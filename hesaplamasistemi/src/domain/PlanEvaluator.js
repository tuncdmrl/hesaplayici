import { PlanPolicy } from '../config/planPolicy.js'
import { Money } from './Money.js'
import { OrganizationFeeSchedule } from './OrganizationFeeSchedule.js'
import { PlanResult, PlanRow } from './PlanResult.js'
import { Violation } from './Violation.js'

/** Ay numarasını 0 tabanlı teslimat offset'ine çevirir. */
function toDeliveryOffset(monthNumber) {
  return Number.isFinite(monthNumber) ? Math.max(0, monthNumber - 1) : monthNumber
}

/**
 * Ham taksit dizisini alıp teslimat ve birikim şartlarını uygular, ay ay
 * tabloyu üretir ve sonucun geçerli olup olmadığına karar verir.
 */
export class PlanEvaluator {
  /**
   * @param {import('./PlanInput.js').PlanInput} input
   * @param {import('./schedule/ScheduleBuilder.js').RawSchedule} schedule
   * @param {number} plannedDeliveryMonth 0 tabanlı teslimat offset'i
   * @param {Violation[]} carriedViolations
   */
  evaluate(input, schedule, plannedDeliveryMonth, carriedViolations = []) {
    const maxTerm = input.maxTermMonths

    const requestedTerm = Math.max(
      PlanPolicy.minDeliveryMonth,
      schedule.payoffMonth,
      input.isInstallmentMode ? 0 : plannedDeliveryMonth,
    )
    const term = Math.min(requestedTerm, maxTerm)

    const stats = this._installmentStats(schedule.payments)
    const { rows, accumulationMonth, organization } = this._buildRows(
      input,
      schedule.payments,
      term,
      plannedDeliveryMonth,
    )

    const durationRequirementMonth = this._durationRequirementMonth(term, input)
    const earliestEligibleDeliveryMonth = Math.max(
      PlanPolicy.minDeliveryMonth,
      toDeliveryOffset(durationRequirementMonth),
      toDeliveryOffset(accumulationMonth),
    )

    const violations = [
      ...carriedViolations,
      ...this._collectViolations({
        input,
        schedule,
        stats,
        term,
        accumulationMonth,
        durationRequirementMonth,
        earliestEligibleDeliveryMonth,
        plannedDeliveryMonth,
        maxTerm,
      }),
    ]

    const warnings = []
    if (schedule.capApplied) {
      warnings.push('Seçtiğiniz dönemsel artış, uygulanabilir taksit seviyesinde sınırlandı.')
    }
    if (schedule.tailRebalanced) {
      warnings.push(
        'Kalan tutar, vade gereksiz uzamasın ve taksitler dengeli kalsın diye son aylara dağıtıldı.',
      )
    }

    const postDeliveryInstallment =
      plannedDeliveryMonth + 1 < schedule.payments.length
        ? schedule.payments[plannedDeliveryMonth + 1]
        : null

    return new PlanResult({
      input,
      violations,
      warnings,
      term,
      payoffMonth: schedule.payoffMonth,
      accumulationMonth,
      durationRequirementMonth,
      earliestEligibleDeliveryMonth,
      plannedDeliveryMonth,
      deliveryThreshold: this.deliveryThreshold(input.targetAmount),
      organizationFee: organization.total,
      totalWithKnownFees: input.targetAmount + organization.total,
      rows,
      firstInstallment: stats.first,
      minInstallment: stats.min,
      maxInstallment: stats.max,
      postDeliveryInstallment,
      capApplied: schedule.capApplied,
      tailRebalanced: schedule.tailRebalanced,
    })
  }

  /** Teslimat için biriktirilmesi gereken tutar (hedef tutarın %45'i). */
  deliveryThreshold(targetAmount) {
    return Money.ceilDiv(targetAmount * PlanPolicy.deliveryThresholdBps, 10_000)
  }

  /** Hesaplama yapılamayan girdiler için boş sonuç. */
  invalidResult(input, violations) {
    const organization = new OrganizationFeeSchedule(Math.max(0, input.targetAmount))
    return new PlanResult({
      input,
      violations,
      plannedDeliveryMonth: input.isInstallmentMode
        ? PlanPolicy.minDeliveryMonth
        : (input.desiredDeliveryMonth ?? PlanPolicy.minDeliveryMonth),
      earliestEligibleDeliveryMonth: PlanPolicy.minDeliveryMonth,
      accumulationMonth: Number.POSITIVE_INFINITY,
      deliveryThreshold: input.targetAmount > 0 ? this.deliveryThreshold(input.targetAmount) : 0,
      organizationFee: organization.total,
      totalWithKnownFees: Math.max(0, input.targetAmount) + organization.total,
    })
  }

  _installmentStats(payments) {
    const positives = payments.filter((amount) => amount > 0)
    if (positives.length === 0) return { min: 0, max: 0, first: 0 }
    return { min: Math.min(...positives), max: Math.max(...positives), first: positives[0] }
  }

  /**
   * Vade şartı: teslimat, vadenin en az %45'i tamamlanmadan gerçekleşemez.
   * Peşinat oranı arttıkça bu şart orantılı olarak hafifler.
   */
  _durationRequirementMonth(term, input) {
    return Money.ceilDiv(
      BigInt(term) * BigInt(PlanPolicy.deliveryThresholdBps) * BigInt(input.financedAmount),
      10_000n * BigInt(input.targetAmount),
    )
  }

  _buildRows(input, payments, term, plannedDeliveryMonth) {
    const organization = new OrganizationFeeSchedule(input.targetAmount)
    const threshold = this.deliveryThreshold(input.targetAmount)

    let cumulative = input.downPayment
    let accumulationMonth = cumulative >= threshold ? 0 : Number.POSITIVE_INFINITY

    const rows = [
      new PlanRow({
        month: 0,
        financingPayment: input.downPayment,
        organizationPayment: 0,
        totalPayment: input.downPayment,
        cumulativePaid: input.downPayment,
        remainingFinancing: input.financedAmount,
        isDeliveryMonth: false,
      }),
    ]

    const lastMonth = Math.max(term, plannedDeliveryMonth + 1)

    for (let month = 1; month <= lastMonth; month += 1) {
      const financingPayment = payments[month - 1] ?? 0
      const organizationPayment = organization.paymentAt(month)
      cumulative += financingPayment

      if (!Number.isFinite(accumulationMonth) && cumulative >= threshold) {
        accumulationMonth = month
      }

      rows.push(
        new PlanRow({
          month,
          financingPayment,
          organizationPayment,
          totalPayment: financingPayment + organizationPayment,
          cumulativePaid: cumulative,
          remainingFinancing: Math.max(0, input.targetAmount - cumulative),
          isDeliveryMonth: month === plannedDeliveryMonth + 1,
        }),
      )
    }

    return { rows, accumulationMonth, organization }
  }

  _collectViolations(context) {
    const {
      input,
      schedule,
      stats,
      term,
      accumulationMonth,
      durationRequirementMonth,
      earliestEligibleDeliveryMonth,
      plannedDeliveryMonth,
      maxTerm,
    } = context

    const violations = []

    if (!schedule.wholeLiraValid) {
      violations.push(
        Violation.invalidInput(
          'Bakiye tam TL taksitlerle kapatılamıyor. Hedef tutar ile peşinatın kuruş hanelerini eşitleyin.',
        ),
      )
    }

    if (!schedule.fullyPaid) {
      violations.push(
        Violation.termLimit(
          `${input.asset.label} için azami ${maxTerm} ay içinde finansman tamamlanmıyor.`,
        ),
      )
    }

    if (!schedule.policyValid) {
      violations.push(
        Violation.policyNotFeasible(
          'Seçtiğiniz teslimat sonrası ödeme tercihi, taksit sınırları içinde uygulanamıyor.',
        ),
      )
    }

    const ratioAcceptable =
      stats.min === 0 || stats.max <= PlanPolicy.maxInstallmentMultiple * stats.min
    if (!ratioAcceptable) {
      violations.push(
        Violation.installmentRatio(
          'Seçilen taksit değişimiyle uygulanabilir bir ödeme dağılımı oluşmuyor.',
        ),
      )
    }

    if (input.isInstallmentMode) {
      if (earliestEligibleDeliveryMonth > term) {
        violations.push(
          Violation.duration('Teslimat şartları ödeme planı süresi içinde tamamlanmıyor.'),
        )
      }
      return violations
    }

    if (toDeliveryOffset(accumulationMonth) > plannedDeliveryMonth) {
      violations.push(
        Violation.accumulation('Seçtiğiniz teslimat tarihinde gerekli birikim oluşmuyor.'),
      )
    }

    if (toDeliveryOffset(durationRequirementMonth) > plannedDeliveryMonth) {
      violations.push(
        Violation.duration('Seçtiğiniz teslimat tarihi ödeme planına göre çok erken kalıyor.'),
      )
    }

    return violations
  }
}

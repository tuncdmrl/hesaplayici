import { PlanPolicy } from '../../config/planPolicy.js'
import { InstallmentNormalizer } from './InstallmentNormalizer.js'

/**
 * Bir kurgudan çıkan ham taksit dizisi ve o dizinin kural uyumu.
 * Henüz teslimat/birikim şartları değerlendirilmemiştir.
 */
export class RawSchedule {
  constructor({
    payments,
    payoffMonth,
    fullyPaid,
    capApplied = false,
    tailRebalanced = false,
    policyValid = true,
    wholeLiraValid = true,
  }) {
    this.payments = payments
    this.payoffMonth = payoffMonth
    this.fullyPaid = fullyPaid
    this.capApplied = capApplied
    this.tailRebalanced = tailRebalanced
    this.policyValid = policyValid
    this.wholeLiraValid = wholeLiraValid
    Object.freeze(this)
  }

  static empty() {
    return new RawSchedule({
      payments: [],
      payoffMonth: 0,
      fullyPaid: false,
      policyValid: false,
    })
  }

  amountAt(month) {
    return this.payments[month - 1] ?? 0
  }
}

export class ScheduleBuilder {
  // eslint-disable-next-line no-unused-vars
  build(input, context) {
    throw new Error('build uygulanmalı')
  }
}

/**
 * "Aylık taksite göre" modu: kullanıcı ilk taksidi verir, motor bakiyeyi
 * kapatana kadar seçilen desene göre taksit üretir.
 */
export class InstallmentModeScheduleBuilder extends ScheduleBuilder {
  /**
   * @param {import('../PlanInput.js').PlanInput} input
   * @param {number|undefined} deliveryMonth Desen teslimat ayına bağlıysa gerekir.
   */
  build(input, deliveryMonth) {
    const financed = input.financedAmount
    const maxTerm = input.maxTermMonths
    const payments = []

    let remaining = financed
    let capApplied = false
    let lastPaymentTruncated = false

    for (let month = 1; month <= maxTerm && remaining > 0; month += 1) {
      const step = input.pattern.amountAt(input.initialInstallment, month, deliveryMonth)
      capApplied = capApplied || step.capped

      const payment = Math.min(step.amount, remaining)
      lastPaymentTruncated = payment < step.amount
      payments.push(payment)
      remaining -= payment
    }

    if (remaining > 0) {
      const normalized = InstallmentNormalizer.toWholeLira(payments)
      return new RawSchedule({
        payments: normalized.payments,
        payoffMonth: maxTerm,
        fullyPaid: false,
        capApplied,
        wholeLiraValid: normalized.valid,
      })
    }

    const normalized = InstallmentNormalizer.toWholeLira(payments, financed)
    const merged = normalized.valid
      ? InstallmentNormalizer.mergeShortTail(normalized.payments, lastPaymentTruncated)
      : { payments: normalized.payments, changed: false }

    // "Teslimattan sonra artır" seçildiyse planın teslimattan sonra en az bir
    // taksidi kalmalıdır; aksi hâlde artış hiç uygulanmamış olur.
    const policyValid =
      !input.pattern.needsDeliveryMonth ||
      (deliveryMonth !== undefined && merged.payments.length > deliveryMonth + 1)

    return new RawSchedule({
      payments: merged.payments,
      payoffMonth: merged.payments.length,
      fullyPaid: true,
      capApplied,
      tailRebalanced: normalized.tailRebalanced || merged.changed,
      policyValid,
      wholeLiraValid: normalized.valid,
    })
  }
}

/**
 * "Teslimat tarihine göre" modu: teslimata kadar sabit bir taksit ödenir,
 * teslimattan sonra seçilen tercih devreye girer.
 */
export class DeliveryModeScheduleBuilder extends ScheduleBuilder {
  /**
   * @param {import('../PlanInput.js').PlanInput} input
   * @param {number} initialInstallment Teslimata kadarki aylık taksit (kuruş).
   */
  build(input, initialInstallment) {
    const preDeliveryMonths = input.desiredDeliveryMonth + 1

    return input.afterDelivery.fixesTotalTerm
      ? this._buildForTargetTerm(input, initialInstallment, preDeliveryMonths)
      : this._buildForPolicy(input, initialInstallment, preDeliveryMonths)
  }

  _buildForTargetTerm(input, initialInstallment, preDeliveryMonths) {
    const financed = input.financedAmount
    const totalTerm = input.afterDelivery.totalTerm

    if (totalTerm <= preDeliveryMonths || totalTerm > input.maxTermMonths) {
      return RawSchedule.empty()
    }

    const payments = []
    let remaining = financed

    for (let month = 1; month <= preDeliveryMonths; month += 1) {
      const payment = Math.min(initialInstallment, remaining)
      payments.push(payment)
      remaining -= payment
    }

    // Bakiye teslimattan önce bittiyse seçilen toplam vade tutturulamaz.
    if (remaining <= 0) {
      let payoffMonth = 0
      for (let index = payments.length - 1; index >= 0; index -= 1) {
        if (payments[index] > 0) {
          payoffMonth = index + 1
          break
        }
      }
      const normalized = InstallmentNormalizer.toWholeLira(payments, financed)
      return new RawSchedule({
        payments: normalized.payments,
        payoffMonth,
        fullyPaid: true,
        tailRebalanced: normalized.tailRebalanced,
        policyValid: false,
        wholeLiraValid: normalized.valid,
      })
    }

    const afterDelivery = InstallmentNormalizer.distribute(remaining, totalTerm - preDeliveryMonths)
    const lowest = Math.min(...afterDelivery)
    const highest = Math.max(...afterDelivery)
    const policyValid =
      lowest >= initialInstallment &&
      highest <= initialInstallment * PlanPolicy.maxInstallmentMultiple

    payments.push(...afterDelivery)
    const normalized = InstallmentNormalizer.toWholeLira(payments, financed)

    return new RawSchedule({
      payments: normalized.payments,
      payoffMonth: totalTerm,
      fullyPaid: true,
      tailRebalanced: normalized.tailRebalanced,
      policyValid,
      wholeLiraValid: normalized.valid,
    })
  }

  _buildForPolicy(input, initialInstallment, preDeliveryMonths) {
    const financed = input.financedAmount
    const maxTerm = input.maxTermMonths
    const payments = []

    let remaining = financed
    let capApplied = false
    let policyValid = true

    for (let month = 1; month <= maxTerm && remaining > 0; month += 1) {
      let scheduled = initialInstallment

      if (month > preDeliveryMonths) {
        const step = input.afterDelivery.amountAfter(initialInstallment, month - preDeliveryMonths)
        scheduled = step.amount
        capApplied = capApplied || step.capped
        policyValid = policyValid && step.valid
      }

      const payment = Math.min(scheduled, remaining)
      payments.push(payment)
      remaining -= payment
    }

    if (remaining > 0) {
      const normalized = InstallmentNormalizer.toWholeLira(payments)
      return new RawSchedule({
        payments: normalized.payments,
        payoffMonth: maxTerm,
        fullyPaid: false,
        capApplied,
        policyValid,
        wholeLiraValid: normalized.valid,
      })
    }

    // Teslimattan sonra hiç taksit kalmadıysa seçilen tercih uygulanamamıştır.
    if (payments.length <= preDeliveryMonths && input.afterDelivery.type !== 'same') {
      policyValid = false
    }

    const normalized = InstallmentNormalizer.toWholeLira(payments, financed)

    return new RawSchedule({
      payments: normalized.payments,
      payoffMonth: normalized.payments.length,
      fullyPaid: true,
      capApplied,
      tailRebalanced: normalized.tailRebalanced,
      policyValid,
      wholeLiraValid: normalized.valid,
    })
  }
}

import { PlanPolicy } from '../config/planPolicy.js'
import { Money } from './Money.js'
import { PlanEvaluator } from './PlanEvaluator.js'
import { Violation } from './Violation.js'
import {
  DeliveryModeScheduleBuilder,
  InstallmentModeScheduleBuilder,
} from './schedule/ScheduleBuilder.js'

/**
 * Hesaplama motorunun dış yüzü.
 *
 * Arayüz yalnızca bu sınıfı tanır: bir `PlanInput` verir, bir `PlanResult` alır.
 * İçeride mod başına farklı bir strateji çalışır:
 *
 *  - Aylık taksite göre → taksit bilinir, teslimat ayı aranır.
 *  - Teslimat tarihine göre → teslimat bilinir, en düşük uygun taksit ikili
 *    arama ile bulunur.
 */
export class PlanCalculator {
  constructor() {
    this.evaluator = new PlanEvaluator()
    this.installmentBuilder = new InstallmentModeScheduleBuilder()
    this.deliveryBuilder = new DeliveryModeScheduleBuilder()
  }

  /** @param {import('./PlanInput.js').PlanInput} input */
  calculate(input) {
    return input.isInstallmentMode
      ? this.calculateFromInstallment(input)
      : this.calculateFromDeliveryDate(input)
  }

  // ---------------------------------------------------------------- taksit modu

  calculateFromInstallment(input) {
    const violations = [...input.validateAmounts()]

    if (!Money.isPositiveAmount(input.initialInstallment)) {
      violations.push(Violation.invalidInput('Aylık ayırabileceğiniz finansman taksidini girin.'))
    }
    violations.push(...input.pattern.validate())

    if (violations.length > 0) return this.evaluator.invalidResult(input, violations)

    // "Teslimattan sonra artır" deseninde taksit tutarı teslimat ayına bağlıdır;
    // en erken uygulanabilir teslimat ayını tarayarak buluruz.
    if (input.pattern.needsDeliveryMonth) {
      let lastResult = null
      for (
        let deliveryMonth = PlanPolicy.minDeliveryMonth;
        deliveryMonth <= input.maxTermMonths - 1;
        deliveryMonth += 1
      ) {
        const schedule = this.installmentBuilder.build(input, deliveryMonth)
        const result = this.evaluator.evaluate(input, schedule, deliveryMonth)
        lastResult = result
        if (result.valid && result.earliestEligibleDeliveryMonth <= deliveryMonth) return result
      }
      return (
        lastResult ??
        this.evaluator.invalidResult(input, [
          Violation.policyNotFeasible('Teslimat sonrası artışla uygulanabilir bir plan oluşmuyor.'),
        ])
      )
    }

    const schedule = this.installmentBuilder.build(input)
    const probe = this.evaluator.evaluate(input, schedule, PlanPolicy.minDeliveryMonth)
    if (!probe.valid) return probe

    // Plan geçerliyse teslimatı, şartların sağlandığı en erken aya çekeriz.
    return this.evaluator.evaluate(input, schedule, probe.earliestEligibleDeliveryMonth)
  }

  // -------------------------------------------------------------- teslimat modu

  calculateFromDeliveryDate(input) {
    const violations = [...input.validateAmounts(), ...input.afterDelivery.validate(input)]

    if (!Number.isInteger(input.desiredDeliveryMonth) || input.desiredDeliveryMonth < PlanPolicy.minDeliveryMonth) {
      violations.push(
        Violation.deliveryTooEarly(
          'Seçtiğiniz teslimat tarihi çok erken. Lütfen daha ileri bir tarih seçin.',
        ),
      )
    } else if (input.desiredDeliveryMonth > input.maxTermMonths) {
      violations.push(
        Violation.invalidInput(`Teslimat ayı en fazla ${input.maxTermMonths} olabilir.`),
      )
    }

    if (violations.length > 0) return this.evaluator.invalidResult(input, violations)

    return this._findLowestFeasibleInstallment(input)
  }

  /** Seçilen teslimat tarihini tutturan en düşük aylık taksidi ikili aramayla bulur. */
  _findLowestFeasibleInstallment(input) {
    const financed = input.financedAmount
    const policy = input.afterDelivery

    let lowerBound = PlanPolicy.installmentStep
    let upperBound = financed

    if (policy.type === 'fixed') {
      lowerBound = Math.max(
        lowerBound,
        Money.ceilDiv(policy.amount, PlanPolicy.maxInstallmentMultiple),
      )
      upperBound = Math.min(upperBound, policy.amount)
    }

    if (policy.fixesTotalTerm) {
      upperBound = Math.min(upperBound, Math.floor(financed / policy.totalTerm))
    } else if (policy.type !== 'same') {
      upperBound = Math.min(upperBound, Math.floor((financed - 1) / (input.desiredDeliveryMonth + 1)))
    }

    let low = Math.ceil(lowerBound / PlanPolicy.installmentStep)
    let high = Math.floor(upperBound / PlanPolicy.installmentStep)

    if (low > high || high <= 0) {
      return this._evaluateWithInstallment(input, Math.max(1, low) * PlanPolicy.installmentStep)
    }

    const highest = this._evaluateWithInstallment(input, high * PlanPolicy.installmentStep)
    if (!highest.valid) return highest

    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (this._evaluateWithInstallment(input, middle * PlanPolicy.installmentStep).valid) {
        high = middle
      } else {
        low = middle + 1
      }
    }

    return this._evaluateWithInstallment(input, low * PlanPolicy.installmentStep)
  }

  _evaluateWithInstallment(input, installment) {
    const schedule = this.deliveryBuilder.build(input, installment)
    return this.evaluator.evaluate(input, schedule, input.desiredDeliveryMonth)
  }
}

/** Uygulama genelinde paylaşılan tek hesaplayıcı örneği. */
export const planCalculator = new PlanCalculator()

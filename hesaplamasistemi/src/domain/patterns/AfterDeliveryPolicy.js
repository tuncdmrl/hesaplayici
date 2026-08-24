import { getAssetType, PlanPolicy } from '../../config/planPolicy.js'
import { Money } from '../Money.js'
import { Violation } from '../Violation.js'

/**
 * "Teslimat tarihine göre" modunda, teslimattan sonraki taksitlerin nasıl
 * belirleneceğini tanımlayan strateji.
 *
 * Teslimata kadar olan taksit tutarını hesaplama motoru arar; bu sınıflar
 * yalnızca teslimattan **sonraki** davranışı tarif eder.
 */
export class AfterDeliveryPolicy {
  static from(spec) {
    switch (spec?.type) {
      case 'same':
        return new SameAfterDeliveryPolicy()
      case 'oncePercent':
        return new OncePercentAfterDeliveryPolicy(spec.increaseBps)
      case 'fixed':
        return new FixedAmountAfterDeliveryPolicy(spec.amount)
      case 'targetTerm':
        return new TargetTermAfterDeliveryPolicy(spec.totalTerm)
      case 'periodic':
        return new PeriodicAfterDeliveryPolicy(spec.periodMonths, spec.increaseBps)
      default:
        throw new Error(`Tanımsız teslimat sonrası tercih: ${spec?.type}`)
    }
  }

  get type() {
    throw new Error('type uygulanmalı')
  }

  /** Toplam vadeyi kullanıcının belirlediği tek strateji için true. */
  get fixesTotalTerm() {
    return false
  }

  /**
   * @param {number} base Teslimata kadarki aylık taksit (kuruş)
   * @param {number} monthsAfterDelivery 1 tabanlı: teslimattan sonraki kaçıncı ay
   * @returns {{amount:number, capped:boolean, valid:boolean}}
   */
  // eslint-disable-next-line no-unused-vars
  amountAfter(base, monthsAfterDelivery) {
    throw new Error('amountAfter uygulanmalı')
  }

  /** @returns {Violation[]} */
  // eslint-disable-next-line no-unused-vars
  validate(input) {
    return []
  }

  toSpec() {
    return { type: this.type }
  }

  _applySteps(base, steps) {
    const ceiling = base * PlanPolicy.maxInstallmentMultiple
    let amount = base
    let capped = false
    for (let step = 0; step < steps; step += 1) {
      const next = Money.increaseByBps(amount, this.increaseBps)
      if (next >= ceiling) {
        amount = ceiling
        capped = true
        break
      }
      amount = next
    }
    return { amount, capped, valid: true }
  }

  _validateIncrease() {
    if (
      !Number.isSafeInteger(this.increaseBps) ||
      this.increaseBps <= 0 ||
      this.increaseBps > 10_000
    ) {
      return [Violation.invalidInput('Taksit artış oranını 0 ile 100 arasında girin.')]
    }
    return []
  }
}

/** Teslimattan sonra da aynı taksitle devam edilir. */
export class SameAfterDeliveryPolicy extends AfterDeliveryPolicy {
  get type() {
    return 'same'
  }

  amountAfter(base) {
    return { amount: base, capped: false, valid: true }
  }
}

/** Teslimattan sonra taksit bir kez yüzde artar ve sabit kalır. */
export class OncePercentAfterDeliveryPolicy extends AfterDeliveryPolicy {
  constructor(increaseBps) {
    super()
    this.increaseBps = increaseBps
  }

  get type() {
    return 'oncePercent'
  }

  amountAfter(base) {
    const increased = Money.increaseByBps(base, this.increaseBps)
    const ceiling = base * PlanPolicy.maxInstallmentMultiple
    return { amount: Math.min(increased, ceiling), capped: increased >= ceiling, valid: true }
  }

  validate() {
    return this._validateIncrease()
  }

  toSpec() {
    return { type: this.type, increaseBps: this.increaseBps }
  }
}

/** Teslimattan sonraki aylık taksidi kullanıcı belirler. */
export class FixedAmountAfterDeliveryPolicy extends AfterDeliveryPolicy {
  constructor(amount) {
    super()
    this.amount = amount
  }

  get type() {
    return 'fixed'
  }

  amountAfter(base) {
    const ceiling = base * PlanPolicy.maxInstallmentMultiple
    return {
      amount: this.amount,
      capped: false,
      valid: this.amount >= base && this.amount <= ceiling,
    }
  }

  validate() {
    return Money.isPositiveAmount(this.amount)
      ? []
      : [Violation.invalidInput('Teslimat sonrası aylık taksiti girin.')]
  }

  toSpec() {
    return { type: this.type, amount: this.amount }
  }
}

/** Toplam vadeyi kullanıcı seçer; kalan bakiye eşit dağıtılır. */
export class TargetTermAfterDeliveryPolicy extends AfterDeliveryPolicy {
  constructor(totalTerm) {
    super()
    this.totalTerm = totalTerm
  }

  get type() {
    return 'targetTerm'
  }

  get fixesTotalTerm() {
    return true
  }

  amountAfter(base) {
    // Tutar doğrudan bakiyeden dağıtıldığı için burada taban tutar döner.
    return { amount: base, capped: false, valid: true }
  }

  validate(input) {
    const maxTerm = getAssetType(input.assetType).maxTermMonths
    if (
      !Number.isInteger(this.totalTerm) ||
      this.totalTerm <= input.desiredDeliveryMonth + 1 ||
      this.totalTerm > maxTerm
    ) {
      return [
        Violation.invalidInput(
          `Hedef vade teslimat ayından büyük ve en fazla ${maxTerm} ay olmalıdır.`,
        ),
      ]
    }
    return []
  }

  toSpec() {
    return { type: this.type, totalTerm: this.totalTerm }
  }
}

/** Teslimattan sonra 6 veya 12 ayda bir yüzde artış. */
export class PeriodicAfterDeliveryPolicy extends AfterDeliveryPolicy {
  constructor(periodMonths, increaseBps) {
    super()
    this.periodMonths = periodMonths
    this.increaseBps = increaseBps
  }

  get type() {
    return 'periodic'
  }

  amountAfter(base, monthsAfterDelivery) {
    const steps = 1 + Math.floor((monthsAfterDelivery - 1) / this.periodMonths)
    return this._applySteps(base, steps)
  }

  validate() {
    const violations = []
    if (this.periodMonths !== 6 && this.periodMonths !== 12) {
      violations.push(Violation.invalidInput('Artış sıklığı 6 veya 12 ay olabilir.'))
    }
    return [...violations, ...this._validateIncrease()]
  }

  toSpec() {
    return { type: this.type, periodMonths: this.periodMonths, increaseBps: this.increaseBps }
  }
}

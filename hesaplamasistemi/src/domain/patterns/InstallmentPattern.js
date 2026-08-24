import { PlanPolicy } from '../../config/planPolicy.js'
import { Money } from '../Money.js'
import { Violation } from '../Violation.js'

/**
 * "Aylık taksite göre" modunda taksitlerin zaman içinde nasıl değiştiğini
 * tanımlayan strateji.
 *
 * Yeni bir artış biçimi eklemek için bu sınıftan türeyip `amountAt` yazmak ve
 * `InstallmentPattern.from` fabrikasına bir satır eklemek yeterlidir.
 */
export class InstallmentPattern {
  static from(spec) {
    switch (spec?.type) {
      case 'equal':
        return new EqualInstallmentPattern()
      case 'periodic':
        return new PeriodicInstallmentPattern(spec.periodMonths, spec.increaseBps)
      case 'afterDeliveryOnce':
        return new AfterDeliveryOnceInstallmentPattern(spec.increaseBps)
      default:
        throw new Error(`Tanımsız taksit deseni: ${spec?.type}`)
    }
  }

  get type() {
    throw new Error('type uygulanmalı')
  }

  /** Teslimat ayının plan içinde bilinmesi gerekiyorsa true döner. */
  get needsDeliveryMonth() {
    return false
  }

  /**
   * @param {number} base İlk taksit (kuruş)
   * @param {number} month 1 tabanlı ay numarası
   * @param {number|undefined} deliveryMonth Teslimat ayı (0 tabanlı offset)
   * @returns {{amount:number, capped:boolean}}
   */
  // eslint-disable-next-line no-unused-vars
  amountAt(base, month, deliveryMonth) {
    throw new Error('amountAt uygulanmalı')
  }

  /** @returns {Violation[]} */
  validate() {
    return []
  }

  toSpec() {
    return { type: this.type }
  }

  /** Artışları en yüksek taksit tavanına kadar uygular. */
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
    return { amount, capped }
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

/** Her ay aynı taksit. */
export class EqualInstallmentPattern extends InstallmentPattern {
  get type() {
    return 'equal'
  }

  amountAt(base) {
    return { amount: base, capped: false }
  }
}

/** Belirli aralıklarla (6 veya 12 ayda bir) yüzde artış. */
export class PeriodicInstallmentPattern extends InstallmentPattern {
  constructor(periodMonths, increaseBps) {
    super()
    this.periodMonths = periodMonths
    this.increaseBps = increaseBps
  }

  get type() {
    return 'periodic'
  }

  amountAt(base, month) {
    return this._applySteps(base, Math.floor((month - 1) / this.periodMonths))
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

/** Teslimattan sonraki ilk taksitte bir kez artar, sonra sabit devam eder. */
export class AfterDeliveryOnceInstallmentPattern extends InstallmentPattern {
  constructor(increaseBps) {
    super()
    this.increaseBps = increaseBps
  }

  get type() {
    return 'afterDeliveryOnce'
  }

  get needsDeliveryMonth() {
    return true
  }

  amountAt(base, month, deliveryMonth) {
    if (deliveryMonth === undefined || month <= deliveryMonth + 1) {
      return { amount: base, capped: false }
    }
    const increased = Money.increaseByBps(base, this.increaseBps)
    const ceiling = base * PlanPolicy.maxInstallmentMultiple
    return { amount: Math.min(increased, ceiling), capped: increased >= ceiling }
  }

  validate() {
    return this._validateIncrease()
  }

  toSpec() {
    return { type: this.type, increaseBps: this.increaseBps }
  }
}

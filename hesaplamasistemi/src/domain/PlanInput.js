import { getAssetType } from '../config/planPolicy.js'
import { MonthKey } from './MonthKey.js'
import { Money } from './Money.js'
import { Violation } from './Violation.js'
import { InstallmentPattern } from './patterns/InstallmentPattern.js'
import { AfterDeliveryPolicy } from './patterns/AfterDeliveryPolicy.js'

/**
 * Hesaplamaya giren, doğrulanmış ve değiştirilemez kullanıcı tercihleri.
 *
 * İki mod vardır:
 *  - `installment`: aylık taksit bellidir, teslimat ayı hesaplanır.
 *  - `delivery`:    teslimat ayı bellidir, gereken aylık taksit hesaplanır.
 */
export class PlanInput {
  constructor(config) {
    this.mode = config.mode
    this.assetType = config.assetType
    this.targetAmount = config.targetAmount
    this.downPayment = config.downPayment
    this.planStartMonth = MonthKey.normalize(config.planStartMonth)

    if (this.mode === 'installment') {
      this.initialInstallment = config.initialInstallment
      this.pattern =
        config.pattern instanceof InstallmentPattern
          ? config.pattern
          : InstallmentPattern.from(config.pattern)
    } else {
      this.desiredDeliveryMonth = config.desiredDeliveryMonth
      this.afterDelivery =
        config.afterDelivery instanceof AfterDeliveryPolicy
          ? config.afterDelivery
          : AfterDeliveryPolicy.from(config.afterDelivery)
    }

    Object.freeze(this)
  }

  get asset() {
    return getAssetType(this.assetType)
  }

  get maxTermMonths() {
    return this.asset.maxTermMonths
  }

  /** Peşinat düşüldükten sonra taksitlerle kapatılacak bakiye. */
  get financedAmount() {
    return this.targetAmount - this.downPayment
  }

  get isInstallmentMode() {
    return this.mode === 'installment'
  }

  /** Aynı türde, alanları güncellenmiş yeni bir girdi üretir. */
  withChanges(changes) {
    return new PlanInput({ ...this.toObject(), ...changes })
  }

  toObject() {
    const base = {
      mode: this.mode,
      assetType: this.assetType,
      targetAmount: this.targetAmount,
      downPayment: this.downPayment,
      planStartMonth: this.planStartMonth,
    }
    return this.isInstallmentMode
      ? { ...base, initialInstallment: this.initialInstallment, pattern: this.pattern }
      : { ...base, desiredDeliveryMonth: this.desiredDeliveryMonth, afterDelivery: this.afterDelivery }
  }

  /** Serileştirilebilir hâl (paylaşım bağlantısı, kayıt vb. için). */
  toSpec() {
    const object = this.toObject()
    return {
      ...object,
      pattern: this.pattern?.toSpec(),
      afterDelivery: this.afterDelivery?.toSpec(),
    }
  }

  /** Tutarlarla ilgili, her iki modda da geçerli olan kurallar. */
  validateAmounts() {
    const violations = []

    if (!Money.isPositiveAmount(this.targetAmount)) {
      violations.push(Violation.invalidInput('Hedef finansman tutarını girin.'))
    }

    if (!Number.isSafeInteger(this.downPayment) || this.downPayment < 0) {
      violations.push(Violation.invalidInput('Peşinat 0 TL veya daha yüksek olmalıdır.'))
    } else if (Money.isPositiveAmount(this.targetAmount) && this.downPayment >= this.targetAmount) {
      violations.push(Violation.invalidInput('Peşinat, hedef finansman tutarından düşük olmalıdır.'))
    }

    return violations
  }
}

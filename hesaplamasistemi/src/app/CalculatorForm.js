import { getAssetType, PlanPolicy } from '../config/planPolicy.js'
import { MoneyInput, formatPercent, parsePercent } from '../domain/Money.js'
import { MonthKey } from '../domain/MonthKey.js'
import { PlanInput } from '../domain/PlanInput.js'

/**
 * Formdaki ham metinler ile hesaplama motorunun beklediği `PlanInput` arasındaki
 * çeviri katmanı.
 *
 * Kullanıcı yazarken hiçbir şey kuruşa çevrilmez; yalnızca "Hesapla" anında
 * dönüştürme ve alan bazlı doğrulama yapılır.
 */
export class CalculatorForm {
  constructor(values) {
    this.values = Object.freeze({ ...values })
  }

  static initial() {
    return new CalculatorForm({
      assetType: 'home',
      targetAmount: '',
      downPayment: '0',
      planStartMonth: MonthKey.current(),

      // Aylık taksite göre
      initialInstallment: '',
      installmentPattern: 'equal',
      installmentIncreaseRate: '10',

      // Teslimat tarihine göre
      desiredDeliveryMonth: '12',
      afterType: 'same',
      afterIncreaseRate: '10',
      afterFixedAmount: '',
      afterTargetTerm: '60',
      afterPeriod: '6',
    })
  }

  /** Kullanıcıya örnek bir senaryo göstermek için. */
  static example() {
    return CalculatorForm.initial().with({
      assetType: 'home',
      targetAmount: '1.500.000',
      downPayment: '150.000',
      desiredDeliveryMonth: '18',
      initialInstallment: '25.000',
      afterType: 'same',
      installmentPattern: 'equal',
    })
  }

  get(name) {
    return this.values[name]
  }

  with(patch) {
    return new CalculatorForm({ ...this.values, ...patch })
  }

  /** Ürün değişince vade sınırını aşan ay değerlerini kırpar. */
  withAssetType(assetType) {
    const maxTerm = getAssetType(assetType).maxTermMonths
    const clamp = (text) => {
      const value = Number(text)
      return Number.isFinite(value) && value > maxTerm ? String(maxTerm) : text
    }
    return this.with({
      assetType,
      desiredDeliveryMonth: clamp(this.values.desiredDeliveryMonth),
      afterTargetTerm: clamp(this.values.afterTargetTerm),
    })
  }

  get maxTermMonths() {
    return getAssetType(this.values.assetType).maxTermMonths
  }

  /**
   * @param {'delivery'|'installment'} mode
   * @returns {{input: PlanInput|null, errors: Record<string,string>}}
   */
  toPlanInput(mode) {
    const values = this.values
    const errors = {}

    const targetAmount = MoneyInput.parse(values.targetAmount)
    const downPayment = values.downPayment.trim() === '' ? 0 : MoneyInput.parse(values.downPayment)

    if (targetAmount === null || targetAmount <= 0) {
      errors.targetAmount = 'Hedef tutarı girin.'
    }
    if (downPayment === null || downPayment < 0) {
      errors.downPayment = 'Geçerli bir peşinat girin; peşinatınız yoksa 0 yazabilirsiniz.'
    } else if (targetAmount !== null && downPayment >= targetAmount) {
      errors.downPayment = 'Peşinat, hedef tutardan düşük olmalıdır.'
    }

    if (targetAmount === null || targetAmount <= 0 || downPayment === null) {
      return { input: null, errors }
    }

    const base = {
      assetType: values.assetType,
      targetAmount,
      downPayment,
      planStartMonth: values.planStartMonth,
    }

    return mode === 'installment'
      ? this.#buildInstallmentInput(base, errors)
      : this.#buildDeliveryInput(base, errors)
  }

  #buildInstallmentInput(base, errors) {
    const values = this.values
    const initialInstallment = MoneyInput.parse(values.initialInstallment)
    const increaseBps = parsePercent(values.installmentIncreaseRate)

    if (initialInstallment === null || initialInstallment <= 0) {
      errors.initialInstallment = 'Aylık ayırabileceğiniz tutarı girin.'
    }
    if (values.installmentPattern !== 'equal' && (increaseBps === null || increaseBps <= 0)) {
      errors.installmentIncreaseRate = 'Artış oranını 0’dan büyük girin.'
    }
    if (Object.keys(errors).length > 0 || initialInstallment === null) {
      return { input: null, errors }
    }

    const pattern =
      values.installmentPattern === 'equal'
        ? { type: 'equal' }
        : values.installmentPattern === 'afterDelivery'
          ? { type: 'afterDeliveryOnce', increaseBps }
          : {
              type: 'periodic',
              periodMonths: values.installmentPattern === 'six' ? 6 : 12,
              increaseBps,
            }

    return {
      input: new PlanInput({ ...base, mode: 'installment', initialInstallment, pattern }),
      errors,
    }
  }

  #buildDeliveryInput(base, errors) {
    const values = this.values
    const maxTerm = this.maxTermMonths
    const desiredDeliveryMonth = Number(values.desiredDeliveryMonth)

    if (
      !Number.isInteger(desiredDeliveryMonth) ||
      desiredDeliveryMonth < PlanPolicy.minDeliveryMonth ||
      desiredDeliveryMonth > maxTerm
    ) {
      errors.desiredDeliveryMonth = `Teslimat ayı ${PlanPolicy.minDeliveryMonth} ile ${maxTerm} arasında olmalıdır.`
    }

    let afterDelivery
    if (values.afterType === 'same') {
      afterDelivery = { type: 'same' }
    } else if (values.afterType === 'fixed') {
      const amount = MoneyInput.parse(values.afterFixedAmount)
      if (amount === null || amount <= 0) {
        errors.afterFixedAmount = 'Teslimattan sonra ödemek istediğiniz aylık taksiti girin.'
      }
      afterDelivery = { type: 'fixed', amount: amount ?? 0 }
    } else if (values.afterType === 'targetTerm') {
      const totalTerm = Number(values.afterTargetTerm)
      if (
        !Number.isInteger(totalTerm) ||
        totalTerm <= desiredDeliveryMonth + 1 ||
        totalTerm > maxTerm
      ) {
        errors.afterTargetTerm = `Toplam vade, teslimattan sonra en az bir taksit bırakmalı ve en fazla ${maxTerm} ay olmalıdır.`
      }
      afterDelivery = { type: 'targetTerm', totalTerm }
    } else {
      const increaseBps = parsePercent(values.afterIncreaseRate)
      if (increaseBps === null || increaseBps <= 0) {
        errors.afterIncreaseRate = 'Artış oranını 0’dan büyük girin.'
      }
      afterDelivery =
        values.afterType === 'oncePercent'
          ? { type: 'oncePercent', increaseBps: increaseBps ?? 0 }
          : {
              type: 'periodic',
              periodMonths: Number(values.afterPeriod),
              increaseBps: increaseBps ?? 0,
            }
    }

    if (Object.keys(errors).length > 0) return { input: null, errors }

    return {
      input: new PlanInput({ ...base, mode: 'delivery', desiredDeliveryMonth, afterDelivery }),
      errors,
    }
  }

  /** Bir öneri uygulandığında formu o girdiye göre yeniden doldurur. */
  static fromPlanInput(input) {
    const form = CalculatorForm.initial().with({
      assetType: input.assetType,
      targetAmount: MoneyInput.toText(input.targetAmount),
      downPayment: MoneyInput.toText(input.downPayment),
      planStartMonth: input.planStartMonth,
    })

    if (input.isInstallmentMode) {
      const pattern = input.pattern
      const patternKey =
        pattern.type === 'equal'
          ? 'equal'
          : pattern.type === 'afterDeliveryOnce'
            ? 'afterDelivery'
            : pattern.periodMonths === 6
              ? 'six'
              : 'yearly'

      return form.with({
        initialInstallment: MoneyInput.toText(input.initialInstallment),
        installmentPattern: patternKey,
        installmentIncreaseRate: pattern.increaseBps ? formatPercent(pattern.increaseBps) : '10',
      })
    }

    const policy = input.afterDelivery
    return form.with({
      desiredDeliveryMonth: String(input.desiredDeliveryMonth),
      afterType: policy.type,
      afterIncreaseRate: policy.increaseBps ? formatPercent(policy.increaseBps) : '10',
      afterFixedAmount: policy.type === 'fixed' ? MoneyInput.toText(policy.amount) : '',
      afterTargetTerm: policy.type === 'targetTerm' ? String(policy.totalTerm) : '60',
      afterPeriod: policy.periodMonths ? String(policy.periodMonths) : '6',
    })
  }
}

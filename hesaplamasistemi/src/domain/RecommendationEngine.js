import { PlanPolicy } from '../config/planPolicy.js'
import { MoneyFormatter } from './Money.js'
import { MonthKey } from './MonthKey.js'
import { Recommendation } from './PlanResult.js'
import { SameAfterDeliveryPolicy, FixedAmountAfterDeliveryPolicy } from './patterns/AfterDeliveryPolicy.js'

const STEP = PlanPolicy.installmentStep
const MAX_SUGGESTIONS = 3
/** Teslimat erteleme önerisi ararken taranacak en fazla ay sayısı. */
const POSTPONE_SCAN_LIMIT = 60

/**
 * Plan oluşmadığında "şunu değiştirirsen olur" diyebilmek için, tek bir
 * değişkeni ikili aramayla en küçük geçerli değerine çeker ve sonucu yeniden
 * hesaplayarak doğrular. Önerilen her seçenek gerçekten hesaplanmış ve geçerli
 * çıkmış bir plandır.
 */
export class RecommendationEngine {
  constructor(calculator) {
    this.calculator = calculator
  }

  /** @returns {Recommendation[]} */
  suggest(input) {
    return input.isInstallmentMode
      ? this._forInstallmentMode(input)
      : this._forDeliveryMode(input)
  }

  _calculate(input) {
    return this.calculator.calculate(input)
  }

  /**
   * `changes(value)` ile üretilen girdiler için, [low, high] aralığında geçerli
   * sonuç veren en küçük değeri bulur. Bulunamazsa null döner.
   */
  _findSmallestValid(low, high, buildInput) {
    if (low > high) return null
    if (!this._calculate(buildInput(high)).valid) return null

    let lowerBound = low
    let upperBound = high
    while (lowerBound < upperBound) {
      const middle = Math.floor((lowerBound + upperBound) / 2)
      if (this._calculate(buildInput(middle)).valid) {
        upperBound = middle
      } else {
        lowerBound = middle + 1
      }
    }
    return lowerBound
  }

  _forInstallmentMode(input) {
    const suggestions = []

    // 1) Aylık taksidi en az ne kadar artırmak gerekiyor?
    const lowestInstallmentUnits = this._findSmallestValid(
      Math.floor(input.initialInstallment / STEP) + 1,
      Math.max(
        Math.floor(input.initialInstallment / STEP) + 1,
        Math.ceil(input.financedAmount / STEP),
      ),
      (units) => input.withChanges({ initialInstallment: units * STEP }),
    )

    if (lowestInstallmentUnits !== null) {
      const amount = lowestInstallmentUnits * STEP
      const candidate = input.withChanges({ initialInstallment: amount })
      const result = this._calculate(candidate)
      if (result.valid) {
        suggestions.push(
          new Recommendation({
            code: 'INCREASE_INSTALLMENT',
            label: 'En az taksit değişimi',
            title: `Aylık taksiti ${MoneyFormatter.currencyAuto(amount)} yapın`,
            explanation: `${result.term} ayda tamamlanır; tahmini teslimat ${MonthKey.label(candidate.planStartMonth, result.plannedDeliveryMonth)} olur.`,
            input: candidate,
            result,
          }),
        )
      }
    }

    // 2) Peşinatı en az ne kadar artırmak gerekiyor?
    suggestions.push(...this._downPaymentSuggestion(input))

    // 3) Mevcut bütçeyle ulaşılabilecek en yüksek hedef tutar.
    const reachableTarget = this._findLargestValidTarget(input)
    if (reachableTarget) {
      const result = this._calculate(reachableTarget)
      suggestions.push(
        new Recommendation({
          code: 'REDUCE_TARGET',
          label: 'Bütçenize en yakın hedef',
          title: `Hedef tutarı ${MoneyFormatter.currencyAuto(reachableTarget.targetAmount)} yapın`,
          explanation: `${result.term} ay vadeyle tahmini teslimat ${MonthKey.label(reachableTarget.planStartMonth, result.plannedDeliveryMonth)} olur.`,
          input: reachableTarget,
          result,
        }),
      )
    }

    return this._dedupe(suggestions)
  }

  _forDeliveryMode(input) {
    const suggestions = []

    // 1) Teslimat sonrası taksidi kullanıcı belirlediyse, vadeye sığan en düşük tutar.
    if (input.afterDelivery.type === 'fixed') {
      const amountUnits = this._findSmallestValid(
        Math.floor(input.afterDelivery.amount / STEP) + 1,
        Math.ceil(input.financedAmount / STEP),
        (units) =>
          input.withChanges({
            afterDelivery: new FixedAmountAfterDeliveryPolicy(units * STEP),
          }),
      )

      if (amountUnits !== null) {
        const amount = amountUnits * STEP
        const candidate = input.withChanges({
          afterDelivery: new FixedAmountAfterDeliveryPolicy(amount),
        })
        const result = this._calculate(candidate)
        if (result.valid) {
          suggestions.push(
            new Recommendation({
              code: 'INCREASE_POST_DELIVERY',
              label: 'Vade sınırına uygun',
              title: `Teslimat sonrası taksiti ${MoneyFormatter.currencyAuto(amount)} yapın`,
              explanation: `Plan ${result.term} ayda tamamlanır ve teslimat ${result.deliveryLabel} tarihinde kalır.`,
              input: candidate,
              result,
            }),
          )
        }
      }
    }

    // 2) En sade seçenek: taksidi sistemin hesaplamasına bırak.
    if (input.afterDelivery.type !== 'same') {
      const candidate = input.withChanges({ afterDelivery: new SameAfterDeliveryPolicy() })
      const result = this._calculate(candidate)
      if (result.valid) {
        suggestions.push(
          new Recommendation({
            code: 'USE_AUTO_INSTALLMENT',
            label: 'En sade seçenek',
            title: 'Taksidi sistemin eşit hesaplamasına bırakın',
            explanation: `${MoneyFormatter.currencyAuto(result.firstInstallment)} taksitle ${result.term} ayda tamamlanır.`,
            input: candidate,
            result,
          }),
        )
      }
    }

    // 3) Aynı tercihlerle çalışan en yakın teslimat tarihi.
    const scanEnd = Math.min(input.maxTermMonths, input.desiredDeliveryMonth + POSTPONE_SCAN_LIMIT)
    for (let month = input.desiredDeliveryMonth + 1; month <= scanEnd; month += 1) {
      const candidate = input.withChanges({ desiredDeliveryMonth: month })
      const result = this._calculate(candidate)
      if (result.valid) {
        suggestions.push(
          new Recommendation({
            code: 'POSTPONE_DELIVERY',
            label: 'En yakın teslimat tarihi',
            title: `Teslimatı ${MonthKey.label(candidate.planStartMonth, month)} tarihine alın`,
            explanation: `Ödeme tercihiniz korunarak plan ${result.term} ayda tamamlanır.`,
            input: candidate,
            result,
          }),
        )
        break
      }
    }

    // 4) Peşinatı en az ne kadar artırmak gerekiyor?
    suggestions.push(...this._downPaymentSuggestion(input))

    return this._dedupe(suggestions)
  }

  _downPaymentSuggestion(input) {
    const smallest = this._findSmallestValid(
      input.downPayment + 1,
      input.targetAmount - 1,
      (value) => input.withChanges({ downPayment: value }),
    )
    if (smallest === null) return []

    const candidate = input.withChanges({ downPayment: smallest })
    const result = this._calculate(candidate)
    if (!result.valid) return []

    return [
      new Recommendation({
        code: 'INCREASE_DOWN_PAYMENT',
        label: 'En az ek peşinat',
        title: `Peşinatı ${MoneyFormatter.currencyAuto(smallest)} yapın`,
        explanation: input.isInstallmentMode
          ? `Mevcut taksit tercihinizle plan ${result.term} ayda tamamlanır.`
          : `Teslimat ${result.deliveryLabel} tarihinde korunur; plan ${result.term} ay sürer.`,
        input: candidate,
        result,
      }),
    ]
  }

  /** Verilen bütçeyle ulaşılabilen en yüksek hedef tutarı arar. */
  _findLargestValidTarget(input) {
    let low = input.downPayment + 1
    let high = input.targetAmount - 1
    let best = null

    while (low <= high) {
      const middle = Math.floor((low + high) / 2)
      const candidate = input.withChanges({ targetAmount: middle })
      if (this._calculate(candidate).valid) {
        best = candidate
        low = middle + 1
      } else {
        high = middle - 1
      }
    }

    return best
  }

  _dedupe(suggestions) {
    const unique = new Map()
    for (const suggestion of suggestions) {
      if (!unique.has(suggestion.code)) unique.set(suggestion.code, suggestion)
    }
    return [...unique.values()].slice(0, MAX_SUGGESTIONS)
  }
}

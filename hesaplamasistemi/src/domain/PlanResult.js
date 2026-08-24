import { MonthKey } from './MonthKey.js'
import { MoneyFormatter } from './Money.js'

/** Ödeme tablosunun tek bir satırı. */
export class PlanRow {
  constructor(config) {
    this.month = config.month
    this.financingPayment = config.financingPayment
    this.organizationPayment = config.organizationPayment
    this.totalPayment = config.totalPayment
    this.cumulativePaid = config.cumulativePaid
    this.remainingFinancing = config.remainingFinancing
    this.isDeliveryMonth = config.isDeliveryMonth
    Object.freeze(this)
  }

  get isDownPayment() {
    return this.month === 0
  }

  label(planStartMonth) {
    return this.isDownPayment ? 'Peşinat' : MonthKey.rowLabel(planStartMonth, this.month)
  }
}

/**
 * Hesaplamanın sonucu: özet rakamlar, ay ay tablo, uyarılar ve — plan
 * oluşmadıysa — uygulanabilir alternatifler.
 */
export class PlanResult {
  constructor(config) {
    this.input = config.input
    this.violations = config.violations ?? []
    this.warnings = config.warnings ?? []
    this.recommendations = config.recommendations ?? []

    this.term = config.term ?? 0
    this.payoffMonth = config.payoffMonth ?? 0
    this.accumulationMonth = config.accumulationMonth ?? Number.POSITIVE_INFINITY
    this.durationRequirementMonth = config.durationRequirementMonth ?? 0
    this.earliestEligibleDeliveryMonth = config.earliestEligibleDeliveryMonth ?? 0
    this.plannedDeliveryMonth = config.plannedDeliveryMonth ?? 0
    this.deliveryThreshold = config.deliveryThreshold ?? 0

    this.organizationFee = config.organizationFee ?? 0
    this.totalWithKnownFees = config.totalWithKnownFees ?? 0

    this.rows = config.rows ?? []
    this.firstInstallment = config.firstInstallment ?? 0
    this.minInstallment = config.minInstallment ?? 0
    this.maxInstallment = config.maxInstallment ?? 0
    this.postDeliveryInstallment = config.postDeliveryInstallment ?? null

    this.capApplied = config.capApplied ?? false
    this.tailRebalanced = config.tailRebalanced ?? false
  }

  get valid() {
    return this.violations.length === 0
  }

  get planStartMonth() {
    return this.input.planStartMonth
  }

  /** "Mart 2028" — anahtarın teslim alınacağı ay. */
  get deliveryLabel() {
    return MonthKey.label(this.planStartMonth, this.plannedDeliveryMonth)
  }

  get payoffLabel() {
    return MonthKey.rowLabel(this.planStartMonth, this.payoffMonth)
  }

  /** Teslimata kaç ay kaldığı (plan başlangıcından itibaren). */
  get monthsUntilDelivery() {
    return this.plannedDeliveryMonth
  }

  /** Ödeme tablosundaki taksit satırları (peşinat hariç). */
  get installmentRows() {
    return this.rows.filter((row) => !row.isDownPayment)
  }

  /** Plan boyunca ödenecek toplam tutar. */
  get totalOutlay() {
    return this.rows.reduce((sum, row) => sum + row.totalPayment, 0)
  }

  /** Teslimat ayı satırı. */
  get deliveryRow() {
    return this.rows.find((row) => row.isDeliveryMonth) ?? null
  }

  /** Paylaşım ve PDF başlıklarında kullanılan tek satırlık özet. */
  get headline() {
    const asset = this.input.asset.lowerLabel
    return `${asset} için ${MoneyFormatter.currencyAuto(this.input.targetAmount)} hedefli plan · teslimat ${this.deliveryLabel} · ${this.term} ay vade`
  }

  withRecommendations(recommendations) {
    const clone = new PlanResult({ ...this, input: this.input })
    clone.recommendations = recommendations
    return clone
  }
}

/** Plan oluşmadığında sunulan, yeniden hesaplanmış ve geçerliliği doğrulanmış alternatif. */
export class Recommendation {
  constructor({ code, label, title, explanation, input, result }) {
    this.code = code
    this.label = label
    this.title = title
    this.explanation = explanation
    this.input = input
    this.term = result.term
    this.deliveryMonth = result.plannedDeliveryMonth
    this.deliveryLabel = result.deliveryLabel
    this.firstInstallment = result.firstInstallment
    this.maxInstallment = result.maxInstallment
    Object.freeze(this)
  }
}

/**
 * Planın neden oluşturulamadığını anlatan kural ihlali.
 *
 * `code` arayüzün ihlali sınıflandırması (ör. hangi alana odaklanacağı) için,
 * `message` doğrudan kullanıcıya gösterilir.
 */
export class Violation {
  constructor(code, message) {
    this.code = code
    this.message = message
    Object.freeze(this)
  }

  static invalidInput(message) {
    return new Violation('INVALID_INPUT', message)
  }

  static termLimit(message) {
    return new Violation('TERM_LIMIT', message)
  }

  static policyNotFeasible(message) {
    return new Violation('POLICY_NOT_FEASIBLE', message)
  }

  static installmentRatio(message) {
    return new Violation('INSTALLMENT_RATIO', message)
  }

  static accumulation(message) {
    return new Violation('ACCUMULATION_REQUIREMENT', message)
  }

  static duration(message) {
    return new Violation('DURATION_REQUIREMENT', message)
  }

  static deliveryTooEarly(message) {
    return new Violation('DELIVERY_BEFORE_MINIMUM', message)
  }
}

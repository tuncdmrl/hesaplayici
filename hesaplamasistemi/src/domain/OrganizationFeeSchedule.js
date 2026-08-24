import { PlanPolicy } from '../config/planPolicy.js'
import { Money } from './Money.js'

/**
 * Organizasyon (hizmet) bedeli ve ödeme takvimi.
 *
 * Bedel hedef tutarın %7'sidir. Yarısı planın 1. ayında, kalanı takip eden
 * 4 aya eşit bölünerek tahsil edilir. Peşinat ayında (0. ay) organizasyon
 * ödemesi yoktur.
 */
export class OrganizationFeeSchedule {
  constructor(targetAmount) {
    this.total = Money.applyBps(Math.max(0, targetAmount), PlanPolicy.organizationFeeBps)

    const firstPayment = Money.ceilDiv(this.total, PlanPolicy.organizationFeeFirstShare)
    const remaining = this.total - firstPayment
    const months = PlanPolicy.organizationFeeRemainingMonths
    const share = Math.floor(remaining / months)
    const leftover = remaining % months

    /** payments[n] = n. ayda ödenecek organizasyon tutarı. */
    this.payments = [0, firstPayment]
    for (let index = 0; index < months; index += 1) {
      this.payments.push(share + (index < leftover ? 1 : 0))
    }

    Object.freeze(this.payments)
    Object.freeze(this)
  }

  paymentAt(month) {
    return this.payments[month] ?? 0
  }

  /** Bedelin tamamının ödendiği son ay. */
  get lastMonth() {
    return this.payments.length - 1
  }
}

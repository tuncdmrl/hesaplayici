import { advisor } from '../config/advisor.js'
import { MoneyFormatter } from '../domain/Money.js'

/**
 * Danışmana ulaşma yolları: WhatsApp, telefon ve e-posta bağlantıları.
 *
 * WhatsApp mesajı, ekranda bir plan varsa o planın özetiyle hazır gelir; böylece
 * kullanıcı hiçbir şey yazmadan görüşmeye başlayabilir.
 */
export class ContactService {
  constructor(person = advisor) {
    this.person = person
  }

  /** Plan yokken kullanılan genel mesaj. */
  get defaultMessage() {
    return `Merhaba ${this.person.salutation}, tasarruf finansmanı ödeme planı hakkında bilgi almak istiyorum.`
  }

  /** @param {import('../domain/PlanResult.js').PlanResult|null} plan */
  messageFor(plan) {
    if (!plan) return this.defaultMessage

    const summary =
      `Hesaplayıcıda ${plan.input.asset.lowerLabel} için ` +
      `${MoneyFormatter.currencyAuto(plan.input.targetAmount)} hedef tutar ve ` +
      `${MoneyFormatter.currencyAuto(plan.input.downPayment)} peşinatla bir ön plan oluşturdum.`

    if (!plan.valid) {
      return [
        `Merhaba ${this.person.salutation},`,
        summary,
        'Bu bilgilerle uygun bir plan çıkmadı. Bütçeme uygun seçenekleri konuşabilir miyiz?',
      ].join('\n')
    }

    return [
      `Merhaba ${this.person.salutation},`,
      summary,
      `Tahmini teslimat ${plan.deliveryLabel}, toplam vade ${plan.term} ay görünüyor. ` +
        `İlk taksit ${MoneyFormatter.currencyAuto(plan.firstInstallment)}. ` +
        'Planı güncel koşullarla değerlendirebilir miyiz?',
    ].join('\n')
  }

  whatsAppLink(plan = null) {
    const text = encodeURIComponent(this.messageFor(plan))
    return `https://wa.me/${this.person.phone.whatsapp}?text=${text}`
  }

  get phoneLink() {
    return `tel:${this.person.phone.dial}`
  }

  mailLink(plan = null) {
    const subject = encodeURIComponent('Tasarruf finansmanı ön hesaplama')
    const body = encodeURIComponent(this.messageFor(plan))
    return `mailto:${this.person.email}?subject=${subject}&body=${body}`
  }
}

export const contactService = new ContactService()

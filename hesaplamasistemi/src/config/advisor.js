/**
 * Danışman bilgileri.
 *
 * Sitedeki isim, unvan, telefon ve e-posta yalnızca buradan yönetilir.
 * Başka bir danışman için siteyi uyarlarken tek değiştirilmesi gereken dosya budur.
 */
export const advisor = Object.freeze({
  fullName: 'Merve Demirel',
  /** WhatsApp ve metinlerde kullanılan hitap. */
  salutation: 'Merve Hanım',
  title: 'Pendik Şube Müdürü',
  company: 'Birevim',
  branch: 'Pendik Şubesi',
  city: 'İstanbul',
  phone: Object.freeze({
    /** tel: bağlantısı için. */
    dial: '+905498244340',
    /** wa.me bağlantısı için (başında + veya 0 olmadan). */
    whatsapp: '905498244340',
    /** Ekranda gösterilen biçim. */
    display: '0 (549) 824 43 40',
  }),
  email: 'mervedemirel@birevim.com',
})

export const site = Object.freeze({
  name: 'Ödeme Planı Hesaplayıcı',
  tagline: 'Faizsiz tasarruf finansmanı ödeme planı hesaplayıcı',
  /** PDF ve paylaşımlarda kullanılan yasal uyarı. */
  disclaimer:
    'Bu belge, girilen bilgiler esas alınarak hazırlanmış temsili bir ön hesaplamadır. ' +
    'Teklif, tahsisat taahhüdü, ön bilgilendirme formu veya sözleşme yerine geçmez. ' +
    'Kesin tutar, teslimat tarihi, vergi, masraf ve ödeme koşulları güncel tarife, ' +
    'ön bilgilendirme formu ve imzalanacak sözleşmeyle belirlenir.',
})

import { jsPDF } from 'jspdf'
import { advisor, site } from '../../config/advisor.js'
import { MoneyFormatter } from '../../domain/Money.js'
import { MonthKey } from '../../domain/MonthKey.js'
import { PlanPolicy } from '../../config/planPolicy.js'
import * as regularFont from './fonts/roboto-regular.js'
import * as boldFont from './fonts/roboto-bold.js'

const RENK = {
  kirmizi: [215, 0, 20],
  kirmiziSis: [253, 236, 238],
  murekkep: [23, 9, 12],
  orta: [94, 72, 76],
  acik: [146, 127, 130],
  cizgi: [223, 209, 211],
  zemin: [246, 241, 240],
  beyaz: [255, 255, 255],
}

const SAYFA = { genislik: 210, yukseklik: 297, kenar: 14 }
const ICERIK_GENISLIK = SAYFA.genislik - SAYFA.kenar * 2

/**
 * Ödeme planını A4 bir belgeye çizer.
 *
 * jsPDF'in yerleşik fontları Türkçe karakterleri basamadığı için, yalnızca
 * ihtiyaç duyulan glifleri içeren küçültülmüş bir Roboto gömülür.
 */
export class PlanPdfDocument {
  #cizildi = false

  /** @param {import('../../domain/PlanResult.js').PlanResult} plan */
  constructor(plan) {
    this.plan = plan
    this.doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
    this.y = 0
    this.#kurFontlar()
  }

  #kurFontlar() {
    const { doc } = this
    doc.addFileToVFS(regularFont.fileName, regularFont.base64)
    doc.addFont(regularFont.fileName, 'Gomulu', 'normal')
    doc.addFileToVFS(boldFont.fileName, boldFont.base64)
    doc.addFont(boldFont.fileName, 'Gomulu', 'bold')
    doc.setFont('Gomulu', 'normal')
  }

  /**
   * Belgeyi çizer. Birden çok kez çağrılabilir; içerik yalnızca bir kez çizilir.
   * @returns {jsPDF}
   */
  build() {
    if (this.#cizildi) return this.doc
    this.#cizildi = true
    this.#basli()
    this.#anahtarAyi()
    this.#ozetKutulari()
    this.#tutarOzeti()
    this.#tabloBasligi()
    this.#tablo()
    this.#sayfaAltlari()
    return this.doc
  }

  toBlob() {
    return this.build().output('blob')
  }

  get fileName() {
    const ay = MonthKey.add(this.plan.planStartMonth, this.plan.plannedDeliveryMonth)
    return `odeme-plani-${this.plan.input.assetType}-${ay}.pdf`
  }

  // ------------------------------------------------------------------ parçalar

  #yaz(text, x, y, { size = 10, weight = 'normal', color = RENK.murekkep, align = 'left' } = {}) {
    const { doc } = this
    doc.setFont('Gomulu', weight)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    doc.text(String(text), x, y, { align })
  }

  #cizgi(y, x1 = SAYFA.kenar, x2 = SAYFA.genislik - SAYFA.kenar, color = RENK.cizgi, width = 0.3) {
    const { doc } = this
    doc.setDrawColor(...color)
    doc.setLineWidth(width)
    doc.line(x1, y, x2, y)
  }

  #kutu(x, y, w, h, { fill, stroke, radius = 2 } = {}) {
    const { doc } = this
    if (fill) doc.setFillColor(...fill)
    if (stroke) doc.setDrawColor(...stroke)
    doc.setLineWidth(0.3)
    const style = fill && stroke ? 'FD' : fill ? 'F' : 'S'
    doc.roundedRect(x, y, w, h, radius, radius, style)
  }

  #basli() {
    const { doc } = this

    doc.setFillColor(...RENK.kirmizi)
    doc.rect(0, 0, SAYFA.genislik, 4, 'F')

    this.#yaz(site.name.toLocaleUpperCase('tr-TR'), SAYFA.kenar, 15, {
      size: 15,
      weight: 'bold',
      color: RENK.kirmizi,
    })
    this.#yaz('Ödeme planı ön hesaplaması', SAYFA.kenar, 20.5, { size: 9, color: RENK.orta })

    const bugun = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' }).format(new Date())
    this.#yaz(bugun, SAYFA.genislik - SAYFA.kenar, 15, {
      size: 9,
      color: RENK.acik,
      align: 'right',
    })
    this.#yaz(
      `${advisor.fullName} · ${advisor.title}`,
      SAYFA.genislik - SAYFA.kenar,
      20.5,
      { size: 9, weight: 'bold', align: 'right' },
    )
    this.#yaz(
      `${advisor.phone.display} · ${advisor.email}`,
      SAYFA.genislik - SAYFA.kenar,
      25,
      { size: 8, color: RENK.orta, align: 'right' },
    )

    this.#cizgi(30)
    this.y = 30
  }

  #anahtarAyi() {
    const { plan } = this
    const y = this.y + 8
    const yukseklik = 34

    this.#kutu(SAYFA.kenar, y, ICERIK_GENISLIK, yukseklik, {
      fill: RENK.kirmiziSis,
      stroke: [246, 204, 209],
    })

    this.#yaz('ANAHTAR AYINIZ', SAYFA.kenar + 7, y + 10, {
      size: 8,
      weight: 'bold',
      color: RENK.kirmizi,
    })
    this.#yaz(plan.deliveryLabel, SAYFA.kenar + 7, y + 22, {
      size: 22,
      weight: 'bold',
      color: RENK.murekkep,
    })
    this.#yaz(
      `${plan.input.asset.label} · ${MoneyFormatter.currencyAuto(plan.input.targetAmount)} hedef · ` +
        `${plan.term} ay vade · plan başlangıcı ${MonthKey.label(plan.planStartMonth)}`,
      SAYFA.kenar + 7,
      y + 29,
      { size: 8, color: RENK.orta },
    )

    this.#damga(SAYFA.genislik - SAYFA.kenar - 47, y + 8, 40, 18, {
      ust: 'ANAHTAR TESLİM',
      ana: `${plan.monthsUntilDelivery}. AY`,
    })

    this.y = y + yukseklik
  }

  /** Ekrandaki kırmızı mührün belge karşılığı: çift çerçeveli kırmızı kutu. */
  #damga(x, y, w, h, { ust, ana }) {
    const { doc } = this
    doc.setDrawColor(...RENK.kirmizi)
    doc.setLineWidth(0.8)
    doc.roundedRect(x, y, w, h, 1.5, 1.5, 'S')
    doc.setLineWidth(0.3)
    doc.roundedRect(x + 1.4, y + 1.4, w - 2.8, h - 2.8, 1, 1, 'S')

    this.#yaz(ust, x + w / 2, y + 7.4, {
      size: 5.6,
      weight: 'normal',
      color: RENK.kirmizi,
      align: 'center',
    })
    this.#yaz(ana, x + w / 2, y + 13.6, {
      size: 11,
      weight: 'bold',
      color: RENK.kirmizi,
      align: 'center',
    })
  }

  #ozetKutulari() {
    const { plan } = this
    const y = this.y + 7
    const yukseklik = 19
    const aralik = 3
    const kalemler = [
      ['Toplam vade', `${plan.term} ay`],
      ['İlk taksit', MoneyFormatter.currencyAuto(plan.firstInstallment)],
      plan.maxInstallment > plan.firstInstallment
        ? ['En yüksek taksit', MoneyFormatter.currencyAuto(plan.maxInstallment)]
        : ['Teslimata kalan', `${plan.monthsUntilDelivery} ay`],
      ['Toplam ödeme', MoneyFormatter.currencyAuto(plan.totalWithKnownFees)],
    ]
    const genislik = (ICERIK_GENISLIK - aralik * (kalemler.length - 1)) / kalemler.length

    kalemler.forEach(([etiket, deger], index) => {
      const x = SAYFA.kenar + index * (genislik + aralik)
      this.#kutu(x, y, genislik, yukseklik, { fill: RENK.zemin, stroke: RENK.cizgi })
      this.#yaz(etiket.toLocaleUpperCase('tr-TR'), x + 4, y + 7, {
        size: 6.5,
        weight: 'bold',
        color: RENK.acik,
      })
      this.#yaz(deger, x + 4, y + 14.5, { size: 11, weight: 'bold' })
    })

    this.y = y + yukseklik
  }

  #tutarOzeti() {
    const { plan } = this
    let y = this.y + 11

    this.#yaz('Ödeme özeti', SAYFA.kenar, y, { size: 11, weight: 'bold' })
    y += 5

    const satirlar = [
      ['Hedef finansman tutarı', MoneyFormatter.currency(plan.input.targetAmount)],
      ['Peşinat', MoneyFormatter.currency(plan.input.downPayment)],
      [
        `Organizasyon ücreti (%${PlanPolicy.organizationFeeBps / 100})`,
        MoneyFormatter.currency(plan.organizationFee),
      ],
    ]

    for (const [etiket, deger] of satirlar) {
      this.#cizgi(y)
      y += 5.5
      this.#yaz(etiket, SAYFA.kenar, y, { size: 9, color: RENK.orta })
      this.#yaz(deger, SAYFA.genislik - SAYFA.kenar, y, {
        size: 9,
        weight: 'bold',
        align: 'right',
      })
      y += 2.5
    }

    this.#cizgi(y, SAYFA.kenar, SAYFA.genislik - SAYFA.kenar, RENK.murekkep, 0.6)
    y += 6
    this.#yaz('Belirtilen kalemlerle toplam', SAYFA.kenar, y, { size: 10, weight: 'bold' })
    this.#yaz(
      MoneyFormatter.currency(plan.totalWithKnownFees),
      SAYFA.genislik - SAYFA.kenar,
      y,
      { size: 12, weight: 'bold', color: RENK.kirmizi, align: 'right' },
    )

    this.y = y + 2
  }

  #tabloBasligi() {
    const y = this.y + 11
    this.#yaz('Ay ay ödeme planı', SAYFA.kenar, y, { size: 11, weight: 'bold' })
    this.#yaz(
      `${this.plan.term} ay · tutarlar TL`,
      SAYFA.genislik - SAYFA.kenar,
      y,
      { size: 8, color: RENK.acik, align: 'right' },
    )
    this.y = y + 4
  }

  #sutunlar() {
    const x = SAYFA.kenar
    const paraGenislik = 26
    const tarihGenislik = ICERIK_GENISLIK - paraGenislik * 3 - 20
    return [
      { baslik: 'Tarih', x, genislik: tarihGenislik, hiza: 'left' },
      { baslik: 'Finansman', x: x + tarihGenislik, genislik: paraGenislik, hiza: 'right' },
      { baslik: 'Organizasyon', x: x + tarihGenislik + paraGenislik, genislik: 20, hiza: 'right' },
      {
        baslik: 'Aylık toplam',
        x: x + tarihGenislik + paraGenislik + 20,
        genislik: paraGenislik,
        hiza: 'right',
      },
      {
        baslik: 'Kalan',
        x: x + tarihGenislik + paraGenislik * 2 + 20,
        genislik: paraGenislik,
        hiza: 'right',
      },
    ]
  }

  #tabloBasligiCiz(y) {
    const sutunlar = this.#sutunlar()
    this.doc.setFillColor(...RENK.zemin)
    this.doc.rect(SAYFA.kenar, y - 4.5, ICERIK_GENISLIK, 7, 'F')

    for (const sutun of sutunlar) {
      const x = sutun.hiza === 'right' ? sutun.x + sutun.genislik : sutun.x + 2
      this.#yaz(sutun.baslik, x, y, {
        size: 6.8,
        weight: 'bold',
        color: RENK.orta,
        align: sutun.hiza,
      })
    }
    this.#cizgi(y + 2.5, SAYFA.kenar, SAYFA.genislik - SAYFA.kenar, RENK.cizgi, 0.4)
    return y + 7
  }

  #tablo() {
    const { plan } = this
    const satirYukseklik = 6
    const altSinir = SAYFA.yukseklik - 22

    let y = this.#tabloBasligiCiz(this.y + 5)

    for (const row of plan.rows) {
      if (y + satirYukseklik > altSinir) {
        this.doc.addPage()
        y = this.#tabloBasligiCiz(SAYFA.kenar + 8)
      }

      if (row.isDeliveryMonth) {
        this.doc.setFillColor(...RENK.kirmiziSis)
        this.doc.rect(SAYFA.kenar, y - 4, ICERIK_GENISLIK, satirYukseklik, 'F')
      }

      const kalin = row.isDeliveryMonth || row.isDownPayment
      const sutunlar = this.#sutunlar()
      const degerler = [
        row.label(plan.planStartMonth) + (row.isDeliveryMonth ? '  — TESLİMAT' : ''),
        MoneyFormatter.cell(row.financingPayment),
        MoneyFormatter.cell(row.organizationPayment),
        MoneyFormatter.cell(row.totalPayment),
        MoneyFormatter.cell(row.remainingFinancing),
      ]

      degerler.forEach((deger, index) => {
        const sutun = sutunlar[index]
        const x = sutun.hiza === 'right' ? sutun.x + sutun.genislik : sutun.x + 2
        this.#yaz(deger, x, y, {
          size: 7.6,
          weight: kalin ? 'bold' : 'normal',
          color: row.isDeliveryMonth ? RENK.kirmizi : RENK.murekkep,
          align: sutun.hiza,
        })
      })

      this.#cizgi(y + 2, SAYFA.kenar, SAYFA.genislik - SAYFA.kenar, RENK.cizgi, 0.15)
      y += satirYukseklik
    }

    this.y = y
  }

  #sayfaAltlari() {
    const { doc } = this
    const toplam = doc.getNumberOfPages()

    for (let sayfa = 1; sayfa <= toplam; sayfa += 1) {
      doc.setPage(sayfa)
      const y = SAYFA.yukseklik - 16

      this.#cizgi(y - 4)
      doc.setFont('Gomulu', 'normal')
      doc.setFontSize(6.2)
      doc.setTextColor(...RENK.acik)

      const satirlar = doc.splitTextToSize(site.disclaimer, ICERIK_GENISLIK - 22)
      doc.text(satirlar.slice(0, 3), SAYFA.kenar, y)

      this.#yaz(`${sayfa} / ${toplam}`, SAYFA.genislik - SAYFA.kenar, y, {
        size: 7,
        color: RENK.acik,
        align: 'right',
      })
    }
  }
}

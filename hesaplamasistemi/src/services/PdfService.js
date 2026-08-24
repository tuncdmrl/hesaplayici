import { MoneyFormatter } from '../domain/Money.js'

/**
 * PDF üretimi ve paylaşımı.
 *
 * jsPDF ve gömülü font yaklaşık 400 KB tuttuğu için, PDF modülü yalnızca
 * kullanıcı düğmeye bastığında indirilir (dinamik import). Böylece ilk açılış
 * hızı etkilenmez.
 */
export class PdfService {
  async #createDocument(plan) {
    const { PlanPdfDocument } = await import('./pdf/PlanPdfDocument.js')
    return new PlanPdfDocument(plan)
  }

  /**
   * Dosyayı doğrudan cihaza indirir.
   *
   * jsPDF'in `save()` yardımcısı yerine indirmeyi kendimiz kuruyoruz; böylece
   * dosya adını ve nesne URL'inin ne zaman serbest bırakılacağını denetleriz.
   */
  async download(plan) {
    const planDocument = await this.#createDocument(plan)
    const url = URL.createObjectURL(planDocument.toBlob())

    const link = document.createElement('a')
    link.href = url
    link.download = planDocument.fileName
    link.rel = 'noopener'
    document.body.append(link)
    link.click()

    // Bağlantıyı ve nesne URL'ini hemen kaldırmak bazı tarayıcılarda indirmeyi
    // yarıda keser; tarayıcıya işi bitirmesi için süre bırakıyoruz.
    window.setTimeout(() => link.remove(), 2_000)
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return planDocument.fileName
  }

  async createFile(plan) {
    const planDocument = await this.#createDocument(plan)
    return new File([planDocument.toBlob()], planDocument.fileName, { type: 'application/pdf' })
  }

  /** Cihaz PDF dosyası paylaşımını destekliyor mu? */
  canShareFiles() {
    if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false
    try {
      const probe = new File([''], 'plan.pdf', { type: 'application/pdf' })
      return navigator.canShare({ files: [probe] })
    } catch {
      return false
    }
  }
}

/**
 * "Planı paylaş" davranışı: önce PDF dosyasıyla paylaşım, olmazsa metin
 * paylaşımı, o da yoksa panoya kopyalama.
 */
export class ShareService {
  constructor(pdfService = new PdfService()) {
    this.pdf = pdfService
  }

  summaryText(plan) {
    return (
      `${plan.input.asset.label} için ${MoneyFormatter.currencyAuto(plan.input.targetAmount)} hedefli ön plan: ` +
      `tahmini teslimat ${plan.deliveryLabel}, vade ${plan.term} ay. ` +
      'Hesaplama bilgilendirme amaçlıdır.'
    )
  }

  /** @returns {Promise<{ok:boolean, message:string}>} */
  async share(plan) {
    const text = this.summaryText(plan)
    const url = window.location.origin

    try {
      if (this.pdf.canShareFiles()) {
        const file = await this.pdf.createFile(plan)
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: 'Ödeme planı', text, files: [file] })
          return { ok: true, message: 'Plan paylaşım ekranına hazırlandı.' }
        }
      }

      if (navigator.share) {
        await navigator.share({ title: 'Ödeme planı', text, url })
        return {
          ok: true,
          message: 'Bu cihaz PDF dosyası paylaşımını desteklemiyor; plan özeti paylaşıldı.',
        }
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        return { ok: true, message: 'Plan özeti ve site bağlantısı panoya kopyalandı.' }
      }

      return {
        ok: false,
        message: 'Bu tarayıcı paylaşımı desteklemiyor. PDF’yi indirip dosya olarak gönderebilirsiniz.',
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { ok: true, message: '' }
      }
      return {
        ok: false,
        message: 'Paylaşım başlatılamadı. PDF’yi indirip dosya olarak gönderebilirsiniz.',
      }
    }
  }
}

export const pdfService = new PdfService()
export const shareService = new ShareService(pdfService)

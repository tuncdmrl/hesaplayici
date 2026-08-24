import { useEffect, useMemo, useState } from 'react'
import { advisor, site } from '../config/advisor.js'
import { PlanPolicy } from '../config/planPolicy.js'
import { MoneyFormatter } from '../domain/Money.js'
import { MonthKey } from '../domain/MonthKey.js'
import { contactService } from '../services/ContactService.js'
import { pdfService, shareService } from '../services/PdfService.js'
import { useRoute } from '../app/Router.jsx'
import { usePlanSession } from '../app/PlanSession.jsx'
import { Icon } from '../ui/Icon.jsx'
import { Stamp } from '../ui/shell.jsx'

/**
 * Ödeme şeridi: her ay bir sütun, sütun yüksekliği o ayın toplam ödemesi.
 * Teslimat ayı kırmızı ve bayraklı; organizasyon ödemesi olan ilk aylar koyu.
 */
function PaymentStrip({ plan }) {
  const rows = plan.installmentRows
  const enYuksek = Math.max(...rows.map((row) => row.totalPayment), 1)

  return (
    <>
      <div className="serit-sarmal" role="img" aria-label={`Ay ay ödeme şeridi, ${plan.term} ay`}>
        <div className="serit">
          {rows.map((row) => {
            const oran = Math.max(4, Math.round((row.totalPayment / enYuksek) * 100))
            const sinif = row.isDeliveryMonth
              ? 'serit__sutun serit__sutun--teslim'
              : row.organizationPayment > 0
                ? 'serit__sutun serit__sutun--org'
                : 'serit__sutun'
            const ay = MonthKey.parse(MonthKey.add(plan.planStartMonth, row.month - 1))
            return (
              <div className={sinif} key={row.month}>
                {row.isDeliveryMonth && (
                  <span className="serit__bayrak">
                    <span>Teslimat</span>
                  </span>
                )}
                <span className="serit__cubuk" style={{ height: `calc(${oran}% - 0.8rem)` }} />
                <span className="serit__yil">{ay.monthIndex === 0 ? ay.year : ''}</span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="serit-aciklama">
        <span>
          <i style={{ background: 'var(--cizgi-koyu)' }} /> Aylık ödeme
        </span>
        <span>
          <i style={{ background: 'var(--murekkep-acik)' }} /> Organizasyon ödemesi olan aylar
        </span>
        <span>
          <i style={{ background: 'var(--kirmizi)' }} /> Teslimat ayı
        </span>
      </p>
    </>
  )
}

function ScheduleTable({ plan }) {
  return (
    <div className="tablo-sarmal">
      <table className="odeme-tablo">
        <thead>
          <tr>
            <th scope="col">Tarih</th>
            <th scope="col">Finansman</th>
            <th scope="col">Org.</th>
            <th scope="col">Aylık toplam</th>
            <th scope="col">Kalan</th>
          </tr>
        </thead>
        <tbody>
          {plan.rows.map((row) => (
            <tr key={row.month} className={row.isDeliveryMonth ? 'satir--teslim' : ''}>
              <th scope="row">
                {row.label(plan.planStartMonth)}
                {row.isDeliveryMonth && <span className="teslim-etiket">Teslimat</span>}
              </th>
              <td>{MoneyFormatter.cell(row.financingPayment)}</td>
              <td>{MoneyFormatter.cell(row.organizationPayment)}</td>
              <td>{MoneyFormatter.cell(row.totalPayment)}</td>
              <td>{MoneyFormatter.cell(row.remainingFinancing)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function InvalidPlan({ plan, onEdit, onApply }) {
  return (
    <>
      <section className="belge sonuc-kapak">
        <p className="ustyazi">Birlikte düzeltelim</p>
        <h1 className="alt-baslik" style={{ marginBlock: '0.6rem 0.7rem' }}>
          Bu bilgilerle uygun bir plan çıkmıyor
        </h1>
        <p className="sonuc-kapak__aciklama">
          Vade ve teslimat şartlarına uymayan noktaları işaretledik. Aşağıdaki seçeneklerin her biri
          yeniden hesaplandı ve uygulanabilir çıktı.
        </p>

        <ul className="uyari-listesi">
          {plan.violations.map((violation, index) => (
            <li key={`${violation.code}-${index}`}>
              <Icon name="alert" />
              <span>{violation.message}</span>
            </li>
          ))}
        </ul>

        <div className="sonuc-eylemler">
          <button className="dugme dugme--birincil" type="button" onClick={onEdit}>
            <Icon name="edit" size={19} />
            Bilgileri değiştir
          </button>
          <a
            className="dugme dugme--yesil"
            href={contactService.whatsAppLink(plan)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="whatsapp" size={20} />
            {advisor.salutation}’a danış
          </a>
        </div>
      </section>

      {plan.recommendations.length > 0 ? (
        <section className="belge sonuc-blok" aria-labelledby="oneri-baslik">
          <div className="sonuc-blok__baslik">
            <h2 id="oneri-baslik">Küçük bir değişiklikle olur</h2>
          </div>
          <div className="oneri-izgara">
            {plan.recommendations.map((oneri) => (
              <article className="oneri-kart" key={oneri.code}>
                <span className="rozet">{oneri.label}</span>
                <h3>{oneri.title}</h3>
                <p>{oneri.explanation}</p>
                <dl className="oneri-kart__olculer">
                  <div>
                    <dt>Vade</dt>
                    <dd>{oneri.term} ay</dd>
                  </div>
                  <div>
                    <dt>Teslimat</dt>
                    <dd>{oneri.deliveryLabel}</dd>
                  </div>
                </dl>
                <button
                  className="dugme dugme--birincil"
                  type="button"
                  onClick={() => onApply(oneri)}
                >
                  Bu seçeneği uygula
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="belge bos-oneri">
          <Icon name="info" />
          <div>
            <h2>Uygun seçeneği birlikte bulalım</h2>
            <p>
              Bu tercihler otomatik olarak düzeltilemedi. Tutarı veya ödeme tercihinizi
              değiştirebilir ya da {advisor.salutation}’a danışabilirsiniz.
            </p>
          </div>
        </section>
      )}
    </>
  )
}

export function ResultPage() {
  const session = usePlanSession()
  const { navigate } = useRoute()
  const plan = session.result

  const [pdfHazirlaniyor, setPdfHazirlaniyor] = useState(false)
  const [paylasiliyor, setPaylasiliyor] = useState(false)
  const [bildirim, setBildirim] = useState('')

  const whatsAppLink = useMemo(() => contactService.whatsAppLink(plan), [plan])

  // Sayfaya doğrudan girildiyse (henüz hesaplama yoksa) forma yönlendir.
  useEffect(() => {
    if (!plan) navigate('/hesapla', { replace: true })
  }, [plan, navigate])

  if (!plan) return null

  function duzenle() {
    navigate('/hesapla')
  }

  function oneriUygula(oneri) {
    session.applyRecommendation(oneri)
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }

  async function pdfIndir() {
    setPdfHazirlaniyor(true)
    setBildirim('')
    try {
      const dosya = await pdfService.download(plan)
      setBildirim(`${dosya} indirildi. Telefonunuzda “İndirilenler” klasöründe bulabilirsiniz.`)
    } catch {
      setBildirim('PDF hazırlanamadı. Sayfayı yenileyip yeniden deneyin.')
    } finally {
      setPdfHazirlaniyor(false)
    }
  }

  async function paylas() {
    setPaylasiliyor(true)
    setBildirim('')
    const sonuc = await shareService.share(plan)
    if (sonuc.message) setBildirim(sonuc.message)
    setPaylasiliyor(false)
  }

  if (!plan.valid) {
    return (
      <div className="kabuk kabuk--sonuc sonuc-sayfa">
        <InvalidPlan plan={plan} onEdit={duzenle} onApply={oneriUygula} />
      </div>
    )
  }

  const taksitArtiyor = plan.maxInstallment > plan.firstInstallment
  const ozetler = [
    {
      etiket: 'Toplam vade',
      deger: plan.term,
      birim: 'ay',
      not: plan.payoffMonth < plan.term ? `Finansman ${plan.payoffLabel} biter` : null,
    },
    {
      etiket: 'İlk taksit',
      deger: MoneyFormatter.currencyAuto(plan.firstInstallment),
      not: 'Organizasyon ödemesi hariç',
    },
    taksitArtiyor
      ? {
          etiket: 'En yüksek taksit',
          deger: MoneyFormatter.currencyAuto(plan.maxInstallment),
          not: 'Artışlar uygulandıktan sonra',
        }
      : {
          etiket: 'Teslimata kalan',
          deger: plan.monthsUntilDelivery,
          birim: 'ay',
          not: 'Plan başlangıcından',
        },
    {
      etiket: 'Toplam ödeme',
      deger: MoneyFormatter.currencyAuto(plan.totalWithKnownFees),
      not: 'Peşinat ve organizasyon dahil',
    },
  ]

  return (
    <div className="kabuk kabuk--sonuc sonuc-sayfa">
      <section className="belge sonuc-kapak">
        <div className="sonuc-kapak__damga">
          <Stamp top="Anahtar teslim" main={`${plan.monthsUntilDelivery}. ay`} large animate />
        </div>

        <p className="ustyazi">Planınız hazır</p>
        <p className="sonuc-kapak__ay">{plan.deliveryLabel}</p>
        <p className="sonuc-kapak__aciklama">
          {MoneyFormatter.currencyAuto(plan.input.targetAmount)} hedefli{' '}
          {plan.input.asset.lowerLabel} planınızda ödemeler{' '}
          {MonthKey.rowLabel(plan.planStartMonth, 1)} – {plan.payoffLabel} arasında sürer.
        </p>

        <div className="ozet-izgara">
          {ozetler.map((ozet) => (
            <div className="ozet-kutu" key={ozet.etiket}>
              <span className="ozet-kutu__etiket">{ozet.etiket}</span>
              <span className="ozet-kutu__deger">
                {ozet.deger}
                {ozet.birim && <span className="ozet-kutu__birim">{ozet.birim}</span>}
              </span>
              {ozet.not && <span className="ozet-kutu__not">{ozet.not}</span>}
            </div>
          ))}
        </div>

        <div className="sonuc-eylemler">
          <button
            className="dugme dugme--birincil"
            type="button"
            onClick={pdfIndir}
            disabled={pdfHazirlaniyor}
          >
            <Icon name="download" size={19} />
            {pdfHazirlaniyor ? 'PDF hazırlanıyor…' : 'PDF olarak indir'}
          </button>

          <a
            className="dugme dugme--yesil"
            href={whatsAppLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="whatsapp" size={20} />
            {advisor.salutation}’a gönder
          </a>

          <button
            className="dugme dugme--ikincil"
            type="button"
            onClick={paylas}
            disabled={paylasiliyor}
          >
            <Icon name="share" size={19} />
            {paylasiliyor ? 'Hazırlanıyor…' : 'Paylaş'}
          </button>
        </div>

        <p className="sonuc-eylemler__ikincil">
          <button className="metin-dugme" type="button" onClick={duzenle}>
            <Icon name="edit" size={17} />
            Bilgileri değiştir
          </button>
        </p>

        {bildirim && (
          <p className="eylem-notu" role="status">
            <Icon name="info" />
            {bildirim}
          </p>
        )}
      </section>

      {plan.warnings.length > 0 && (
        <div>
          {plan.warnings.map((uyari) => (
            <p className="not not--uyari" key={uyari}>
              <Icon name="info" size={18} />
              {uyari}
            </p>
          ))}
        </div>
      )}

      <section className="belge sonuc-blok" aria-labelledby="tutar-baslik">
        <div className="sonuc-blok__baslik">
          <h2 id="tutar-baslik">Ödeme özeti</h2>
          <span className="rozet rozet--sessiz">Kalemler ayrı gösterilir</span>
        </div>

        <dl className="tutar-listesi">
          <div className="tutar-satiri">
            <dt>Hedef finansman tutarı</dt>
            <dd>{MoneyFormatter.currency(plan.input.targetAmount)}</dd>
          </div>
          <div className="tutar-satiri">
            <dt>Peşinat</dt>
            <dd>{MoneyFormatter.currency(plan.input.downPayment)}</dd>
          </div>
          <div className="tutar-satiri">
            <dt>
              Organizasyon ücreti
              <small>%{PlanPolicy.organizationFeeBps / 100} sabit oran · ilk 5 aya bölünür</small>
            </dt>
            <dd>{MoneyFormatter.currency(plan.organizationFee)}</dd>
          </div>
          <div className="tutar-satiri tutar-satiri--toplam">
            <dt>Belirtilen kalemlerle toplam</dt>
            <dd>{MoneyFormatter.currency(plan.totalWithKnownFees)}</dd>
          </div>
        </dl>
      </section>

      <section className="belge sonuc-blok" aria-labelledby="serit-baslik">
        <div className="sonuc-blok__baslik">
          <h2 id="serit-baslik">Ödemeleriniz zaman içinde</h2>
          <span className="rozet rozet--sessiz">{plan.term} ay</span>
        </div>
        <PaymentStrip plan={plan} />
      </section>

      <section className="belge sonuc-blok" aria-labelledby="tablo-baslik">
        <div className="sonuc-blok__baslik">
          <h2 id="tablo-baslik">Ay ay ödeme planı</h2>
          <span className="rozet rozet--sessiz">Tutarlar TL</span>
        </div>
        <ScheduleTable plan={plan} />
        <p className="tablo-notu">
          Tabloyu kaydırarak {plan.term} ayın tamamını görebilirsiniz. “Finansman” taksitiniz,
          “Org.” organizasyon ücretinin o aya düşen payı, “Kalan” ise hedef tutardan geriye kalan
          bakiyedir.
        </p>
      </section>

      <p className="yasal-not">{site.disclaimer}</p>
    </div>
  )
}

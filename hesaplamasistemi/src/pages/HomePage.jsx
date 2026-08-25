import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { advisor } from '../config/advisor.js'
import { MonthKey } from '../domain/MonthKey.js'
import { MoneyFormatter } from '../domain/Money.js'
import { PlanInput } from '../domain/PlanInput.js'
import { planService } from '../domain/PlanService.js'
import { contactService } from '../services/ContactService.js'
import { useRoute } from '../app/Router.jsx'
import { usePlanSession } from '../app/PlanSession.jsx'
import { useInstallPrompt } from '../app/useInstallPrompt.js'
import { Icon } from '../ui/Icon.jsx'
import { BrandMark, Stamp } from '../ui/shell.jsx'

/** Karşılama ekranında gösterilen, gerçekten hesaplanmış örnek plan. */
const ORNEK_TUTAR = 1_500_000_00
const ORNEK_PESINAT = 200_000_00
const ORNEK_TAKSIT = 40_000_00
const HUCRE_SAYISI = 16

function useExamplePlan() {
  return useMemo(() => {
    const input = new PlanInput({
      mode: 'installment',
      assetType: 'home',
      targetAmount: ORNEK_TUTAR,
      downPayment: ORNEK_PESINAT,
      initialInstallment: ORNEK_TAKSIT,
      pattern: { type: 'equal' },
      planStartMonth: MonthKey.current(),
    })
    return planService.createPlan(input, { withRecommendations: false })
  }, [])
}

/**
 * Takvim kartı: 12 aylık bir şerit ve teslimat ayına vurulmuş mühür.
 * Sitenin tek "yüksek sesli" görseli budur.
 */
function CalendarCard({ plan }) {
  const teslimat = plan.plannedDeliveryMonth
  // Teslimat şeridin dışına taşarsa pencere teslimat ayına kaydırılır.
  const ilkAy = Math.max(0, teslimat - (HUCRE_SAYISI - 4))
  const aylar = Array.from({ length: HUCRE_SAYISI }, (_, index) => ilkAy + index)

  return (
    <figure className="takvim-kart giris">
      <figcaption className="takvim-kart__ust">
        <span className="takvim-kart__etiket">Örnek plan · Ev</span>
        <span className="takvim-kart__tutar">{MoneyFormatter.compact(ORNEK_TUTAR)}</span>
      </figcaption>

      <div className="takvim-izgara">
        {aylar.map((offset, index) => {
          const teslimatMi = offset === teslimat
          const yil = MonthKey.year(plan.planStartMonth, offset)
          const oncekiYil = index > 0 ? MonthKey.year(plan.planStartMonth, aylar[index - 1]) : null
          return (
            <div
              key={offset}
              className={`takvim-hucre ${teslimatMi ? 'takvim-hucre--teslim' : ''}`}
              style={{ animationDelay: `${index * 45}ms` }}
            >
              <span className="takvim-hucre__ay">
                {MonthKey.shortLabel(plan.planStartMonth, offset)}
              </span>
              <span className="takvim-hucre__yil">{teslimatMi || yil !== oncekiYil ? yil :' '}</span>
            </div>
          )
        })}
      </div>

      <Stamp
        className="takvim-kart__damga"
        top="Anahtar"
        main={plan.deliveryLabel}
        animate
        // Mühür, hücreler yerine oturduktan sonra düşer.
        style={{ animationDelay: '820ms' }}
      />

      <div className="takvim-kart__alt">
        <div className="takvim-kart__olcu">
          <span>Aylık taksit</span>
          <strong>{MoneyFormatter.currencyAuto(ORNEK_TAKSIT)}</strong>
        </div>
        <div className="takvim-kart__olcu">
          <span>Vade</span>
          <strong>{plan.term} ay</strong>
        </div>
        <div className="takvim-kart__olcu">
          <span>Peşinat</span>
          <strong>{MoneyFormatter.compact(ORNEK_PESINAT)}</strong>
        </div>
      </div>
    </figure>
  )
}

const ADIMLAR = [
  {
    baslik: 'Hedefinizi yazın',
    metin: 'Ev, iş yeri, otomobil ya da motosiklet. Tutarı ve varsa peşinatı girin.',
  },
  {
    baslik: 'Tercihinizi seçin',
    metin: 'Teslimat tarihi mi, aylık taksit mi? Hangisi sizin için netse ondan başlayın.',
  },
  {
    baslik: 'Planınızı alın',
    metin: 'Ay ay tabloyu görün, PDF olarak indirin, tek dokunuşla WhatsApp’tan gönderin.',
  },
]

/** iPhone/iPad ve düğmesiz tarayıcılar için elle ekleme adımları. */
const KUR_ADIMLARI = {
  ios: [
    { ikon: 'iosShare', metin: 'Paylaş simgesine dokunun' },
    { ikon: 'plusSquare', metin: 'Listeyi kaydırıp “Ana Ekrana Ekle”ye dokunun' },
    { ikon: 'check', metin: 'Sağ üstteki “Ekle”ye dokunun, bitti' },
  ],
  menu: [
    { ikon: 'menuDots', metin: 'Tarayıcı menüsünü açın' },
    { ikon: 'plusSquare', metin: '“Uygulamayı yükle” / “Ana ekrana ekle”yi seçin' },
    { ikon: 'check', metin: 'Onaylayın, simge ana ekranınızda' },
  ],
}

/**
 * Düğmeyle kurulum yapılamayan tarayıcılarda açılan yönerge penceresi.
 *
 * iOS'ta ana ekrana ekleme için tarayıcıya açılmış bir API yok; kullanıcının
 * Paylaş menüsünden geçmesi şart. Bu yüzden düğme tek kalır, adımlar ancak
 * düğmeye basıldığında ve gereken cihazda görünür.
 */
function InstallSheet({ platform, pad, onClose }) {
  const pencereRef = useRef(null)

  useEffect(() => {
    // Odak pencereye alınır; kapatma düğmesine verilse açılışta halka çiziliyor.
    pencereRef.current?.focus()

    const tus = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', tus)

    // Pencere açıkken arkadaki sayfa kaymasın.
    const eskiTasma = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', tus)
      document.body.style.overflow = eskiTasma
    }
  }, [onClose])

  const ios = platform === 'ios'

  return (
    <div className="kur-perde" role="presentation" onClick={onClose}>
      <div
        className="kur-pencere"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kur-pencere-baslik"
        tabIndex={-1}
        ref={pencereRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="kur-pencere__ust">
          <h3 id="kur-pencere-baslik">
            {ios ? 'Ana ekrana eklemek için iki dokunuş' : 'Ana ekrana eklemek için'}
          </h3>
          <button
            className="kur-pencere__kapat"
            type="button"
            onClick={onClose}
            aria-label="Kapat"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <p className="kur-pencere__giris">
          {ios
            ? 'iPhone ve iPad’de kurulumu düğmeye bağlamaya Apple izin vermiyor. Yol da kısa:'
            : 'Tarayıcınız kurulumu düğmeye bağlamıyor; menüden iki adımda ekleyebilirsiniz:'}
        </p>

        <ol className="kur-adimlar">
          {KUR_ADIMLARI[platform].map((adim, index) => (
            <li key={adim.metin}>
              <span className="kur-adimlar__no" aria-hidden="true">
                {index + 1}
              </span>
              <Icon name={adim.ikon} size={19} />
              <span>{adim.metin}</span>
            </li>
          ))}
        </ol>

        {ios && (
          <p className={`kur-isaret ${pad ? 'kur-isaret--yukari' : ''}`}>
            <Icon name="arrowDown" size={20} />
            Paylaş simgesi tarayıcının {pad ? 'üst' : 'alt'} çubuğunda
          </p>
        )}

        <button className="dugme dugme--birincil dugme--genis" type="button" onClick={onClose}>
          Anladım
        </button>
      </div>
    </div>
  )
}

/**
 * Ana ekrana ekleme bölümü.
 *
 * Her cihazda tek bir düğme görünür: kurulum olayını veren tarayıcılarda düğme
 * doğrudan kurar, vermeyenlerde yönerge penceresini açar. Uygulama zaten ana
 * ekrandan açılmışsa bölüm hiç çizilmez.
 */
function InstallSection() {
  const { canInstall, install, installed, platform, pad } = useInstallPrompt()
  const [yonergeAcik, setYonergeAcik] = useState(false)
  const kapat = useCallback(() => setYonergeAcik(false), [])

  if (installed) return null

  return (
    <section className="kur-bolumu" aria-labelledby="kur-baslik">
      <div className="kabuk">
        <div className="kur-kart">
          <div className="kur-telefon" aria-hidden="true">
            <span className="kur-telefon__cerceve">
              <span className="kur-telefon__centik" />
              <BrandMark className="kur-telefon__rozet" />
              <span className="kur-telefon__ad">Ödeme Planı</span>
            </span>
          </div>

          <div className="kur-kart__metin">
            <p className="ustyazi">Uygulama gibi kullanın</p>
            <h2 className="bolum-baslik" id="kur-baslik">
              Telefonunuza kısayol ekleyin
            </h2>
            <p className="kur-kart__aciklama">
              Ana ekranınıza bir simge düşer; hesaplayıcı tek dokunuşla, tarayıcı adresi yazmadan
              açılır. Uygulama mağazasına gerek yok, yer kaplamaz ve ilk açılıştan sonra internet
              olmadan da çalışır.
            </p>

            <div className="kur-kart__eylem">
              <button
                className="dugme dugme--birincil"
                type="button"
                onClick={canInstall ? install : () => setYonergeAcik(true)}
              >
                <Icon name="download" size={19} />
                Telefona ekle
              </button>
            </div>
          </div>
        </div>
      </div>

      {yonergeAcik && <InstallSheet platform={platform} pad={pad} onClose={kapat} />}
    </section>
  )
}

export function HomePage() {
  const { navigate } = useRoute()
  const session = usePlanSession()
  const ornek = useExamplePlan()

  function baslat(mode) {
    session.setMode(mode)
    navigate(`/hesapla?mod=${mode === 'delivery' ? 'teslimat' : 'taksit'}`)
  }

  return (
    <>
      <section className="giris-bolumu">
        <div className="kabuk giris-izgara">
          <div className="giris-metin">
            <p className="ustyazi">Faizsiz tasarruf finansmanı</p>
            <h1 className="dev-baslik">
              Anahtarı hangi ay alacağınızı <em>bugün öğrenin</em>
            </h1>
            <p className="lede">
              Hedef tutarınızı yazın; teslimat ayınızı, vadenizi ve ay ay ödeme planınızı yarım
              dakikada görün. Faiz yok, kefil yok, üyelik yok.
            </p>

            <ul className="guven-satiri">
              <li>
                <Icon name="check" /> Ücretsiz
              </li>
              <li>
                <Icon name="check" /> Üyelik gerekmez
              </li>
              <li>
                <Icon name="check" /> Bilgileriniz cihazınızdan çıkmaz
              </li>
            </ul>

          </div>

          <CalendarCard plan={ornek} />
        </div>
      </section>

      <section className="adim-bolumu" aria-labelledby="adim-baslik">
        <div className="kabuk">
          <div className="bolum-kapak bolum-kapak--orta">
            <p className="ustyazi">Formül yok, sürpriz yok</p>
            <h2 className="bolum-baslik" id="adim-baslik">
              Üç adımda anlaşılır sonuç
            </h2>
          </div>

          <div className="adim-izgara">
            {ADIMLAR.map((adim, index) => (
              <article className="adim" key={adim.baslik}>
                <span className="adim__no" aria-hidden="true">
                  {index + 1}
                </span>
                <h3>{adim.baslik}</h3>
                <p>{adim.metin}</p>
              </article>
            ))}
          </div>

          {/* Hesaplama girişi, üç adımı okuduktan hemen sonra gelir. */}
          <div className="mod-izgara">
            <button className="mod-kart" type="button" onClick={() => baslat('delivery')}>
              <span className="mod-kart__ikon">
                <Icon name="calendar" />
              </span>
              <span className="mod-kart__ad">Teslimat tarihime göre</span>
              <span className="mod-kart__aciklama">
                Anahtarı ne zaman almak istediğinizi seçin, aylık ödemenizi hesaplayalım.
              </span>
              <span className="mod-kart__eylem">
                Tarihi seçeyim <Icon name="arrowRight" />
              </span>
            </button>

            <button className="mod-kart" type="button" onClick={() => baslat('installment')}>
              <span className="mod-kart__ikon">
                <Icon name="wallet" />
              </span>
              <span className="mod-kart__ad">Aylık bütçeme göre</span>
              <span className="mod-kart__aciklama">
                Her ay ayırabileceğiniz tutarı yazın, teslimat ayınızı hesaplayalım.
              </span>
              <span className="mod-kart__eylem">
                Bütçemi yazayım <Icon name="arrowRight" />
              </span>
            </button>
          </div>
        </div>
      </section>

      <InstallSection />

      <section className="danisman-bolumu" aria-labelledby="danisman-baslik">
        <div className="kabuk">
          <div className="danisman-kart">
            <div className="danisman-kart__metin">
              <p className="ustyazi">Hesaplamadan sonrası</p>
              <h2 className="danisman-kart__ad" id="danisman-baslik">
                {advisor.fullName}
              </h2>
              <p className="danisman-kart__unvan">{advisor.title}</p>
              <p className="danisman-kart__soz">
                Hesaplayıcı size fikir verir; rakamları güncel koşullarla birlikte gözden geçirmek
                ve size en uygun kurguyu bulmak benim işim. Planınızı gönderin, aynı gün dönüş
                yapayım.
              </p>
            </div>

            <div className="danisman-kart__eylemler">
              <a
                className="dugme dugme--yesil"
                href={contactService.whatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="whatsapp" size={20} />
                WhatsApp’tan yaz
              </a>
              <a className="dugme dugme--ikincil" href={contactService.phoneLink}>
                <Icon name="phone" size={19} />
                Ara
              </a>
              <a className="dugme dugme--ikincil" href={`mailto:${advisor.email}`}>
                <Icon name="mail" size={19} />
                E-posta
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

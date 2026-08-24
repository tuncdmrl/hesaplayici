import { useEffect, useMemo, useRef } from 'react'
import { ASSET_TYPES, getAssetType, PlanPolicy } from '../config/planPolicy.js'
import { MonthKey } from '../domain/MonthKey.js'
import { useRoute } from '../app/Router.jsx'
import { usePlanSession } from '../app/PlanSession.jsx'
import { Icon } from '../ui/Icon.jsx'
import { ChoiceGroup, MoneyField, NumberField, PercentField, SelectField } from '../ui/fields.jsx'

const MOD_SORGUSU = { delivery: 'teslimat', installment: 'taksit' }
const SORGU_MOD = { teslimat: 'delivery', taksit: 'installment' }

const TAKSIT_DESENLERI = [
  { value: 'equal', label: 'Eşit', description: 'Her ay aynı tutar' },
  { value: 'six', label: '6 ayda bir', description: 'Dönemsel artış' },
  { value: 'yearly', label: 'Yılda bir', description: 'Yıllık artış' },
  { value: 'afterDelivery', label: 'Teslimattan sonra', description: 'Bir kez artır, sabit devam et' },
]

/** Uzun teslimat listesini yıllara bölerek okunur hâle getirir. */
function useDeliveryOptions(planStartMonth, maxTerm) {
  return useMemo(() => {
    const gruplar = new Map()
    for (let offset = PlanPolicy.minDeliveryMonth; offset <= maxTerm; offset += 1) {
      const yil = MonthKey.year(planStartMonth, offset)
      if (!gruplar.has(yil)) gruplar.set(yil, [])
      gruplar.get(yil).push({ offset, label: MonthKey.label(planStartMonth, offset) })
    }
    return [...gruplar.entries()]
  }, [planStartMonth, maxTerm])
}

export function CalculatorPage() {
  const session = usePlanSession()
  const { navigate, query } = useRoute()
  const formRef = useRef(null)

  const mode = session.mode
  const form = session.form
  const errors = session.errors
  const values = form.values
  const maxTerm = form.maxTermMonths
  const deliveryOptions = useDeliveryOptions(values.planStartMonth, maxTerm)

  // Bağlantıdan gelen mod (ör. /hesapla?mod=taksit) oturuma uygulanır.
  useEffect(() => {
    const istenen = SORGU_MOD[query.get('mod')]
    if (istenen && istenen !== session.mode) session.setMode(istenen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.toString()])

  function degistir(alan, deger) {
    session.updateForm({ [alan]: deger })
  }

  function modDegistir(yeniMod) {
    session.setMode(yeniMod)
    navigate(`/hesapla?mod=${MOD_SORGUSU[yeniMod]}`, { replace: true, scrollToTop: false })
  }

  function gonder(event) {
    event.preventDefault()
    if (session.calculate()) {
      navigate('/plan')
      return
    }
    window.requestAnimationFrame(() => {
      formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
    })
  }

  return (
    <div className="kabuk kabuk--dar form-sayfa">
      <form className="belge form-belge" ref={formRef} onSubmit={gonder} noValidate>
        <div className="form-belge__ust">
          <div>
            <p className="ustyazi">Plan kurulumu</p>
            <h1>
              {mode === 'delivery' ? 'Teslimat tarihinizi seçin' : 'Aylık bütçenizi yazın'}
            </h1>
            <p>
              {mode === 'delivery'
                ? 'Anahtarı almak istediğiniz ayı söyleyin; gereken aylık ödemeyi ve vadeyi hesaplayalım.'
                : 'Her ay ayırabileceğiniz tutarı söyleyin; teslimat ayınızı ve vadeyi hesaplayalım.'}
            </p>
          </div>

          <div className="mod-degistir" role="group" aria-label="Hesaplama şekli">
            <button
              type="button"
              className="mod-degistir__secenek"
              aria-pressed={mode === 'delivery'}
              onClick={() => modDegistir('delivery')}
            >
              Tarihe göre
            </button>
            <button
              type="button"
              className="mod-degistir__secenek"
              aria-pressed={mode === 'installment'}
              onClick={() => modDegistir('installment')}
            >
              Bütçeye göre
            </button>
          </div>
        </div>

        <section className="form-adim" aria-labelledby="adim-hedef">
          <div className="form-adim__baslik">
            <span className="form-adim__no" aria-hidden="true">
              1
            </span>
            <div>
              <h2 id="adim-hedef">Ne için plan yapıyorsunuz?</h2>
              <p>Ürününüzü seçin, ardından hedef tutarı yazın.</p>
            </div>
          </div>

          <div className="urun-secici" role="group" aria-label="Ürün türü">
            {ASSET_TYPES.map((asset) => (
              <button
                key={asset.key}
                type="button"
                className="urun-secenek"
                aria-pressed={values.assetType === asset.key}
                onClick={() => session.setAssetType(asset.key)}
              >
                <Icon name={asset.icon} />
                <span>{asset.label}</span>
                <small>{asset.blurb}</small>
                {values.assetType === asset.key && (
                  <Icon name="check" className="urun-secenek__tik" size={18} />
                )}
              </button>
            ))}
          </div>

          <div className="alan-izgara alan-izgara--iki">
            <MoneyField
              id="hedef-tutar"
              label="Hedef tutar"
              hint={`Almak istediğiniz ${getAssetType(values.assetType).lowerLabel} için gereken toplam tutar.`}
              placeholder="Örn. 1.500.000"
              value={values.targetAmount}
              error={errors.targetAmount}
              onValueChange={(next) => degistir('targetAmount', next)}
              autoFocus
            />
            <MoneyField
              id="pesinat"
              label="Peşinat"
              hint="Başlangıçta ödeyebileceğiniz tutar. Peşinatınız yoksa 0 bırakın."
              placeholder="Örn. 150.000"
              value={values.downPayment}
              error={errors.downPayment}
              onValueChange={(next) => degistir('downPayment', next)}
            />
          </div>
        </section>

        <section className="form-adim" aria-labelledby="adim-odeme">
          <div className="form-adim__baslik">
            <span className="form-adim__no" aria-hidden="true">
              2
            </span>
            <div>
              <h2 id="adim-odeme">Ödeme tercihiniz</h2>
              <p>Bütçenize ve hedefinize uyan ödeme şeklini seçin.</p>
            </div>
          </div>

          {mode === 'installment' ? (
            <>
              <MoneyField
                id="aylik-taksit"
                label="Aylık ayırabileceğiniz tutar"
                hint="Bu yalnızca finansman taksidi. Organizasyon ödemesi sonuçta ayrıca gösterilir."
                placeholder="Örn. 25.000"
                value={values.initialInstallment}
                error={errors.initialInstallment}
                onValueChange={(next) => degistir('initialInstallment', next)}
              />

              <ChoiceGroup
                legend="Taksitleriniz nasıl değişsin?"
                options={TAKSIT_DESENLERI}
                value={values.installmentPattern}
                onChange={(next) => degistir('installmentPattern', next)}
              />

              {values.installmentPattern !== 'equal' && (
                <PercentField
                  id="taksit-artis"
                  label={
                    values.installmentPattern === 'afterDelivery'
                      ? 'Teslimat sonrası artış oranı'
                      : 'Artış oranı'
                  }
                  hint={
                    values.installmentPattern === 'afterDelivery'
                      ? 'Teslimat ayındaki taksit değişmez; takip eden ay bu oranda artar ve aynı tutarla devam eder.'
                      : `Her ${values.installmentPattern === 'six' ? '6 ayda' : 'yılda'} bir, önceki taksit bu oranda artar.`
                  }
                  value={values.installmentIncreaseRate}
                  error={errors.installmentIncreaseRate}
                  onValueChange={(next) => degistir('installmentIncreaseRate', next)}
                />
              )}
            </>
          ) : (
            <>
              <SelectField
                id="teslimat-ayi"
                label="Anahtarı ne zaman almak istiyorsunuz?"
                hint={`En erken ${PlanPolicy.minDeliveryMonth}. ay, en geç ${maxTerm}. ay seçilebilir.`}
                value={values.desiredDeliveryMonth}
                error={errors.desiredDeliveryMonth}
                onChange={(event) => degistir('desiredDeliveryMonth', event.target.value)}
              >
                {deliveryOptions.map(([yil, aylar]) => (
                  <optgroup key={yil} label={String(yil)}>
                    {aylar.map((ay) => (
                      <option key={ay.offset} value={ay.offset}>
                        {ay.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </SelectField>

              <SelectField
                id="teslimat-sonrasi"
                label="Teslimattan sonra nasıl ödemek istersiniz?"
                hint="Değişiklik, teslimat ayından sonraki ilk taksitte başlar."
                value={values.afterType}
                onChange={(event) => degistir('afterType', event.target.value)}
              >
                <option value="same">Aynı taksitle devam edeyim</option>
                <option value="oncePercent">Taksidi bir kez yüzde artırayım</option>
                <option value="fixed">Yeni aylık taksidi ben belirleyeyim</option>
                <option value="targetTerm">Toplam vadeyi ben seçeyim</option>
                <option value="periodic">6 veya 12 ayda bir artsın</option>
              </SelectField>

              {values.afterType === 'fixed' && (
                <MoneyField
                  id="teslimat-sonrasi-tutar"
                  label="Teslimat sonrası aylık taksit"
                  hint="Bu tutar teslimatı takip eden ayda başlar ve vadeyi kısaltır."
                  placeholder="Örn. 35.000"
                  value={values.afterFixedAmount}
                  error={errors.afterFixedAmount}
                  onValueChange={(next) => degistir('afterFixedAmount', next)}
                />
              )}

              {values.afterType === 'targetTerm' && (
                <NumberField
                  id="toplam-vade"
                  label="Toplam vade"
                  hint="Teslimat sonrası gereken taksidi sistem hesaplar."
                  min={Number(values.desiredDeliveryMonth || PlanPolicy.minDeliveryMonth) + 2}
                  max={maxTerm}
                  suffix="ay"
                  value={values.afterTargetTerm}
                  error={errors.afterTargetTerm}
                  onValueChange={(next) => degistir('afterTargetTerm', next)}
                />
              )}

              {(values.afterType === 'oncePercent' || values.afterType === 'periodic') && (
                <div className="alan-izgara alan-izgara--iki">
                  {values.afterType === 'periodic' && (
                    <SelectField
                      id="artis-sikligi"
                      label="Artış sıklığı"
                      value={values.afterPeriod}
                      onChange={(event) => degistir('afterPeriod', event.target.value)}
                    >
                      <option value="6">6 ayda bir</option>
                      <option value="12">Yılda bir</option>
                    </SelectField>
                  )}
                  <PercentField
                    id="teslimat-sonrasi-artis"
                    label={
                      values.afterType === 'periodic'
                        ? 'Her dönem artış oranı'
                        : 'Tek seferlik artış oranı'
                    }
                    hint="Seçtiğiniz oranda artış uygulanır."
                    value={values.afterIncreaseRate}
                    error={errors.afterIncreaseRate}
                    onValueChange={(next) => degistir('afterIncreaseRate', next)}
                  />
                </div>
              )}
            </>
          )}
        </section>

        <section className="form-adim form-adim--gonder" aria-labelledby="adim-sonuc">
          <div className="form-adim__baslik">
            <span className="form-adim__no" aria-hidden="true">
              3
            </span>
            <div>
              <h2 id="adim-sonuc">Planınızı görün</h2>
              <p>Teslimat ayı, vade ve ay ay ödeme tablosu birlikte hesaplanır.</p>
            </div>
          </div>

          <p className="gizlilik-satiri">
            <Icon name="lock" />
            Girdikleriniz yalnızca bu cihazda hesaplanır; kaydedilmez veya gönderilmez.
          </p>

          <button className="dugme dugme--birincil dugme--iri dugme--genis" type="submit">
            Planımı hesapla
          </button>

          <p style={{ marginTop: '0.9rem', textAlign: 'center' }}>
            <button className="metin-dugme" type="button" onClick={() => session.fillExample()}>
              Örnek verilerle doldur
            </button>
          </p>
        </section>
      </form>
    </div>
  )
}

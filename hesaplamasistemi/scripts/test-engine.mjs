/**
 * Hesaplama motorunun kural testleri.
 *
 *   npm test
 *
 * Rastgele üretilen yüzlerce senaryoda değişmez kuralların (toplamların
 * tutması, taksitlerin tam lira olması, 3 kat sınırı, %45 birikim şartı)
 * bozulmadığını doğrular. İş kurallarında bir değişiklik yaparken bu testler
 * hangi varsayımların kırıldığını gösterir.
 */
import assert from 'node:assert/strict'
import { ASSET_TYPES, PlanPolicy, getAssetType } from '../src/config/planPolicy.js'
import { Money, MoneyInput, parsePercent } from '../src/domain/Money.js'
import { MonthKey } from '../src/domain/MonthKey.js'
import { PlanInput } from '../src/domain/PlanInput.js'
import { PlanCalculator } from '../src/domain/PlanCalculator.js'
import { PlanService } from '../src/domain/PlanService.js'
import { OrganizationFeeSchedule } from '../src/domain/OrganizationFeeSchedule.js'

const calculator = new PlanCalculator()
const service = new PlanService(calculator)
const PLAN_BASI = '2026-08'

let gecen = 0
let kalan = 0

function test(ad, gövde) {
  try {
    gövde()
    gecen += 1
  } catch (error) {
    kalan += 1
    console.error(`\n✗ ${ad}\n  ${error.message}`)
  }
}

// ---------------------------------------------------------------- para birimi

test('Türkçe para girdisi kuruşa çevrilir', () => {
  assert.equal(MoneyInput.parse('1.500.000'), 150_000_000)
  assert.equal(MoneyInput.parse('1.500.000,50'), 150_000_050)
  assert.equal(MoneyInput.parse('25000'), 2_500_000)
  assert.equal(MoneyInput.parse('abc'), null)
  assert.equal(MoneyInput.parse(''), null)
})

test('Binlik ayırıcı yazarken doğru yerleşir', () => {
  assert.equal(MoneyInput.mask('1500000'), '1.500.000')
  assert.equal(MoneyInput.mask('1500000,5'), '1.500.000,5')
  assert.equal(MoneyInput.mask('12a'), null)
})

test('Kuruş → metin dönüşü kayıpsız', () => {
  for (const kurus of [0, 1, 99, 100, 150_000_00, 1_234_567_89]) {
    assert.equal(MoneyInput.parse(MoneyInput.toText(kurus)), kurus)
  }
})

test('Yüzde girdisi baz puana çevrilir', () => {
  assert.equal(parsePercent('10'), 1000)
  assert.equal(parsePercent('12,5'), 1250)
  assert.equal(parsePercent('101'), null)
})

test('Ay aritmetiği yıl sınırını doğru geçer', () => {
  assert.equal(MonthKey.add('2026-11', 3), '2027-02')
  assert.equal(MonthKey.add('2026-01', -1), '2025-12')
  assert.equal(MonthKey.label('2026-08', 18), 'Şubat 2028')
  assert.equal(MonthKey.rowLabel('2026-08', 1), 'Ağustos 2026')
})

// ------------------------------------------------------------ organizasyon ücreti

test('Organizasyon ücreti hedef tutarın %7’si ve 5 aya bölünür', () => {
  const takvim = new OrganizationFeeSchedule(1_500_000_00)
  assert.equal(takvim.total, 105_000_00)
  assert.equal(takvim.paymentAt(0), 0)
  assert.equal(
    takvim.payments.reduce((toplam, tutar) => toplam + tutar, 0),
    takvim.total,
  )
  assert.equal(takvim.lastMonth, 5)
})

// ------------------------------------------------------------------ bilinen plan

test('Örnek plan bilinen sonucu verir', () => {
  const plan = service.createPlan(
    new PlanInput({
      mode: 'installment',
      assetType: 'home',
      targetAmount: 1_500_000_00,
      downPayment: 200_000_00,
      initialInstallment: 40_000_00,
      pattern: { type: 'equal' },
      planStartMonth: PLAN_BASI,
    }),
  )
  assert.ok(plan.valid, 'plan geçerli olmalı')
  assert.equal(plan.plannedDeliveryMonth, 12)
  assert.equal(plan.deliveryLabel, 'Ağustos 2027')
  assert.equal(plan.term, 32)
  assert.equal(plan.organizationFee, 105_000_00)
})

test('Teslimat modu, seçilen tarihi tutturan düşük bir taksit bulur', () => {
  const taban = {
    mode: 'delivery',
    assetType: 'home',
    targetAmount: 1_500_000_00,
    downPayment: 150_000_00,
    desiredDeliveryMonth: 18,
    afterDelivery: { type: 'same' },
    planStartMonth: PLAN_BASI,
  }
  const plan = calculator.calculate(new PlanInput(taban))
  assert.ok(plan.valid)

  assert.equal(plan.plannedDeliveryMonth, taban.desiredDeliveryMonth)
  assert.equal(plan.firstInstallment % Money.LIRA, 0)

  // Yarı taksitle aynı teslimat ayı tutturulamamalı: bulunan tutar gerçekten
  // tarihin gerektirdiği seviyede.
  const yariTaksit = Math.floor(plan.firstInstallment / 2 / Money.LIRA) * Money.LIRA
  const zayif = calculator.calculate(
    new PlanInput({
      assetType: taban.assetType,
      targetAmount: taban.targetAmount,
      downPayment: taban.downPayment,
      planStartMonth: taban.planStartMonth,
      mode: 'installment',
      initialInstallment: yariTaksit,
      pattern: { type: 'equal' },
    }),
  )
  assert.ok(
    !zayif.valid || zayif.plannedDeliveryMonth > taban.desiredDeliveryMonth,
    'yarı taksitle teslimat tarihi tutturulmamalı',
  )
})

// ------------------------------------------------------------- rastgele senaryolar

let seed = 7
const rastgele = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
const arasinda = (min, max) => min + Math.floor(rastgele() * (max - min + 1))
const sec = (liste) => liste[Math.floor(rastgele() * liste.length)]

function rastgeleGirdi() {
  const asset = sec(ASSET_TYPES)
  const hedefLira = arasinda(150_000, 6_000_000)
  const taban = {
    assetType: asset.key,
    targetAmount: hedefLira * 100,
    downPayment: arasinda(0, Math.floor(hedefLira * 0.45)) * 100,
    planStartMonth: PLAN_BASI,
  }

  if (rastgele() < 0.5) {
    const desen = sec(['equal', 'six', 'yearly', 'afterDelivery'])
    const increaseBps = arasinda(1, 50) * 100
    return new PlanInput({
      ...taban,
      mode: 'installment',
      initialInstallment: arasinda(1_000, 200_000) * 100,
      pattern:
        desen === 'equal'
          ? { type: 'equal' }
          : desen === 'afterDelivery'
            ? { type: 'afterDeliveryOnce', increaseBps }
            : { type: 'periodic', periodMonths: desen === 'six' ? 6 : 12, increaseBps },
    })
  }

  const teslimat = arasinda(PlanPolicy.minDeliveryMonth, asset.maxTermMonths)
  const tercih = sec(['same', 'oncePercent', 'fixed', 'targetTerm', 'periodic'])
  const increaseBps = arasinda(1, 50) * 100
  const afterDelivery =
    tercih === 'same'
      ? { type: 'same' }
      : tercih === 'oncePercent'
        ? { type: 'oncePercent', increaseBps }
        : tercih === 'fixed'
          ? { type: 'fixed', amount: arasinda(1_000, 300_000) * 100 }
          : tercih === 'targetTerm'
            ? {
                type: 'targetTerm',
                totalTerm: arasinda(
                  Math.min(teslimat + 2, asset.maxTermMonths),
                  asset.maxTermMonths,
                ),
              }
            : { type: 'periodic', periodMonths: sec([6, 12]), increaseBps }

  return new PlanInput({ ...taban, mode: 'delivery', desiredDeliveryMonth: teslimat, afterDelivery })
}

const SENARYO_SAYISI = 600
const senaryolar = Array.from({ length: SENARYO_SAYISI }, rastgeleGirdi)
const planlar = senaryolar.map((girdi) => calculator.calculate(girdi))
const gecerliPlanlar = planlar.filter((plan) => plan.valid)

test(`${SENARYO_SAYISI} rastgele senaryonun anlamlı bir kısmı geçerli plan üretir`, () => {
  assert.ok(
    gecerliPlanlar.length > SENARYO_SAYISI * 0.4,
    `yalnızca ${gecerliPlanlar.length} geçerli plan çıktı`,
  )
})

test('Geçerli planlarda taksitler toplamı finansman bakiyesine eşittir', () => {
  for (const plan of gecerliPlanlar) {
    const toplam = plan.installmentRows.reduce((acc, row) => acc + row.financingPayment, 0)
    assert.equal(
      toplam,
      plan.input.financedAmount,
      `${plan.input.asset.label}: taksit toplamı ${toplam} ≠ bakiye ${plan.input.financedAmount}`,
    )
  }
})

test('Taksitler tam liradır, kuruş kalmaz', () => {
  for (const plan of gecerliPlanlar) {
    for (const row of plan.installmentRows) {
      assert.equal(row.financingPayment % Money.LIRA, 0)
    }
  }
})

test('En yüksek taksit, en düşüğün 3 katını aşmaz', () => {
  for (const plan of gecerliPlanlar) {
    assert.ok(
      plan.maxInstallment <= PlanPolicy.maxInstallmentMultiple * plan.minInstallment,
      `${plan.maxInstallment} > 3 × ${plan.minInstallment}`,
    )
  }
})

test('Teslimat en erken 6. ayda ve vade sınırı içindedir', () => {
  for (const plan of gecerliPlanlar) {
    assert.ok(plan.plannedDeliveryMonth >= PlanPolicy.minDeliveryMonth)
    assert.ok(plan.term <= getAssetType(plan.input.assetType).maxTermMonths)
    assert.ok(plan.plannedDeliveryMonth < plan.term + 1)
  }
})

test('Teslimat ayında hedef tutarın en az %45’i birikmiştir', () => {
  for (const plan of gecerliPlanlar) {
    const teslimatSatiri = plan.deliveryRow
    assert.ok(teslimatSatiri, 'teslimat satırı bulunmalı')
    assert.ok(
      teslimatSatiri.cumulativePaid >= plan.deliveryThreshold,
      `birikim ${teslimatSatiri.cumulativePaid} < eşik ${plan.deliveryThreshold}`,
    )
  }
})

test('Organizasyon ödemeleri her planda ücretin tamamını karşılar', () => {
  for (const plan of gecerliPlanlar) {
    const toplam = plan.rows.reduce((acc, row) => acc + row.organizationPayment, 0)
    assert.equal(toplam, plan.organizationFee)
  }
})

test('Kalan bakiye monoton azalır ve sıfırın altına inmez', () => {
  for (const plan of gecerliPlanlar) {
    let onceki = Number.POSITIVE_INFINITY
    for (const row of plan.rows) {
      assert.ok(row.remainingFinancing >= 0)
      assert.ok(row.remainingFinancing <= onceki)
      onceki = row.remainingFinancing
    }
  }
})

test('Teslimat modunda plan tam olarak istenen ayda teslim eder', () => {
  for (const plan of gecerliPlanlar.filter((p) => !p.input.isInstallmentMode)) {
    assert.equal(plan.plannedDeliveryMonth, plan.input.desiredDeliveryMonth)
  }
})

test('Önerilen alternatiflerin hepsi yeniden hesaplandığında geçerlidir', () => {
  const gecersizler = senaryolar
    .map((girdi) => ({ girdi, plan: service.createPlan(girdi) }))
    .filter(({ plan }) => !plan.valid && plan.recommendations.length > 0)
    .slice(0, 30)

  assert.ok(gecersizler.length > 0, 'öneri üreten en az bir senaryo bulunmalı')

  for (const { plan } of gecersizler) {
    for (const oneri of plan.recommendations) {
      const yeniden = calculator.calculate(oneri.input)
      assert.ok(yeniden.valid, `öneri geçersiz çıktı: ${oneri.title}`)
      assert.equal(yeniden.term, oneri.term)
    }
  }
})

console.log(`\n${gecen} test geçti, ${kalan} test kaldı.`)
process.exit(kalan === 0 ? 0 : 1)

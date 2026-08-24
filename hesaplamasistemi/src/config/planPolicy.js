/**
 * Tasarruf finansmanı iş kuralları.
 *
 * Hesaplama motorunun tamamı bu dosyadaki değerleri okur; oranlar veya vade
 * sınırları değiştiğinde başka hiçbir dosyaya dokunmak gerekmez.
 */

/** Bir liranın kuruş karşılığı. Tüm tutarlar tam sayı kuruş olarak tutulur. */
export const LIRA = 100

/** Yüzde değerleri baz puan (bps) olarak tutulur: %7 = 700 bps. */
export const BPS = 10_000

export class AssetType {
  /**
   * @param {{key:string,label:string,accusative:string,maxTermMonths:number,icon:string,blurb:string}} config
   */
  constructor(config) {
    this.key = config.key
    this.label = config.label
    /** "…nizi" ekli hâli: "evinizi", "otomobilinizi". */
    this.accusative = config.accusative
    this.maxTermMonths = config.maxTermMonths
    this.icon = config.icon
    this.blurb = config.blurb
    Object.freeze(this)
  }

  get lowerLabel() {
    return this.label.toLocaleLowerCase('tr-TR')
  }
}

/**
 * Sunulan ürünler. Yeni bir ürün eklemek için listeye bir satır eklemek yeterli;
 * form, sonuç ekranı ve PDF otomatik olarak yeni ürünü tanır.
 */
export const ASSET_TYPES = Object.freeze([
  new AssetType({
    key: 'home',
    label: 'Ev',
    accusative: 'evinizi',
    maxTermMonths: 200,
    icon: 'home',
    blurb: 'Konut, arsa veya yazlık',
  }),
  new AssetType({
    key: 'workplace',
    label: 'İş yeri',
    accusative: 'iş yerinizi',
    maxTermMonths: 200,
    icon: 'workplace',
    blurb: 'Dükkân, ofis veya depo',
  }),
  new AssetType({
    key: 'vehicle',
    label: 'Otomobil',
    accusative: 'otomobilinizi',
    maxTermMonths: 110,
    icon: 'vehicle',
    blurb: 'Binek veya ticari araç',
  }),
  new AssetType({
    key: 'motorcycle',
    label: 'Motosiklet',
    accusative: 'motosikletinizi',
    maxTermMonths: 110,
    icon: 'motorcycle',
    blurb: 'Scooter ve ATV dahil',
  }),
])

const ASSET_INDEX = new Map(ASSET_TYPES.map((asset) => [asset.key, asset]))

/** @returns {AssetType} */
export function getAssetType(key) {
  const asset = ASSET_INDEX.get(key)
  if (!asset) throw new Error(`Tanımsız ürün tipi: ${key}`)
  return asset
}

export const PlanPolicy = Object.freeze({
  /** Teslimatın olabileceği en erken ay (plan başlangıcından itibaren). */
  minDeliveryMonth: 6,

  /** Organizasyon (hizmet) bedeli: hedef tutarın %7'si. */
  organizationFeeBps: 700,

  /**
   * Organizasyon bedelinin yarısı ilk ay, kalanı takip eden 4 aya bölünerek ödenir.
   * Dizideki her eleman "kaç parçaya bölüneceğini" değil, ödeme takvimini tanımlar.
   */
  organizationFeeFirstShare: 2,
  organizationFeeRemainingMonths: 4,

  /** Teslimat için biriktirilmesi gereken oran: hedef tutarın %45'i. */
  deliveryThresholdBps: 4_500,

  /**
   * Bir plan içindeki en yüksek taksit, en düşük taksidin en fazla bu katı olabilir.
   * Artışlar bu tavana ulaştığında sabitlenir.
   */
  maxInstallmentMultiple: 3,

  /** Taksitler tam liraya yuvarlanır; kuruşlu taksit oluşturulmaz. */
  installmentStep: LIRA,
})

/** Artış aralığı olarak sunulan seçenekler (ay). */
export const INCREASE_PERIODS = Object.freeze([6, 12])

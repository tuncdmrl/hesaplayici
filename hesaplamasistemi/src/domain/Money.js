import { BPS, LIRA } from '../config/planPolicy.js'

/**
 * Para işlemleri.
 *
 * Kayan noktalı sayılarda 0,1 + 0,2 problemi yaşamamak için bütün tutarlar
 * tam sayı **kuruş** olarak taşınır. Bu sınıf yalnızca statik yardımcılardan
 * oluşur; bir tutarı temsil etmez, tutarlar üzerinde işlem yapar.
 */
export class Money {
  static LIRA = LIRA

  /** Yukarı yuvarlayan tam sayı bölme (BigInt ile taşma riski yok). */
  static ceilDiv(value, divisor) {
    const v = BigInt(value)
    const d = BigInt(divisor)
    if (d <= 0n) throw new Error('Bölen pozitif olmalıdır.')
    return Number(v <= 0n ? 0n : (v + d - 1n) / d)
  }

  /** (value × multiplier / divisor), en yakın tam sayıya yuvarlanır. */
  static mulDiv(value, multiplier, divisor) {
    const result =
      (BigInt(value) * BigInt(multiplier) + BigInt(Math.floor(divisor / 2))) / BigInt(divisor)
    return Number(result)
  }

  /** Tutarın baz puan (bps) karşılığı: applyBps(1000, 700) → %7'si. */
  static applyBps(value, bps) {
    return Money.mulDiv(value, bps, BPS)
  }

  /** Tutarı baz puan kadar artırır: increaseByBps(1000, 700) → 1070. */
  static increaseByBps(value, bps) {
    return Money.mulDiv(value, BPS + bps, BPS)
  }

  /** Tam liraya aşağı yuvarlar. */
  static floorToLira(value) {
    return Math.floor(value / LIRA) * LIRA
  }

  static isPositiveAmount(value) {
    return Number.isSafeInteger(value) && value > 0
  }
}

const currencyFormatters = new Map()

function currencyFormatter(fractionDigits) {
  let formatter = currencyFormatters.get(fractionDigits)
  if (!formatter) {
    formatter = new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    currencyFormatters.set(fractionDigits, formatter)
  }
  return formatter
}

/** Kuruş cinsinden tutarları ekranda ve PDF'te göstermek için biçimlendirici. */
export class MoneyFormatter {
  /** "1.000.000,00 ₺" */
  static currency(kurus, fractionDigits = 2) {
    return currencyFormatter(fractionDigits).format(kurus / 100)
  }

  /** Kuruş hanesi sıfırsa gizler: "1.000.000 ₺" */
  static currencyAuto(kurus) {
    return MoneyFormatter.currency(kurus, kurus % 100 === 0 ? 0 : 2)
  }

  /** Simgesiz: "1.000.000" */
  static plain(kurus) {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: kurus % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(kurus / 100)
  }

  /** Tabloda sıfır yerine tire gösterir. */
  static cell(kurus) {
    return kurus === 0 ? '—' : MoneyFormatter.plain(kurus)
  }

  /** Kısaltılmış gösterim: 1.250.000 → "1,25 mn ₺" */
  static compact(kurus) {
    const lira = kurus / 100
    if (lira >= 1_000_000) {
      return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(lira / 1_000_000)} mn ₺`
    }
    if (lira >= 1_000) {
      return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(lira / 1_000)} bin ₺`
    }
    return MoneyFormatter.currencyAuto(kurus)
  }
}

/**
 * Kullanıcının yazdığı metni kuruşa çeviren ve yazarken binlik ayırıcı ekleyen
 * yardımcı. Türkçe girdi alışkanlıklarına göre çalışır: nokta binlik, virgül
 * ondalık ayırıcıdır ("1.250.000,50").
 */
export class MoneyInput {
  /** Metni kuruşa çevirir; geçersizse null döner. */
  static parse(text) {
    const trimmed = String(text ?? '').trim()
    if (!trimmed || /[eE+-]/.test(trimmed)) return null

    const cleaned = trimmed.replace(/\s/g, '').replace(/₺|TL/gi, '')
    if (!/^[\d.,]+$/.test(cleaned)) return null

    const lastComma = cleaned.lastIndexOf(',')
    const lastDot = cleaned.lastIndexOf('.')
    const lastSeparator = Math.max(lastComma, lastDot)
    const commaGroups = cleaned.split(',')
    const commasAreThousands =
      commaGroups.length > 2 && commaGroups.slice(1).every((group) => /^\d{3}$/.test(group))

    let integerPart = cleaned
    let fractionPart = ''

    if (lastSeparator >= 0) {
      const tail = cleaned.slice(lastSeparator + 1)
      const separatorCount = (cleaned.match(/[.,]/g) ?? []).length
      let treatAsFraction = false

      if (lastComma >= 0 && !commasAreThousands) {
        if (tail.length > 2) return null
        treatAsFraction = tail.length > 0
      } else if (lastComma < 0) {
        treatAsFraction = tail.length > 0 && tail.length <= 2 && (separatorCount === 1 || tail.length !== 3)
      }

      if (treatAsFraction) {
        integerPart = cleaned.slice(0, lastSeparator)
        fractionPart = tail
      }
    }

    integerPart = integerPart.replace(/[.,]/g, '')
    if (!/^\d+$/.test(integerPart)) return null
    if (fractionPart && !/^\d{1,2}$/.test(fractionPart)) return null

    const lira = Number(integerPart)
    const kurus = fractionPart ? Number(fractionPart.padEnd(2, '0')) : 0
    const total = lira * 100 + kurus
    return Number.isSafeInteger(total) ? total : null
  }

  /** Yazım sırasında binlik ayırıcıları yerleştirir; geçersiz karakterde null döner. */
  static mask(text) {
    if (/[eE+-]/.test(text)) return null
    const cleaned = text.replace(/₺|TL/gi, '').replace(/\s/g, '')
    if (!cleaned) return ''
    if (!/^[\d.,]+$/.test(cleaned)) return null

    const commaCount = (cleaned.match(/,/g) ?? []).length
    const commaGroups = cleaned.split(',')
    const commasAreThousands =
      commaCount > 1 && commaGroups.slice(1).every((group) => /^\d{3}$/.test(group))
    const separatorIndex = commasAreThousands ? -1 : cleaned.lastIndexOf(',')

    const rawInteger = separatorIndex >= 0 ? cleaned.slice(0, separatorIndex) : cleaned
    const rawFraction = separatorIndex >= 0 ? cleaned.slice(separatorIndex + 1) : ''
    const digitsOnly = rawInteger.replace(/[.,]/g, '')
    const fraction = rawFraction.replace(/[.,]/g, '').slice(0, 2)

    if (digitsOnly && !/^\d+$/.test(digitsOnly)) return null

    const grouped = (digitsOnly || '0')
      .replace(/^0+(?=\d)/, '')
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.')

    return separatorIndex >= 0 ? `${grouped},${fraction}` : grouped
  }

  /** Kuruş değerini input alanında gösterilecek metne çevirir. */
  static toText(kurus) {
    const lira = Math.floor(kurus / 100)
    const fraction = kurus % 100
    const grouped = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(lira)
    return fraction ? `${grouped},${String(fraction).padStart(2, '0')}` : grouped
  }
}

/** Yüzde girdisini baz puana çevirir: "12,5" → 1250. */
export function parsePercent(text) {
  const normalized = String(text ?? '').trim().replace(',', '.')
  if (!normalized || !/^\d{1,3}(?:\.\d{1,2})?$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0 || value > 100) return null
  return Math.round(value * 100)
}

/** Baz puanı yüzde metnine çevirir: 1250 → "12,5". */
export function formatPercent(bps) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(bps / 100)
}

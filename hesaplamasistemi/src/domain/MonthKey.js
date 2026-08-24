const PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/

const monthYearFormatter = new Intl.DateTimeFormat('tr-TR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const shortMonthFormatter = new Intl.DateTimeFormat('tr-TR', {
  month: 'short',
  timeZone: 'UTC',
})

/**
 * "2026-08" biçiminde ay anahtarları üzerinde takvim aritmetiği.
 *
 * Gün bilgisi taşımaz; plan hesaplamaları ay bazında yapıldığı için yaz saati
 * ve ayın kaç çektiği gibi sorunlar tamamen devre dışı kalır.
 */
export class MonthKey {
  /** İçinde bulunulan ay. */
  static current(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }

  static parse(key) {
    const match = PATTERN.exec(String(key ?? ''))
    return match ? { year: Number(match[1]), monthIndex: Number(match[2]) - 1 } : null
  }

  static isValid(key) {
    return MonthKey.parse(key) !== null
  }

  /** Geçersiz anahtarları bu ayla değiştirir. */
  static normalize(key) {
    return key && MonthKey.isValid(key) ? key : MonthKey.current()
  }

  /** Ay anahtarına ay ekler: add('2026-11', 3) → '2027-02'. */
  static add(key, offset) {
    const base = MonthKey.parse(MonthKey.normalize(key))
    const date = new Date(Date.UTC(base.year, base.monthIndex + Math.trunc(offset), 1))
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  }

  static toDate(key) {
    const parsed = MonthKey.parse(MonthKey.normalize(key))
    return new Date(Date.UTC(parsed.year, parsed.monthIndex, 1))
  }

  /** "Mart 2028" */
  static label(key, offset = 0) {
    const text = monthYearFormatter.format(MonthKey.toDate(MonthKey.add(key, offset)))
    return text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1)
  }

  /** "Mar" — şerit ve grafik etiketleri için. */
  static shortLabel(key, offset = 0) {
    const text = shortMonthFormatter.format(MonthKey.toDate(MonthKey.add(key, offset)))
    return text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1).replace('.', '')
  }

  /** Yıl: 2028 */
  static year(key, offset = 0) {
    return MonthKey.parse(MonthKey.add(key, offset)).year
  }

  /**
   * Ödeme tablosunda 1. taksit planın başladığı aya denk gelir.
   * rowLabel(key, 1) → planın başladığı ay.
   */
  static rowLabel(key, monthNumber) {
    const safe = Number.isFinite(monthNumber) ? Math.max(1, Math.trunc(monthNumber)) : 1
    return MonthKey.label(key, safe - 1)
  }
}

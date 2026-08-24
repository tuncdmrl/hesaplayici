import { PlanPolicy } from '../../config/planPolicy.js'

const STEP = PlanPolicy.installmentStep

/**
 * Ham taksit dizilerini "uygulanabilir" hâle getiren yardımcılar.
 *
 * İki kural vardır:
 *  1. Taksitler tam liradır (kuruşlu taksit oluşturulmaz).
 *  2. En yüksek taksit, en düşük taksidin en fazla 3 katı olabilir.
 *
 * Yuvarlamadan artakalan tutar son taksitlere aktarılır; bu son taksidi
 * orantısız büyütürse kuyruk yeniden dengelenir.
 */
export class InstallmentNormalizer {
  /** En yüksek / en düşük taksit oranı sınır içinde mi? */
  static ratioIsAcceptable(payments) {
    const positives = payments.filter((amount) => amount > 0)
    if (positives.length <= 1) return true
    return Math.max(...positives) <= PlanPolicy.maxInstallmentMultiple * Math.min(...positives)
  }

  /**
   * Oran sınırı aşıldıysa, dizinin sonundan başlayarak giderek daha uzun bir
   * kuyruğu eşitlemeyi dener. Toplam tutar korunur.
   */
  static rebalanceTail(payments) {
    const result = [...payments]
    if (result.some((amount) => amount % STEP !== 0)) {
      return { payments: result, changed: false, valid: false }
    }

    const positiveIndexes = result
      .map((amount, index) => ({ amount, index }))
      .filter(({ amount }) => amount > 0)
      .map(({ index }) => index)

    if (positiveIndexes.length <= 1) return { payments: result, changed: false, valid: true }
    if (InstallmentNormalizer.ratioIsAcceptable(result)) {
      return { payments: result, changed: false, valid: true }
    }

    for (let start = positiveIndexes.length - 2; start >= 0; start -= 1) {
      const candidate = [...result]
      const tail = positiveIndexes.slice(start)
      const tailTotal = tail.reduce((sum, index) => sum + candidate[index], 0)
      if (tailTotal % STEP !== 0) continue

      const units = tailTotal / STEP
      const share = Math.floor(units / tail.length)
      const leftover = units % tail.length

      for (let position = 0; position < tail.length; position += 1) {
        const getsExtra = position >= tail.length - leftover
        candidate[tail[position]] = (share + (getsExtra ? 1 : 0)) * STEP
      }

      if (InstallmentNormalizer.ratioIsAcceptable(candidate)) {
        return { payments: candidate, changed: true, valid: true }
      }
    }

    return { payments: result, changed: false, valid: false }
  }

  /**
   * Taksitleri tam liraya indirir; `total` verildiyse artakalanı son takside
   * ekleyip toplamı birebir tutturur.
   */
  static toWholeLira(payments, total) {
    if (total !== undefined && total % STEP !== 0) {
      return { payments: [...payments], tailRebalanced: false, valid: false }
    }

    const floored = payments.map((amount) => Math.floor(amount / STEP) * STEP)
    if (total === undefined) return { payments: floored, tailRebalanced: false, valid: true }
    if (floored.length === 0) return { payments: floored, tailRebalanced: false, valid: total === 0 }

    const sum = floored.reduce((acc, amount) => acc + amount, 0)
    const difference = total - sum
    if (difference < 0 || difference % STEP !== 0) {
      return { payments: [...payments], tailRebalanced: false, valid: false }
    }

    floored[floored.length - 1] += difference
    const rebalanced = InstallmentNormalizer.rebalanceTail(floored)

    return {
      payments: rebalanced.payments,
      tailRebalanced: rebalanced.changed,
      valid:
        rebalanced.payments.every((amount) => amount % STEP === 0) &&
        rebalanced.payments.reduce((acc, amount) => acc + amount, 0) === total,
    }
  }

  /**
   * Son ay yalnızca küçük bir bakiye kaldığı için kırpıldıysa, gereksiz bir ay
   * daha eklememek adına son iki taksidi birleştirmeyi dener.
   */
  static mergeShortTail(payments, shouldMerge) {
    if (!shouldMerge || payments.length < 2) return { payments: [...payments], changed: false }

    const merged = payments.slice(0, -2)
    merged.push(payments[payments.length - 2] + payments[payments.length - 1])

    if (InstallmentNormalizer.ratioIsAcceptable(merged)) return { payments: merged, changed: true }

    const rebalanced = InstallmentNormalizer.rebalanceTail(merged)
    if (rebalanced.valid && InstallmentNormalizer.ratioIsAcceptable(rebalanced.payments)) {
      return { payments: rebalanced.payments, changed: true }
    }

    return { payments: [...payments], changed: false }
  }

  /** Bir tutarı, mümkün olduğunca eşit ve tam lira olacak şekilde aylara böler. */
  static distribute(amount, months) {
    if (months <= 0) return []

    if (amount % STEP !== 0) {
      const share = Math.floor(amount / months)
      const leftover = amount % months
      return Array.from({ length: months }, (_, index) =>
        index >= months - leftover ? share + 1 : share,
      )
    }

    const units = amount / STEP
    const share = Math.floor(units / months)
    const leftover = units % months
    return Array.from({ length: months }, (_, index) =>
      (index >= months - leftover ? share + 1 : share) * STEP,
    )
  }
}

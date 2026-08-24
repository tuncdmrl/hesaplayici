import { createContext, useContext, useSyncExternalStore } from 'react'
import { planService } from '../domain/PlanService.js'
import { PlanInput } from '../domain/PlanInput.js'
import { CalculatorForm } from './CalculatorForm.js'
import { Store } from './Store.js'

const DEPO_ANAHTARI = 'anahtar-ayi/oturum'

/**
 * Kullanıcının bu oturumdaki tercihleri ve son hesaplanan plan.
 *
 * Hiçbir veri sunucuya gönderilmez; sayfa yenilendiğinde kaybolmaması için
 * yalnızca tarayıcının oturum belleğinde tutulur.
 */
export class PlanSession extends Store {
  constructor(service = planService) {
    super()
    this.service = service
    this.mode = 'delivery'
    this.form = CalculatorForm.initial()
    this.errors = {}
    this.result = null
    this.restore()
  }

  setMode(mode) {
    if (this.mode === mode) return
    this.mode = mode
    this.errors = {}
    this.emit()
    this.persist()
  }

  updateForm(patch) {
    this.form = this.form.with(patch)
    for (const key of Object.keys(patch)) delete this.errors[key]
    this.emit()
  }

  setAssetType(assetType) {
    this.form = this.form.withAssetType(assetType)
    delete this.errors.desiredDeliveryMonth
    delete this.errors.afterTargetTerm
    this.emit()
  }

  fillExample() {
    this.form = CalculatorForm.example()
    this.errors = {}
    this.emit()
  }

  /**
   * Formu hesaplar. Alan hataları varsa `false` döner ve hatalar arayüze yansır.
   * @returns {boolean} hesaplama yapıldı mı
   */
  calculate() {
    const { input, errors } = this.form.toPlanInput(this.mode)
    this.errors = errors

    if (!input) {
      this.emit()
      return false
    }

    this.result = this.service.createPlan(input)
    this.emit()
    this.persist()
    return true
  }

  /** Geçersiz plan ekranındaki bir öneriyi uygular ve yeniden hesaplar. */
  applyRecommendation(recommendation) {
    this.mode = recommendation.input.mode
    this.form = CalculatorForm.fromPlanInput(recommendation.input)
    this.errors = {}
    this.result = this.service.createPlan(recommendation.input)
    this.emit()
    this.persist()
  }

  clearResult() {
    this.result = null
    this.emit()
  }

  persist() {
    try {
      const payload = {
        mode: this.mode,
        form: this.form.values,
        input: this.result?.input.toSpec() ?? null,
      }
      window.sessionStorage.setItem(DEPO_ANAHTARI, JSON.stringify(payload))
    } catch {
      // Depolama kapalıysa sessizce devam et; uygulama bellekten çalışmayı sürdürür.
    }
  }

  restore() {
    try {
      const raw = window.sessionStorage.getItem(DEPO_ANAHTARI)
      if (!raw) return
      const payload = JSON.parse(raw)
      if (payload.mode) this.mode = payload.mode
      if (payload.form) this.form = new CalculatorForm(payload.form)
      if (payload.input) this.result = this.service.createPlan(new PlanInput(payload.input))
    } catch {
      // Bozuk kayıt varsa temiz başla.
    }
  }
}

const PlanSessionContext = createContext(null)

export function PlanSessionProvider({ session, children }) {
  return <PlanSessionContext.Provider value={session}>{children}</PlanSessionContext.Provider>
}

export function usePlanSession() {
  const session = useContext(PlanSessionContext)
  if (!session) throw new Error('usePlanSession yalnızca PlanSessionProvider içinde kullanılabilir.')
  useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  return session
}

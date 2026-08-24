import { PlanCalculator } from './PlanCalculator.js'
import { RecommendationEngine } from './RecommendationEngine.js'

/**
 * Arayüzün konuştuğu tek nokta.
 *
 * Planı hesaplar; plan oluşmadıysa (ve sorun eksik/hatalı girdi değilse)
 * uygulanabilir alternatifleri de üretip sonuca ekler.
 */
export class PlanService {
  constructor(calculator = new PlanCalculator()) {
    this.calculator = calculator
    this.recommendations = new RecommendationEngine(calculator)
  }

  /**
   * @param {import('./PlanInput.js').PlanInput} input
   * @param {{withRecommendations?: boolean}} options
   */
  createPlan(input, options = {}) {
    const withRecommendations = options.withRecommendations ?? true
    const result = this.calculator.calculate(input)

    if (result.valid || !withRecommendations) return result

    // Girdinin kendisi eksikse öneri üretmenin anlamı yok; kullanıcı önce
    // eksik alanı doldurmalı.
    if (result.violations.some((violation) => violation.code === 'INVALID_INPUT')) return result

    return result.withRecommendations(this.recommendations.suggest(input))
  }
}

export const planService = new PlanService()

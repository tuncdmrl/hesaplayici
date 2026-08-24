import { createContext, useContext, useSyncExternalStore } from 'react'
import { Store } from './Store.js'

/**
 * Küçük, bağımlılıksız yönlendirici.
 *
 * Uygulamada üç ekran var; harici bir yönlendirme kütüphanesi taşımak yerine
 * History API'sini saran bu sınıf yeterli. Yeni bir sayfa eklemek için
 * `App.jsx` içindeki eşlemeye bir satır eklemek yetiyor.
 */
export class Router extends Store {
  constructor(history = window.history, location = window.location) {
    super()
    this.history = history
    this.location = location
    this.path = location.pathname
    this.query = new URLSearchParams(location.search)

    window.addEventListener('popstate', () => this.#sync())
  }

  #sync() {
    this.path = this.location.pathname
    this.query = new URLSearchParams(this.location.search)
    this.emit()
  }

  /**
   * Sayfa değiştirir.
   *
   * Sınıf alanı olarak tanımlıdır; böylece her render'da aynı referans döner ve
   * bağımlılık listelerinde kullanılabilir.
   *
   * @param {string} to "/hesapla?mod=teslimat" biçiminde
   */
  navigate = (to, { replace = false, scrollToTop = true } = {}) => {
    const current = `${this.location.pathname}${this.location.search}`
    if (to !== current) {
      this.history[replace ? 'replaceState' : 'pushState']({}, '', to)
      this.#sync()
    }
    if (scrollToTop) {
      window.requestAnimationFrame(() =>
        window.scrollTo({ top: 0, behavior: this.#prefersReducedMotion() ? 'auto' : 'smooth' }),
      )
    }
  }

  back() {
    this.history.back()
  }

  #prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  }
}

const RouterContext = createContext(null)

export function RouterProvider({ router, children }) {
  return <RouterContext.Provider value={router}>{children}</RouterContext.Provider>
}

export function useRouter() {
  const router = useContext(RouterContext)
  if (!router) throw new Error('useRouter yalnızca RouterProvider içinde kullanılabilir.')
  useSyncExternalStore(router.subscribe, router.getSnapshot, router.getSnapshot)
  return router
}

/**
 * Geçerli yolu, sorgu parametrelerini ve `navigate` işlevini döner.
 *
 * `useRouter` zaten yönlendiriciye abone olduğu için yol değişince bileşen
 * yeniden çizilir; `navigate` sabit bir referanstır.
 */
export function useRoute() {
  const router = useRouter()
  return { path: router.path, query: router.query, navigate: router.navigate }
}

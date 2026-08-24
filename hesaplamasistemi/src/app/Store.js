/**
 * React'ın `useSyncExternalStore` API'siyle çalışan minimal gözlemlenebilir taban.
 *
 * Uygulama durumunu sınıflarda tutabilmek için kullanılır: alt sınıf durumu
 * değiştirdiğinde `emit()` çağırır, ona abone bileşenler yeniden çizilir.
 */
export class Store {
  #listeners = new Set()
  #version = 0

  subscribe = (listener) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  getSnapshot = () => this.#version

  emit() {
    this.#version += 1
    for (const listener of this.#listeners) listener()
  }
}

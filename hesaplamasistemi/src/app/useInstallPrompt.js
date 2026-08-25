import { useCallback, useEffect, useState } from 'react'

/** Uygulama ana ekrandan (tam ekran kısayoldan) açıldıysa kurulum zaten yapılmış demektir. */
function kuruluMu() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.navigator.standalone === true
  )
}

/**
 * iPhone/iPad'de `beforeinstallprompt` hiç tetiklenmez; kullanıcı Paylaş
 * menüsünden ekler. Bu yüzden platformu ayırt edip yönergeyi ona göre veriyoruz.
 * iPadOS kendini Mac gibi tanıttığından dokunma noktası sayısına bakılır.
 */
function iosMu() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iphone|ipad|ipod/i.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

/** iPad'de Paylaş simgesi üst çubukta, iPhone'da alttadır; yönerge buna göre değişir. */
function ipadMi() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/ipad/i.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

/**
 * "Telefona ekle" akışı.
 *
 * Tarayıcı uygulamayı ana ekrana eklemeye uygun bulduğunda `beforeinstallprompt`
 * olayını gönderir; onu yakalayıp kendi düğmemize bağlarız. Olay gelmeyen
 * tarayıcılarda düğme yerine elle ekleme adımları gösterilir.
 *
 * @returns {{canInstall: boolean, install: () => Promise<void>, installed: boolean, platform: 'ios' | 'menu', pad: boolean}}
 */
export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null)
  const [installed, setInstalled] = useState(kuruluMu)

  useEffect(() => {
    const hazir = (event) => {
      event.preventDefault()
      setPromptEvent(event)
    }
    const kuruldu = () => {
      setPromptEvent(null)
      setInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', hazir)
    window.addEventListener('appinstalled', kuruldu)
    return () => {
      window.removeEventListener('beforeinstallprompt', hazir)
      window.removeEventListener('appinstalled', kuruldu)
    }
  }, [])

  const install = useCallback(async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    // Olay tek kullanımlıktır; kullanıcı vazgeçse de yeniden çağrılamaz.
    setPromptEvent(null)
    if (outcome === 'accepted') setInstalled(true)
  }, [promptEvent])

  return {
    canInstall: Boolean(promptEvent),
    install,
    installed,
    platform: iosMu() ? 'ios' : 'menu',
    pad: ipadMi(),
  }
}

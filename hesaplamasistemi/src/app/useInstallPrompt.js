import { useCallback, useEffect, useState } from 'react'

/**
 * "Telefona ekle" akışı.
 *
 * Tarayıcı uygulamayı ana ekrana eklemeye uygun bulduğunda `beforeinstallprompt`
 * olayını gönderir; onu yakalayıp kendi düğmemize bağlarız.
 */
export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null)

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault()
      setPromptEvent(event)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setPromptEvent(null))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = useCallback(async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    await promptEvent.userChoice
    setPromptEvent(null)
  }, [promptEvent])

  return { canInstall: Boolean(promptEvent), install }
}

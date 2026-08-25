import { useEffect, useMemo } from 'react'
import { Router, RouterProvider, useRoute } from './app/Router.jsx'
import { PlanSession, PlanSessionProvider, usePlanSession } from './app/PlanSession.jsx'
import { HomePage } from './pages/HomePage.jsx'
import { CalculatorPage } from './pages/CalculatorPage.jsx'
import { ResultPage } from './pages/ResultPage.jsx'
import { SiteFooter, SiteHeader, WhatsAppButton } from './ui/shell.jsx'

/**
 * Yol → sayfa eşlemesi. Yeni bir sayfa eklemek için buraya bir satır yeter.
 */
const SAYFALAR = {
  '/': HomePage,
  '/hesapla': CalculatorPage,
  '/plan': ResultPage,
}

function Pages() {
  const { path, navigate } = useRoute()
  const session = usePlanSession()
  const bilinen = Boolean(SAYFALAR[path])
  const Page = SAYFALAR[path] ?? HomePage

  // Tanınmayan bir adres karşılama sayfasını gösteriyor; adres çubuğu da ona
  // uysun ki kullanıcı yanlış bağlantıyı paylaşmasın.
  useEffect(() => {
    if (!bilinen) navigate('/', { replace: true, scrollToTop: false })
  }, [bilinen, navigate])

  return (
    <>
      <a className="atla-baglantisi" href="#ana-icerik">
        Ana içeriğe geç
      </a>
      <SiteHeader />
      <main id="ana-icerik">
        <Page />
      </main>
      <WhatsAppButton plan={path === '/plan' ? session.result : null} />
      <SiteFooter />
    </>
  )
}

export default function App() {
  const router = useMemo(() => new Router(), [])
  const session = useMemo(() => new PlanSession(), [])

  return (
    <RouterProvider router={router}>
      <PlanSessionProvider session={session}>
        <Pages />
      </PlanSessionProvider>
    </RouterProvider>
  )
}

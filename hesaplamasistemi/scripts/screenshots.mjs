/**
 * Tasarım değişikliklerini gözle karşılaştırmak için ekran görüntüsü alır.
 *
 *   npm run preview          (ayrı bir terminalde, 5199 portunda)
 *   npm run shots            (görüntüler ekrangoruntuleri/ altına yazılır)
 *
 * Chrome yolu farklıysa CHROME_PATH ortam değişkeniyle verilebilir.
 */
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const CHROME =
  process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.SHOT_BASE ?? 'http://localhost:5199'
const OUT = process.argv[2] ?? 'ekrangoruntuleri'

mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--font-render-hinting=none'],
})

const page = await browser.newPage()
const sorunlar = []
page.on('console', (m) => {
  if (m.type() === 'error') sorunlar.push(`[konsol] ${m.text()}`)
})
page.on('pageerror', (e) => sorunlar.push(`[hata] ${e.message}`))

const bekle = (ms) => new Promise((r) => setTimeout(r, ms))

async function cek(ad, { width = 1440, height = 1000 } = {}) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  await bekle(900)
  await page.screenshot({ path: `${OUT}/${ad}.png`, fullPage: true })
  console.log('✓', ad)
}

async function ornekPlanOlustur(mod) {
  await page.goto(`${BASE}/hesapla?mod=${mod}`, { waitUntil: 'networkidle0' })
  await page.click('.metin-dugme')
  await bekle(400)
  await page.click('button[type="submit"]')
  await bekle(1500)
}

// Ana sayfa
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await cek('01-ana-masaustu')
await cek('01-ana-tablet', { width: 820, height: 1000 })
await cek('01-ana-mobil', { width: 400, height: 860 })

// Form
await page.setViewport({ width: 1440, height: 1000 })
await page.goto(`${BASE}/hesapla?mod=teslimat`, { waitUntil: 'networkidle0' })
await page.click('.metin-dugme')
await bekle(400)
await cek('02-form-tarihe-gore')

await page.goto(`${BASE}/hesapla?mod=taksit`, { waitUntil: 'networkidle0' })
await page.click('.metin-dugme')
await bekle(400)
await cek('03-form-butceye-gore')

// Sonuç
await ornekPlanOlustur('teslimat')
await cek('04-sonuc-masaustu')
await cek('04-sonuc-mobil', { width: 400, height: 860 })

// Uygun plan çıkmayan senaryo
await page.setViewport({ width: 1440, height: 1000 })
await page.goto(`${BASE}/hesapla?mod=taksit`, { waitUntil: 'networkidle0' })
await page.evaluate(() => {
  const yaz = (secici, deger) => {
    const alan = document.querySelector(secici)
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(alan, deger)
    alan.dispatchEvent(new Event('input', { bubbles: true }))
  }
  yaz('#hedef-tutar', '5.000.000')
  yaz('#pesinat', '0')
  yaz('#aylik-taksit', '6.000')
})
await bekle(400)
await page.click('button[type="submit"]')
await bekle(4000)
await cek('05-plan-cikmadi')

console.log(sorunlar.length ? `\nKonsol sorunları:\n${sorunlar.join('\n')}` : '\nKonsol temiz.')
await browser.close()

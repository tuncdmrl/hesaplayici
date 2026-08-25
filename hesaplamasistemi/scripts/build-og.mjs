/**
 * WhatsApp/Twitter bağlantı önizlemesinde görünen kapak görselini üretir.
 *
 *   npm run og            (public/og.png — 1200×630)
 *
 * Metinler advisor.js'ten okunur; danışman veya site adı değişirse görseli
 * yeniden üretmek yeterli. Chrome yolu farklıysa CHROME_PATH ile verilebilir.
 */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { advisor, site } from '../src/config/advisor.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const cikti = path.resolve(here, '../public/og.png')

const CHROME =
  process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const html = `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@500;700&family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Roboto+Mono:wght@700&display=swap"
      rel="stylesheet"
    />
    <style>
      * { box-sizing: border-box; margin: 0; }
      body {
        width: 1200px; height: 630px; display: flex; align-items: center; gap: 56px;
        padding: 72px; background: #f6f1f0; color: #17090c;
        font-family: 'Be Vietnam Pro', sans-serif;
      }
      .sol { flex: 1 1 0; min-width: 0; }
      .marka { display: flex; align-items: center; gap: 18px; margin-bottom: 40px; }
      .rozet {
        width: 76px; height: 76px; border-radius: 20px; display: grid; place-items: center;
        background: linear-gradient(148deg, #ff4356 0%, #d70014 46%, #78000c 100%);
        box-shadow: 0 18px 34px -18px rgba(215, 0, 20, 0.9);
      }
      .rozet svg { width: 44px; height: 44px; }
      .marka b { font-family: 'Bricolage Grotesque', sans-serif; font-size: 30px; letter-spacing: -0.03em; }
      h1 {
        font-family: 'Bricolage Grotesque', sans-serif; font-size: 74px; line-height: 1.02;
        letter-spacing: -0.035em; text-wrap: balance;
      }
      h1 em { font-style: normal; color: #d70014; }
      p { margin-top: 26px; font-size: 25px; line-height: 1.45; color: #5e484c; max-width: 22ch; }
      .kisi {
        margin-top: 44px; padding-top: 26px; border-top: 2px solid #e8dcdd;
        font-size: 22px; font-weight: 700; color: #17090c;
      }
      .kisi span { color: #927f82; font-weight: 500; }
      .kart {
        flex: none; width: 372px; padding: 34px; background: #fff; border: 1px solid #e8dcdd;
        border-radius: 26px; box-shadow: 0 40px 70px -50px rgba(23, 9, 12, 0.75); position: relative;
      }
      .kart__ust { font-family: 'Roboto Mono', monospace; font-size: 15px; letter-spacing: 0.16em; color: #927f82; }
      .kart__tutar { font-family: 'Bricolage Grotesque', sans-serif; font-size: 42px; letter-spacing: -0.035em; margin-top: 4px; }
      .izgara { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 26px; }
      .hucre {
        aspect-ratio: 1 / 0.72; border-radius: 12px; border: 1px solid #e8dcdd; background: #f6f1f0;
        display: grid; place-items: center; font-family: 'Roboto Mono', monospace; font-size: 15px; color: #5e484c;
      }
      .hucre.teslim { background: #d70014; border-color: #d70014; color: #fff; font-weight: 700; }
      .damga {
        position: absolute; right: -18px; top: 26px; transform: rotate(-7deg);
        padding: 10px 18px; border: 3px solid #d70014; border-radius: 8px; background: #fff;
        color: #d70014; font-family: 'Roboto Mono', monospace; font-weight: 700; text-align: center;
      }
      .damga small { display: block; font-size: 12px; letter-spacing: 0.18em; }
      .damga b { font-size: 22px; letter-spacing: 0.04em; }
    </style>
  </head>
  <body>
    <div class="sol">
      <div class="marka">
        <span class="rozet">
          <svg viewBox="0 0 24 24">
            <g transform="rotate(45 12 12)" fill="#fff">
              <path fill-rule="evenodd" d="M12 2.8a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4Zm0 2.55a1.65 1.65 0 1 0 0 3.3 1.65 1.65 0 0 0 0-3.3Z" />
              <path d="M10.9 9.8h2.2v5.4h3.1v1.7h-3.1v1.4h2.3v1.7h-2.3v.9a1.1 1.1 0 0 1-2.2 0V9.8Z" />
            </g>
          </svg>
        </span>
        <b>${site.name}</b>
      </div>

      <h1>Anahtarı hangi ay alacağınızı <em>bugün öğrenin</em></h1>
      <p>Faizsiz tasarruf finansmanı planınızı yarım dakikada hesaplayın.</p>

      <div class="kisi">${advisor.fullName} <span>· ${advisor.title} · ${advisor.phone.display}</span></div>
    </div>

    <div class="kart">
      <div class="kart__ust">ÖRNEK PLAN · EV</div>
      <div class="kart__tutar">1,5 mn ₺</div>
      <div class="izgara">
        ${['Ağu', 'Eyl', 'Eki', 'Kas', 'Ara', 'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem']
          .map((ay) => `<div class="hucre">${ay}</div>`)
          .join('')}
        <div class="hucre teslim">Ağu</div>
        ${['Eyl', 'Eki', 'Kas'].map((ay) => `<div class="hucre">${ay}</div>`).join('')}
      </div>
      <div class="damga"><small>ANAHTAR</small><b>AĞUSTOS</b></div>
    </div>
  </body>
</html>`

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--font-render-hinting=none'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'networkidle0' })
await page.evaluate(() => document.fonts.ready)
const png = await page.screenshot({ type: 'png' })
await browser.close()

await writeFile(cikti, png)
console.log(`og.png (${(png.length / 1024).toFixed(1)} KB)`)

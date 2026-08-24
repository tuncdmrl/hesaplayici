/**
 * PDF içine gömülecek Türkçe destekli fontları üretir.
 *
 * jsPDF'in yerleşik fontları WinAnsi kodlamasını kullandığı için ğ, İ, ı, ş
 * gibi karakterleri basamaz. Bu script Roboto'yu yalnızca ihtiyaç duyduğumuz
 * karakter kümesine indirger (~20 KB) ve base64 olarak `src/services/pdf/fonts`
 * altına yazar.
 *
 * Çalıştırmak için:  node scripts/build-pdf-fonts.mjs
 * (Font dosyaları depoda hazır geldiği için normal kurulumda gerekmez.)
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import subsetFont from 'subset-font'

const SOURCES = {
  regular:
    'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf',
  bold: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjammT.ttf',
}

const GLYPHS = [
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'abcdefghijklmnopqrstuvwxyz',
  '0123456789',
  'çÇğĞıİöÖşŞüÜâÂîÎûÛ',
  ' .,:;!?\'"()[]{}<>/\\|@#$%^&*_+-=~`',
  '₺€₤·–—’‘“”…°•→←↑↓✓×',
]. join('')

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(here, '../src/services/pdf/fonts')

async function build(name, url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${name} indirilemedi: ${response.status}`)
  const original = Buffer.from(await response.arrayBuffer())
  const subset = await subsetFont(original, GLYPHS, { targetFormat: 'truetype' })
  const base64 = subset.toString('base64')
  const file = path.join(outDir, `roboto-${name}.js`)
  await writeFile(
    file,
    `// Otomatik üretildi: scripts/build-pdf-fonts.mjs — elle düzenlemeyin.\n` +
      `export const fileName = 'Roboto-${name}.ttf'\n` +
      `export const base64 = '${base64}'\n`,
    'utf8',
  )
  console.log(
    `${name}: ${(original.length / 1024).toFixed(0)} KB → ${(subset.length / 1024).toFixed(0)} KB`,
  )
}

await mkdir(outDir, { recursive: true })
for (const [name, url] of Object.entries(SOURCES)) {
  await build(name, url)
}

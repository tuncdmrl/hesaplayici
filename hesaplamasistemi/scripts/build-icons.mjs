/**
 * public/favicon.svg dosyasından uygulama simgelerini üretir.
 *
 *   node scripts/build-icons.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(here, '../public')

const svg = await readFile(path.join(publicDir, 'favicon.svg'))

for (const size of [192, 512]) {
  const png = await sharp(svg, { density: 512 }).resize(size, size).png().toBuffer()
  await writeFile(path.join(publicDir, `app-icon-${size}.png`), png)
  console.log(`app-icon-${size}.png (${(png.length / 1024).toFixed(1)} KB)`)
}

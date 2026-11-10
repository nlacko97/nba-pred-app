// Renders the favicon set and the social share card into public/ using
// headless Chrome (so the card gets Big Shoulders Display). Rerun after
// changing the artwork below.
//
//   node scripts/brand-assets.mjs

import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { Buffer } from 'node:buffer'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const CHROME =
  process.env.CHROME ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PUBLIC = new URL('../public/', import.meta.url).pathname
const FONT =
  'https://fonts.googleapis.com/css2?family=Archivo:wght@500;600&family=Big+Shoulders+Display:wght@800;900&display=block'

const INK = '#0f0e0c'
const PAPER = '#f3eee3'
const ORANGE = '#e8490f'

// Bold ball, centered in a 64 box. Thicker seams than the masthead ball so it
// still reads at 16px.
const ball = (cx, cy, r, seam) => {
  const k = r / 20
  return `<g transform="translate(${cx - 20 * k} ${cy - 20 * k}) scale(${k})">
<circle cx="20" cy="20" r="19" fill="${ORANGE}"/>
<g stroke="${INK}" stroke-width="${seam}" fill="none" stroke-linecap="round">
<path d="M1 20h38M20 1v38"/>
<path d="M7 6.5c5.5 4.5 7.5 8.5 7.5 13.500S12.5 29 7 33.5M33 6.5c-5.5 4.5-7.5 8.5-7.5 13.500s2 9 7.5 13.500"/>
</g></g>`
}

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="${INK}"/>
${ball(32, 32, 26, 2.6)}
</svg>`

// Full-bleed version for apple-touch / maskable (the OS rounds the corners)
const ICON_FULL = ICON.replace('rx="14"', 'rx="0"')

const CARD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
<rect width="1200" height="630" fill="${INK}"/>
<g stroke="${PAPER}" stroke-opacity=".07" stroke-width="3" fill="none">
<circle cx="930" cy="315" r="250"/>
<circle cx="930" cy="315" r="420"/>
<path d="M930 0v630"/>
</g>
<g transform="rotate(-14 930 315)">${ball(930, 315, 200, 1.7)}</g>
<rect x="72" y="86" width="64" height="8" fill="${ORANGE}"/>
<text x="68" y="360" font-family="'Big Shoulders Display'" font-weight="800" font-size="300" fill="${PAPER}">NBA</text>
<text x="74" y="452" font-family="'Big Shoulders Display'" font-weight="800" font-size="104" fill="${ORANGE}" letter-spacing="14">PREDICTOR</text>
<text x="76" y="530" font-family="Archivo" font-weight="500" font-size="34" fill="${PAPER}" fill-opacity=".72">Call every game. Climb the standings.</text>
</svg>`

const work = mkdtempSync(join(tmpdir(), 'brand-assets-'))

function render(svg, w, h, file) {
  const page = join(work, 'page.html')
  writeFileSync(
    page,
    `<!doctype html><link rel="stylesheet" href="${FONT}">
<style>html,body{margin:0;background:transparent}svg{display:block;width:${w}px;height:${h}px}</style>
${svg}`,
  )
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--default-background-color=00000000',
      `--window-size=${w},${h}`,
      '--virtual-time-budget=4000',
      `--screenshot=${file}`,
      `file://${page}`,
    ],
    { stdio: 'ignore' },
  )
}

// .ico that wraps PNGs (supported everywhere that matters)
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(pngs.length, 4)
  let offset = head.length
  pngs.forEach(({ size, data }, i) => {
    const o = 6 + 16 * i
    head[o] = size
    head[o + 1] = size
    head.writeUInt16LE(1, o + 4)
    head.writeUInt16LE(32, o + 6)
    head.writeUInt32LE(data.length, o + 8)
    head.writeUInt32LE(offset, o + 12)
    offset += data.length
  })
  return Buffer.concat([head, ...pngs.map(p => p.data)])
}

writeFileSync(join(PUBLIC, 'favicon.svg'), ICON + '\n')
render(ICON, 180, 180, join(work, 'i180.png'))
render(ICON_FULL, 180, 180, join(PUBLIC, 'apple-touch-icon.png'))
render(ICON, 192, 192, join(PUBLIC, 'icon-192.png'))
render(ICON, 512, 512, join(PUBLIC, 'icon-512.png'))
const sizes = [16, 32, 48]
const pngs = sizes.map(size => {
  const f = join(work, `i${size}.png`)
  render(ICON, size, size, f)
  return { size, data: readFileSync(f) }
})
writeFileSync(join(PUBLIC, 'favicon.ico'), ico(pngs))
render(CARD, 1200, 630, join(PUBLIC, 'og-image.png'))

rmSync(work, { recursive: true, force: true })
console.log(`wrote brand assets to ${PUBLIC}`)

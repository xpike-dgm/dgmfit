const { chromium } = require('playwright')
const path = require('path')
const out = path.join(__dirname, '..', 'public', 'icons')
const svg = (size, { pad = 0, bg = '#C8F169', fg = '#142004', radius = 0, transparent = false } = {}) => `
<html><body style="margin:0;background:${transparent ? 'transparent' : '#0B0C0A'}">
<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${transparent ? 'transparent' : bg};border-radius:${radius}px">
<svg width="${size * (1 - pad)}" height="${size * (1 - pad)}" viewBox="0 0 100 100">
  <text x="50" y="58" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-weight="800" font-size="50" letter-spacing="-3" fill="${fg}">Dg</text>
  <rect x="26" y="80" width="52" height="6" rx="3" fill="${fg}"/>
</svg></div></body></html>`
;(async () => {
  const b = await chromium.launch()
  const shot = async (name, size, opts) => {
    const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    await p.setContent(svg(size, opts))
    await p.screenshot({ path: path.join(out, name), omitBackground: !!opts?.transparent })
    await p.close()
  }
  await shot('icon-192.png', 192, { pad: 0.12 })
  await shot('icon-512.png', 512, { pad: 0.12 })
  await shot('maskable-512.png', 512, { pad: 0.3 })
  await shot('apple-touch-icon.png', 180, { pad: 0.14 })
  await shot('badge-72.png', 72, { pad: 0.05, fg: '#FFFFFF', transparent: true })
  await shot('favicon-32.png', 32, { pad: 0.02 })
  await b.close()
})()

import fs from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { getUser } from '@/lib/auth'
import { getDiary } from '@/lib/food-data'
import { getToday } from '@/lib/today'
import { listSupplements } from '@/lib/supplement-data'
import { CARD_KINDS, isCardKind, microRows, type MicroRow, type Tone } from '@/lib/day-card'
import { addDays, dayString, longDate } from '@/lib/time'
import { fmtNum } from '@/lib/calc'

export const dynamic = 'force-dynamic'

// TTF yazı tipleri (Satori woff2 okumaz): public/fonts, OFL lisanslı Manrope + Space Grotesk
let fontCache: Promise<{ name: string; data: Buffer; weight: 600 | 700 | 800; style: 'normal' }[]> | null = null
function fonts() {
  fontCache ??= Promise.all(([['Manrope', 'manrope', 600], ['Manrope', 'manrope', 700], ['Manrope', 'manrope', 800], ['Grotesk', 'spacegrotesk', 600], ['Grotesk', 'spacegrotesk', 700]] as const).map(async ([name, file, weight]) => ({
    name, weight, style: 'normal' as const, data: await fs.readFile(path.join(process.cwd(), 'public', 'fonts', `${file}-${weight}.ttf`)),
  })))
  return fontCache
}

const N = { fontFamily: 'Grotesk' }
const fmt = (v: number) => fmtNum(v, v < 10 && v % 1 ? 1 : 0)

/** Günlük beslenme özeti PNG: ?gun=YYYY-AA-GG&tip=a (koyu kart) | b (açık hikâye). */
export async function GET(req: Request) {
  const u = await getUser()
  if (!u) return new Response('oturum yok', { status: 401 })
  const sp = new URL(req.url).searchParams
  const today = dayString()
  const g = sp.get('gun') ?? today
  const day = /^\d{4}-\d{2}-\d{2}$/.test(g) && g <= today && g >= addDays(today, -365) ? g : today
  const tip = sp.get('tip')
  const kind = isCardKind(tip) ? tip : 'a'
  const spec = CARD_KINDS[kind]
  const [diary, t, supp] = await Promise.all([getDiary(u.id, day), getToday(u.id, day), listSupplements(u.id, day)])
  const target = { kcal: t?.target.kcal ?? 2000, protein: t?.target.protein ?? 120, carb: t?.target.carb ?? 200, fat: t?.target.fat ?? 65 }
  const budget = target.kcal + (t?.burned ?? 0)
  const d = {
    date: longDate(day), eaten: diary.totals, target, budget, left: budget - diary.totals.kcal,
    meals: diary.meals.map((m) => ({ label: m.label, kcal: m.totals.kcal, n: m.items.length })),
    micro: microRows(diary.micro, spec.micro),
    supps: supp.items.filter((s) => s.count > 0).map((s) => `${s.name} · ${fmt(s.count)} × ${s.label.replace(/^1 /, '')}`),
    water: t?.waterMl ?? 0,
  }
  const el = kind === 'a' ? <CardA d={d} /> : <CardB d={d} />
  return new ImageResponse(el, {
    width: spec.w, height: spec.h, fonts: await fonts(),
    headers: { 'Cache-Control': 'private, no-store', 'Content-Disposition': `inline; filename="dgfit-${day}-${kind === 'a' ? 'kart' : 'hikaye'}.png"` },
  })
}

type D = {
  date: string; eaten: { kcal: number; protein: number; carb: number; fat: number }; target: { kcal: number; protein: number; carb: number; fat: number }
  budget: number; left: number; meals: { label: string; kcal: number; n: number }[]; micro: MicroRow[]; supps: string[]; water: number
}
const pct = (v: number, g: number) => `${Math.max(0, Math.min(100, g > 0 ? (v / g) * 100 : 0))}%`
const leftText = (d: D) => (d.left >= 0 ? `${fmtNum(d.left)} kcal kaldı` : `${fmtNum(-d.left)} kcal aşım`)
const refText = (m: MicroRow) => (m.kind === 'max' ? `sınır ${fmtNum(m.ref)}` : `%${m.pct}`)

// ——— A: koyu kart (1080×1350) ———
const DARK = { bg: '#14161B', card: '#1C1F26', line: '#2A2E37', tile: '#252932', ink: '#F2F3F5', ink2: '#C9CDD4', mute: '#8B919C', acc: '#FFA06B', good: '#8FDB7A', warn: '#FFB45C', bad: '#FF8A7A' }
const toneDark: Record<Tone, string> = { good: DARK.good, warn: DARK.acc, bad: DARK.bad }

function Ring({ value, size, stroke, color, track }: { value: number; size: number; stroke: number; color: string; track: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      {v > 0.001 ? <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} /> : null}
    </svg>
  )
}

function CardA({ d }: { d: D }) {
  const macros = [['Protein', d.eaten.protein, d.target.protein, '#9BE06A'], ['Karbonhidrat', d.eaten.carb, d.target.carb, DARK.warn], ['Yağ', d.eaten.fat, d.target.fat, '#A9A4FF']] as const
  const half = Math.ceil(d.micro.length / 2)
  const cols = [d.micro.slice(0, half), d.micro.slice(half)]
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: DARK.bg, color: DARK.ink, fontFamily: 'Manrope', padding: '64px 64px 52px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: -260, right: -200, width: 760, height: 760, borderRadius: 380, backgroundImage: 'radial-gradient(circle, rgba(230,138,62,0.33), rgba(194,85,31,0) 70%)', display: 'flex' }} />
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ ...N, width: 58, height: 58, borderRadius: 16, background: DARK.acc, color: DARK.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 24 }}>Dg</div>
        <div style={{ ...N, marginLeft: 16, fontWeight: 700, fontSize: 28, letterSpacing: 1, color: DARK.acc }}>DgFit</div>
        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: DARK.ink2, textTransform: 'capitalize' }}>{d.date}</span>
          <span style={{ fontSize: 19, fontWeight: 600, color: DARK.mute, marginTop: 2 }}>Günlük beslenme özeti</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 34 }}>
        <div style={{ width: 330, height: 330, position: 'relative', display: 'flex' }}>
          <Ring value={d.budget > 0 ? d.eaten.kcal / d.budget : 0} size={330} stroke={26} color={DARK.acc} track={DARK.line} />
          <div style={{ position: 'absolute', top: 0, left: 0, width: 330, height: 330, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ ...N, fontSize: 76, fontWeight: 700, lineHeight: 1 }}>{fmtNum(d.eaten.kcal)}</span>
            <span style={{ fontSize: 22, color: '#A3A9B3', marginTop: 10, fontWeight: 600 }}>/ {fmtNum(d.budget)} kcal</span>
            <span style={{ fontSize: 21, color: d.left >= 0 ? DARK.good : DARK.bad, fontWeight: 700, marginTop: 10 }}>{leftText(d)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginLeft: 44 }}>
          {macros.map(([l, v, gl, c], i) => (
            <div key={l} style={{ display: 'flex', flexDirection: 'column', marginTop: i ? 24 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 25, fontWeight: 700 }}>
                <span>{l}</span><span style={{ ...N, fontSize: 30, display: 'flex', alignItems: 'flex-end' }}>{fmtNum(v)}<span style={{ fontSize: 21, color: DARK.mute, fontWeight: 600, marginLeft: 8 }}>/ {fmtNum(gl)} g</span></span>
              </div>
              <div style={{ height: 16, borderRadius: 8, background: DARK.line, marginTop: 10, display: 'flex' }}><div style={{ width: pct(v, gl), height: 16, borderRadius: 8, background: c }} /></div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', background: DARK.card, border: `1px solid ${DARK.line}`, borderRadius: 30, padding: '26px 30px', marginTop: 34 }}>
        <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: 1.7, color: DARK.mute, marginBottom: 14 }}>ÖĞÜNLER</span>
        <div style={{ display: 'flex' }}>
          {d.meals.map((m, i) => (
            <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: DARK.tile, borderRadius: 22, padding: '18px 18px', marginLeft: i ? 14 : 0 }}>
              <span style={{ fontSize: 19, color: '#A3A9B3', fontWeight: 700 }}>{m.label.replace(' yemeği', '')}</span>
              <span style={{ ...N, fontSize: 34, fontWeight: 700, marginTop: 6 }}>{fmtNum(m.kcal)}</span>
              <span style={{ fontSize: 17, color: DARK.mute }}>{m.n ? `kcal · ${m.n} besin` : 'kayıt yok'}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', background: DARK.card, border: `1px solid ${DARK.line}`, borderRadius: 30, padding: '26px 30px', marginTop: 30 }}>
        <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: 1.7, color: DARK.mute, marginBottom: 14 }}>MİKRO BESİNLER · GÜNLÜK REFERANSA GÖRE</span>
        {d.micro.length ? (
          <div style={{ display: 'flex' }}>
            {cols.map((col, ci) => (
              <div key={ci} style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: ci ? 34 : 0 }}>
                {col.map((m, i) => (
                  <div key={m.key} style={{ display: 'flex', flexDirection: 'column', marginTop: i ? 12 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700 }}>
                      <span>{m.label}</span><span style={{ ...N, color: DARK.ink2, display: 'flex', alignItems: 'flex-end' }}>{fmt(m.value)} {m.unit}<span style={{ fontSize: 16, color: DARK.mute, fontWeight: 600, marginLeft: 6 }}>{refText(m)}</span></span>
                    </div>
                    <div style={{ height: 9, borderRadius: 5, background: DARK.line, marginTop: 6, display: 'flex' }}><div style={{ width: pct(m.pct, 100), height: 9, borderRadius: 5, background: toneDark[m.tone] }} /></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : <span style={{ fontSize: 20, color: DARK.mute }}>Bugünkü besinlerde mikro besin bilgisi yok.</span>}
      </div>
      {d.supps.length || d.water ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 26 }}>
          {[...(d.water ? [`Su · ${fmtNum(d.water)} ml`] : []), ...d.supps].slice(0, 6).map((s) => (
            <span key={s} style={{ fontSize: 19, fontWeight: 700, background: DARK.tile, border: '1px solid #3B404B', borderRadius: 99, padding: '8px 16px', marginRight: 10, marginBottom: 10 }}>{s}</span>
          ))}
        </div>
      ) : null}
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: 18, color: '#6E7480', fontWeight: 600 }}>
        <span>Mikro değerler yalnızca bilgisi olan besinlerden hesaplanır.</span><span style={N}>dgfit.dgmcraft.online</span>
      </div>
    </div>
  )
}

// ——— B: açık hikâye (1080×1920) ———
const LIGHT = { bg: '#F3F4F6', card: '#FFFFFF', line: '#EEF0F3', track: '#E4E7EC', ink: '#14161B', ink2: '#4A505C', mute: '#8B919C', good: '#2F8A3A', warn: '#B04A18', bad: '#C2352B' }
const toneLight: Record<Tone, string> = { good: LIGHT.good, warn: LIGHT.warn, bad: LIGHT.bad }

function CardB({ d }: { d: D }) {
  const macros = [['Protein', d.eaten.protein, d.target.protein, '#3F8F1E'], ['Karb.', d.eaten.carb, d.target.carb, '#B5560F'], ['Yağ', d.eaten.fat, d.target.fat, '#5E4FD0']] as const
  const done = d.budget > 0 ? Math.round((d.eaten.kcal / d.budget) * 100) : 0
  const card = { display: 'flex', flexDirection: 'column' as const, background: LIGHT.card, borderRadius: 40, padding: '36px 40px', boxShadow: '0 10px 40px rgba(20,22,27,0.06)', marginTop: 26 }
  const h = { fontSize: 23, fontWeight: 800, letterSpacing: 2, color: '#6E7480', marginBottom: 14 }
  const half = Math.ceil(d.micro.length / 2)
  const extras = [...(d.water ? [`Su · ${fmtNum(d.water)} ml`] : []), ...d.supps].slice(0, 3)
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: LIGHT.bg, color: LIGHT.ink, fontFamily: 'Manrope' }}>
      <div style={{ display: 'flex', flexDirection: 'column', backgroundImage: 'linear-gradient(160deg, #C2551F, #E68A3E)', color: '#fff', padding: '100px 72px 190px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ ...N, width: 58, height: 58, borderRadius: 16, background: '#fff', color: '#C2551F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 24 }}>Dg</div>
          <div style={{ ...N, marginLeft: 16, fontWeight: 700, fontSize: 28, letterSpacing: 1 }}>DgFit</div>
        </div>
        <span style={{ fontSize: 68, fontWeight: 800, marginTop: 64, lineHeight: 1.05 }}>Bugün ne yedim?</span>
        <span style={{ fontSize: 30, fontWeight: 600, opacity: 0.9, marginTop: 12, textTransform: 'capitalize' }}>{d.date}</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 52 }}>
          <span style={{ ...N, fontSize: 170, fontWeight: 700, lineHeight: 0.85 }}>{fmtNum(d.eaten.kcal)}</span>
          <span style={{ fontSize: 34, fontWeight: 700, opacity: 0.9, marginLeft: 18, paddingBottom: 6 }}>/ {fmtNum(d.budget)} kcal</span>
        </div>
        <div style={{ height: 22, borderRadius: 11, background: 'rgba(255,255,255,0.3)', marginTop: 34, display: 'flex' }}><div style={{ width: pct(d.eaten.kcal, d.budget), height: 22, borderRadius: 11, background: '#fff' }} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, fontWeight: 700, marginTop: 14 }}><span>%{done} tamam</span><span style={N}>{leftText(d)}</span></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', margin: '-156px 48px 0' }}>
        <div style={card}>
          <span style={h}>MAKROLAR</span>
          <div style={{ display: 'flex' }}>
            {macros.map(([l, v, gl, c], i) => (
              <div key={l} style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: i ? 22 : 0 }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: LIGHT.ink2 }}>{l}</span>
                <span style={{ ...N, fontSize: 52, fontWeight: 700, marginTop: 6 }}>{fmtNum(v)}</span>
                <span style={{ fontSize: 24, color: LIGHT.mute, fontWeight: 600 }}>/ {fmtNum(gl)} g</span>
                <div style={{ height: 14, borderRadius: 7, background: LIGHT.track, marginTop: 12, display: 'flex' }}><div style={{ width: pct(v, gl), height: 14, borderRadius: 7, background: c }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div style={card}>
          <span style={h}>ÖĞÜNLER</span>
          {d.meals.map((m, i) => (
            <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 30, fontWeight: 700, padding: '16px 0', borderTop: i ? `2px solid ${LIGHT.line}` : '0px solid transparent' }}>
              <span style={{ color: LIGHT.ink2 }}>{m.label}</span><span style={{ ...N, fontSize: 34 }}>{m.n ? `${fmtNum(m.kcal)} kcal` : '—'}</span>
            </div>
          ))}
        </div>
        <div style={card}>
          <span style={h}>MİKRO BESİNLER</span>
          {d.micro.length ? (
            <div style={{ display: 'flex' }}>
              {[d.micro.slice(0, half), d.micro.slice(half)].map((col, ci) => (
                <div key={ci} style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: ci ? 40 : 0 }}>
                  {col.map((m, i) => (
                    <div key={m.key} style={{ display: 'flex', flexDirection: 'column', marginTop: i ? 18 : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 25, fontWeight: 700 }}>
                        <span>{m.label}</span><span style={{ ...N, display: 'flex', alignItems: 'flex-end' }}>{fmt(m.value)} {m.unit}<span style={{ fontSize: 20, color: LIGHT.mute, fontWeight: 600, marginLeft: 6 }}>{m.kind === 'max' ? 'sınır' : `%${m.pct}`}</span></span>
                      </div>
                      <div style={{ height: 12, borderRadius: 6, background: LIGHT.track, marginTop: 8, display: 'flex' }}><div style={{ width: pct(m.pct, 100), height: 12, borderRadius: 6, background: toneLight[m.tone] }} /></div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : <span style={{ fontSize: 24, color: LIGHT.mute }}>Bugünkü besinlerde mikro besin bilgisi yok.</span>}
        </div>
        {extras.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 26 }}>
            {extras.map((s) => <span key={s} style={{ fontSize: 24, fontWeight: 700, background: LIGHT.card, borderRadius: 99, padding: '10px 20px', marginRight: 12, marginBottom: 12, color: LIGHT.ink2 }}>{s}</span>)}
          </div>
        ) : null}
      </div>
      <div style={{ ...N, marginTop: 'auto', padding: '24px 72px 60px', fontSize: 24, color: LIGHT.mute, display: 'flex' }}>dgfit.dgmcraft.online</div>
    </div>
  )
}

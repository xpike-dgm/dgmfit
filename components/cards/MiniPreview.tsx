// Ö3: tasarımın küçük önizlemesi (kişisel veri yok; yalnız kart yerleşimi ve renkler). Sunucu ve istemcide çizilir.
import { resolveScreen, type Design } from '@/lib/cards/layout'
import { MODULES, modulePalette } from '@/lib/cards/colors'
import type { ScreenId } from '@/lib/cards/registry'

const base = (mod: string, d: Design) => d.modules?.[mod as keyof NonNullable<Design['modules']>] ?? MODULES.find((m) => m.id === mod)?.base ?? '#3D4452'

export default function MiniPreview({ design, screen = 'today', width = 96, label }: { design: Design; screen?: ScreenId; width?: number; label?: string }) {
  const r = resolveScreen(design, screen, {})
  const radius = design.style?.radius === 'sharp' ? 3 : design.style?.radius === 'round' ? 9 : 6
  return (
    <div role="img" aria-label={label ?? 'Tasarım önizlemesi'} className="shrink-0 rounded-[16px] border-2 border-line-2 bg-bg p-1.5 grid grid-cols-2 gap-1 content-start overflow-hidden" style={{ width, minHeight: width * 1.75 }} data-mini-preview>
      {r.items.slice(0, 10).map((i) => {
        const pal = modulePalette(base(i.def.module, design))
        const bg = design.cards?.[i.id]?.colors?.bg
        const top = i.def.locked === 'top'
        return (
          <div key={i.id} className={i.size === 'full' ? 'col-span-2' : ''} style={{
            height: top ? width * 0.36 : i.stack?.length ? width * 0.2 : width * 0.15, borderRadius: radius,
            background: top ? (design.style?.band === 'flat' ? pal.m1 : `linear-gradient(160deg, ${pal.m1}, ${pal.m2})`) : bg ?? `color-mix(in oklab, ${pal.m1} 22%, var(--color-surface-2))`,
            borderTop: top ? undefined : `2px solid ${pal.m1}`,
          }} />
        )
      })}
    </div>
  )
}

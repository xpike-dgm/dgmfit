#!/usr/bin/env python3
"""Kas haritası: data/body-map-source.webp (kullanıcının ürettiği renk kodlu ön/arka görsel) → lib/body-map-paths.ts.
Her piksel en yakın palet rengine atanır; her kas maskesi kontura (vektör yol) çevrilir. Gövde silueti ayrı çıkarılır.
Çalıştırma: python3 scripts/data/build_bodymap.py  (opencv-python-headless, numpy, pillow gerekir)"""
import json, sys
import numpy as np, cv2
from PIL import Image

SRC = 'data/body-map-source.webp'
OUT = 'lib/body-map-paths.ts'
# Görseldeki gerçek renkler (histogramdan) → uygulamadaki kas anahtarları (lib/exercise-labels MUSCLES)
PAL = {
  'front': [((250, 10, 10), 'chest'), ((8, 190, 160), 'quadriceps'), ((136, 56, 248), 'abdominals'), ((248, 64, 136), 'abdominals'),
            ((248, 168, 8), 'forearms'), ((8, 184, 88), 'biceps'), ((8, 152, 248), 'shoulders'), ((88, 108, 192), 'calves'),
            ((200, 200, 56), 'abductors'), ((136, 104, 88), 'adductors'), ((160, 160, 160), 'neck')],
  'back': [((40, 168, 152), 'hamstrings'), ((232, 56, 56), 'glutes'), ((88, 152, 72), 'lats'), ((120, 88, 72), 'middle back'),
           ((88, 116, 196), 'calves'), ((248, 88, 40), 'traps'), ((248, 168, 8), 'forearms'), ((8, 152, 248), 'shoulders'),
           ((24, 136, 232), 'triceps'), ((184, 56, 184), 'lower back')],
}
SCALE = 0.5  # çıktı koordinatları (dosya boyutu için yarım çözünürlük)

def path_of(mask, eps):
    cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    out = []
    for c in cs:
        if cv2.contourArea(c) < 60: continue
        a = cv2.approxPolyDP(c, eps, True).reshape(-1, 2) * SCALE
        out.append('M' + 'L'.join(f'{x:.1f},{y:.1f}'.replace('.0,', ',').rstrip('0').rstrip('.') if False else f'{round(x,1):g},{round(y,1):g}' for x, y in a) + 'Z')
    return ''.join(out)

im = np.array(Image.open(SRC).convert('RGB')).astype(np.int32)
H, W, _ = im.shape
res = {}
for side, (x0, x1) in {'front': (0, W // 2), 'back': (W // 2, W)}.items():
    a = im[:, x0:x1]
    cols = np.array([c for c, _ in PAL[side]])
    d = np.sqrt(((a[:, :, None, :] - cols[None, None, :, :]) ** 2).sum(-1))
    best = d.argmin(-1); dist = d.min(-1)
    sat = a.max(-1) - a.min(-1)
    silhouette = (a.min(-1) < 236).astype(np.uint8)  # beyaz arka plan dışı her şey
    silhouette = cv2.morphologyEx(silhouette, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    ys, xs = np.nonzero(silhouette)
    bx0, by0, bx1, by1 = xs.min() - 4, ys.min() - 4, xs.max() + 4, ys.max() + 4
    muscles = {}
    for i, (_, key) in enumerate(PAL[side]):
        m = ((best == i) & (dist < 48) & ((sat > 40) | (key == 'neck'))).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        m = m[by0:by1, bx0:bx1]
        p = path_of(m, 1.2)
        if p: muscles[key] = muscles.get(key, '') + p
    sil = silhouette[by0:by1, bx0:bx1]
    res[side] = {'w': round((bx1 - bx0) * SCALE), 'h': round((by1 - by0) * SCALE), 'outline': path_of(sil, 1.0), 'muscles': muscles}
    print(side, res[side]['w'], res[side]['h'], sorted(muscles), file=sys.stderr)

with open(OUT, 'w') as f:
    f.write('// Üretildi: scripts/data/build_bodymap.py ← data/body-map-source.webp (elle düzenlemeyin)\n')
    f.write('export interface BodyView { w: number; h: number; outline: string; muscles: Record<string, string> }\n')
    f.write('export const BODY_MAP: { front: BodyView; back: BodyView } = ' + json.dumps(res, ensure_ascii=False) + '\n')
print(OUT, sum(len(json.dumps(v)) for v in res.values()), 'bytes', file=sys.stderr)

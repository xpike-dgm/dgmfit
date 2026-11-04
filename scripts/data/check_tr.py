#!/usr/bin/env python3
"""tr-foods.json'daki her USDA açıklamasını birebir doğrular; bulunamayanlar için en yakın 3 aday gösterir."""
import gzip, json, re
d = json.load(gzip.open('data/usda-sr.json.gz', 'rt'))['foods']
by = {f['en']: f for f in d}
tr = json.load(open('data/tr-foods.json'))['foods']
words = lambda s: set(re.findall(r'[a-z0-9%]+', s.lower()))
bad = 0
for t in tr:
    f = by.get(t['usda'])
    if not f:
        bad += 1
        w = words(t['usda'])
        cand = sorted(d, key=lambda x: (-len(w & words(x['en'])), len(x['en'])))[:3]
        print(f"YOK {t['k']}: {t['usda']}")
        for c in cand: print(f"    → {c['en']}")
        continue
    for lab, g in t['p']:
        if isinstance(g, str) and g.startswith('@'):
            if not any(g[1:] in p['en'] for p in f['portions']):
                bad += 1; print(f"PORSİYON YOK {t['k']} {g}: {[p['en'] for p in f['portions']][:6]}")
print('hata:', bad)

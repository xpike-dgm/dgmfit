#!/usr/bin/env python3
"""Aday bulucu: python3 -I scripts/data/find_usda.py 'sorgu1' 'sorgu2' ... (tüm kelimeleri içeren açıklamalar)"""
import gzip, json, sys
d = json.load(gzip.open('data/usda-sr.json.gz', 'rt'))['foods']
for q in sys.argv[1:]:
    ws = [w.lower() for w in q.split()]
    hits = [f for f in d if all(w in f['en'].lower() for w in ws)]
    hits.sort(key=lambda f: len(f['en']))
    print(f'## {q}')
    for f in hits[:4]: print(f"  {f['id']} | {f['en']} | {f['n']['kcal']} kcal")

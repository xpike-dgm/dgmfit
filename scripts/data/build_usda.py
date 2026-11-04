#!/usr/bin/env python3
"""USDA FoodData Central SR Legacy (CC0) CSV → data/usda-sr.json.gz
Kullanım: python3 -I scripts/data/build_usda.py <SR_LEGACY_CSV_KLASÖRÜ> data/usda-sr.json.gz
Değerler 100 g başınadır; kaynak verideki sayılar değiştirilmez (yalnızca yuvarlanır)."""
import csv, gzip, json, sys, os

NUT = {  # nutrient_id → alan (nutrient.csv ile doğrulandı)
    '1008': 'kcal', '1003': 'protein', '1004': 'fat', '1005': 'carb', '1079': 'fiber', '2000': 'sugar',
    '1258': 'satFat', '1093': 'sodium', '1051': 'water', '1253': 'chol', '1087': 'ca', '1089': 'fe',
    '1092': 'k', '1162': 'vitC', '1114': 'vitD', '1106': 'vitA', '1090': 'mg', '1095': 'zn', '1175': 'b6', '1178': 'b12',
}
src, out = sys.argv[1], sys.argv[2]
rd = lambda n: csv.DictReader(open(os.path.join(src, n), encoding='utf-8'))
cats = {r['id']: r['description'] for r in rd('food_category.csv')}
units = {r['id']: r['name'] for r in rd('measure_unit.csv')}
foods = {}
for r in rd('food.csv'):
    foods[r['fdc_id']] = {'id': int(r['fdc_id']), 'en': r['description'], 'cat': cats.get(r['food_category_id'], ''), 'n': {}, 'portions': []}
for r in rd('food_nutrient.csv'):
    f = foods.get(r['fdc_id']); k = NUT.get(r['nutrient_id'])
    if f is not None and k and r['amount'] != '':
        f['n'][k] = round(float(r['amount']), 3)
for r in rd('food_portion.csv'):
    f = foods.get(r['fdc_id'])
    if f is None or not r['gram_weight']: continue
    unit = units.get(r['measure_unit_id'], '')
    label = ' '.join(x for x in [r['amount'] if r['amount'] not in ('', '1', '1.0') or unit != 'undetermined' else '', '' if unit == 'undetermined' else unit, r['modifier'], r['portion_description']] if x).strip()
    f['portions'].append({'en': label or 'serving', 'g': round(float(r['gram_weight']), 2)})
rows = [f for f in foods.values() if all(k in f['n'] for k in ('kcal', 'protein', 'fat', 'carb'))]
rows.sort(key=lambda f: f['id'])
with gzip.open(out, 'wt', encoding='utf-8') as fh:
    json.dump({'source': 'USDA FoodData Central SR Legacy 2018-04 (CC0 1.0)', 'count': len(rows), 'foods': rows}, fh, ensure_ascii=False, separators=(',', ':'))
print(len(rows), 'besin yazıldı →', out)

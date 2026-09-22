"""The first fetch (21-22 September 2026): Basic and Standard single drivers, married households, and mileage variants.

Run from the repository root: python3 scripts/research/ca-2026/ca_batch.py
Pages already in the manifest are skipped. Two seconds between requests.
"""
import json, os, re, time, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ca_fetch import run

RAW = os.path.join(os.environ.get('CA_DIR', '.catalog-cache/research/ca-2026'), 'raw', 'tool')
os.makedirs(RAW, exist_ok=True)
LOCS = ['Los Angeles Los Angeles - Central', 'Orange Irvine', 'Modoc Alturas']
MID = '7,600 - 10,000 '

queries = []
for loc in LOCS:
    for y in ['1 to 2', '3 to 4', '5 to 7', '8 to 13', '14 to 25']:
        for r in 'ABCD':
            queries.append(('Basic - Liability Only', loc, 'Single Driver', y, MID, r, 'Toyota Camry'))
    for y in ['1 to 4', '5 to 7', '8 to 13', '14 to 25']:
        for r in 'ABCD':
            queries.append(('Standard', loc, 'Single Driver', y, MID, r, 'Honda Accord'))
    for r in ['HWAB', 'HWAD', 'HWC', 'HWD']:
        queries.append(('Standard', loc, 'Married Couple', '40 plus', '7600', r, 'Toyota Camry, Toyota Prius'))
        queries.append(('Standard', loc, 'Married Couple w/Teen', '28yrs/25yrs/1yr', '12,000 - 20,000', r, 'Toyota Camry, Toyota Highlander'))
        queries.append(('Standard', loc, 'Young Family Couple', '13yrs/10yrs', '15000', r, 'Toyota Camry, Toyota Sienna'))
    for r in ['HWAB', 'HWC', 'HWD']:
        queries.append(('Basic - Liability Only', loc, 'Married Couple', '13yrs/10yrs', MID, r, 'Toyota Camry, Toyota Rav4'))
        queries.append(('Basic - Liability Only', loc, 'Married Senior Couple', '40 plus', MID, r, 'Mercedes-Benz E350, Toyota Camry'))
# mileage variation, LA only, clean record
loc = LOCS[0]
for y in ['1 to 2', '3 to 4', '5 to 7', '8 to 13', '14 to 25']:
    for m in ['5,000 - 7,500', '12,500 - 16,000']:
        queries.append(('Basic - Liability Only', loc, 'Single Driver', y, m, 'A', 'Toyota Camry'))
for y in ['1 to 4', '5 to 7', '8 to 13', '14 to 25']:
    for m in ['5,000 - 7,500', '12,500 - 16,000' if y == '1 to 4' else '12,600 - 16,000']:
        queries.append(('Standard', loc, 'Single Driver', y, m, 'A', 'Honda Accord'))

names = ['P11_TYPE', 'P11_LOCATION', 'P11_INSURANCE_FOR', 'P11_YEARS_LICENSED', 'P11_MILEAGE', 'P11_RECORD', 'P11_VEHICLE']
man_path = os.path.join(RAW, 'manifest.json')
manifest = json.load(open(man_path)) if os.path.exists(man_path) else {}
print(len(queries), 'queries')
for i, q in enumerate(queries):
    fn = re.sub(r'[^A-Za-z0-9]+', '_', '_'.join(q)).strip('_') + '.html'
    if fn in manifest and os.path.exists(os.path.join(RAW, fn)):
        continue
    for attempt in range(3):
        try:
            url, body = run(list(zip(names, q)))
            break
        except Exception as e:
            print('ERR', q, e); time.sleep(10)
    else:
        continue
    ok = 'PREMIUM_AMT' in body and 'Profile ' in body
    open(os.path.join(RAW, fn), 'w').write(body)
    manifest[fn] = {'form': dict(zip(names, q)), 'result_url': url, 'ok': ok,
                    'fetched_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    json.dump(manifest, open(man_path, 'w'), indent=1)
    print(i, ok, fn, flush=True)
    time.sleep(2)

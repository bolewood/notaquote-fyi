"""Fetch every Standard single-driver vehicle (clean record, 7,600-10,000 miles) in all three places.

Same form, file naming, and manifest as ca_batch.py. Added 2026-09-22 to calibrate
vehicle factors against real prices. Two seconds between requests.
"""
import json, os, re, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ca_fetch import run

RAW = os.path.join(os.environ.get('CA_DIR', '.catalog-cache/research/ca-2026'), 'raw', 'tool')
LOCS = ['Los Angeles Los Angeles - Central', 'Orange Irvine', 'Modoc Alturas']
MID = '7,600 - 10,000 '
GROUPS = {
    '1 to 4': ['Subaru Crosstrek', 'Honda Civic', 'Honda Accord', 'Toyota Tacoma'],
    '5 to 7': ['Honda Accord', 'Toyota Prius', 'Tesla Model 3', 'Ford F-150'],
    '8 to 13': ['Honda Accord', 'BMW 340i', 'Ford F-150', 'Toyota RAV4'],
    '14 to 25': ['Honda Accord', 'Tesla Model S', 'Chevy Silverado', 'BMW 530i'],
}
names = ['P11_TYPE', 'P11_LOCATION', 'P11_INSURANCE_FOR', 'P11_YEARS_LICENSED', 'P11_MILEAGE', 'P11_RECORD', 'P11_VEHICLE']
man_path = os.path.join(RAW, 'manifest.json')
manifest = json.load(open(man_path))
for loc in LOCS:
    for years, vehicles in GROUPS.items():
        for vehicle in vehicles:
            q = ('Standard', loc, 'Single Driver', years, MID, 'A', vehicle)
            fn = re.sub(r'[^A-Za-z0-9]+', '_', '_'.join(q)).strip('_') + '.html'
            if fn in manifest and os.path.exists(os.path.join(RAW, fn)):
                continue
            url, body = run(list(zip(names, q)))
            ok = 'PREMIUM_AMT' in body and re.search(r'\d{4}A_V\d', body) is not None
            open(os.path.join(RAW, fn), 'w').write(body)
            manifest[fn] = {'form': dict(zip(names, q)), 'result_url': url, 'ok': ok,
                            'fetched_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                            'note': 'vehicle calibration batch (ca_vehicles.py)'}
            json.dump(manifest, open(man_path, 'w'), indent=1)
            print(ok, fn, flush=True)
            time.sleep(2)

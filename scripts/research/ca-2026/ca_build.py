"""Build premiums.csv and profiles.csv from the saved result pages in $CA_DIR/raw/tool.

Run from the repository root: python3 scripts/research/ca-2026/ca_build.py
(CA_DIR defaults to .catalog-cache/research/ca-2026). Copy the results to data/factors/sources/ca-2026-*.csv.
"""
import csv, html, json, os, re
from collections import Counter, defaultdict

D = os.environ.get('CA_DIR', '.catalog-cache/research/ca-2026')
RAW = D + '/raw/tool'
URL = 'https://interactive.web.insurance.ca.gov/apex_extprd/f?p=111:11'
man = json.load(open(RAW + '/manifest.json'))

BASIC_COV = ('Basic Limits: Liability Coverage Only: 30,000/60,000 Bodily Injury; 15,000 Property Damage; 2,000 Medical Payments; '
             '30,000/60,000 Uninsured/Underinsured Motorist; 3,500 Uninsured Motorist - Property Damage')
STD_COV = ('Standard Full Coverage: 100,000/300,000 Bodily Injury; 50,000 Property Damage; 5,000 Medical Payments; '
           '30,000/60,000 Uninsured/Underinsured Motorist - Bodily Injury; $250 Comprehensive Deductible; $500 Collision Deductible; '
           'Waiver on Collision Deductible')
# years licensed stated in the Profiles exhibit (raw/APS2026ProfilesExhibit-2.xlsx) per profile-number prefix
YEARS = {'110': 2, '111': 4, '112': 7, '113': 13, '114': 25, '251': 4, '252': 7, '253': 13, '254': 25}
REC = {'A': (0, 0), 'B': (0, 1), 'C': (1, 0), 'D': (1, 1)}

prem = []
profiles = {}
bad = []
for fn, m in sorted(man.items()):
    t = open(os.path.join(RAW, fn), encoding='utf-8', errors='ignore').read()
    f = m['form']
    pm = re.search(r'headers="PROF_LIST" ><a [^>]*>([^<]+)</a>', t)
    rows = re.findall(r'headers="SHORT_CO_NAME"><a [^>]*>([^<]+)</a>&nbsp;</td><td  align="right"  headers="PREMIUM_AMT">([^<]*)</td>', t)
    if not pm or not rows:
        bad.append(fn)
        continue
    prof = pm.group(1).strip()
    pid = 'ca-' + prof
    terr = f['P11_LOCATION'].strip()
    for name, amt in rows:
        name = html.unescape(name).strip()
        a = amt.strip().replace('$', '').replace(',', '')
        if not a.isdigit():
            bad.append((fn, name, amt))
            continue
        loc = (f"raw/tool/{fn}: 2026 Auto Premium Survey result table 'Survey Results', row '{name}', column 'Annual Premium' = {amt.strip()} "
               f"(tool Profile {prof}; form values in raw/tool/manifest.json)")
        prem.append(['ca-2026', 'CA', 2026, URL, loc, terr, name, pid, int(a)])
    basic = f['P11_TYPE'].startswith('Basic')
    single = f['P11_INSURANCE_FOR'] == 'Single Driver'
    plain = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', re.sub(r'<script.*?</script>', '', t, flags=re.S))))
    dm = re.search(r'Driving Record: (.*?) Vehicle:', plain)
    drec = dm.group(1).strip() if dm else f['P11_RECORD']
    desc = (f"CDI 2026 Auto Premium Survey tool: Coverage Type={f['P11_TYPE']}; Insurance For={f['P11_INSURANCE_FOR']}; "
            f"Years Licensed={f['P11_YEARS_LICENSED'].strip()}; Mileage={f['P11_MILEAGE'].strip()}; "
            f"Driving Record={drec}; "
            f"Vehicle={f['P11_VEHICLE']}; Profile {prof}. " + (BASIC_COV if basic else STD_COV))
    num = re.match(r'(\d+)([A-Za-z])', prof)
    yrs = inc = vio = ''
    if single and num:
        yrs = YEARS.get(num.group(1)[:3], '')
        inc, vio = REC.get(num.group(2).upper(), ('', ''))
    other = []
    if not single:
        other.append('multi-driver/multi-car profile: ' + f['P11_INSURANCE_FOR'] + ' (' + f['P11_YEARS_LICENSED'] + ' licensed)')
    profiles[pid] = ['ca-2026', pid, desc, '', '', 'single' if single else 'married', yrs, inc, vio,
                     'liability-only' if basic else 'full',
                     '30/60/15' if basic else '100/300/50', '' if basic else 250, '' if basic else 500,
                     f['P11_VEHICLE'], f['P11_MILEAGE'].strip(), '', '', '; '.join(other)]

with open(D + '/premiums.csv', 'w', newline='') as fh:
    w = csv.writer(fh)
    w.writerow('source_id,state,data_year,url,locator,territory,carrier,profile_id,annual_premium'.split(','))
    w.writerows(prem)
with open(D + '/profiles.csv', 'w', newline='') as fh:
    w = csv.writer(fh)
    w.writerow('source_id,profile_id,description,driver_age,gender,marital,years_licensed,incidents,violations,coverage,liability_limits,comp_deductible,coll_deductible,vehicle,annual_miles,good_student,driver_training,other'.split(','))
    for pid in sorted(profiles):
        w.writerow(profiles[pid])
print(len(prem), 'rows', len(profiles), 'profiles', 'carriers', len(set(r[6] for r in prem)))
print('bad', bad[:20], len(bad))
c = Counter((r[5], r[7]) for r in prem)
print('max rows per table', max(c.values()), 'min', min(c.values()))
dup = Counter((r[5], r[7], r[6]) for r in prem)
print('dup carrier rows', sum(1 for v in dup.values() if v > 1))

"""Check which vehicle names the survey tool accepts for a Standard single-driver profile.

Usage: python3 scripts/research/ca-2026/ca_probe.py "5 to 7" "Tesla Model 3" "Toyota Prius"
"""
import sys, re, time, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ca_fetch import run

names = ['P11_TYPE', 'P11_LOCATION', 'P11_INSURANCE_FOR', 'P11_YEARS_LICENSED', 'P11_MILEAGE', 'P11_RECORD', 'P11_VEHICLE']
for label in sys.argv[2:]:
    q = ('Standard', 'Los Angeles Los Angeles - Central', 'Single Driver', sys.argv[1], '7,600 - 10,000 ', 'A', label)
    url, body = run(list(zip(names, q)))
    prof = re.findall(r'(\d{4}[A-Z]_V\d)', body)
    rows = len(re.findall(r'PREMIUM_AMT', body))
    first = re.findall(r'\$[\d,]+', body)[:2]
    print(repr(label), prof[:1], rows, first, flush=True)
    time.sleep(2)

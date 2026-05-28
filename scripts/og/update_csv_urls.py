"""
Point every outreach link at its school's share page so the link preview shows
that school's court.

Rewrites wbb_outreach_final.csv:
    tracking_url  ->  {ORIGIN}/s/{slug}/?ref={ref}

Mapping is by the row's `school` column against scripts/og/schools.json (the
single source of truth for slug<->teamId). Aborts loudly if a school in the CSV
has no schools.json entry, so a typo can never silently ship a broken link.

Run:  python3 scripts/og/update_csv_urls.py
"""
from pathlib import Path
import csv
import json
import sys

ROOT = Path(__file__).resolve().parents[2]
CSV = ROOT / 'wbb_outreach_final.csv'
SCHOOLS = json.loads((ROOT / 'scripts' / 'og' / 'schools.json').read_text())
ORIGIN = 'https://ashtonjantz.com'

slug_by_school = {s['school']: s['slug'] for s in SCHOOLS}


def main() -> int:
    rows = list(csv.DictReader(CSV.open(newline='')))
    missing = sorted({r['school'] for r in rows if r['school'] not in slug_by_school})
    if missing:
        print('ABORT — schools in CSV with no schools.json entry:')
        for m in missing:
            print(f'  - {m!r}')
        return 1

    for r in rows:
        slug, ref = slug_by_school[r['school']], r['ref']
        r['tracking_url'] = f'{ORIGIN}/s/{slug}/?ref={ref}'

    fieldnames = list(rows[0].keys())
    with CSV.open('w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    print(f'Updated {len(rows)} tracking URLs in {CSV.name}')
    print(f'  e.g. {rows[0]["tracking_url"]}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

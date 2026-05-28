"""
Fold the freshly-scraped teams into the live shot-chart index.

The scraper writes new teams to public/data/d1/_index_new_fragment.json (a bare
list) so a long, crash-prone run can never clobber the 25 teams already serving
in index.json. This merges that fragment in:

    index.json = { generatedAt, season, teams: [...] }   (existing 25)
    fragment   = [ {...}, ... ]                           (new, apRank=999)

Dedup is by teamId (fragment wins). Output is sorted AP-ranked first, then
unranked alphabetical — the same order the UI renders, so the JSON reads sanely.

Run:  python3 scripts/og/merge_teams_index.py
"""
from datetime import datetime, timezone
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
D1 = ROOT / 'public' / 'data' / 'd1'
INDEX = D1 / 'index.json'
FRAGMENT = D1 / '_index_new_fragment.json'


def is_ranked(ap: int) -> bool:
    return 0 < ap < 100


def sort_key(t: dict):
    ranked = is_ranked(t['apRank'])
    return (0 if ranked else 1, t['apRank'] if ranked else 0, t['name'].lower())


def main() -> int:
    index = json.loads(INDEX.read_text())
    existing = index['teams']
    new = json.loads(FRAGMENT.read_text()) if FRAGMENT.exists() else []

    by_id = {t['teamId']: t for t in existing}
    for t in new:
        by_id[t['teamId']] = t

    merged = sorted(by_id.values(), key=sort_key)
    index['teams'] = merged
    index['generatedAt'] = datetime.now(timezone.utc).isoformat()

    INDEX.write_text(json.dumps(index, indent=2))
    ranked = sum(1 for t in merged if is_ranked(t['apRank']))
    print(f'Merged: {len(existing)} existing + {len(new)} new -> {len(merged)} teams '
          f'({ranked} AP-ranked, {len(merged) - ranked} unranked)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

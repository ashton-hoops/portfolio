"""
Capture a clean PNG of the 3D shot-chart canvas for every school in
scripts/og/schools.json, using the ?team= deep-link so selection is by ESPN
teamId (robust — no fragile button-text matching across 60 teams).

Requires the dev server running:  npm run dev  (http://localhost:5173)

Output: scripts/og/.courts/{teamId}.png
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[2]          # Portfolio repo root
SCHOOLS = json.loads((ROOT / 'scripts' / 'og' / 'schools.json').read_text())
COURTS = ROOT / 'scripts' / 'og' / '.courts'
COURTS.mkdir(parents=True, exist_ok=True)

BASE = 'http://localhost:5173/#/shot-chart?team={team_id}'


def main(only_team: str | None = None) -> int:
    targets = [s for s in SCHOOLS if not only_team or s['teamId'] == only_team]
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={'width': 1600, 'height': 1100},
                                  device_scale_factor=2)
        for s in targets:
            tid, name = s['teamId'], s['school']
            # Fresh page per team: the SPA reads ?team= only in its mount-time
            # state initializer, and a hash-only goto on a reused page is a
            # same-document nav that never remounts — so we'd capture the
            # previously loaded team. A new page forces a clean document load.
            page = ctx.new_page()
            try:
                page.goto(BASE.format(team_id=tid), wait_until='domcontentloaded')
                try:
                    page.wait_for_selector('canvas', timeout=15000)
                except Exception:
                    print(f'  [skip] {name} ({tid}): no canvas')
                    continue
                # Let the team file fetch + three.js markers settle. Poll for
                # the "Loading court..." overlay to disappear (large files need
                # >3s), then give markers a beat to render before the shot.
                try:
                    page.wait_for_function(
                        "!document.body.innerText.includes('Loading court')",
                        timeout=15000)
                except Exception:
                    print(f'  [warn] {name} ({tid}): still loading after 15s')
                page.wait_for_timeout(2500)
                canvas = page.query_selector('canvas')
                if not canvas:
                    print(f'  [skip] {name} ({tid}): canvas vanished')
                    continue
                out = COURTS / f'{tid}.png'
                canvas.screenshot(path=str(out))
                print(f'  captured {name} ({tid}) -> {out.name}')
            finally:
                page.close()
        browser.close()
    print(f'Done. Courts in {COURTS}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else None))

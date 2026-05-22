"""
Capture a demo video of the /shot-chart page that shows:
  1. Starting on UCLA
  2. Switching to Oklahoma (markers populate, camera settles)
  3. Switching the view mode from markers to zones
  4. Selecting Aaliyah Chavez from the player picker

Output: public/videos/shot-chart-demo.mp4
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
FRAMES_DIR = ROOT / 'scripts' / '.frames'
OUT_DIR = ROOT / 'public' / 'videos'
OUT_FILE = OUT_DIR / 'shot-chart-demo.mp4'

# Aaliyah Chavez's ESPN athleteId on Oklahoma
CHAVEZ_ATHLETE_ID = '5311585'

if FRAMES_DIR.exists():
    shutil.rmtree(FRAMES_DIR)
FRAMES_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={'width': 1280, 'height': 760}, device_scale_factor=2)
    page = ctx.new_page()

    page.goto('http://localhost:5173/#/shot-chart', wait_until='domcontentloaded')
    page.wait_for_selector('canvas', timeout=10000)
    page.wait_for_selector('button.sct__team-btn', timeout=10000)
    page.wait_for_timeout(900)  # initial render settle

    # Pre-position: jump to UCLA so the capture begins on UCLA.
    page.evaluate("""() => {
      const btns = document.querySelectorAll('button.sct__team-btn')
      for (const b of btns) {
        if (b.textContent.trim().startsWith('UCLA')) { b.click(); return }
      }
    }""")
    page.wait_for_timeout(900)  # UCLA markers populate, camera settles

    fps = 24
    duration_s = 9.0  # longer clip to fit the three actions
    total = int(fps * duration_s)
    interval_ms = int(1000 / fps)

    # Scripted action timing (in frames)
    F_CLICK_OU = 2
    F_SWITCH_ZONES = int(fps * 3.5)
    F_PICK_CHAVEZ = int(fps * 6.0)

    did_ou = False
    did_zones = False
    did_chavez = False

    for i in range(total):
        if i == F_CLICK_OU and not did_ou:
            page.evaluate("""() => {
              const btns = document.querySelectorAll('button.sct__team-btn')
              for (const b of btns) {
                if (b.textContent.trim().startsWith('OU')) { b.click(); return }
              }
            }""")
            did_ou = True

        if i == F_SWITCH_ZONES and not did_zones:
            # The view toggle is a button group with text "markers" / "zones"
            # under the "Chart" filter row.
            page.evaluate("""() => {
              const btns = document.querySelectorAll('button.sct__filter-btn')
              for (const b of btns) {
                if (b.textContent.trim().toLowerCase() === 'zones') { b.click(); return }
              }
            }""")
            did_zones = True

        if i == F_PICK_CHAVEZ and not did_chavez:
            # Player picker is a native <select>; set the value via the
            # native setter then dispatch a `change` event so React's
            # onChange handler runs.
            page.evaluate(f"""() => {{
              const selects = document.querySelectorAll('select.sct__select')
              for (const s of selects) {{
                const opts = [...s.options].map(o => o.value)
                if (opts.includes('{CHAVEZ_ATHLETE_ID}')) {{
                  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
                  setter.call(s, '{CHAVEZ_ATHLETE_ID}')
                  s.dispatchEvent(new Event('change', {{ bubbles: true }}))
                  return
                }}
              }}
            }}""")
            did_chavez = True

        out = FRAMES_DIR / f'frame_{i:04d}.png'
        page.screenshot(path=str(out), full_page=False)
        page.wait_for_timeout(interval_ms)

    browser.close()

cmd = [
    'ffmpeg', '-y',
    '-framerate', str(fps),
    '-i', str(FRAMES_DIR / 'frame_%04d.png'),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-crf', '22',
    '-preset', 'medium',
    '-movflags', '+faststart',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    str(OUT_FILE),
]
subprocess.run(cmd, check=True)
shutil.rmtree(FRAMES_DIR)
print(f'Wrote {OUT_FILE} ({OUT_FILE.stat().st_size / 1024:.1f} KB)')

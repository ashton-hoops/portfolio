"""
Emit one CLEAN static share page per recipient ref:  public/s/{cleanpath}/index.html

The visible URL is short and path-based (no ?ref= query string), e.g.
    https://ashtonjantz.com/s/jackson-state-d
DOBO -> "{slug}-d", ASST -> "{slug}-a". The page bakes in the FULL original ref
and redirects to /?ref={fullref}#/ so trackVisit() identity is unchanged
(PostHog + Discord still key on jackson-state-dobo etc.). trackVisit then strips
the ?ref= from the address bar, so the only place a URL is ever seen is the clean
email link.

Source of refs: src/lib/refDirectory.ts (committed, no PII). School->slug from
scripts/og/schools.json.

Run:  python3 scripts/og/build_clean_share_pages.py
Writes a ref->clean_url map to scripts/og/.clean_urls.json for CSV/draft updates.
"""
from pathlib import Path
import html, json, re

ROOT = Path(__file__).resolve().parents[2]
PUB = ROOT / 'public'
SCHOOLS = json.loads((ROOT / 'scripts' / 'og' / 'schools.json').read_text())
REFDIR = (ROOT / 'src' / 'lib' / 'refDirectory.ts').read_text()

ORIGIN = 'https://ashtonjantz.com'
TITLE = 'Ashton Jantz · Basketball Analytics & Research'
DESC = 'Looking to support a program through research, analytics, and software development.'

school_to_slug = {s['school']: s['slug'] for s in SCHOOLS}

# Parse refDirectory.ts entries: "ref": {"name": "...", "school": "...", "role": "..."}
entries = re.findall(
    r'"([^"]+)":\s*\{[^}]*?"school":\s*"((?:[^"\\]|\\.)*)"[^}]*?"role":\s*"([^"]*)"',
    REFDIR,
)

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=aj-serif-3" />
    <title>{title}</title>
    <meta name="description" content="{desc}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Ashton Jantz" />
    <meta property="og:title" content="{title}" />
    <meta property="og:description" content="{desc}" />
    <meta property="og:url" content="{origin}/s/{cleanpath}/" />
    <meta property="og:image" content="{origin}/og/teams/{slug}.png" />
    <meta property="og:image:secure_url" content="{origin}/og/teams/{slug}.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:alt" content="Ashton Jantz — {school} 3D shot chart" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{title}" />
    <meta name="twitter:description" content="{desc}" />
    <meta name="twitter:image" content="{origin}/og/teams/{slug}.png" />

    <script>
      (function () {{
        location.replace('/?ref={ref}#/');
      }})();
    </script>
    <noscript><meta http-equiv="refresh" content="0; url=/#/" /></noscript>
    <style>
      body {{ margin:0; min-height:100vh; display:grid; place-items:center;
        background:#fafaf6; color:#18171a;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }}
      a {{ color:#18171a; }}
    </style>
  </head>
  <body>
    <p>Opening Ashton Jantz's portfolio… <a href="/#/">Continue</a></p>
  </body>
</html>
"""


def clean_path(ref: str, school: str) -> str:
    if ref.endswith('-dobo'):
        return ref[:-5] + '-d'
    if ref.endswith('-asst'):
        return ref[:-5] + '-a'
    return ref  # personal / non-standard: leave as-is


def slug_for(ref: str, school: str) -> str:
    if ref.endswith('-dobo') or ref.endswith('-asst'):
        return ref.rsplit('-', 1)[0]
    return school_to_slug.get(school, ref)


def main() -> int:
    mapping = {}
    n = 0
    for ref, school_esc, role in entries:
        school = school_esc.encode().decode('unicode_escape')
        slug = slug_for(ref, school)
        cp = clean_path(ref, school)
        out_dir = PUB / 's' / cp
        out_dir.mkdir(parents=True, exist_ok=True)
        page = PAGE.format(
            title=html.escape(TITLE, quote=True),
            desc=html.escape(DESC, quote=True),
            school=html.escape(school, quote=True),
            slug=slug, cleanpath=cp, ref=ref, origin=ORIGIN,
        )
        (out_dir / 'index.html').write_text(page)
        mapping[ref] = f'{ORIGIN}/s/{cp}'
        n += 1
    (ROOT / 'scripts' / 'og' / '.clean_urls.json').write_text(json.dumps(mapping, indent=2))
    print(f'Wrote {n} clean share pages under {PUB / "s"}')
    print('sample:')
    for r in list(mapping)[:4]:
        print(f'  {r}  ->  {mapping[r]}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

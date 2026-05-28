"""
Emit one static share page per school:  public/s/{slug}/index.html

Why static HTML: link-preview crawlers (iMessage, Slack, iCloud Mail) read the
og:image straight from the served HTML and never run our SPA's JS, so the only
way a per-recipient link can preview the *correct* school court is a dedicated
page whose og:image is that school's card.

Each page:
  - carries per-school OG / Twitter meta -> /og/teams/{slug}.png so the link
    preview shows the recipient's own school court
  - on load, reads its own ?ref= and forwards a human to the portfolio home
        /?ref={ref}#/
    so trackVisit() fires at the root and the coach lands on the landing page.
    Crawlers just read the meta and never redirect.

Run:  python3 scripts/og/build_share_pages.py
"""
from pathlib import Path
import html
import json

ROOT = Path(__file__).resolve().parents[2]
PUB = ROOT / 'public'
SCHOOLS = json.loads((ROOT / 'scripts' / 'og' / 'schools.json').read_text())

ORIGIN = 'https://ashton-portfolio.onrender.com'
TITLE = 'Ashton Jantz · Basketball Analytics & Research'
DESC = 'Looking to support a program through research, analytics, and software development.'

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=aj-serif-3" />
    <title>{title}</title>
    <meta name="description" content="{desc}" />

    <!-- Open Graph / Link Preview -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Ashton Jantz" />
    <meta property="og:title" content="{title}" />
    <meta property="og:description" content="{desc}" />
    <meta property="og:url" content="{origin}/s/{slug}/" />
    <meta property="og:image" content="{origin}/og/teams/{slug}.png" />
    <meta property="og:image:secure_url" content="{origin}/og/teams/{slug}.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="2400" />
    <meta property="og:image:height" content="1260" />
    <meta property="og:image:alt" content="Ashton Jantz — {school} 3D shot chart" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{title}" />
    <meta name="twitter:description" content="{desc}" />
    <meta name="twitter:image" content="{origin}/og/teams/{slug}.png" />

    <script>
      (function () {{
        var ref = new URLSearchParams(location.search).get('ref');
        var base = ref ? '/?ref=' + encodeURIComponent(ref) : '/';
        location.replace(base + '#/');
      }})();
    </script>
    <noscript>
      <meta http-equiv="refresh" content="0; url=/#/" />
    </noscript>
    <style>
      body {{
        margin: 0; min-height: 100vh; display: grid; place-items: center;
        background: #fafaf6; color: #18171a;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }}
      a {{ color: #18171a; }}
    </style>
  </head>
  <body>
    <p>Opening Ashton Jantz’s portfolio…
      <a href="/#/">Continue</a>
    </p>
  </body>
</html>
"""


def main() -> int:
    n = 0
    for sch in SCHOOLS:
        slug = sch['slug']
        out_dir = PUB / 's' / slug
        out_dir.mkdir(parents=True, exist_ok=True)
        page = PAGE.format(
            title=html.escape(TITLE, quote=True),
            desc=html.escape(DESC, quote=True),
            school=html.escape(sch['school'], quote=True),
            slug=slug,
            origin=ORIGIN,
        )
        (out_dir / 'index.html').write_text(page)
        n += 1
    print(f'Wrote {n} share pages under {PUB / "s"}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

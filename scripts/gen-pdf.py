#!/usr/bin/env python3
"""
Regenerate ashton-jantz-portfolio.pdf from the live dev server.

Usage:
    # 1. Make sure dev server is running at localhost:5173
    # 2. python3 scripts/gen-pdf.py

The generated PDF goes to public/ashton-jantz-portfolio.pdf and
can be shared with coaches as an email attachment.
"""

from playwright.sync_api import sync_playwright
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(REPO_ROOT, "public", "ashton-jantz-portfolio.pdf")
URL = "http://localhost:5173"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1200, "height": 800})

        try:
            page.goto(URL, wait_until="networkidle", timeout=30000)
        except Exception as e:
            print(f"ERROR: couldn't reach {URL}. Is the dev server running?")
            print(f"  Run: npm run dev")
            print(f"  {e}")
            sys.exit(1)

        page.wait_for_timeout(3000)

        # Print stylesheet — hide nav, force page breaks per section
        page.add_style_tag(content="""
            @page { margin: 0; size: A4; }
            @media print {
              .header { display: none !important; }
              section { page-break-inside: avoid; break-inside: avoid; }
              .masthead { page-break-after: always; break-after: page; }
              .cv-demo { page-break-after: always; break-after: page; }
              .shot-section { page-break-after: always; break-after: page; }
              .projects-section { page-break-before: always; break-before: page; }
              .cta-bar { page-break-before: always; break-before: page; }
            }
        """)

        page.pdf(
            path=OUTPUT,
            format="Letter",
            print_background=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
        )
        browser.close()

    size_mb = os.path.getsize(OUTPUT) / 1024 / 1024
    print(f"✓ PDF generated: {OUTPUT}  ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()

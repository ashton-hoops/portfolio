# CLAUDE.md

Persistent context for Claude Code sessions on this repository. Claude reads
this automatically at the start of every session. It covers **who Ashton is**
(so any session knows the person and the mission) and a **guide to this repo**.

---

## About Ashton (the person)

**Ashton Jantz** — Basketball Analytics & Software Development. Based in Norman, OK.

- **Contact:** ashtonbjantz@icloud.com · (405) 696-9206 · Norman, OK
  - Also uses: ashton@hoopsandheritage.com (Hoops & Heritage brand)
- **Site:** https://ashtonjantz.com (also deployed at ashton-portfolio.onrender.com)
- **Education:** B.B.A., Sports Business — University of Oklahoma, May 2026.
  Sports Analytics concentration.

### The mission / current goal
Seeking a **volunteer analytics role with a Division I women's basketball
program for the 2026–27 season.** The portfolio, the outreach campaign, and most
projects exist to land this role. When suggesting work, optimize for *what makes
a college coaching staff want to bring Ashton on.*

### Background
- **OU Women's Basketball — Practice Player (2024–2026).** Two seasons running
  scout-team simulations of opponent sets. Independently built a full defensive
  analytics platform for the program (film tagging, shot charts, lineup metrics,
  statistical reports) from scratch. Tagged **811 half-court possessions across
  15 tournament-level opponents.**
- **Hoops & Heritage — Founder (2021–present).** Design brand making decorative
  mini basketball hoops as functional art. Built brand, product line,
  e-commerce, and wholesale from zero; collaborations with NBA players, art
  institutions, and independent retailers.
- **Norman Optimist Club Basketball — Head Coach, 5th–7th grade (2021–2024).**

### Skills
- **Code:** Python · TypeScript · React · SQL · R
- **Data/viz:** Tableau · Three.js · D3 · Pandas · Excel
- **CV / ML:** OpenCV · PyTorch · YOLO · NumPy
- **Basketball:** film breakdown · scouting · play design · practice-player reps

### References
- **Cal Watson** — Director of Scouting & Analytics, Alabama WBB
- **Michael Neal** — Director of Player Development, Oklahoma WBB

### Signature projects
- **Defensive Analysis Dashboard** (React · Python · PostgreSQL · Cloudflare R2) —
  possession-by-possession film tagging (14 action types), 3D shot charts,
  lineup metrics. The 811-possession study is the flagship research piece.
- **Computer Vision Pipeline** (Python · OpenCV · PyTorch · YOLO) — tracks all 10
  players, court locations, and actions (screens, DHOs, shot contests) from
  broadcast film; can process a full game overnight.
- **3D Shot Chart** (Three.js) — interactive shot viewer for the 2025-26 AP Top
  25 women's D1 teams, rendered on a real court. Data from ESPN's public API.
- **2-for-1 study** — optimal timing to go 2-for-1 in women's college basketball.

---

## About this repository

Personal basketball-analytics portfolio site.

- **Stack:** React 19 + Vite + TypeScript. Routing via `react-router-dom` v7
  (**HashRouter**). Three.js for the 3D shot chart. PostHog analytics
  (`src/lib/analytics.ts`, `trackVisit.ts`). `lucide-react` icons.
- **Deploy:** static site on **Render** (`render.yaml`, SPA rewrite to
  `index.html`). No CI, no test suite.
- **Commands:** `npm run dev` (local), `npm run build` (Vite build),
  `npm run lint` (ESLint).

### Layout
- `src/pages/` — routes: `PortfolioDeck` (homepage), `Research`, `Article`,
  `ShotChartTool/` (the live Three.js shot chart — uses **real** ESPN data),
  `DefensiveAnalysis/`, `TwoForOne/`, `Resume`, PDF-export pages.
- `src/components/` — `Header`, `Footer`, `Layout`, `ShotChart` (NOTE: unused
  leftover with synthetic data — the real chart is `ShotChartTool`), etc.
- `src/data/articles.ts` — article/project content model.
- `src/lib/refDirectory.ts` — auto-generated coach directory (names, schools,
  roles; **no emails**).
- `public/data/d1/` — ESPN shot dataset: `index.json` (376 team rosters) +
  `teams/*.json` (60 team shot files, ~122k shots total, incl. opponents).
- `public/s/` — per-team share pages for coach outreach. `public/og/` — link
  preview cards. `scripts/` — Python tooling (OG cards, ref directory, data build).

### Notes / gotchas
- **Outreach emails are NOT in the repo.** `wbb_outreach_final.csv` (coach emails)
  is **gitignored** on purpose and only exists on Ashton's local machine — so it
  is absent in cloud/web sessions.
- In the shot JSON, the `isOpponent` flag is unreliable; identify a team's own
  shots by matching `shot.teamId` to the file's `teamId`.
- HashRouter means every route shares the homepage's meta tags (no per-page SEO).

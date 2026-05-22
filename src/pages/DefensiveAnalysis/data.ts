/* ================================================================
   Defensive Analysis Report — Chart Data
   All values sourced from the 811-possession tagging dataset.
   ================================================================ */

export interface BarItem {
  label: string
  poss: number
  value: number
  lowSample?: boolean
}

export interface StackedItem {
  label: string
  poss: number
  open: number
  light: number
  contested: number
  heavy: number
}

export interface CourtZone {
  id: string
  label: string
  value: number
  poss: number
  x: number
  y: number
}

/* ---------- Finding 1: PPP & Paint Touch by Action Count ---------- */

export const pppByActionCount: BarItem[] = [
  { label: 'No Actions / ISO', poss: 68, value: 0.79 },
  { label: '1 Action', poss: 146, value: 0.76 },
  { label: '2–3 Actions', poss: 387, value: 1.06 },
  { label: '4–6 Actions', poss: 188, value: 1.05 },
  { label: '7–9 Actions', poss: 21, value: 1.24 },
]
export const PPP_BY_ACTION_COUNT_AVG = 0.99

export const paintTouchByActionCount: BarItem[] = [
  { label: 'No Actions / ISO', poss: 68, value: 12 },
  { label: '1 Action', poss: 146, value: 34 },
  { label: '2–3 Actions', poss: 387, value: 68 },
  { label: '4–6 Actions', poss: 188, value: 78 },
  { label: '7–9 Actions', poss: 21, value: 90 },
]
export const PAINT_TOUCH_BY_ACTION_COUNT_AVG = 60

/* ---------- Finding 2: PPP & Paint Touch by Action Type ---------- */

export const paintTouchByAction: BarItem[] = [
  { label: 'Fake DHO/Keep', poss: 14, value: 86, lowSample: true },
  { label: 'Ghost Screen', poss: 14, value: 79, lowSample: true },
  { label: 'Cross Screen', poss: 9, value: 78, lowSample: true },
  { label: 'ISO', poss: 170, value: 77 },
  { label: 'Side PNR/PNP', poss: 15, value: 73, lowSample: true },
  { label: 'Rejected Ball Screen', poss: 39, value: 69 },
  { label: 'Pick & Roll', poss: 173, value: 60 },
  { label: 'Flare', poss: 31, value: 52 },
  { label: 'DHO', poss: 57, value: 51 },
  { label: 'Pick & Pop', poss: 71, value: 51 },
  { label: 'Back Screen', poss: 12, value: 50, lowSample: true },
  { label: 'Pin-Down', poss: 33, value: 48 },
  { label: 'Get Action', poss: 11, value: 45, lowSample: true },
  { label: 'Stagger', poss: 11, value: 18, lowSample: true },
]
export const PAINT_TOUCH_BY_ACTION_AVG = 60

export const pppByAction: BarItem[] = [
  { label: 'Back Screen', poss: 12, value: 1.58, lowSample: true },
  { label: 'Stagger', poss: 11, value: 1.36, lowSample: true },
  { label: 'Ghost Screen', poss: 14, value: 1.29, lowSample: true },
  { label: 'DHO', poss: 57, value: 1.23 },
  { label: 'Fake DHO/Keep', poss: 14, value: 1.14, lowSample: true },
  { label: 'Side PNR/PNP', poss: 15, value: 1.13, lowSample: true },
  { label: 'ISO', poss: 170, value: 1.09 },
  { label: 'Pin-Down', poss: 33, value: 1.06 },
  { label: 'Pick & Roll', poss: 173, value: 0.97 },
  { label: 'Flare', poss: 31, value: 0.97 },
  { label: 'Rejected Ball Screen', poss: 39, value: 0.95 },
  { label: 'Pick & Pop', poss: 71, value: 0.69 },
  { label: 'Cross Screen', poss: 9, value: 0.67, lowSample: true },
  { label: 'Get Action', poss: 11, value: 0.64, lowSample: true },
]
export const PPP_BY_ACTION_AVG = 0.99

/* ---------- Finding 3: Contest Level ---------- */

export const pppByContest: BarItem[] = [
  { label: 'Open (4+ ft)', poss: 105, value: 1.52 },
  { label: 'Light / Late High-Hand', poss: 203, value: 1.33 },
  { label: 'Contested / On-Time High-Hand', poss: 164, value: 0.99 },
  { label: 'Heavy / Early High-Hand', poss: 122, value: 0.57 },
]
export const PPP_BY_CONTEST_AVG = 1.11

export const contestByAction: StackedItem[] = [
  { label: 'Pin-Down', poss: 33, open: 19, light: 42, contested: 19, heavy: 19 },
  { label: 'Pick & Pop', poss: 71, open: 13, light: 47, contested: 26, heavy: 15 },
  { label: 'Flare', poss: 31, open: 29, light: 29, contested: 29, heavy: 14 },
  { label: 'DHO', poss: 57, open: 18, light: 32, contested: 27, heavy: 23 },
  { label: 'Pick & Roll', poss: 173, open: 19, light: 31, contested: 29, heavy: 21 },
  { label: 'ISO', poss: 170, open: 11, light: 32, contested: 30, heavy: 28 },
  { label: 'Rejected Ball Screen', poss: 39, open: 7, light: 31, contested: 34, heavy: 28 },
  { label: 'Side PNR/PNP', poss: 15, open: 8, light: 17, contested: 58, heavy: 17 },
]
export const CONTEST_AVG_OPEN_LIGHT = 48

/* ---------- Finding 4: Opp PPP by OU Miss Zone ---------- */

export const courtZones: CourtZone[] = [
  { id: 'rim', label: 'At Rim', value: 0.66, poss: 82, x: 250, y: 58 },
  { id: 'paint', label: 'Paint + Short Mid', value: 0.61, poss: 137, x: 250, y: 155 },
  { id: 'long-mid', label: 'Long Midrange', value: 0.76, poss: 62, x: 250, y: 248 },
  { id: 'corner-3-l', label: 'Corner 3', value: 1.18, poss: 17, x: 48, y: 80 },
  { id: 'corner-3-r', label: 'Corner 3', value: 1.18, poss: 17, x: 452, y: 80 },
  { id: 'wing-3-l', label: 'Wing 3', value: 1.22, poss: 55, x: 80, y: 310 },
  { id: 'wing-3-r', label: 'Wing 3', value: 1.22, poss: 55, x: 420, y: 310 },
  { id: 'top-3', label: 'Top of Key 3', value: 1.22, poss: 71, x: 250, y: 385 },
]
export const LIVE_BALL_TO_PPP = 1.21
export const LIVE_BALL_TO_POSS = 85

/* ---------- Finding 5: Formation / Set ---------- */

export const paintTouchByFormation: BarItem[] = [
  { label: 'UCLA', poss: 9, value: 67, lowSample: true },
  { label: 'Pistol', poss: 17, value: 59, lowSample: true },
  { label: 'Horns', poss: 51, value: 55 },
  { label: 'Zipper', poss: 8, value: 50, lowSample: true },
  { label: 'Zoom', poss: 25, value: 48 },
  { label: 'Dbl Ball Screen / Brush', poss: 16, value: 44, lowSample: true },
  { label: 'Ram', poss: 12, value: 42, lowSample: true },
  { label: 'Iverson', poss: 7, value: 29, lowSample: true },
  { label: 'Floppy', poss: 18, value: 28, lowSample: true },
]
export const PAINT_TOUCH_BY_FORMATION_AVG = 48

export const pppByFormation: BarItem[] = [
  { label: 'UCLA', poss: 9, value: 1.56, lowSample: true },
  { label: 'Floppy', poss: 18, value: 1.33, lowSample: true },
  { label: 'Zoom', poss: 25, value: 1.08 },
  { label: 'Horns', poss: 51, value: 1.08 },
  { label: 'Dbl Ball Screen / Brush', poss: 16, value: 1.06, lowSample: true },
  { label: 'Pistol', poss: 17, value: 1.06, lowSample: true },
  { label: 'Iverson', poss: 7, value: 1.00, lowSample: true },
  { label: 'Zipper', poss: 8, value: 0.75, lowSample: true },
  { label: 'Ram', poss: 12, value: 0.58, lowSample: true },
]
export const PPP_BY_FORMATION_AVG = 1.07

/* ---------- Setup: Tagged Fields Table ---------- */

export const taggedFields = [
  { field: 'Situation', captures: 'Half-Court, SLOB, BLOB, ATO, Transition' },
  { field: 'Offensive formation', captures: 'Horns Flare, Zipper Pin-Down, Spain PNR, etc.' },
  { field: 'Action sequence', captures: 'DHO, Flare, Pin-Down, Get Action, Final Trigger, etc.' },
  { field: 'Defensive coverage', captures: 'Man or Zone, Coverage Type' },
  { field: 'Shot contest', captures: 'Open, Light/Late, Contested/On-Time, Heavy/Early, Blocked' },
  { field: 'Paint touch', captures: 'Drive Middle, Drive Baseline, Post Touch, Cut To Paint, No Touch' },
  { field: 'Scouting role', captures: 'Primary Player, Shooter, Role Player' },
  { field: 'Outcome context', captures: 'Shot Result, Shot Zone, Rebound, Possession Result' },
]

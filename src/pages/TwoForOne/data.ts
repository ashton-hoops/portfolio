// 2-for-1 analysis data — AP top 25 WBB 2025-26 season
// Source: ESPN play-by-play via sportsdataverse
// Cohort: opportunities started 50-70s remaining in Q1/Q2/Q3 with fresh shot clock
// "Took advantage" = ended at 40-58s remaining (TOs exempt from cohort)
// Counterfactual baseline: each team's own half-court PPP (length>=10s possessions)

export interface TeamRow {
  name: string
  espnId: number
  apRank: number
  attemptsPerGame: number
  ppgGained: number
  combinedPpp: number
  hcPpp: number
  conversionPct: number
  passUpPct: number
  toRate: number
  earlyRate: number
}

export const TEAMS: TeamRow[] = [
  { name: 'LSU', espnId: 99, apRank: 8, attemptsPerGame: 1.23, ppgGained: 2.96, combinedPpp: 3.53, hcPpp: 1.12, conversionPct: 69.4, passUpPct: 17.7, toRate: 20.5, earlyRate: 12.9 },
  { name: 'Texas', espnId: 251, apRank: 4, attemptsPerGame: 1.10, ppgGained: 1.50, combinedPpp: 2.44, hcPpp: 1.08, conversionPct: 57.3, passUpPct: 30.7, toRate: 13.8, earlyRate: 12.0 },
  { name: 'Kentucky', espnId: 96, apRank: 14, attemptsPerGame: 1.06, ppgGained: 1.38, combinedPpp: 2.37, hcPpp: 1.07, conversionPct: 63.0, passUpPct: 31.7, toRate: 17.8, earlyRate: 5.0 },
  { name: 'UCLA', espnId: 26, apRank: 1, attemptsPerGame: 1.03, ppgGained: 2.10, combinedPpp: 3.23, hcPpp: 1.18, conversionPct: 59.1, passUpPct: 27.3, toRate: 15.4, earlyRate: 13.6 },
  { name: 'Louisville', espnId: 97, apRank: 11, attemptsPerGame: 1.03, ppgGained: 2.28, combinedPpp: 3.32, hcPpp: 1.02, conversionPct: 60.8, passUpPct: 23.0, toRate: 17.6, earlyRate: 14.9 },
  { name: 'Iowa', espnId: 2294, apRank: 16, attemptsPerGame: 1.03, ppgGained: 1.69, combinedPpp: 2.71, hcPpp: 0.98, conversionPct: 71.4, passUpPct: 24.5, toRate: 23.4, earlyRate: 6.2 },
  { name: 'Michigan', espnId: 130, apRank: 7, attemptsPerGame: 1.03, ppgGained: 2.18, combinedPpp: 3.23, hcPpp: 1.02, conversionPct: 65.5, passUpPct: 23.6, toRate: 26.7, earlyRate: 10.9 },
  { name: 'South Carolina', espnId: 2579, apRank: 2, attemptsPerGame: 1.02, ppgGained: 1.65, combinedPpp: 2.75, hcPpp: 1.07, conversionPct: 63.1, passUpPct: 24.6, toRate: 17.7, earlyRate: 12.3 },
  { name: 'Maryland', espnId: 120, apRank: 20, attemptsPerGame: 1.00, ppgGained: 1.97, combinedPpp: 2.97, hcPpp: 1.00, conversionPct: 55.9, passUpPct: 33.9, toRate: 15.7, earlyRate: 10.2 },
  { name: 'Duke', espnId: 150, apRank: 5, attemptsPerGame: 0.97, ppgGained: 1.14, combinedPpp: 2.09, hcPpp: 0.91, conversionPct: 53.8, passUpPct: 35.4, toRate: 12.2, earlyRate: 12.2 },
  { name: 'West Virginia', espnId: 277, apRank: 18, attemptsPerGame: 0.97, ppgGained: 2.22, combinedPpp: 3.26, hcPpp: 0.98, conversionPct: 59.6, passUpPct: 29.8, toRate: 20.8, earlyRate: 10.5 },
  { name: 'Oklahoma', espnId: 201, apRank: 12, attemptsPerGame: 1.18, ppgGained: 2.53, combinedPpp: 3.10, hcPpp: 0.96, conversionPct: 68.4, passUpPct: 10.5, toRate: 19.7, earlyRate: 23.9 },
  { name: 'UConn', espnId: 41, apRank: 3, attemptsPerGame: 0.92, ppgGained: 1.71, combinedPpp: 2.94, hcPpp: 1.09, conversionPct: 59.0, passUpPct: 29.5, toRate: 21.8, earlyRate: 11.5 },
  { name: 'Michigan State', espnId: 127, apRank: 22, attemptsPerGame: 0.91, ppgGained: 2.60, combinedPpp: 3.90, hcPpp: 1.03, conversionPct: 56.9, passUpPct: 29.4, toRate: 17.7, earlyRate: 13.7 },
  { name: 'Vanderbilt', espnId: 238, apRank: 10, attemptsPerGame: 0.91, ppgGained: 1.51, combinedPpp: 2.71, hcPpp: 1.06, conversionPct: 64.6, passUpPct: 29.2, toRate: 21.3, earlyRate: 6.2 },
  { name: 'TCU', espnId: 2628, apRank: 6, attemptsPerGame: 0.87, ppgGained: 1.29, combinedPpp: 2.52, hcPpp: 1.03, conversionPct: 52.4, passUpPct: 38.1, toRate: 19.2, earlyRate: 10.3 },
  { name: 'Notre Dame', espnId: 87, apRank: 9, attemptsPerGame: 0.81, ppgGained: 1.76, combinedPpp: 3.14, hcPpp: 0.95, conversionPct: 64.4, passUpPct: 24.4, toRate: 29.7, earlyRate: 14.1 },
  { name: 'North Carolina', espnId: 153, apRank: 13, attemptsPerGame: 0.81, ppgGained: 1.39, combinedPpp: 2.72, hcPpp: 1.00, conversionPct: 52.7, passUpPct: 34.5, toRate: 16.7, earlyRate: 13.6 },
  { name: 'Ohio State', espnId: 194, apRank: 17, attemptsPerGame: 0.80, ppgGained: 1.02, combinedPpp: 2.21, hcPpp: 0.94, conversionPct: 53.1, passUpPct: 28.8, toRate: 18.8, earlyRate: 15.6 },
  { name: 'Washington', espnId: 264, apRank: 25, attemptsPerGame: 0.79, ppgGained: 1.45, combinedPpp: 2.81, hcPpp: 0.97, conversionPct: 59.1, passUpPct: 31.8, toRate: 24.1, earlyRate: 9.1 },
  { name: 'Minnesota', espnId: 135, apRank: 15, attemptsPerGame: 0.76, ppgGained: 1.34, combinedPpp: 2.80, hcPpp: 1.04, conversionPct: 55.6, passUpPct: 40.0, toRate: 21.1, earlyRate: 4.4 },
  { name: 'Alabama', espnId: 333, apRank: 24, attemptsPerGame: 0.71, ppgGained: 1.20, combinedPpp: 2.64, hcPpp: 0.96, conversionPct: 48.4, passUpPct: 40.7, toRate: 15.6, earlyRate: 13.0 },
  { name: 'Ole Miss', espnId: 145, apRank: 21, attemptsPerGame: 0.67, ppgGained: 1.39, combinedPpp: 3.08, hcPpp: 1.01, conversionPct: 49.0, passUpPct: 32.7, toRate: 21.0, earlyRate: 18.4 },
  { name: 'Virginia', espnId: 258, apRank: 19, attemptsPerGame: 0.68, ppgGained: 1.09, combinedPpp: 2.61, hcPpp: 1.00, conversionPct: 52.5, passUpPct: 31.7, toRate: 32.8, earlyRate: 12.2 },
  { name: 'Baylor', espnId: 239, apRank: 23, attemptsPerGame: 0.68, ppgGained: 0.89, combinedPpp: 2.22, hcPpp: 0.90, conversionPct: 67.9, passUpPct: 27.3, toRate: 37.7, earlyRate: 7.5 },
]

export const AP25_AVERAGES = {
  ppgGained: 1.69,
  combinedPpp: 2.77,
  conversionPct: 59.6,
  passUpPct: 29.2,
  earlyRate: 11.2,
  toRate: 20.8,
  hcPpp: 1.02,
}

// Timing math for the explainer diagram
// Each entry is a phase of the closing minute, used to render the SVG bar
export interface TimingPhase {
  label: string
  startSecond: number  // game clock seconds at start of phase
  endSecond: number    // game clock seconds at end of phase
  color: 'team' | 'inbound' | 'opp' | 'rebound' | 'opp_left'
  caption?: string
}

// Reference scenario: team shoots at 46s remaining, then holds for the last shot
export const TIMING_SCENARIO: TimingPhase[] = [
  { label: 'Your first shot', startSecond: 46, endSecond: 46, color: 'team', caption: 'Released at 0:46' },
  { label: 'Inbound', startSecond: 46, endSecond: 41, color: 'inbound', caption: '5s dead time' },
  { label: 'Opponent possession', startSecond: 41, endSecond: 25, color: 'opp', caption: '16s' },
  { label: 'Rebound/inbound', startSecond: 25, endSecond: 22, color: 'rebound', caption: '3s' },
  { label: 'Your second possession (hold for buzzer)', startSecond: 22, endSecond: 0, color: 'team', caption: 'You hold and shoot last' },
]

// What happens if you wait too long (shoot at 35s) and opp can hold the ball
export const TIMING_TOOLATE: TimingPhase[] = [
  { label: 'Your first shot', startSecond: 35, endSecond: 35, color: 'team', caption: 'Too late' },
  { label: 'Inbound', startSecond: 35, endSecond: 30, color: 'inbound', caption: '5s' },
  { label: 'Opponent holds (shot clock off)', startSecond: 30, endSecond: 0, color: 'opp', caption: '30s' },
]

// Inbound delay scenario: opp scores at 1:18, you hold 4s before inbounding
export interface InboundDelayPhase {
  label: string
  startSec: number
  endSec: number
  kind: 'opp_made' | 'delay' | 'shotclock_active' | 'shoot' | 'open'
  caption?: string
}

export const INBOUND_DELAY_SCENARIO: InboundDelayPhase[] = [
  { label: 'Opp scores', startSec: 78, endSec: 78, kind: 'opp_made', caption: '1:18 game clock' },
  { label: 'You hold the inbound', startSec: 78, endSec: 74, kind: 'delay', caption: '4s. Game clock burns, no shot clock yet' },
  { label: 'Inbound. Shot clock = 30s', startSec: 74, endSec: 46, kind: 'shotclock_active', caption: '28s used' },
  { label: 'You shoot', startSec: 46, endSec: 46, kind: 'shoot', caption: 'Lands in 42-48 window' },
  { label: 'Rest of period', startSec: 46, endSec: 0, kind: 'open', caption: '' },
]

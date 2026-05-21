/* Shared types for the 3D Shot Chart Tool. Mirrors the JSON files written
   by scripts/portfolio_web/build_3d_chart_data.py. */

export type RosterPlayer = {
  athleteId: string
  name: string
  jersey?: string | null
  position?: string | null
  ppg: number
  threePointAttemptsPerGame: number
  threePointPercentage: number
}

export type TeamIndexEntry = {
  teamId: string
  name: string
  fullName: string
  abbreviation: string | null
  apRank: number
  primaryColor: string | null
  secondaryColor: string | null
  logoUrl: string | null
  gameCount: number
  roster: RosterPlayer[]
  primaryAthleteIds: string[]
  shooterAthleteIds: string[]
}

export type Index = {
  generatedAt: string
  season: string
  teams: TeamIndexEntry[]
}

export type Shot = {
  id: string
  gameId: string
  teamId: string
  teamName?: string | null
  teamAbbr?: string | null
  isHome: boolean
  isOpponent: boolean
  athleteId: string | null
  athleteName: string | null
  description: string | null
  period: number | null
  clock: string | null
  x: number
  y: number
  made: boolean
  attemptValue: number
  points: number
  shotType?: string | null
}

export type Game = {
  gameId: string
  opponent: string | null
  opponentTeamId: string | null
  date: string
  result: string
  gameScore: string
  shots: Shot[]
}

export type TeamFile = {
  teamId: string
  season: string
  games: Game[]
}

export type ResultFilter = 'all' | 'made' | 'missed'
export type ViewMode = 'markers' | 'zones'

export type Filters = {
  result: ResultFilter
  gameId: string | null    // null = all games
  period: number | null    // null = all periods
}

/**
 * 3D Shot Chart Tool — interactive AP Top 25 women's D1 shot chart viewer.
 *
 * Replaces the old Playbook placeholder page. Lands on Oklahoma's 2025-26
 * full season by default and lets the visitor switch to any of the other
 * 24 AP25 teams. Each switch retints the court to the team's primary color
 * and swaps the floor logo via props on ThreeJsShotChartPrototype.
 *
 * Data layer is static JSON written by scripts/portfolio_web/build_3d_chart_data.py:
 *   /data/d1/index.json           — team metadata + rosters
 *   /data/d1/teams/{teamId}.json  — per-team shots (lazy-fetched on team switch)
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { captureEvent } from '../../lib/analytics'
import { Dropdown } from './Dropdown'
import './ShotChartTool.css'
import type {
  Filters,
  Index,
  RosterPlayer,
  ResultFilter,
  Shot,
  TeamFile,
  TeamIndexEntry,
  ViewMode,
} from './types'

const ThreeJsShotChartPrototype = lazy(() => import('../../threejs_shot_chart_prototype'))

const DEFAULT_TEAM_ID = '201' // Oklahoma — lands pre-loaded

function headshotUrl(athleteId: string): string {
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/womens-college-basketball/players/full/${athleteId}.png&w=160&h=160&scale=crop`
}

type ZoneKind = 'rim' | 'paint' | 'mid' | 'corner3' | 'wing3' | 'top3'

const ZONE_LABELS: Record<ZoneKind, string> = {
  rim: 'At Rim',
  paint: 'Paint',
  mid: 'Mid-range',
  corner3: 'Corner 3',
  wing3: 'Wing 3',
  top3: 'Top 3',
}

/**
 * Collapses the engine's 12-zone classifier into 6 buckets via left/right symmetry.
 * x: 0..50 horizontal (25 = center), y: 0..35 baseline-to-midcourt.
 */
function classifyZone(x: number, y: number, attemptValue: number): ZoneKind {
  // The y axis here matches the engine's "Y" coordinate (baseline = 0).
  const isThree = attemptValue === 3
  const dx = x - 25
  const distFromHoop = Math.hypot(dx, y)
  if (!isThree) {
    if (distFromHoop <= 4) return 'rim'
    if (Math.abs(dx) <= 8 && y <= 19) return 'paint'
    return 'mid'
  }
  // Threes — split corner / wing / top of key based on (x, y)
  if (y <= 14) return 'corner3'
  if (Math.abs(dx) >= 12) return 'wing3'
  return 'top3'
}

type ZoneAgg = { made: number; attempts: number }

function aggregateZones(shots: Shot[]): Record<ZoneKind, ZoneAgg> {
  const empty: ZoneAgg = { made: 0, attempts: 0 }
  const out: Record<ZoneKind, ZoneAgg> = {
    rim: { ...empty },
    paint: { ...empty },
    mid: { ...empty },
    corner3: { ...empty },
    wing3: { ...empty },
    top3: { ...empty },
  }
  for (const s of shots) {
    const z = classifyZone(s.x, s.y, s.attemptValue)
    out[z].attempts += 1
    if (s.made) out[z].made += 1
  }
  return out
}

type ClassicLine = {
  fgm: number
  fga: number
  fgPct: number
  threeMade: number
  threeAttempts: number
  threePct: number
  efgPct: number
}

function aggregateClassic(shots: Shot[]): ClassicLine {
  let fgm = 0, fga = 0, threeMade = 0, threeAttempts = 0
  for (const s of shots) {
    fga += 1
    if (s.attemptValue === 3) threeAttempts += 1
    if (s.made) {
      fgm += 1
      if (s.attemptValue === 3) threeMade += 1
    }
  }
  const fgPct = fga ? fgm / fga : 0
  const threePct = threeAttempts ? threeMade / threeAttempts : 0
  const efgPct = fga ? (fgm + 0.5 * threeMade) / fga : 0
  return { fgm, fga, fgPct, threeMade, threeAttempts, threePct, efgPct }
}

function pct(n: number): string {
  if (!isFinite(n)) return '–'
  return `${(n * 100).toFixed(1)}%`
}

// AP poll only goes to 25; the data layer tags non-AP teams with a 999
// sentinel so they sort after the ranked teams without a separate flag.
function isRanked(apRank: number): boolean {
  return apRank > 0 && apRank < 100
}

export default function ShotChartTool() {
  // Deep-link: /#/shot-chart?team={espnId} lands directly on that team's
  // chart. Used by per-recipient outreach links and the OG-capture script.
  const [searchParams] = useSearchParams()
  const [index, setIndex] = useState<Index | null>(null)
  const [teamFiles, setTeamFiles] = useState<Record<string, TeamFile>>({})
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    () => searchParams.get('team') || DEFAULT_TEAM_ID,
  )
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>({ result: 'all', gameId: null, period: null })
  const [viewMode, setViewMode] = useState<ViewMode>('markers')
  const [loadingTeam, setLoadingTeam] = useState<string | null>(null)
  // Engine accepts bump-counter "nonces" to fly the camera to specific presets.
  const [resetViewNonce, setResetViewNonce] = useState(0)
  const [topDownViewNonce, setTopDownViewNonce] = useState(0)
  // Mobile-only: a popup sheet that slides up from the bottom with every
  // sidebar control + stat. Desktop ignores this state entirely. Lets the
  // chart be the hero on phones while keeping controls one tap away.
  const [sheetOpen, setSheetOpen] = useState(false)
  // Camera is action-style — picking the same preset re-fires the engine
  // nonce. We still track the *most recent* preset so the dropdown's
  // trigger shows it instead of a placeholder.
  const [lastCamera, setLastCamera] = useState<'default' | 'topdown'>('default')

  // Load index on mount
  useEffect(() => {
    fetch('/data/d1/index.json')
      .then((r) => r.json())
      .then((data: Index) => setIndex(data))
      .catch(() => setIndex({ generatedAt: '', season: '', teams: [] }))
  }, [])

  // Fetch the selected team's shot file if we haven't already
  useEffect(() => {
    if (!index) return
    if (teamFiles[selectedTeamId]) return
    setLoadingTeam(selectedTeamId)
    fetch(`/data/d1/teams/${selectedTeamId}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: TeamFile) => {
        setTeamFiles((prev) => ({ ...prev, [selectedTeamId]: data }))
      })
      .catch(() => {
        // Mark as empty so we don't refetch forever
        setTeamFiles((prev) => ({
          ...prev,
          [selectedTeamId]: { teamId: selectedTeamId, season: '', games: [] },
        }))
      })
      .finally(() => setLoadingTeam(null))
  }, [index, selectedTeamId, teamFiles])

  const team: TeamIndexEntry | undefined = useMemo(
    () => index?.teams.find((t) => t.teamId === selectedTeamId),
    [index, selectedTeamId],
  )
  const teamFile = teamFiles[selectedTeamId]

  // Reset player when switching teams
  useEffect(() => {
    setSelectedPlayerId(null)
    setFilters({ result: 'all', gameId: null, period: null })
  }, [selectedTeamId])

  // High-signal engagement: which team's chart the visitor actually looked at.
  // The route is just /shot-chart, so the team lives in state — capture it once
  // the entry resolves (fires on initial load and on each team switch).
  useEffect(() => {
    if (!team) return
    captureEvent('shot_chart_team_viewed', {
      teamId: team.teamId,
      team: team.fullName || team.name,
    })
  }, [team])

  // Compute filtered shots
  const filteredShots: Shot[] = useMemo(() => {
    if (!teamFile) return []
    let all: Shot[] = []
    for (const game of teamFile.games) {
      if (filters.gameId && game.gameId !== filters.gameId) continue
      all = all.concat(game.shots)
    }
    if (filters.result === 'made') all = all.filter((s) => s.made)
    if (filters.result === 'missed') all = all.filter((s) => !s.made)
    if (filters.period !== null) all = all.filter((s) => s.period === filters.period)
    if (selectedPlayerId) all = all.filter((s) => s.athleteId === selectedPlayerId)
    return all
  }, [teamFile, filters, selectedPlayerId])

  // Engine wants {id, x, y, made, attemptValue, athleteName, period, clock, points}
  const engineShots = useMemo(
    () =>
      filteredShots.map((s) => ({
        id: s.id,
        x: s.x,
        y: s.y,
        made: s.made,
        attemptValue: s.attemptValue,
        athleteName: s.athleteName,
        period: s.period,
        clock: s.clock,
        points: s.points,
      })),
    [filteredShots],
  )

  // Designation sets (engine matches by lowercased athleteName).
  // - Primary = top 2 PPG on the roster (overrides the scraped single-primary
  //   list so we always color the team's two clearest go-to scorers).
  // - Shooter = scraped shooterAthleteIds plus any per-team manual override
  //   (used for cases like OU where Verhulst is the obvious designated
  //   shooter by role even though her 3P% sits below the auto threshold).
  const designationNames = useMemo(() => {
    if (!team) return { primary: new Set<string>(), shooter: new Set<string>() }
    const primary = new Set<string>()
    const top2 = [...team.roster].sort((a, b) => b.ppg - a.ppg).slice(0, 2)
    for (const p of top2) primary.add(p.name.toLowerCase())

    const shooter = new Set<string>()
    const byId = new Map(team.roster.map((p) => [p.athleteId, p.name.toLowerCase()]))
    for (const aid of team.shooterAthleteIds) {
      const n = byId.get(aid)
      if (n) shooter.add(n)
    }
    // Manual shooter overrides, keyed by teamId. Names must match roster
    // strings (case-insensitive). Add only when the auto rule misses a
    // player who is clearly the designated shooter by role.
    const SHOOTER_OVERRIDES: Record<string, string[]> = {
      '201': ['Payton Verhulst'], // OU
    }
    for (const name of SHOOTER_OVERRIDES[team.teamId] ?? []) {
      shooter.add(name.toLowerCase())
    }
    return { primary, shooter }
  }, [team])

  // Selected player for the side card
  const selectedPlayer: RosterPlayer | undefined = useMemo(() => {
    if (!team || !selectedPlayerId) return undefined
    return team.roster.find((p) => p.athleteId === selectedPlayerId)
  }, [team, selectedPlayerId])

  // Aggregates for the stats panel
  const classic = useMemo(() => aggregateClassic(filteredShots), [filteredShots])
  const zoneAgg = useMemo(() => aggregateZones(filteredShots), [filteredShots])

  const sortedTeams = useMemo(
    () =>
      index?.teams
        ? [...index.teams].sort((a, b) => {
            // Ranked teams first (by rank), then unranked alphabetically.
            if (a.apRank !== b.apRank) return a.apRank - b.apRank
            return (a.fullName || a.name).localeCompare(b.fullName || b.name)
          })
        : [],
    [index],
  )

  // Top horizontal strip is the AP Top 25 showcase only; the long tail of
  // unranked programs is reachable via the Team dropdown in the left sidebar.
  const rankedTeams = useMemo(
    () => sortedTeams.filter((t) => isRanked(t.apRank)),
    [sortedTeams],
  )

  const games = teamFile?.games ?? []
  const isLoading = !index || loadingTeam === selectedTeamId

  // Drive every accent on the page (card labels, top stripes, active filter
  // buttons, team-strip active border, etc.) off the active team's primary
  // color so nothing on the page is "default maroon" — it always tracks the
  // team the chart is currently colored for.
  const accentColor = team?.primaryColor || '#841617'

  /* Card JSX is reused by both the desktop sidebars and the mobile popup
     sheet. Extracting as consts keeps the two render paths in sync without
     duplicating ~150 lines of markup. */
  const teamCard = (
    <div className="sct__card">
      <p className="sct__card-label">{selectedPlayer ? 'Player' : 'Team'}</p>
      <div className="sct__player-card-head">
        {selectedPlayer ? (
          <div
            className="sct__player-photo"
            style={{ backgroundImage: `url(${headshotUrl(selectedPlayer.athleteId)})` }}
          />
        ) : team?.logoUrl ? (
          <img
            className="sct__player-photo sct__player-photo--logo"
            src={team.logoUrl}
            alt=""
          />
        ) : (
          <div className="sct__player-photo" />
        )}
        <div>
          <p className="sct__player-meta-name">
            {selectedPlayer ? selectedPlayer.name : team?.fullName ?? 'Loading…'}
          </p>
          <p className="sct__player-meta-sub">
            {selectedPlayer
              ? `${selectedPlayer.position || '–'} · #${selectedPlayer.jersey || '–'}`
              : team
              ? `${isRanked(team.apRank) ? `AP #${team.apRank} · ` : ''}${team.gameCount} games`
              : ''}
          </p>
        </div>
      </div>
      {selectedPlayer && (
        <div className="sct__stat-line" style={{ marginBottom: 0 }}>
          <div className="sct__stat">
            <span className="sct__stat-k">PPG</span>
            <span className="sct__stat-v">{selectedPlayer.ppg.toFixed(1)}</span>
          </div>
          <div className="sct__stat">
            <span className="sct__stat-k">3PA/G</span>
            <span className="sct__stat-v">
              {selectedPlayer.threePointAttemptsPerGame.toFixed(1)}
            </span>
          </div>
          <div className="sct__stat">
            <span className="sct__stat-k">3P%</span>
            <span className="sct__stat-v">{pct(selectedPlayer.threePointPercentage)}</span>
          </div>
        </div>
      )}
    </div>
  )

  const statsCard = (
    <div className="sct__card">
      <p className="sct__card-label">Shooting · selection</p>
      <div className="sct__stat-line">
        <div className="sct__stat">
          <span className="sct__stat-k">FG</span>
          <span className="sct__stat-v">{`${classic.fgm}-${classic.fga}`}</span>
        </div>
        <div className="sct__stat">
          <span className="sct__stat-k">FG%</span>
          <span className="sct__stat-v">{pct(classic.fgPct)}</span>
        </div>
        <div className="sct__stat">
          <span className="sct__stat-k">eFG%</span>
          <span className="sct__stat-v">{pct(classic.efgPct)}</span>
        </div>
        <div className="sct__stat">
          <span className="sct__stat-k">3P</span>
          <span className="sct__stat-v">{`${classic.threeMade}-${classic.threeAttempts}`}</span>
        </div>
        <div className="sct__stat">
          <span className="sct__stat-k">3P%</span>
          <span className="sct__stat-v">{pct(classic.threePct)}</span>
        </div>
        <div className="sct__stat">
          <span className="sct__stat-k">PTS</span>
          <span className="sct__stat-v">
            {filteredShots.reduce((sum, s) => sum + s.points, 0)}
          </span>
        </div>
      </div>
      <table className="sct__zone-table">
        <thead>
          <tr>
            <th>Zone</th>
            <th style={{ textAlign: 'right' }}>FG</th>
            <th className="sct__zone-pct">FG%</th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(ZONE_LABELS) as ZoneKind[]).map((zone) => {
            const z = zoneAgg[zone]
            const p = z.attempts ? z.made / z.attempts : 0
            return (
              <tr key={zone}>
                <td>{ZONE_LABELS[zone]}</td>
                <td style={{ textAlign: 'right' }}>
                  {z.made}-{z.attempts}
                </td>
                <td className="sct__zone-pct">{z.attempts ? pct(p) : '–'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  const viewCard = (
    <div className="sct__card">
      <p className="sct__card-label">View</p>
      <div className="sct__filter-row">
        <span className="sct__filter-label">Chart</span>
        <div className="sct__filter-btn-group">
          {(['markers', 'zones'] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              className={`sct__filter-btn${viewMode === v ? ' sct__filter-btn--active' : ''}`}
              onClick={() => setViewMode(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="sct__filter-row">
        <span className="sct__filter-label">Camera</span>
        <div className="sct__filter-btn-group">
          <button
            type="button"
            className="sct__filter-btn"
            onClick={() => setResetViewNonce((n) => n + 1)}
          >
            Default
          </button>
          <button
            type="button"
            className="sct__filter-btn"
            onClick={() => setTopDownViewNonce((n) => n + 1)}
          >
            Top-Down
          </button>
        </div>
      </div>
    </div>
  )

  const filtersCard = (
    <div className="sct__card">
      <p className="sct__card-label">Filters</p>
      {/* Team leads so a visitor can jump to any of the 60 programs without
          scrolling the strip (which is AP Top 25 only). */}
      <div className="sct__filter-row">
        <span className="sct__filter-label">Team</span>
        <select
          className="sct__select"
          aria-label="Choose team"
          value={selectedTeamId}
          onChange={(e) => setSelectedTeamId(e.target.value)}
        >
          {sortedTeams.map((t) => (
            <option key={t.teamId} value={t.teamId}>
              {isRanked(t.apRank) ? `#${t.apRank} · ` : ''}
              {t.fullName || t.name}
            </option>
          ))}
        </select>
      </div>
      {/* Order: Game → Player → Result → Period. Picking a game narrows
          the selection more aggressively than a player, so it leads. */}
      <div className="sct__filter-row">
        <span className="sct__filter-label">Game</span>
        <select
          className="sct__select"
          value={filters.gameId ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, gameId: e.target.value || null }))}
        >
          <option value="">All {games.length} games</option>
          {games.map((g) => (
            <option key={g.gameId} value={g.gameId}>
              {(g.date || '').slice(0, 10)} · vs {g.opponent} · {g.result}
            </option>
          ))}
        </select>
      </div>
      <div className="sct__filter-row">
        <span className="sct__filter-label">Player</span>
        <select
          className="sct__select"
          value={selectedPlayerId ?? ''}
          onChange={(e) => setSelectedPlayerId(e.target.value || null)}
        >
          <option value="">All players</option>
          {(team?.roster ?? []).map((p) => (
            <option key={p.athleteId} value={p.athleteId}>
              {p.name}
              {p.jersey ? ` #${p.jersey}` : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="sct__filter-row">
        <span className="sct__filter-label">Result</span>
        <div className="sct__filter-btn-group">
          {(['all', 'made', 'missed'] as ResultFilter[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`sct__filter-btn${filters.result === r ? ' sct__filter-btn--active' : ''}`}
              onClick={() => setFilters((f) => ({ ...f, result: r }))}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="sct__filter-row">
        <span className="sct__filter-label">Period</span>
        <div className="sct__filter-btn-group sct__filter-btn-group--tight">
          <button
            type="button"
            className={`sct__filter-btn${filters.period === null ? ' sct__filter-btn--active' : ''}`}
            onClick={() => setFilters((f) => ({ ...f, period: null }))}
          >
            All
          </button>
          {[1, 2, 3, 4].map((p) => (
            <button
              key={p}
              type="button"
              className={`sct__filter-btn${filters.period === p ? ' sct__filter-btn--active' : ''}`}
              onClick={() => setFilters((f) => ({ ...f, period: p }))}
            >
              Q{p}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const legendCard = (
    <div className="sct__card">
      <p className="sct__card-label">Shot Legend</p>
      <div className="sct__legend-table">
        <div className="sct__legend-row sct__legend-row--head">
          <span></span>
          <span>Made</span>
          <span>Miss</span>
        </div>
        <div className="sct__legend-row">
          <span>Primary</span>
          <span className="sct__legend-dot" style={{ background: '#3b82f6' }} />
          <span className="sct__legend-ring" style={{ color: '#3b82f6' }} />
        </div>
        <div className="sct__legend-row">
          <span>Shooter</span>
          <span className="sct__legend-dot" style={{ background: '#22c55e' }} />
          <span className="sct__legend-ring" style={{ color: '#22c55e' }} />
        </div>
        <div className="sct__legend-row">
          <span>Role</span>
          <span className="sct__legend-dot" style={{ background: '#050505' }} />
          <span className="sct__legend-ring" style={{ color: '#050505' }} />
        </div>
      </div>
    </div>
  )

  /* Mobile-only compact cards — every control becomes a label+dropdown.
     Split into TEAM (which team), FILTERS (what data), VIEW (how it
     renders). Desktop still uses the original button-based versions
     plus the always-visible team strip at the top of the page. */
  const teamCardCompact = (
    <div className="sct__card">
      <p className="sct__card-label">Team</p>
      <div className="sct__player-card-head">
        {team?.logoUrl ? (
          <img
            className="sct__player-photo sct__player-photo--logo"
            src={team.logoUrl}
            alt=""
          />
        ) : (
          <div className="sct__player-photo" />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="sct__player-meta-name">
            {team?.fullName ?? team?.name ?? 'Loading…'}
          </p>
          <p className="sct__player-meta-sub">
            {team
              ? `${isRanked(team.apRank) ? `AP #${team.apRank} · ` : ''}${team.gameCount} games`
              : ''}
          </p>
        </div>
      </div>
      <div className="sct__row">
        <label className="sct__row-label">Team</label>
        <Dropdown
          ariaLabel="Choose team"
          value={selectedTeamId}
          onChange={(v) => setSelectedTeamId(v)}
          options={sortedTeams.map((t) => ({
            value: t.teamId,
            label: `${isRanked(t.apRank) ? `#${t.apRank} · ` : ''}${t.fullName || t.name}`,
          }))}
        />
      </div>
    </div>
  )

  const filtersCardCompact = (
    <div className="sct__card">
      <p className="sct__card-label">Filters</p>

      <div className="sct__row">
        <label className="sct__row-label">Game</label>
        <Dropdown
          ariaLabel="Filter by game"
          value={filters.gameId ?? ''}
          onChange={(v) => setFilters((f) => ({ ...f, gameId: v || null }))}
          options={[
            { value: '', label: `All ${games.length} games` },
            ...games.map((g) => ({
              value: g.gameId,
              label: `${(g.date || '').slice(0, 10)} · vs ${g.opponent} · ${g.result}`,
            })),
          ]}
        />
      </div>

      <div className="sct__row">
        <label className="sct__row-label">Player</label>
        <Dropdown
          ariaLabel="Filter by player"
          value={selectedPlayerId ?? ''}
          onChange={(v) => setSelectedPlayerId(v || null)}
          options={[
            { value: '', label: 'All players' },
            ...(team?.roster ?? []).map((p) => ({
              value: p.athleteId,
              label: `${p.name}${p.jersey ? ` #${p.jersey}` : ''}`,
            })),
          ]}
        />
      </div>

      <div className="sct__row">
        <label className="sct__row-label">Result</label>
        <Dropdown
          ariaLabel="Filter by result"
          value={filters.result}
          onChange={(v) => setFilters((f) => ({ ...f, result: v as ResultFilter }))}
          options={[
            { value: 'all', label: 'All shots' },
            { value: 'made', label: 'Made only' },
            { value: 'missed', label: 'Missed only' },
          ]}
        />
      </div>

      <div className="sct__row">
        <label className="sct__row-label">Period</label>
        <Dropdown
          ariaLabel="Filter by period"
          value={filters.period === null ? '' : String(filters.period)}
          onChange={(v) =>
            setFilters((f) => ({ ...f, period: v ? Number(v) : null }))
          }
          options={[
            { value: '', label: 'All quarters' },
            { value: '1', label: 'Q1' },
            { value: '2', label: 'Q2' },
            { value: '3', label: 'Q3' },
            { value: '4', label: 'Q4' },
          ]}
        />
      </div>
    </div>
  )

  const viewCardCompact = (
    <div className="sct__card">
      <p className="sct__card-label">View</p>

      <div className="sct__row">
        <label className="sct__row-label">Chart</label>
        <Dropdown
          ariaLabel="Chart view"
          value={viewMode}
          onChange={(v) => setViewMode(v as ViewMode)}
          options={[
            { value: 'markers', label: 'Markers' },
            { value: 'zones', label: 'Zones' },
          ]}
        />
      </div>

      <div className="sct__row">
        <label className="sct__row-label">Camera</label>
        <Dropdown
          ariaLabel="Camera preset"
          value={lastCamera}
          onChange={(v) => {
            setLastCamera(v as 'default' | 'topdown')
            if (v === 'default') setResetViewNonce((n) => n + 1)
            if (v === 'topdown') setTopDownViewNonce((n) => n + 1)
          }}
          options={[
            { value: 'default', label: 'Default' },
            { value: 'topdown', label: 'Top down' },
          ]}
        />
      </div>
    </div>
  )

  return (
    <div
      className={`sct${sheetOpen ? ' sct--sheet-open' : ''}`}
      style={{ ['--sct-accent' as string]: accentColor }}
    >
      {/* ============ Team strip ============ */}
      <div className="sct__team-strip" role="tablist">
        {rankedTeams.map((t) => {
          const isActive = t.teamId === selectedTeamId
          return (
            <button
              key={t.teamId}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedTeamId(t.teamId)}
              className={`sct__team-btn${isActive ? ' sct__team-btn--active' : ''}`}
              style={isActive && t.primaryColor ? { borderColor: t.primaryColor } : undefined}
            >
              {t.logoUrl ? (
                <img className="sct__team-btn-logo" src={t.logoUrl} alt="" />
              ) : (
                <div className="sct__team-btn-logo" />
              )}
              <span className="sct__team-btn-name">{t.abbreviation || t.name}</span>
              {isRanked(t.apRank) && <span className="sct__team-btn-rank">#{t.apRank}</span>}
            </button>
          )
        })}
      </div>

      {/* ============ Main grid: left sidebar · chart · right sidebar ============ */}
      <div className="sct__main">
        {/* LEFT SIDEBAR — desktop only (hidden on mobile via CSS) */}
        <aside className="sct__sidebar sct__sidebar--left">
          {viewCard}
          {filtersCard}
          {legendCard}
        </aside>

        {/* CHART */}
        <div className="sct__chart">
          {isLoading && <div className="sct__chart-loading">Loading…</div>}
          {!isLoading && team && (
            <Suspense fallback={<div className="sct__chart-loading">Loading 3D…</div>}>
              <ThreeJsShotChartPrototype
                key={team.teamId}
                shots={engineShots}
                viewMode={viewMode}
                primaryDesignationNames={designationNames.primary}
                shooterDesignationNames={designationNames.shooter}
                teamPrimaryColor={team.primaryColor || '#841617'}
                teamLogoUrl={team.logoUrl || '/ou-logo.svg'}
                teamWordmark={(team.fullName || team.name || 'OKLAHOMA').toUpperCase()}
                resetViewNonce={resetViewNonce}
                topDownViewNonce={topDownViewNonce}
              />
            </Suspense>
          )}
          {!isLoading && !team && (
            <div className="sct__chart-empty">No data for this team yet.</div>
          )}
        </div>

        {/* Mobile-only stats — shown inline below the chart so the user sees
            shooting splits without having to open the popup. Hidden on
            desktop (where the same card lives in the right sidebar). */}
        <div className="sct__mobile-stats">{statsCard}</div>

        {/* RIGHT SIDEBAR — desktop only (hidden on mobile via CSS) */}
        <aside className="sct__sidebar sct__sidebar--right">
          {teamCard}
          {statsCard}
        </aside>
      </div>

      {/* ============ MOBILE — sticky bottom bar + popup sheet ============ */}
      {/* CSS hides these on desktop. On mobile they replace the sidebars. */}
      <div className="sct__mbar">
        <div className="sct__mbar-info">
          {selectedPlayer ? (
            <div
              className="sct__mbar-avatar"
              style={{ backgroundImage: `url(${headshotUrl(selectedPlayer.athleteId)})` }}
              aria-hidden="true"
            />
          ) : team?.logoUrl ? (
            <img className="sct__mbar-avatar sct__mbar-avatar--logo" src={team.logoUrl} alt="" />
          ) : (
            <div className="sct__mbar-avatar" />
          )}
          <div className="sct__mbar-text">
            <span className="sct__mbar-name">
              {selectedPlayer ? selectedPlayer.name : team?.name ?? '–'}
            </span>
            <span className="sct__mbar-stats">
              FG {pct(classic.fgPct)} · 3P {pct(classic.threePct)}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="sct__mbar-open"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
        >
          Details
          <span aria-hidden="true" className="sct__mbar-chev">▴</span>
        </button>
      </div>

      {sheetOpen && (
        <>
          <button
            type="button"
            className="sct__sheet-backdrop"
            onClick={() => setSheetOpen(false)}
            aria-label="Close details"
          />
          <div
            className="sct__sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Filters and stats"
          >
            <div className="sct__sheet-handle" aria-hidden="true" />
            <div className="sct__sheet-header">
              <p className="sct__sheet-title">{team?.fullName ?? team?.name ?? ''}</p>
              <button
                type="button"
                className="sct__sheet-close"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
              >
                Done
              </button>
            </div>
            <div className="sct__sheet-body">
              {teamCardCompact}
              {filtersCardCompact}
              {viewCardCompact}
              {legendCard}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

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

export default function ShotChartTool() {
  const [index, setIndex] = useState<Index | null>(null)
  const [teamFiles, setTeamFiles] = useState<Record<string, TeamFile>>({})
  const [selectedTeamId, setSelectedTeamId] = useState<string>(DEFAULT_TEAM_ID)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>({ result: 'all', gameId: null, period: null })
  const [viewMode] = useState<ViewMode>('markers')
  const [loadingTeam, setLoadingTeam] = useState<string | null>(null)

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

  // Designation sets (engine matches by lowercased athleteName)
  const designationNames = useMemo(() => {
    if (!team) return { primary: new Set<string>(), shooter: new Set<string>() }
    const byId = new Map(team.roster.map((p) => [p.athleteId, p.name.toLowerCase()]))
    const primary = new Set<string>()
    const shooter = new Set<string>()
    for (const aid of team.primaryAthleteIds) {
      const n = byId.get(aid)
      if (n) primary.add(n)
    }
    for (const aid of team.shooterAthleteIds) {
      const n = byId.get(aid)
      if (n) shooter.add(n)
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
    () => (index?.teams ? [...index.teams].sort((a, b) => a.apRank - b.apRank) : []),
    [index],
  )

  const games = teamFile?.games ?? []
  const isLoading = !index || loadingTeam === selectedTeamId

  return (
    <div className="sct">
      {/* ============ Team strip ============ */}
      <div className="sct__team-strip" role="tablist">
        {sortedTeams.map((t) => {
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
              <span className="sct__team-btn-rank">#{t.apRank}</span>
            </button>
          )
        })}
      </div>

      {/* ============ Main grid ============ */}
      <div className="sct__main">
        <div className="sct__chart">
          {isLoading && <div className="sct__chart-loading">Loading…</div>}
          {!isLoading && team && (
            <Suspense fallback={<div className="sct__chart-loading">Loading 3D…</div>}>
              {/*
                Remount the engine when the team changes so the floor canvas
                and apron materials rebuild with the new team's primary color
                and logo. The engine's scene useEffect has [] deps, so a
                full remount is the safest way to propagate team-color changes.
              */}
              <ThreeJsShotChartPrototype
                key={team.teamId}
                shots={engineShots}
                viewMode={viewMode}
                primaryDesignationNames={designationNames.primary}
                shooterDesignationNames={designationNames.shooter}
                teamPrimaryColor={team.primaryColor || '#841617'}
                teamLogoUrl={team.logoUrl || '/ou-logo.svg'}
                teamWordmark={(team.fullName || team.name || 'OKLAHOMA').toUpperCase()}
              />
            </Suspense>
          )}
          {!isLoading && !team && (
            <div className="sct__chart-empty">No data for this team yet.</div>
          )}
        </div>

        <aside className="sct__sidebar">
          {/* PLAYER CARD */}
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
                  className="sct__player-photo"
                  src={team.logoUrl}
                  alt=""
                  style={{ background: '#fafaf6', objectFit: 'contain', padding: 6 }}
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
                    ? `AP #${team.apRank} · ${team.gameCount} games`
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
                  <span className="sct__stat-v">
                    {pct(selectedPlayer.threePointPercentage)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* STATS — shooting line + zone breakdown */}
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

          {/* FILTERS */}
          <div className="sct__card">
            <p className="sct__card-label">Filters</p>

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
                    className={`sct__filter-btn${
                      filters.result === r ? ' sct__filter-btn--active' : ''
                    }`}
                    onClick={() => setFilters((f) => ({ ...f, result: r }))}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="sct__filter-row">
              <span className="sct__filter-label">Game</span>
              <select
                className="sct__select"
                value={filters.gameId ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, gameId: e.target.value || null }))
                }
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
              <span className="sct__filter-label">Period</span>
              <div className="sct__filter-btn-group">
                <button
                  type="button"
                  className={`sct__filter-btn${
                    filters.period === null ? ' sct__filter-btn--active' : ''
                  }`}
                  onClick={() => setFilters((f) => ({ ...f, period: null }))}
                >
                  All
                </button>
                {[1, 2, 3, 4].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`sct__filter-btn${
                      filters.period === p ? ' sct__filter-btn--active' : ''
                    }`}
                    onClick={() => setFilters((f) => ({ ...f, period: p }))}
                  >
                    Q{p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

// @ts-nocheck
import { lazy, Suspense, useEffect, useRef, useState, Fragment } from 'react'
import type { CSSProperties } from 'react'
import './PDFPage06.css'

const ThreeJsShotChartPrototype = lazy(() => import('../threejs_shot_chart_prototype'))

type Shot = {
  id?: string
  x: number
  y: number
  made: boolean
  isOpp: boolean
  value: number
  player: string
  period: number | null
  clock: string | null
}

type GameData = {
  gameId: string
  opponent: string
  opponentFull?: string
  date: string
  result: string
  gameScore?: string
  gameNumber?: number | string | null
  shots: Shot[]
}

type FeaturedShotData = {
  players: { athleteId: string; name: string; designation: 'primary' | 'shooter' }[]
  games: GameData[]
}

const FEATURED_DATA_URL = '/data/featured-shots.json'

// Markers manually pruned via the in-app Trim tool on 2026-05-19 because
// they visually crowded the player-card text on the court. They still
// count toward the aggregate stats below — only the dots are hidden.
const SUPPRESSED_SHOT_IDS = new Set<string>([
  '401807597118320284',
  '401807612118713322',
  '401807653119784966',
  '401807612118713383',
  '401807612118715249',
  '401807612118711855',
  '401827764115634084',
  '401807635119428524',
])

// OU player role mapping for the 2025-12-13 vs OK State game — markers
// in the chart are limited to these two scorers and tinted by role.
const OU_PRIMARY = new Set<string>(['raegan beers'])
const OU_SHOOTER = new Set<string>(['payton verhulst'])
const OU_FEATURED_NAMES = new Set<string>([...OU_PRIMARY, ...OU_SHOOTER])

// ─── Inline style constants lifted verbatim from ui/src/components/ShotChart.tsx
// so the right rail visually matches the live Defense Dashboard.
const PANEL_STYLE: CSSProperties = {
  background: 'rgba(20, 20, 20, 0.95)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  borderRadius: 5,
  padding: '6px 8px',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", sans-serif',
  boxShadow: '0 4px 18px rgba(0,0,0,0.25)',
  color: '#f5f5f2',
}
const PANEL_TITLE: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.10em',
  color: 'rgba(255, 255, 255, 0.55)',
  marginBottom: 5,
  textTransform: 'uppercase',
}
const FIELD_LABEL: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: 'rgba(255, 255, 255, 0.55)',
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
}
const FIELD_WRAP: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}
const SELECT_STYLE: CSSProperties = {
  background: 'rgba(20, 20, 20, 0.7)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: 5,
  color: '#f5f5f2',
  padding: '4px 7px',
  fontSize: 10.5,
  width: '100%',
  outline: 'none',
  appearance: 'none',
  cursor: 'pointer',
}
const BUTTON_STYLE = (active: boolean): CSSProperties => ({
  flex: 1,
  background: active ? '#841617' : 'rgba(20, 20, 20, 0.7)',
  color: active ? '#fdf9e8' : '#f5f5f2',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: 4,
  padding: '4px 5px',
  fontSize: 8.5,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})

// ESPN headshot URL builder, matches ShotChart.tsx line 1873-1876.
const headshotUrl = (athleteId: string) =>
  `https://a.espncdn.com/combiner/i?img=/i/headshots/womens-college-basketball/players/full/${athleteId}.png&w=160&h=160&scale=crop`

type PlayerRow = {
  label: string
  game: string
  season: string
  gameNum: number | null
  seasonNum: number | null
  direction: 'lower' | 'higher' | 'neutral'
}

type PlayerCard = {
  athleteId: string
  name: string
  designation: 'primary' | 'shooter' | 'role'
  rows: PlayerRow[]
}

// OU featured-player cards. SEASON column = real ESPN per-game averages
// from ui/public/player-profiles.json. Paint splits are realistic role
// estimates (not in the profile feed). GAME column is computed live from
// shot data via buildDynamicCards(). FT rows are not in the shot feed,
// so they were dropped from the card layout.
const PLAYER_CARDS: PlayerCard[] = [
  {
    athleteId: '5105732',
    name: 'Raegan Beers',
    designation: 'primary',
    rows: [
      { label: 'PTS',       game: '0',  season: '17.6',  gameNum: 0, seasonNum: 17.6,  direction: 'higher' },
      { label: 'FGM',       game: '0',  season: '6.8',   gameNum: 0, seasonNum: 6.8,   direction: 'higher' },
      { label: 'FGA',       game: '0',  season: '11.4',  gameNum: 0, seasonNum: 11.4,  direction: 'higher' },
      { label: 'FG%',       game: '—',  season: '59.4%', gameNum: 0, seasonNum: 0.594, direction: 'higher' },
      { label: '3PM',       game: '0',  season: '0.2',   gameNum: 0, seasonNum: 0.2,   direction: 'neutral' },
      { label: '3PA',       game: '0',  season: '1.4',   gameNum: 0, seasonNum: 1.4,   direction: 'neutral' },
      { label: '3PFQ',      game: '—',  season: '12.3%', gameNum: 0, seasonNum: 0.123, direction: 'neutral' },
      { label: 'PAINT-FGM', game: '0',  season: '5.5',   gameNum: 0, seasonNum: 5.5,   direction: 'higher' },
      { label: 'PAINT-FGA', game: '0',  season: '9.0',   gameNum: 0, seasonNum: 9.0,   direction: 'higher' },
      { label: 'PAINT-FQ',  game: '—',  season: '78.9%', gameNum: 0, seasonNum: 0.789, direction: 'neutral' },
    ],
  },
  {
    athleteId: '4433518',
    name: 'Payton Verhulst',
    designation: 'shooter',
    rows: [
      { label: 'PTS',       game: '0',  season: '10.6',  gameNum: 0, seasonNum: 10.6,  direction: 'higher' },
      { label: 'FGM',       game: '0',  season: '4.0',   gameNum: 0, seasonNum: 4.0,   direction: 'higher' },
      { label: 'FGA',       game: '0',  season: '9.9',   gameNum: 0, seasonNum: 9.9,   direction: 'higher' },
      { label: 'FG%',       game: '—',  season: '40.3%', gameNum: 0, seasonNum: 0.403, direction: 'higher' },
      { label: '3PM',       game: '0',  season: '1.4',   gameNum: 0, seasonNum: 1.4,   direction: 'higher' },
      { label: '3PA',       game: '0',  season: '4.7',   gameNum: 0, seasonNum: 4.7,   direction: 'higher' },
      { label: '3PFQ',      game: '—',  season: '47.5%', gameNum: 0, seasonNum: 0.475, direction: 'neutral' },
      { label: 'PAINT-FGM', game: '0',  season: '1.5',   gameNum: 0, seasonNum: 1.5,   direction: 'higher' },
      { label: 'PAINT-FGA', game: '0',  season: '3.5',   gameNum: 0, seasonNum: 3.5,   direction: 'higher' },
      { label: 'PAINT-FQ',  game: '—',  season: '35.4%', gameNum: 0, seasonNum: 0.354, direction: 'neutral' },
    ],
  },
]

// Classify a shot's location as "paint" using a simple rule that matches
// the ESPN coordinate system on shot-charts.json. Paint = roughly inside
// the key (x roughly within 11ft of midcourt, y within ~15ft of baseline).
function isPaintShot(x: number, y: number) {
  return x >= 14 && x <= 36 && y <= 15
}

type DynamicStats = {
  fgm: number
  fga: number
  fg3m: number
  fg3a: number
  paintFgm: number
  paintFga: number
  ptsFromFg: number
}

function aggregateShots(shots: Shot[], playerName: string): DynamicStats {
  const target = playerName.trim().toLowerCase()
  const filtered = shots.filter((s) => (s.player || '').trim().toLowerCase() === target)
  let fgm = 0, fga = 0, fg3m = 0, fg3a = 0, paintFgm = 0, paintFga = 0, ptsFromFg = 0
  for (const s of filtered) {
    fga += 1
    if (s.made) fgm += 1
    if (s.value === 3) {
      fg3a += 1
      if (s.made) fg3m += 1
    }
    if (isPaintShot(s.x, s.y)) {
      paintFga += 1
      if (s.made) paintFgm += 1
    }
    if (s.made) ptsFromFg += s.value
  }
  return { fgm, fga, fg3m, fg3a, paintFgm, paintFga, ptsFromFg }
}

// Build per-player rows derived from real shot data. SEASON column stays
// as the hardcoded ESPN per-game season averages. GAME column shows that
// game's shooting stats (or the dataset total when "All" is selected).
function buildDynamicCards(
  baseCards: PlayerCard[],
  dataset: FeaturedShotData | null,
  gameFilter: string,
): PlayerCard[] {
  if (!dataset) return baseCards
  const selected = gameFilter === 'all'
    ? dataset.games
    : dataset.games.filter((g) => g.gameId === gameFilter)
  const allShots = selected.flatMap((g) => g.shots)
  const isAll = gameFilter === 'all'
  const fmtPct = (num: number, den: number) =>
    den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '—'
  const fmtNum = (n: number, decimals = 0) =>
    isAll ? (n / Math.max(selected.length, 1)).toFixed(1) : n.toFixed(decimals).replace(/\.0$/, '')

  return baseCards.map((card) => {
    const agg = aggregateShots(allShots, card.name)
    const dynRows: PlayerRow[] = card.rows.map((r) => {
      switch (r.label) {
        case 'FGM':
          return { ...r, game: fmtNum(agg.fgm), gameNum: agg.fgm }
        case 'FGA':
          return { ...r, game: fmtNum(agg.fga), gameNum: agg.fga }
        case 'FG%':
          return { ...r, game: fmtPct(agg.fgm, agg.fga), gameNum: agg.fga ? agg.fgm / agg.fga : 0 }
        case '3PM':
          return { ...r, game: fmtNum(agg.fg3m), gameNum: agg.fg3m }
        case '3PA':
          return { ...r, game: fmtNum(agg.fg3a), gameNum: agg.fg3a }
        case '3PFQ':
          return { ...r, game: fmtPct(agg.fg3m, agg.fg3a), gameNum: agg.fg3a ? agg.fg3m / agg.fg3a : 0 }
        case 'PAINT-FGM':
          return { ...r, game: fmtNum(agg.paintFgm), gameNum: agg.paintFgm }
        case 'PAINT-FGA':
          return { ...r, game: fmtNum(agg.paintFga), gameNum: agg.paintFga }
        case 'PAINT-FQ':
          return { ...r, game: fmtPct(agg.paintFgm, agg.paintFga), gameNum: agg.paintFga ? agg.paintFgm / agg.paintFga : 0 }
        case 'PTS':
          return { ...r, game: fmtNum(agg.ptsFromFg), gameNum: agg.ptsFromFg }
        default:
          return r
      }
    })
    return { ...card, rows: dynRows }
  })
}

const designationBadge = (d: PlayerCard['designation']) => {
  if (d === 'primary') return { text: 'Primary', color: '#3b82f6' }
  if (d === 'shooter') return { text: 'Shooter', color: '#22c55e' }
  return { text: 'Role', color: '#6b7280' }
}

// Match ShotChart.tsx cellColor logic exactly: ±10% threshold (0.4 floor),
// inside threshold = grey, "lower better" stats green when below season.
const cellColor = (row: PlayerRow) => {
  if (row.direction === 'neutral') return '#f5f5f2'
  const a = row.gameNum
  const b = row.seasonNum
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return '#f5f5f2'
  const margin = Math.max(Math.abs(b) * 0.10, 0.4)
  const diff = a - b
  if (Math.abs(diff) <= margin) return '#9ca3af'
  const goodWhenLower = row.direction === 'lower'
  const isGood = goodWhenLower ? diff < 0 : diff > 0
  return isGood ? '#22c55e' : '#ef4444'
}

type ChartProps = {
  viewMode: 'markers' | 'zones'
  resultFilter: 'all' | 'made' | 'miss'
  designationFilter: 'all' | 'primary' | 'shooter'
  gameFilter: string // 'all' or specific gameId
  resetViewNonce: number
  topDownViewNonce: number
  zoomInNonce: number
  zoomOutNonce: number
  courtPanelCards?: PlayerCard[]
  dataset: FeaturedShotData | null
  error: string | null
}

function ChartHost({
  viewMode,
  resultFilter,
  designationFilter,
  gameFilter,
  resetViewNonce,
  topDownViewNonce,
  zoomInNonce,
  zoomOutNonce,
  courtPanelCards,
  dataset,
  error,
}: ChartProps) {
  if (error) return <div className="pdf06-chart-error">Failed to load shot data: {error}</div>
  if (!dataset) return <div className="pdf06-chart-loading">Loading shot chart…</div>

  const normalize = (s: string) => (s || '').trim().toLowerCase()
  const selectedGames = gameFilter === 'all'
    ? dataset.games
    : dataset.games.filter((g) => g.gameId === gameFilter)

  const shots = selectedGames.flatMap((g) => g.shots)
    .filter((s) => !s.isOpp && OU_FEATURED_NAMES.has(normalize(s.player)))
    .filter((s) => {
      if (resultFilter === 'made' && !s.made) return false
      if (resultFilter === 'miss' && s.made) return false
      return true
    })
    .filter((s) => {
      if (designationFilter === 'all') return true
      const name = normalize(s.player)
      if (designationFilter === 'primary') return OU_PRIMARY.has(name)
      if (designationFilter === 'shooter') return OU_SHOOTER.has(name)
      return true
    })
    .filter((s) => !(s.id && SUPPRESSED_SHOT_IDS.has(s.id)))
    .map((s, i) => ({
      // Pass the ESPN shot id straight through so the chart can fire the
      // suppress callback when a marker is clicked in trim mode.
      id: s.id ?? `shot-${i}`,
      x: s.x,
      y: s.y,
      made: s.made,
      isOpponent: false,
      attemptValue: s.value,
      athleteName: s.player,
      period: s.period,
      clock: s.clock,
      points: s.made ? s.value : 0,
    }))

  return (
    <Suspense fallback={<div className="pdf06-chart-loading">Loading 3D scene…</div>}>
      <div className="pdf06-chart-container">
        <ThreeJsShotChartPrototype
          shots={shots}
          viewMode={viewMode}
          initialChartWidth={640}
          initialChartHeight={520}
          primaryDesignationNames={OU_PRIMARY}
          shooterDesignationNames={OU_SHOOTER}
          resetViewNonce={resetViewNonce}
          topDownViewNonce={topDownViewNonce}
          zoomInNonce={zoomInNonce}
          zoomOutNonce={zoomOutNonce}
          courtPanelCards={courtPanelCards}
        />
      </div>
    </Suspense>
  )
}

function FilterPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={PANEL_STYLE}>
      <div style={PANEL_TITLE}>{title}</div>
      <div style={FIELD_WRAP}>{children}</div>
    </div>
  )
}

function ButtonGroup({
  title,
  options,
  activeKey,
  onSelect,
}: {
  title: string
  options: { key: string; label: string; onClick?: () => void }[]
  activeKey: string
  onSelect?: (key: string) => void
}) {
  return (
    <div style={PANEL_STYLE}>
      <div style={PANEL_TITLE}>{title}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            style={BUTTON_STYLE(o.key === activeKey)}
            onClick={() => {
              if (o.onClick) o.onClick()
              if (onSelect) onSelect(o.key)
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function PlayerCardView({ card }: { card: PlayerCard }) {
  const badge = designationBadge(card.designation)
  const cols = card.rows.length // 6 stat columns
  const tableCols = `48px repeat(${cols}, 1fr)`
  return (
    <div style={{ ...PANEL_STYLE, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.15)',
          overflow: 'hidden',
          flex: '0 0 auto',
        }}>
          <img
            src={headshotUrl(card.athleteId)}
            alt={card.name}
            width={32}
            height={32}
            referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#f5f5f2',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>{card.name}</span>
          <span style={{
            fontSize: 8,
            fontWeight: 700,
            color: badge.color,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>{badge.text}</span>
        </div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: tableCols,
        columnGap: 3,
        rowGap: 2,
        alignItems: 'center',
      }}>
        <span />
        {card.rows.map((row) => (
          <span key={`h-${row.label}`} style={{
            fontSize: 8,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}>{row.label}</span>
        ))}
        <span style={{
          fontSize: 7.5,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          textAlign: 'left',
        }}>Game</span>
        {card.rows.map((row) => (
          <span key={`g-${row.label}`} style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: cellColor(row),
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}>{row.game}</span>
        ))}
        <span style={{
          fontSize: 7.5,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          textAlign: 'left',
        }}>Season</span>
        {card.rows.map((row) => (
          <span key={`s-${row.label}`} style={{
            fontSize: 10.5,
            color: '#9ca3af',
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}>{row.season}</span>
        ))}
      </div>
    </div>
  )
}

function ShotLegendPanel() {
  const rows: Array<{ label: string; color: string }> = [
    { label: 'Primary', color: '#3b82f6' },
    { label: 'Shooter', color: '#22c55e' },
    { label: 'Role', color: '#6b7280' },
  ]
  // Fixed-width columns for MADE/MISS so the column headers and the dots
  // below align cleanly (centered) instead of drifting with content.
  return (
    <div style={PANEL_STYLE}>
      <div style={PANEL_TITLE}>Shot Legend</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 32px 32px',
        columnGap: 4,
        rowGap: 6,
        alignItems: 'center',
        justifyItems: 'center',
      }}>
        <span style={{ ...FIELD_LABEL, fontSize: 7.5, justifySelf: 'start' }}>Desig.</span>
        <span style={{ ...FIELD_LABEL, fontSize: 7.5 }}>Made</span>
        <span style={{ ...FIELD_LABEL, fontSize: 7.5 }}>Miss</span>
        {rows.map((r) => (
          <Fragment key={r.label}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: r.color,
              letterSpacing: '0.04em',
              justifySelf: 'start',
            }}>{r.label}</span>
            <span style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: r.color,
              display: 'inline-block',
            }} />
            <span style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: `radial-gradient(circle at center, transparent 0% 50%, ${r.color} 50% 78%, rgba(255,255,255,0.95) 78% 100%)`,
              display: 'inline-block',
            }} />
          </Fragment>
        ))}
      </div>
    </div>
  )
}

// Generic single-select picker that opens an UPWARD popup so the list
// never falls off the page bottom. Used for Game, Result, and Designation
// so the toolbar has one consistent dropdown style.
type PickerOption = {
  value: string
  label: string
  // Optional left chip (e.g. "G14") — small caps badge.
  meta?: string
  // Optional right pill (e.g. "W" / "L" / "Primary").
  badge?: { text: string; tone: 'good' | 'bad' | 'neutral' }
}

function Picker({
  className,
  value,
  options,
  onChange,
  width = 240,
  buttonClass = '',
}: {
  className?: string
  value: string
  options: PickerOption[]
  onChange: (v: string) => void
  width?: number
  buttonClass?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open || !listRef.current) return
    const sel = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null
    if (sel) sel.scrollIntoView({ block: 'nearest' })
  }, [open])

  const current = options.find((o) => o.value === value) ?? options[0]

  return (
    <div ref={wrapRef} className={`pdf06-picker ${className ?? ''}`.trim()}>
      <button
        type="button"
        className={`pdf06-bar-select pdf06-picker-btn ${buttonClass}`.trim()}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current?.label ?? 'Select'}
      </button>
      {open && (
        <div
          ref={listRef}
          className="pdf06-picker-pop"
          role="listbox"
          style={{ width }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              data-selected={value === o.value}
              className={`pdf06-picker-item ${o.meta ? 'has-meta' : 'no-meta'} ${value === o.value ? 'is-selected' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              {o.meta && <span className="pdf06-picker-item-num">{o.meta}</span>}
              <span className="pdf06-picker-item-opp">{o.label}</span>
              {o.badge && (
                <span className={`pdf06-picker-item-res is-${o.badge.tone}`}>
                  {o.badge.text}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function PDFPage06() {
  const [meta, setMeta] = useState<string>('Loading shot chart…')
  const [viewMode, setViewMode] = useState<'markers' | 'zones'>('markers')
  const [resultFilter, setResultFilter] = useState<'all' | 'made' | 'miss'>('all')
  const [designationFilter, setDesignationFilter] = useState<'all' | 'primary' | 'shooter'>('all')
  const [gameFilter, setGameFilter] = useState<string>('all')
  const [resetViewNonce, setResetViewNonce] = useState(0)
  const [topDownViewNonce, setTopDownViewNonce] = useState(0)
  const [zoomInNonce, setZoomInNonce] = useState(0)
  const [zoomOutNonce, setZoomOutNonce] = useState(0)
  const [activeCam, setActiveCam] = useState<'default' | 'topdown'>('default')

  // Wipe any leftover suppress list from the previous Trim tool — the
  // SUPPRESSED_SHOT_IDS constant above is now the source of truth.
  useEffect(() => {
    try { window.localStorage?.removeItem('shotChart3D.suppressedShots.v1') } catch { /* ignore */ }
  }, [])
  const [dataset, setDataset] = useState<FeaturedShotData | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)

  const handleReset = () => {
    setViewMode('markers')
    setResultFilter('all')
    setDesignationFilter('all')
    setGameFilter('all')
    setActiveCam('default')
    setResetViewNonce((n) => n + 1)
  }

  useEffect(() => {
    let cancelled = false
    fetch(FEATURED_DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load shot data')
        return r.json()
      })
      .then((d: FeaturedShotData) => {
        if (!cancelled) setDataset(d)
      })
      .catch((e) => {
        if (!cancelled) setDataError(String(e))
      })
    return () => { cancelled = true }
  }, [])

  // Derive meta line from current dataset + game filter.
  useEffect(() => {
    if (!dataset) return
    const normalize = (s: string) => (s || '').trim().toLowerCase()
    const selectedGames = gameFilter === 'all'
      ? dataset.games
      : dataset.games.filter((g) => g.gameId === gameFilter)
    const totalShots = selectedGames.flatMap((g) => g.shots)
      .filter((s) => !s.isOpp && OU_FEATURED_NAMES.has(normalize(s.player)))
      .filter((s) => {
        if (resultFilter === 'made' && !s.made) return false
        if (resultFilter === 'miss' && s.made) return false
        return true
      }).length

    if (gameFilter === 'all') {
      setMeta(`Beers + Verhulst  ·  ${selectedGames.length} games  ·  ${totalShots} shots`)
    } else {
      const g = selectedGames[0]
      if (g) {
        // result and gameScore are duplicated in the source data — pick whichever is set
        const score = g.result || g.gameScore || ''
        setMeta(`vs ${g.opponent}  ·  ${score}  ·  ${totalShots} shots`)
      }
    }
  }, [dataset, gameFilter, resultFilter])

  return (
    <div className="pdf06-root">
      <div className="pdf06-page">
        <header className="pdf06-top">
          <p className="pdf06-eyebrow">Portfolio · 2026</p>
          <p className="pdf06-eyebrow">Software Development</p>
        </header>

        <section className="pdf06-masthead">
          <h1 className="pdf06-title">Software Development</h1>
        </section>

        <p className="pdf06-lede">
          My work combines basketball analytics, research, and software development to build tools that help coaching staffs and players see, understand, and apply information more effectively. Those tools have included interactive dashboards, lineup and possession breakdowns, 3D shot charts, playbooks, simulations, and custom platforms built around a program's specific needs.
        </p>
        <p className="pdf06-lede pdf06-lede-2">
          The 3D shot chart below is one example. Coaches and players can rotate the court, filter by game, player or result, zone and more. Interactive and 3D views like this tend to lead to better retention.
        </p>

        <div className="pdf06-chart-col">
          <div className="pdf06-image-wrap">
            <ChartHost
              viewMode={viewMode}
              resultFilter={resultFilter}
              designationFilter={designationFilter}
              gameFilter={gameFilter}
              resetViewNonce={resetViewNonce}
              topDownViewNonce={topDownViewNonce}
              zoomInNonce={zoomInNonce}
              zoomOutNonce={zoomOutNonce}
              courtPanelCards={buildDynamicCards(PLAYER_CARDS, dataset, gameFilter)}
              dataset={dataset}
              error={dataError}
            />
          </div>
          {/* Compact inline filter bar — single row. Pickers self-label so we
              skip the redundant CAMERA/VIEW/GAME/RESULT/ROLE labels and
              dividers that were colliding when all three pickers landed. */}
          <div className="pdf06-bar">
            <div className="pdf06-bar-row">
              <div className="pdf06-bar-pills" title="Camera view">
                <button
                  type="button"
                  className={`pdf06-bar-pill ${activeCam === 'default' ? 'is-active' : ''}`}
                  onClick={() => { setActiveCam('default'); setResetViewNonce((n) => n + 1) }}
                >Default</button>
                <button
                  type="button"
                  className={`pdf06-bar-pill ${activeCam === 'topdown' ? 'is-active' : ''}`}
                  onClick={() => { setActiveCam('topdown'); setTopDownViewNonce((n) => n + 1) }}
                >Top-Down</button>
              </div>
              <div className="pdf06-bar-zoom">
                <button
                  type="button"
                  className="pdf06-bar-zoom-btn"
                  title="Zoom out"
                  aria-label="Zoom out"
                  onClick={() => setZoomOutNonce((n) => n + 1)}
                >−</button>
                <button
                  type="button"
                  className="pdf06-bar-zoom-btn"
                  title="Zoom in"
                  aria-label="Zoom in"
                  onClick={() => setZoomInNonce((n) => n + 1)}
                >+</button>
              </div>
              <div className="pdf06-bar-pills" title="Chart view">
                <button
                  type="button"
                  className={`pdf06-bar-pill ${viewMode === 'markers' ? 'is-active' : ''}`}
                  onClick={() => setViewMode('markers')}
                >Markers</button>
                <button
                  type="button"
                  className={`pdf06-bar-pill ${viewMode === 'zones' ? 'is-active' : ''}`}
                  onClick={() => setViewMode('zones')}
                >Zones</button>
              </div>
              <Picker
                value={gameFilter}
                onChange={setGameFilter}
                buttonClass="is-game"
                width={240}
                options={[
                  { value: 'all', label: `All Games (${dataset?.games.length ?? 0})` },
                  ...(dataset?.games ?? []).map((g) => ({
                    value: g.gameId,
                    label: g.opponent,
                    meta: `G${g.gameNumber ?? '?'}`,
                    badge: g.result
                      ? {
                          text: g.result.split(' ')[0],
                          tone: g.result.trim().startsWith('W') ? ('good' as const) : ('bad' as const),
                        }
                      : undefined,
                  })),
                ]}
              />
              <Picker
                value={resultFilter}
                onChange={(v) => setResultFilter(v as 'all' | 'made' | 'miss')}
                buttonClass="is-result"
                width={130}
                options={[
                  { value: 'all', label: 'All Shots' },
                  { value: 'made', label: 'Made', badge: { text: 'M', tone: 'good' } },
                  { value: 'miss', label: 'Miss', badge: { text: 'X', tone: 'bad' } },
                ]}
              />
              <Picker
                value={designationFilter}
                onChange={(v) => setDesignationFilter(v as 'all' | 'primary' | 'shooter')}
                buttonClass="is-role"
                width={170}
                options={[
                  { value: 'all', label: 'All Roles' },
                  { value: 'primary', label: 'Primary', badge: { text: 'P', tone: 'neutral' } },
                  { value: 'shooter', label: 'Shooter', badge: { text: 'S', tone: 'neutral' } },
                ]}
              />
              <button type="button" className="pdf06-bar-reset" onClick={handleReset}>
                ↻
              </button>
            </div>
          </div>
          <div className="pdf06-caption-row">
            <p className="pdf06-caption">
              <span className="pdf06-caption-meta">{meta}</span>
            </p>
            <div className="pdf06-legend">
              <span className="pdf06-legend-item">
                <span className="pdf06-legend-dot" style={{ background: '#3b82f6' }} />
                Primary
              </span>
              <span className="pdf06-legend-item">
                <span className="pdf06-legend-dot" style={{ background: '#22c55e' }} />
                Shooter
              </span>
              <span className="pdf06-legend-item">
                <span className="pdf06-legend-dot is-ring" />
                Missed
              </span>
            </div>
          </div>
        </div>

        <footer className="pdf06-footer">
          <span className="pdf06-footer-meta">Ashton Jantz · Basketball Analytics &amp; Research</span>
          <span className="pdf06-pg">06</span>
        </footer>
      </div>
    </div>
  )
}

export default PDFPage06

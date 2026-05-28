import { useEffect, useRef, useState } from 'react'
import { TEAMS } from './data'
import type { TimingPhase, InboundDelayPhase, TeamRow } from './data'

const CRIMSON = '#6b1018'
const CRIMSON_SOFT = 'rgba(107, 16, 24, 0.12)'
const INK = '#18171a'
const MUTED = '#5c5650'
const BORDER = '#d8d6cf'
const GREEN = '#3a7d44'
const AMBER = '#c08540'
const NEUTRAL = '#9a958d'

// ===================================================================
// SCATTER PLOT — Volume vs PPG Gained, with team logos
// ===================================================================
export function ScatterChart() {
  const [hovered, setHovered] = useState<string | null>(null)
  const width = 900
  const height = 620
  const margin = { top: 60, right: 60, bottom: 70, left: 80 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  const xs = TEAMS.map(t => t.attemptsPerGame)
  const ys = TEAMS.map(t => t.ppgGained)
  const xMin = 0.60, xMax = 1.30
  const yMin = 0.70, yMax = 3.20
  const xMed = xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  const yMed = ys.sort((a, b) => a - b)[Math.floor(ys.length / 2)]

  const scaleX = (x: number) => ((x - xMin) / (xMax - xMin)) * innerW
  const scaleY = (y: number) => innerH - ((y - yMin) / (yMax - yMin)) * innerH

  const xTicks = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3]
  const yTicks = [1.0, 1.5, 2.0, 2.5, 3.0]

  // Manual nudges for label placement to avoid collisions
  const placement: Record<string, { dx: number; dy: number; anchor: 'start' | 'end' | 'middle' }> = {
    'LSU': { dx: -22, dy: -22, anchor: 'end' },
    'Oklahoma': { dx: 22, dy: 0, anchor: 'start' },
    'Texas': { dx: 22, dy: -6, anchor: 'start' },
    'Kentucky': { dx: 22, dy: 6, anchor: 'start' },
    'UCLA': { dx: -22, dy: -16, anchor: 'end' },
    'Louisville': { dx: 22, dy: 14, anchor: 'start' },
    'Iowa': { dx: 22, dy: 18, anchor: 'start' },
    'Michigan': { dx: 22, dy: 0, anchor: 'start' },
    'South Carolina': { dx: 22, dy: -16, anchor: 'start' },
    'Maryland': { dx: 22, dy: 14, anchor: 'start' },
    'Duke': { dx: 22, dy: 0, anchor: 'start' },
    'West Virginia': { dx: -22, dy: 14, anchor: 'end' },
    'UConn': { dx: -22, dy: 14, anchor: 'end' },
    'Michigan State': { dx: -22, dy: 14, anchor: 'end' },
    'Vanderbilt': { dx: 22, dy: -6, anchor: 'start' },
    'TCU': { dx: 22, dy: 0, anchor: 'start' },
    'Notre Dame': { dx: -22, dy: 14, anchor: 'end' },
    'North Carolina': { dx: 22, dy: 0, anchor: 'start' },
    'Ohio State': { dx: 22, dy: 0, anchor: 'start' },
    'Washington': { dx: -22, dy: 14, anchor: 'end' },
    'Minnesota': { dx: -22, dy: 0, anchor: 'end' },
    'Alabama': { dx: 22, dy: -6, anchor: 'start' },
    'Ole Miss': { dx: 22, dy: 14, anchor: 'start' },
    'Virginia': { dx: -22, dy: 0, anchor: 'end' },
    'Baylor': { dx: 22, dy: -14, anchor: 'start' },
  }

  const colorFor = (t: TeamRow) => {
    if (t.name === 'LSU') return CRIMSON
    if (t.name === 'Baylor') return '#c0392b'
    if (t.ppgGained >= yMed && t.attemptsPerGame >= xMed) return CRIMSON
    if (t.ppgGained >= yMed && t.attemptsPerGame < xMed) return GREEN
    if (t.ppgGained < yMed && t.attemptsPerGame >= xMed) return AMBER
    return NEUTRAL
  }

  return (
    <div className="t41-scatter">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Two-for-one efficiency scatter chart">
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Quadrant median lines */}
          <line x1={scaleX(xMed)} y1={0} x2={scaleX(xMed)} y2={innerH}
            stroke={BORDER} strokeWidth={1.2} strokeDasharray="4 4" opacity={0.6} />
          <line x1={0} y1={scaleY(yMed)} x2={innerW} y2={scaleY(yMed)}
            stroke={BORDER} strokeWidth={1.2} strokeDasharray="4 4" opacity={0.6} />

          {/* Grid */}
          {xTicks.map(t => (
            <line key={`xg-${t}`} x1={scaleX(t)} y1={0} x2={scaleX(t)} y2={innerH}
              stroke={BORDER} strokeWidth={0.5} opacity={0.4} />
          ))}
          {yTicks.map(t => (
            <line key={`yg-${t}`} x1={0} y1={scaleY(t)} x2={innerW} y2={scaleY(t)}
              stroke={BORDER} strokeWidth={0.5} opacity={0.4} />
          ))}

          {/* Quadrant labels */}
          <text x={innerW - 6} y={14} textAnchor="end" fontSize={11}
            fontWeight={700} fill={CRIMSON} opacity={0.85}>ELITE</text>
          <text x={6} y={14} textAnchor="start" fontSize={11}
            fontWeight={700} fill={GREEN} opacity={0.85}>HIDDEN VALUE</text>
          <text x={innerW - 6} y={innerH - 6} textAnchor="end" fontSize={11}
            fontWeight={700} fill={AMBER} opacity={0.85}>INEFFICIENT</text>
          <text x={6} y={innerH - 6} textAnchor="start" fontSize={11}
            fontWeight={700} fill={NEUTRAL} opacity={0.85}>LOWER IMPACT</text>

          {/* Axis ticks */}
          {xTicks.map(t => (
            <g key={`xt-${t}`} transform={`translate(${scaleX(t)}, ${innerH})`}>
              <line y1={0} y2={5} stroke={MUTED} strokeWidth={1} />
              <text y={20} textAnchor="middle" fontSize={10} fill={MUTED}>{t.toFixed(1)}</text>
            </g>
          ))}
          {yTicks.map(t => (
            <g key={`yt-${t}`} transform={`translate(0, ${scaleY(t)})`}>
              <line x1={-5} x2={0} stroke={MUTED} strokeWidth={1} />
              <text x={-10} dy={4} textAnchor="end" fontSize={10} fill={MUTED}>+{t.toFixed(1)}</text>
            </g>
          ))}

          {/* Axis labels */}
          <text x={innerW / 2} y={innerH + 50} textAnchor="middle"
            fontSize={12} fontWeight={600} fill={INK}>2-for-1 attempts per game</text>
          <text x={-innerH / 2} y={-52} textAnchor="middle"
            fontSize={12} fontWeight={600} fill={INK} transform="rotate(-90)">
            Points per game gained vs holding for one shot
          </text>

          {/* Team logos as bubbles */}
          {TEAMS.map(t => {
            const cx = scaleX(t.attemptsPerGame)
            const cy = scaleY(t.ppgGained)
            const isHighlight = t.name === 'LSU' || t.name === 'Baylor'
            const isHovered = hovered === t.name
            const size = isHighlight ? 36 : 26
            const haloSize = size + 8
            const place = placement[t.name] || { dx: 22, dy: 0, anchor: 'start' as const }
            return (
              <g key={t.name}
                onMouseEnter={() => setHovered(t.name)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}>
                {/* Halo for highlights or hover */}
                {(isHighlight || isHovered) && (
                  <circle cx={cx} cy={cy} r={haloSize / 2}
                    fill={colorFor(t)} opacity={0.18} />
                )}
                {/* Logo */}
                <image
                  href={`/images/logos/${t.espnId}.png`}
                  x={cx - size / 2}
                  y={cy - size / 2}
                  width={size}
                  height={size}
                  style={{ transition: 'all 200ms' }}
                />
                {/* Label */}
                <text
                  x={cx + place.dx}
                  y={cy + place.dy}
                  textAnchor={place.anchor}
                  fontSize={isHighlight ? 12 : 11}
                  fontWeight={isHighlight ? 700 : 500}
                  fill={INK}
                  style={{ pointerEvents: 'none' }}
                >
                  {t.name}
                </text>
              </g>
            )
          })}

          {/* Tooltip on hover */}
          {hovered && (() => {
            const t = TEAMS.find(x => x.name === hovered)!
            const tx = scaleX(t.attemptsPerGame)
            const ty = scaleY(t.ppgGained)
            const left = tx > innerW / 2
            return (
              <g>
                <rect
                  x={left ? tx - 200 : tx + 30}
                  y={ty - 56}
                  width={170}
                  height={68}
                  fill="white"
                  stroke={CRIMSON}
                  strokeWidth={1.5}
                  rx={6}
                />
                <text x={left ? tx - 190 : tx + 40} y={ty - 38} fontSize={12} fontWeight={700} fill={INK}>
                  {t.name} (AP #{t.apRank})
                </text>
                <text x={left ? tx - 190 : tx + 40} y={ty - 22} fontSize={11} fill={MUTED}>
                  {t.attemptsPerGame.toFixed(2)} attempts/game
                </text>
                <text x={left ? tx - 190 : tx + 40} y={ty - 8} fontSize={11} fill={INK} fontWeight={600}>
                  +{t.ppgGained.toFixed(2)} PPG gained
                </text>
              </g>
            )
          })()}
        </g>
      </svg>
      <div className="t41-scatter__caption">
        Bubble color = quadrant. Hover any team for its full numbers.
      </div>
    </div>
  )
}

// ===================================================================
// HORIZONTAL BAR — PPG Gained ranking
// ===================================================================
export function PpgGainedRanking() {
  const sorted = [...TEAMS].sort((a, b) => b.ppgGained - a.ppgGained)
  const maxVal = Math.max(...sorted.map(t => t.ppgGained))
  return (
    <div className="t41-ranking">
      {sorted.map((t, i) => {
        const isLsu = t.name === 'LSU'
        const isBaylor = t.name === 'Baylor'
        const barColor = isLsu ? CRIMSON : isBaylor ? '#c0392b' : CRIMSON_SOFT
        const textColor = isLsu || isBaylor ? 'white' : INK
        return (
          <div key={t.name} className="t41-ranking__row">
            <div className="t41-ranking__rank">{i + 1}</div>
            <div className="t41-ranking__logo">
              <img src={`/images/logos/${t.espnId}.png`} alt={t.name} />
            </div>
            <div className="t41-ranking__name">
              {t.name}
              <span className="t41-ranking__ap">AP #{t.apRank}</span>
            </div>
            <div className="t41-ranking__bar-wrap">
              <div
                className="t41-ranking__bar"
                style={{
                  width: `${(t.ppgGained / maxVal) * 100}%`,
                  background: barColor,
                  color: textColor,
                }}
              >
                {(isLsu || isBaylor || t.ppgGained >= 2.0) && (
                  <span className="t41-ranking__bar-val">+{t.ppgGained.toFixed(2)} PPG</span>
                )}
              </div>
              {!(isLsu || isBaylor || t.ppgGained >= 2.0) && (
                <span className="t41-ranking__outside-val">+{t.ppgGained.toFixed(2)} PPG</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ===================================================================
// TIMING DIAGRAM — animated SVG showing the math of the 0:43-0:50 window
// ===================================================================
export function TimingDiagram({ phases, totalSeconds = 60, animationKey = 'default', annotation }: {
  phases: TimingPhase[]
  totalSeconds?: number
  animationKey?: string
  annotation?: string
}) {
  const [progress, setProgress] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setProgress(0)
        // animate to 100% over 2.5 seconds
        const start = performance.now()
        const tick = () => {
          const t = (performance.now() - start) / 2500
          if (t >= 1) { setProgress(1); return }
          setProgress(t)
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [animationKey])

  const width = 800
  const height = 110
  const barTop = 40
  const barHeight = 28
  const padding = 20
  const innerW = width - 2 * padding
  const scale = (s: number) => padding + ((totalSeconds - s) / totalSeconds) * innerW

  const colorMap: Record<string, string> = {
    team: CRIMSON,
    inbound: '#cfcac0',
    opp: '#6b6862',
    rebound: '#a09a90',
    opp_left: '#e0d8c8',
  }

  const visibleEnd = totalSeconds - progress * totalSeconds

  return (
    <div className="t41-timing" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Timing diagram">
        {/* Time ticks */}
        {[60, 50, 40, 30, 20, 10, 0].map(s => {
          const x = scale(s)
          return (
            <g key={s}>
              <line x1={x} y1={barTop - 6} x2={x} y2={barTop + barHeight + 6}
                stroke={BORDER} strokeWidth={0.5} />
              <text x={x} y={barTop - 10} textAnchor="middle" fontSize={9} fill={MUTED}>
                {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
              </text>
            </g>
          )
        })}

        {/* Optimal shoot window 43-50s shaded */}
        <rect x={scale(50)} y={barTop - 4} width={scale(43) - scale(50)} height={barHeight + 8}
          fill={CRIMSON} opacity={0.06} />
        <text x={(scale(50) + scale(43)) / 2} y={barTop + barHeight + 22}
          textAnchor="middle" fontSize={9} fontWeight={600} fill={CRIMSON}>
          shoot window
        </text>

        {/* Phases */}
        {phases.map((p, i) => {
          const x1 = scale(p.startSecond)
          const x2 = scale(p.endSecond)
          const w = Math.max(2, x2 - x1)
          const animatedW = Math.max(0, Math.min(w, scale(visibleEnd) - x1))
          if (animatedW <= 0) return null
          return (
            <g key={i}>
              <rect x={x1} y={barTop} width={animatedW} height={barHeight}
                fill={colorMap[p.color]} opacity={0.85} />
            </g>
          )
        })}

        {/* Phase labels (always shown) */}
        {phases.map((p, i) => {
          if (p.startSecond === p.endSecond) return null
          const x1 = scale(p.startSecond)
          const x2 = scale(p.endSecond)
          const cx = (x1 + x2) / 2
          const w = x2 - x1
          if (w < 24) return null
          return (
            <text key={`lbl-${i}`} x={cx} y={barTop + barHeight / 2 + 4}
              textAnchor="middle" fontSize={9} fontWeight={600} fill="white">
              {p.caption}
            </text>
          )
        })}
      </svg>
      {annotation && <div className="t41-timing__annotation">{annotation}</div>}
    </div>
  )
}

// ===================================================================
// INBOUND DELAY DIAGRAM
// ===================================================================
export function InboundDelayDiagram({ phases }: { phases: InboundDelayPhase[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setProgress(0)
        const start = performance.now()
        const tick = () => {
          const t = (performance.now() - start) / 3000
          if (t >= 1) { setProgress(1); return }
          setProgress(t)
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  const totalSec = 80
  const width = 800
  const height = 150
  const barTop = 60
  const barHeight = 32
  const padding = 20
  const innerW = width - 2 * padding
  const scale = (s: number) => padding + ((totalSec - s) / totalSec) * innerW

  const colorMap: Record<string, string> = {
    opp_made: INK,
    delay: AMBER,
    shotclock_active: CRIMSON,
    shoot: CRIMSON,
    open: '#e8e6df',
  }

  const visibleEnd = totalSec - progress * totalSec

  return (
    <div className="t41-timing" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Inbound delay diagram">
        {/* Time ticks */}
        {[80, 60, 50, 40, 20, 0].map(s => {
          const x = scale(s)
          return (
            <g key={s}>
              <line x1={x} y1={barTop - 6} x2={x} y2={barTop + barHeight + 6}
                stroke={BORDER} strokeWidth={0.5} />
              <text x={x} y={barTop - 10} textAnchor="middle" fontSize={9} fill={MUTED}>
                {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
              </text>
            </g>
          )
        })}

        {/* Optimal shoot window highlighted */}
        <rect x={scale(50)} y={barTop - 4} width={scale(43) - scale(50)} height={barHeight + 8}
          fill={CRIMSON} opacity={0.08} />
        <text x={(scale(50) + scale(43)) / 2} y={barTop + barHeight + 22}
          textAnchor="middle" fontSize={9} fontWeight={600} fill={CRIMSON}>
          shoot here
        </text>

        {/* Phases */}
        {phases.map((p, i) => {
          const x1 = scale(p.startSec)
          const x2 = scale(p.endSec)
          const w = Math.max(p.kind === 'opp_made' || p.kind === 'shoot' ? 4 : 2, x2 - x1)
          const animatedW = Math.max(0, Math.min(w, scale(visibleEnd) - x1))
          if (animatedW <= 0) return null
          const c = colorMap[p.kind]
          return (
            <rect key={i} x={x1} y={barTop} width={animatedW} height={barHeight}
              fill={c} opacity={p.kind === 'open' ? 0.4 : 0.9} />
          )
        })}

        {/* Markers and labels */}
        {phases.map((p, i) => {
          if (p.kind === 'opp_made' || p.kind === 'shoot') {
            const x = scale(p.startSec)
            return (
              <g key={`m-${i}`}>
                <line x1={x} y1={barTop - 14} x2={x} y2={barTop} stroke={INK} strokeWidth={1.5} />
                <text x={x} y={barTop - 20} textAnchor="middle" fontSize={10} fontWeight={700} fill={INK}>
                  {p.label}
                </text>
              </g>
            )
          }
          return null
        })}

        {/* Phase captions inside bars */}
        {phases.map((p, i) => {
          if (p.kind === 'opp_made' || p.kind === 'shoot' || p.kind === 'open') return null
          const x1 = scale(p.startSec)
          const x2 = scale(p.endSec)
          const cx = (x1 + x2) / 2
          const w = x2 - x1
          if (w < 40) return null
          return (
            <text key={`c-${i}`} x={cx} y={barTop + barHeight / 2 + 4}
              textAnchor="middle" fontSize={9} fontWeight={600} fill="white">
              {p.caption}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

// ===================================================================
// STAT CALLOUT cards
// ===================================================================
export function StatCard({ value, label, sublabel, accent }: {
  value: string
  label: string
  sublabel?: string
  accent?: boolean
}) {
  return (
    <div className={`t41-statcard ${accent ? 't41-statcard--accent' : ''}`}>
      <div className="t41-statcard__value">{value}</div>
      <div className="t41-statcard__label">{label}</div>
      {sublabel && <div className="t41-statcard__sublabel">{sublabel}</div>}
    </div>
  )
}

// ===================================================================
// PASS-UP RATE table
// ===================================================================
export function PassUpTable() {
  const sorted = [...TEAMS].sort((a, b) => b.passUpPct - a.passUpPct).slice(0, 10)
  return (
    <table className="t41-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Team</th>
          <th>AP</th>
          <th style={{ textAlign: 'right' }}>Passed up</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((t, i) => (
          <tr key={t.name} className={t.name === 'Alabama' ? 't41-table__row--highlight' : ''}>
            <td>{i + 1}</td>
            <td>
              <span className="t41-table__logo">
                <img src={`/images/logos/${t.espnId}.png`} alt="" />
              </span>
              {t.name}
            </td>
            <td>#{t.apRank}</td>
            <td style={{ textAlign: 'right', fontWeight: 600 }}>{t.passUpPct.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

import { useState } from 'react'
import './ShotChart.css'

// 14 standard shot zones with synthetic WBB-realistic shooting % data
// Coordinates are on a half-court 500x470 SVG (basket at center top)
interface Zone {
  id: string
  name: string
  // Path describing the zone polygon on the half court
  path: string
  // Shooting %, attempts (synthetic placeholders — easy to swap for real data)
  pct: number
  fgm: number
  fga: number
  // Label position
  labelX: number
  labelY: number
}

// Court is 500 wide x 470 tall. Basket at (250, 50). 3pt arc radius ~ 200 from basket.
const ZONES: Zone[] = [
  {
    id: 'rim',
    name: 'At the Rim',
    path: 'M250,50 m-65,0 a65,65 0 1,0 130,0 a65,65 0 1,0 -130,0',
    pct: 58.2,
    fgm: 142,
    fga: 244,
    labelX: 250,
    labelY: 90,
  },
  {
    id: 'paint-left',
    name: 'Paint (Left)',
    path: 'M170,115 L170,210 L250,210 L250,115 L185,115 A65,65 0 0 1 170,80 Z',
    pct: 41.5,
    fgm: 39,
    fga: 94,
    labelX: 210,
    labelY: 165,
  },
  {
    id: 'paint-right',
    name: 'Paint (Right)',
    path: 'M250,115 L250,210 L330,210 L330,115 L315,80 A65,65 0 0 1 315,115 Z',
    pct: 43.8,
    fgm: 42,
    fga: 96,
    labelX: 290,
    labelY: 165,
  },
  {
    id: 'mid-left',
    name: 'Mid-Range (L)',
    path: 'M70,50 L70,180 L170,180 L170,115 A65,65 0 0 1 185,80 L185,50 Z',
    pct: 31.4,
    fgm: 22,
    fga: 70,
    labelX: 120,
    labelY: 120,
  },
  {
    id: 'mid-right',
    name: 'Mid-Range (R)',
    path: 'M315,50 L315,80 A65,65 0 0 1 330,115 L330,180 L430,180 L430,50 Z',
    pct: 33.2,
    fgm: 24,
    fga: 72,
    labelX: 380,
    labelY: 120,
  },
  {
    id: 'mid-elbow-left',
    name: 'Elbow (Left)',
    path: 'M170,180 L170,250 L250,250 L250,210 L170,210 Z',
    pct: 36.7,
    fgm: 18,
    fga: 49,
    labelX: 210,
    labelY: 230,
  },
  {
    id: 'mid-elbow-right',
    name: 'Elbow (Right)',
    path: 'M250,210 L250,250 L330,250 L330,180 L330,210 Z',
    pct: 38.1,
    fgm: 19,
    fga: 50,
    labelX: 290,
    labelY: 230,
  },
  {
    id: 'corner-3-left',
    name: 'Corner 3 (L)',
    path: 'M10,50 L10,180 L70,180 L70,50 Z',
    pct: 38.9,
    fgm: 28,
    fga: 72,
    labelX: 40,
    labelY: 120,
  },
  {
    id: 'corner-3-right',
    name: 'Corner 3 (R)',
    path: 'M430,50 L430,180 L490,180 L490,50 Z',
    pct: 36.4,
    fgm: 24,
    fga: 66,
    labelX: 460,
    labelY: 120,
  },
  {
    id: 'wing-3-left',
    name: 'Wing 3 (L)',
    path: 'M10,180 L10,300 L130,300 L130,200 L70,180 Z',
    pct: 32.8,
    fgm: 41,
    fga: 125,
    labelX: 90,
    labelY: 270,
  },
  {
    id: 'wing-3-right',
    name: 'Wing 3 (R)',
    path: 'M370,200 L370,300 L490,300 L490,180 L430,180 Z',
    pct: 34.1,
    fgm: 44,
    fga: 129,
    labelX: 410,
    labelY: 270,
  },
  {
    id: 'top-3',
    name: 'Top of Key 3',
    path: 'M130,200 L130,310 L370,310 L370,200 L330,250 L170,250 Z',
    pct: 35.9,
    fgm: 51,
    fga: 142,
    labelX: 250,
    labelY: 275,
  },
  {
    id: 'long-2-left',
    name: 'Long 2 (L)',
    path: 'M70,180 L70,250 L170,250 L170,180 Z',
    pct: 28.2,
    fgm: 11,
    fga: 39,
    labelX: 120,
    labelY: 215,
  },
  {
    id: 'long-2-right',
    name: 'Long 2 (R)',
    path: 'M330,180 L330,250 L430,250 L430,180 Z',
    pct: 30.5,
    fgm: 12,
    fga: 39,
    labelX: 380,
    labelY: 215,
  },
]

function colorFor(pct: number): string {
  // Cold (light cream) → Hot (deep burgundy). 25% = lightest, 60%+ = full burgundy.
  const clamped = Math.max(25, Math.min(60, pct))
  const t = (clamped - 25) / 35 // 0..1
  // Cool: #efebe0 (warm cream). Hot: #6b1018 (deep burgundy).
  const r = Math.round(239 + (107 - 239) * t)
  const g = Math.round(235 + (16 - 235) * t)
  const b = Math.round(224 + (24 - 224) * t)
  return `rgb(${r}, ${g}, ${b})`
}

function textColorFor(pct: number): string {
  // Dark text on light zones, white on dark zones
  return pct >= 40 ? '#ffffff' : '#18171a'
}

export function ShotChart() {
  const [activeZone, setActiveZone] = useState<Zone | null>(null)
  const [viewMode, setViewMode] = useState<'pct' | 'volume'>('pct')

  const totalFGM = ZONES.reduce((s, z) => s + z.fgm, 0)
  const totalFGA = ZONES.reduce((s, z) => s + z.fga, 0)
  const overallPct = ((totalFGM / totalFGA) * 100).toFixed(1)

  return (
    <div className="shot-chart">
      <div className="shot-chart__header">
        <div>
          <p className="shot-chart__label">Live · NCAA WBB shooting % by zone</p>
          <h3 className="shot-chart__title">Where the buckets come from</h3>
        </div>
        <div className="shot-chart__toggle">
          <button
            className={viewMode === 'pct' ? 'active' : ''}
            onClick={() => setViewMode('pct')}
          >
            FG%
          </button>
          <button
            className={viewMode === 'volume' ? 'active' : ''}
            onClick={() => setViewMode('volume')}
          >
            Attempts
          </button>
        </div>
      </div>

      <div className="shot-chart__body">
        <div className="shot-chart__court-wrap">
          <svg viewBox="0 0 500 470" className="shot-chart__court" preserveAspectRatio="xMidYMid meet">
            {/* Court outline */}
            <rect x="10" y="50" width="480" height="360" fill="none" stroke="#18171a" strokeWidth="1.5" />

            {/* Render zones */}
            {ZONES.map((zone) => {
              const fill = viewMode === 'pct'
                ? colorFor(zone.pct)
                : colorFor(25 + (zone.fga / 250) * 35)
              const isActive = activeZone?.id === zone.id
              const pctForText = viewMode === 'pct' ? zone.pct : 25 + (zone.fga / 250) * 35
              return (
                <g key={zone.id}
                   onMouseEnter={() => setActiveZone(zone)}
                   onMouseLeave={() => setActiveZone(null)}
                   className="zone">
                  <path
                    d={zone.path}
                    fill={fill}
                    stroke="#18171a"
                    strokeWidth={isActive ? 2 : 0.75}
                    strokeOpacity={isActive ? 1 : 0.18}
                    style={{
                      cursor: 'pointer',
                      transition: 'fill 200ms ease, opacity 200ms ease',
                      opacity: activeZone && !isActive ? 0.55 : 1,
                    }}
                  />
                  <text
                    x={zone.labelX}
                    y={zone.labelY}
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="600"
                    fill={textColorFor(pctForText)}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {viewMode === 'pct' ? `${zone.pct.toFixed(1)}%` : zone.fga}
                  </text>
                </g>
              )
            })}

            {/* 3pt arc reference */}
            <path
              d="M70,50 L70,180 A200,200 0 0 0 430,180 L430,50"
              fill="none"
              stroke="#18171a"
              strokeWidth="1.5"
              opacity="0.55"
              pointerEvents="none"
            />
            {/* Paint */}
            <rect x="170" y="50" width="160" height="160" fill="none" stroke="#18171a" strokeWidth="1.5" opacity="0.55" pointerEvents="none" />
            {/* Free throw line */}
            <line x1="170" y1="210" x2="330" y2="210" stroke="#18171a" strokeWidth="1.5" opacity="0.55" pointerEvents="none" />
            {/* Basket */}
            <circle cx="250" cy="50" r="9" fill="none" stroke="#18171a" strokeWidth="2" pointerEvents="none" />
          </svg>
        </div>

        <div className="shot-chart__sidebar">
          <div className="shot-chart__summary">
            <span className="shot-chart__summary-label">Season overall</span>
            <span className="shot-chart__summary-value">{overallPct}%</span>
            <span className="shot-chart__summary-sub">{totalFGM}/{totalFGA} FG</span>
          </div>

          <div className="shot-chart__zone-detail">
            {activeZone ? (
              <>
                <span className="shot-chart__detail-label">{activeZone.name}</span>
                <span className="shot-chart__detail-value">{activeZone.pct.toFixed(1)}%</span>
                <span className="shot-chart__detail-sub">
                  {activeZone.fgm}/{activeZone.fga} attempts
                </span>
              </>
            ) : (
              <span className="shot-chart__detail-hint">Hover a zone</span>
            )}
          </div>

          <div className="shot-chart__legend">
            <span className="shot-chart__legend-label">{viewMode === 'pct' ? 'Cold → Hot' : 'Few → Many'}</span>
            <div className="shot-chart__legend-bar" />
            <div className="shot-chart__legend-ends">
              <span>{viewMode === 'pct' ? '25%' : 'low'}</span>
              <span>{viewMode === 'pct' ? '60%' : 'high'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

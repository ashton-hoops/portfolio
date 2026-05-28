// Visuals for the 2-for-1 article.
// Design system: analytics-visuals palette and tokens.

import { useEffect, useRef, useState } from 'react'

const CRIMSON = '#841617'
const INK = '#111111'
const MUTED = '#5c6370'
const BORDER = '#d7d9df'
const PANEL = '#f7f7f9'

// Re-animate any wrapped child whenever it scrolls back into view.
// Uses IntersectionObserver: increments a "tick" each time the element enters
// the viewport so callers can pass `key={tick}` to remount and restart CSS animations.
function useReanimateOnView<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [tick, setTick] = useState(0)
  const isInView = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      entries => {
        const e = entries[0]
        if (!e) return
        if (e.isIntersecting && !isInView.current) {
          isInView.current = true
          setTick(t => t + 1)
        } else if (!e.isIntersecting && isInView.current) {
          isInView.current = false
        }
      },
      { threshold: 0.25 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return [ref, tick]
}

// =============================================================
// 1. CLIP FRAME with timestamp annotations
// =============================================================
export function ClipFrame({ src, caption }: { src: string; caption: string }) {
  const markers = [
    { t: 0.05, label: '1:16', desc: 'OU scores' },
    { t: 0.25, label: '1:10', desc: 'Texas A&M inbounds' },
  ]
  const winStart = 0.72
  const winEnd = 0.88
  const [ref, tick] = useReanimateOnView<HTMLElement>()
  return (
    <figure ref={ref} className="t41-clip">
      <video src={src} autoPlay loop muted playsInline className="t41-clip__video" />
      <svg key={tick} viewBox="0 0 1000 70" xmlns="http://www.w3.org/2000/svg" className="t41-clip__timeline">
        {/* Baseline draws in first */}
        <line x1="20" y1="20" x2="980" y2="20" stroke={BORDER} strokeWidth="1"
          className="t41-line-grow-x" style={{ transformOrigin: '20px 20px' }} />
        {/* Markers fade up in order */}
        {markers.map((m, i) => {
          const x = 20 + m.t * 960
          return (
            <g key={m.label} className="t41-fade-up" style={{ animationDelay: `${0.4 + i * 0.25}s` }}>
              <circle cx={x} cy="20" r="5" fill={CRIMSON} />
              <text x={x} y="40" textAnchor="middle" fontSize="15" fontWeight="700" fill={INK}>{m.label}</text>
              <text x={x} y="56" textAnchor="middle" fontSize="13" fontWeight="600" fill={MUTED}>{m.desc}</text>
            </g>
          )
        })}
        {/* Optimal window bracket fades in last */}
        <g className="t41-fade-up" style={{ animationDelay: '0.9s' }}>
          <line x1={20 + winStart * 960} y1="20" x2={20 + winEnd * 960} y2="20" stroke={INK} strokeWidth="3" />
          <line x1={20 + winStart * 960} y1="14" x2={20 + winStart * 960} y2="26" stroke={INK} strokeWidth="2" />
          <line x1={20 + winEnd * 960} y1="14" x2={20 + winEnd * 960} y2="26" stroke={INK} strokeWidth="2" />
          <text x={20 + ((winStart + winEnd) / 2) * 960} y="40" textAnchor="middle" fontSize="15" fontWeight="700" fill={INK}>
            0:48 - 0:42
          </text>
          <text x={20 + ((winStart + winEnd) / 2) * 960} y="56" textAnchor="middle" fontSize="13" fontWeight="600" fill={MUTED}>
            Optimal window
          </text>
        </g>
      </svg>
      <figcaption className="t41-clip__caption">{caption}</figcaption>
    </figure>
  )
}

// =============================================================
// 2. DISTRIBUTION HISTOGRAM with success-rate overlay
// =============================================================
const DIST_DATA = [
  { sec: 28, count: 4585, rate: 34.0 }, { sec: 30, count: 4759, rate: 38.8 },
  { sec: 32, count: 4769, rate: 46.5 }, { sec: 34, count: 4756, rate: 57.2 },
  { sec: 36, count: 4367, rate: 70.0 }, { sec: 38, count: 4321, rate: 76.7 },
  { sec: 40, count: 4157, rate: 83.1 }, { sec: 42, count: 4016, rate: 85.0 },
  { sec: 44, count: 3873, rate: 87.3 }, { sec: 46, count: 3856, rate: 85.2 },
  { sec: 48, count: 3783, rate: 85.1 }, { sec: 50, count: 3555, rate: 82.4 },
  { sec: 52, count: 3492, rate: 79.4 }, { sec: 54, count: 3249, rate: 76.5 },
  { sec: 56, count: 3149, rate: 71.4 }, { sec: 58, count: 3235, rate: 69.6 },
  { sec: 60, count: 2396, rate: 62.8 }, { sec: 62, count: 2949, rate: 59.7 },
  { sec: 64, count: 2884, rate: 55.0 }, { sec: 66, count: 1421, rate: 49.3 },
]

export function DistributionHistogram() {
  const W = 920, H = 700
  const margin = { top: 100, right: 80, bottom: 130, left: 90 }
  const iW = W - margin.left - margin.right
  const iH = H - margin.top - margin.bottom
  const minSec = 36, maxSec = 54

  const DATA = DIST_DATA.filter(d => d.sec >= minSec && d.sec <= maxSec)

  const x = (s: number) => ((s - minSec) / (maxSec - minSec)) * iW
  const y = (r: number) => iH - ((r - 65) / 30) * iH

  const linePath = DATA.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(d.sec)},${y(d.rate)}`).join(' ')

  const [ref, tick] = useReanimateOnView<HTMLElement>()
  return (
    <figure ref={ref} className="t41-chart">
      <svg key={tick} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" className="t41-chart__svg">
        <text x={margin.left} y={36} fontSize="22" fontWeight="800" fill={INK}>
          Success rate peaks at 0:44 and falls off in both directions
        </text>
        <text x={margin.left} y={62} fontSize="15" fontWeight="500" fill={MUTED}>
          Proper 2-for-1 utilization rate by first-shot time, D1 WBB 2018-19 through 2025-26
        </text>

        <g transform={`translate(${margin.left},${margin.top})`}>
          <rect x={x(42)} y={0} width={x(48) - x(42)} height={iH} fill={PANEL} stroke={BORDER} strokeWidth="1" />

          {[70, 75, 80, 85, 90].map(v => (
            <g key={v}>
              <line x1={0} y1={y(v)} x2={iW} y2={y(v)} stroke={BORDER} strokeWidth="1" strokeDasharray="4 4" />
              <text x={-14} y={y(v) + 5} textAnchor="end" fontSize="15" fontWeight="600" fill={INK}>{v}%</text>
            </g>
          ))}

          <line x1={0} y1={0} x2={0} y2={iH} stroke={INK} strokeWidth="1.5" />
          <text x={-58} y={iH / 2} textAnchor="middle" transform={`rotate(-90, -58, ${iH / 2})`} fontSize="15" fontWeight="700" fill={INK}>
            2-for-1 Conversion Success
          </text>

          <path d={linePath} stroke={INK} strokeWidth="3.5" fill="none" className="t41-line-draw" />
          {DATA.map((d, i) => (
            <circle key={d.sec} cx={x(d.sec)} cy={y(d.rate)} r={d.sec === 44 ? 7 : 5} fill={INK}
              className="t41-dot-fade" style={{ animationDelay: `${0.05 * i + 0.8}s` }} />
          ))}

          <g transform={`translate(${x(44)},${y(87.3) - 18})`}>
            <text textAnchor="middle" fontSize="18" fontWeight="800" fill={INK}>87%</text>
          </g>

          <line x1={0} y1={iH} x2={iW} y2={iH} stroke={INK} strokeWidth="1.5" />
          {[36, 38, 40, 42, 44, 46, 48, 50, 52, 54].map(s => (
            <g key={s} transform={`translate(${x(s)},${iH})`}>
              <line y1={0} y2={6} stroke={INK} strokeWidth="1.5" />
              <text y={26} textAnchor="middle" fontSize="13" fontWeight="600" fill={INK}>0:{s.toString().padStart(2, '0')}</text>
            </g>
          ))}

          <g transform={`translate(0,${iH + 54})`}>
            <line x1={x(42)} y1={0} x2={x(48)} y2={0} stroke={INK} strokeWidth="2.5" />
            <line x1={x(42)} y1={-6} x2={x(42)} y2={6} stroke={INK} strokeWidth="2.5" />
            <line x1={x(48)} y1={-6} x2={x(48)} y2={6} stroke={INK} strokeWidth="2.5" />
            <text x={(x(42) + x(48)) / 2} y={26} textAnchor="middle" fontSize="14" fontWeight="800" fill={INK}>
              Optimal window
            </text>
          </g>

          <text x={iW / 2} y={iH + 105} textAnchor="middle" fontSize="14" fontWeight="600" fill={INK}>
            Game clock when first shot ended
          </text>
        </g>
      </svg>
    </figure>
  )
}

// NCAA inline badge
function NcaaBadge({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 60 60" width="60" height="60" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="56" height="56" rx="10" fill={color} />
      <text x="30" y="38" textAnchor="middle" fontSize="14" fontWeight="800"
        fontFamily="system-ui, sans-serif" letterSpacing="0.5" fill="#ffffff">NCAA</text>
    </svg>
  )
}

// =============================================================
// 3. LEAGUE COMPARISON - three bar chart with sources
// =============================================================

const LEAGUE_BARS = [
  {
    name: "D1 Women's CBB",
    value: 35,
    logo: '/images/ncaa-wbb.avif',
    silhouette: '/images/ncaa-wbb-silhouette.png',
    color: '#118AD4',
    era: '2018-2026',
  },
  {
    name: 'WNBA',
    value: 55,
    logo: 'https://a.espncdn.com/i/teamlogos/leagues/500/wnba.png',
    silhouette: '/images/wnba-silhouette.png',
    color: '#F26F21',
    era: '2018-19 + 2021-22',
  },
  {
    name: 'NBA',
    value: 67,
    logo: 'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png',
    silhouette: '/images/nba-silhouette.png',
    color: '#17408B',
    era: '2018-19 + 2021-22',
  },
] as const

export function LeagueComparisonChart() {
  const W = 920, H = 700
  // Layout zones
  const margin = { top: 80, right: 80, bottom: 240, left: 80 }
  const iW = W - margin.left - margin.right
  const iH = H - margin.top - margin.bottom
  const maxV = 80
  const valueH = 44          // big % above silhouette
  const plotTop = valueH
  const baseline = iH        // bottom of plot
  const plotH = baseline - plotTop
  const yScale = (v: number) => baseline - (v / maxV) * plotH
  const colW = iW / LEAGUE_BARS.length
  const yTicks = [0, 20, 40, 60, 80]

  // Silhouette aspect ratios (width/height)
  const silAspect: Record<string, number> = {
    "D1 Women's CBB": 0.32,
    'WNBA': 0.40,
    'NBA': 0.41,
  }
  const maxSilW = colW * 0.62  // cap so tall silhouettes don't get too wide on small bars

  const [ref, tick] = useReanimateOnView<HTMLElement>()
  return (
    <figure ref={ref} className="t41-chart">
      <svg key={tick} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" className="t41-chart__svg">
        <defs>
          {/* Silhouette masks. Coordinates are in g-local space (g is translated by margin). */}
          {LEAGUE_BARS.map((b, i) => {
            const cx = colW * i + colW / 2
            const silH = (b.value / maxV) * plotH
            const silW = Math.min(silH * silAspect[b.name], maxSilW)
            const silX = cx - silW / 2
            const silY = baseline - silH
            return (
              <mask key={b.name} id={`mask-${i}`} maskUnits="userSpaceOnUse">
                <rect x={silX} y={silY} width={silW} height={silH} fill="black" />
                <image
                  href={b.silhouette}
                  x={silX}
                  y={silY}
                  width={silW}
                  height={silH}
                  preserveAspectRatio="none"
                />
              </mask>
            )
          })}
        </defs>
        {/* Title */}
        <text x={margin.left} y={36} fontSize="22" fontWeight="800" fill={INK}>
          The NBA attempts 2-for-1 nearly twice as often as D1 women's CBB
        </text>
        <text x={margin.left} y={62} fontSize="15" fontWeight="500" fill={MUTED}>
          2-for-1 attempt rate by league
        </text>

        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Y axis grid and labels */}
          {yTicks.map(v => (
            <g key={v}>
              <line x1={0} y1={yScale(v)} x2={iW} y2={yScale(v)} stroke={BORDER} strokeWidth="1" strokeDasharray="4 4" />
              <text x={-14} y={yScale(v) + 5} textAnchor="end" fontSize="15" fontWeight="600" fill={INK}>{v}%</text>
            </g>
          ))}
          {/* Y axis line */}
          <line x1={0} y1={plotTop} x2={0} y2={baseline} stroke={INK} strokeWidth="1.5" />
          {/* Y axis title */}
          <text x={-58} y={plotTop + plotH / 2} textAnchor="middle" transform={`rotate(-90, -58, ${plotTop + plotH / 2})`} fontSize="15" fontWeight="700" fill={INK}>
            2-for-1 Attempt Rate
          </text>
          {/* Baseline */}
          <line x1={0} y1={baseline} x2={iW} y2={baseline} stroke={INK} strokeWidth="1.5" />

          {LEAGUE_BARS.map((b, i) => {
            const cx = colW * i + colW / 2
            const silH = (b.value / maxV) * plotH
            const silW = Math.min(silH * silAspect[b.name], maxSilW)
            const silX = cx - silW / 2
            const silY = baseline - silH
            return (
              <g key={b.name}>
                {/* Big value above silhouette */}
                <text x={cx} y={silY - 18} textAnchor="middle" fontSize="44" fontWeight="900" fill={b.color}
                  className="t41-dot-fade" style={{ animationDelay: `${0.6 + i * 0.18}s` }}>
                  {b.value}%
                </text>
                {/* The silhouette IS the bar — colored rects masked to silhouette shape */}
                <g
                  mask={`url(#mask-${i})`}
                  className="t41-bar-rise"
                  style={{ transformOrigin: `${cx}px ${baseline}px`, animationDelay: `${i * 0.18}s` }}
                >
                  <rect x={silX} y={silY} width={silW} height={silH} fill={b.color} />
                </g>
                {/* X tick */}
                <line x1={cx} y1={baseline} x2={cx} y2={baseline + 6} stroke={INK} strokeWidth="1.5" />
                {/* Logo below baseline */}
                {b.logo ? (
                  <image href={b.logo} x={cx - 30} y={baseline + 16} width={60} height={60} />
                ) : (
                  <foreignObject x={cx - 30} y={baseline + 16} width={60} height={60}>
                    <NcaaBadge color={b.color} />
                  </foreignObject>
                )}
                {/* League name below logo */}
                <text x={cx} y={baseline + 96} textAnchor="middle" fontSize="17" fontWeight="800" fill={INK}>
                  {b.name}
                </text>
                {/* Year era below name */}
                <text x={cx} y={baseline + 116} textAnchor="middle" fontSize="13" fontWeight="500" fill={MUTED}>
                  {b.era}
                </text>
              </g>
            )
          })}
        </g>

        {/* Single source line centered under the middle bar, below the labels */}
        <foreignObject
          x={margin.left + colW + 12}
          y={margin.top + baseline + 142}
          width={colW - 24}
          height={120}
        >
          <div style={{ textAlign: 'center', fontSize: '0.85rem', color: MUTED, lineHeight: 1.5 }}>
            <span style={{ fontWeight: 700, color: INK }}>Source: </span>
            arXiv 2412.08840 (Cordova et al. 2024). Methodology applied to WNBA.
          </div>
        </foreignObject>
      </svg>
    </figure>
  )
}

// =============================================================
// 4. LEAGUE COMPARISON — COVER variant
// 16:7 layout, no title or source. Used as the GIF cover thumbnail on /research.
// =============================================================
export function LeagueComparisonCover() {
  const W = 1280, H = 560  // 16:7
  const margin = { top: 80, right: 60, bottom: 110, left: 110 }
  const iW = W - margin.left - margin.right
  const iH = H - margin.top - margin.bottom
  const maxV = 80
  const valueH = 56
  const plotTop = valueH
  const baseline = iH
  const plotH = baseline - plotTop
  const yScale = (v: number) => baseline - (v / maxV) * plotH
  const colW = iW / LEAGUE_BARS.length
  const yTicks = [0, 20, 40, 60, 80]

  const silAspect: Record<string, number> = {
    "D1 Women's CBB": 0.32,
    'WNBA': 0.40,
    'NBA': 0.41,
  }
  const maxSilW = colW * 0.45

  const [ref, tick] = useReanimateOnView<HTMLElement>()
  return (
    <figure ref={ref} className="t41-chart" style={{ margin: 0 }}>
      <svg key={tick} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" className="t41-chart__svg" style={{ background: '#ffffff' }}>
        <defs>
          {LEAGUE_BARS.map((b, i) => {
            const cx = colW * i + colW / 2
            const silH = (b.value / maxV) * plotH
            const silW = Math.min(silH * silAspect[b.name], maxSilW)
            const silX = cx - silW / 2
            const silY = baseline - silH
            return (
              <mask key={b.name} id={`cmask-${i}`} maskUnits="userSpaceOnUse">
                <rect x={silX} y={silY} width={silW} height={silH} fill="black" />
                <image href={b.silhouette} x={silX} y={silY} width={silW} height={silH} preserveAspectRatio="none" />
              </mask>
            )
          })}
        </defs>

        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Y axis grid + labels */}
          {yTicks.map(v => (
            <g key={v}>
              <line x1={0} y1={yScale(v)} x2={iW} y2={yScale(v)} stroke={BORDER} strokeWidth="1" strokeDasharray="4 4" />
              <text x={-14} y={yScale(v) + 5} textAnchor="end" fontSize="15" fontWeight="600" fill={INK}>{v}%</text>
            </g>
          ))}
          {/* Y axis line */}
          <line x1={0} y1={plotTop} x2={0} y2={baseline} stroke={INK} strokeWidth="1.5" />
          {/* Y axis title */}
          <text x={-72} y={plotTop + plotH / 2} textAnchor="middle" transform={`rotate(-90, -72, ${plotTop + plotH / 2})`} fontSize="14" fontWeight="700" fill={INK}>
            2-for-1 Attempt Rate
          </text>
          {/* Baseline */}
          <line x1={0} y1={baseline} x2={iW} y2={baseline} stroke={INK} strokeWidth="1.5" />

          {LEAGUE_BARS.map((b, i) => {
            const cx = colW * i + colW / 2
            const silH = (b.value / maxV) * plotH
            const silW = Math.min(silH * silAspect[b.name], maxSilW)
            const silX = cx - silW / 2
            const silY = baseline - silH
            return (
              <g key={b.name}>
                <text x={cx} y={silY - 14} textAnchor="middle" fontSize="40" fontWeight="900" fill={b.color}
                  className="t41-dot-fade" style={{ animationDelay: `${0.6 + i * 0.18}s` }}>
                  {b.value}%
                </text>
                <g
                  mask={`url(#cmask-${i})`}
                  className="t41-bar-rise"
                  style={{ transformOrigin: `${cx}px ${baseline}px`, animationDelay: `${i * 0.18}s` }}
                >
                  <rect x={silX} y={silY} width={silW} height={silH} fill={b.color} />
                </g>
                {b.logo && (
                  <image href={b.logo} x={cx - 26} y={baseline + 14} width={52} height={52} />
                )}
                <text x={cx} y={baseline + 84} textAnchor="middle" fontSize="16" fontWeight="800" fill={INK}>
                  {b.name}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </figure>
  )
}

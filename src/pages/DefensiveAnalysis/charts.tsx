import { memo, useRef, useState, useEffect } from 'react'
import type { BarItem, StackedItem, CourtZone } from './data'

/* ==========================================================================
   useInView — fires once when element scrolls into view
   ========================================================================== */

export function useInView(threshold = 0.18) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const trigger = () => setInView(true)

    // If the chart is already in viewport on mount, play the animation
    // shortly after mount. Otherwise wait for it to scroll in via the
    // IntersectionObserver.
    const r = el.getBoundingClientRect()
    if (r.top < window.innerHeight && r.bottom > 0) {
      const t = window.setTimeout(trigger, 200)
      return () => window.clearTimeout(t)
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trigger()
          obs.disconnect()
        }
      },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, inView }
}

/* ==========================================================================
   VerticalBarChart — PPP / Paint Touch % by Action Count
   ========================================================================== */

function VerticalBarChartInner({
  title,
  data,
  avg,
  avgLabel,
  unit = '',
  maxValue,
}: {
  title: string
  data: BarItem[]
  avg: number
  avgLabel: string
  unit?: string
  maxValue?: number
}) {
  const { ref, inView } = useInView()
  const max = maxValue ?? Math.max(...data.map((d) => d.value)) * 1.2
  // The bar area in CSS — keep in sync with .da-vchart__body --bar-area
  const BAR_AREA_PX = 220

  return (
    <div ref={ref} className="da-vchart">
      <div className="da-vchart__title">{title}</div>
      <div className="da-vchart__body">
        {/* Average line — PDF style: label above the dashed line on the left */}
        <div
          className={`da-vchart__avg ${inView ? 'visible' : ''}`}
          style={{ bottom: `calc(64px + ${(avg / max) * BAR_AREA_PX}px)` }}
        >
          <span className="da-vchart__avg-label">{avgLabel}</span>
          <span className="da-vchart__avg-line" />
        </div>

        {/* Bars */}
        {data.map((item, i) => {
          const targetPx = (item.value / max) * BAR_AREA_PX
          return (
            <div key={item.label} className="da-vchart__col">
              <span
                className={`da-vchart__val ${inView ? 'visible' : ''}`}
                style={{ transitionDelay: `${i * 100 + 700}ms` }}
              >
                {item.value}
                {unit}
              </span>
              <div className="da-vchart__bar-wrap">
                <div
                  className={`da-vchart__bar ${item.lowSample ? 'low' : ''}`}
                  style={{
                    height: `${targetPx}px`,
                    transform: inView ? 'scaleY(1)' : 'scaleY(0)',
                    transitionDelay: `${i * 100}ms`,
                  }}
                />
              </div>
              <span className="da-vchart__label">{item.label}</span>
              <span className="da-vchart__poss">({item.poss} Poss.)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const VerticalBarChart = memo(VerticalBarChartInner)

/* ==========================================================================
   HorizontalBarChart — sorted horizontal bars with average line
   ========================================================================== */

function HorizontalBarChartInner({
  title,
  data,
  avg,
  avgLabel,
  unit = '',
  maxValue,
}: {
  title: string
  data: BarItem[]
  avg: number
  avgLabel: string
  unit?: string
  maxValue?: number
}) {
  const { ref, inView } = useInView()
  const max = maxValue ?? Math.max(...data.map((d) => d.value)) * 1.15

  return (
    <div ref={ref} className="da-hchart">
      <div className="da-hchart__header">
        <span className="da-hchart__title">{title}</span>
      </div>

      <div className="da-hchart__rows">
        {/* Average vertical dashed line — bar area only */}
        <div
          className={`da-hchart__avg-line ${inView ? 'visible' : ''}`}
          style={{ left: `${(avg / max) * 100}%` }}
        />
        {/* AVG label floats at top, aligned to the dashed line */}
        <span
          className="da-hchart__avg-note"
          style={{ left: `${(avg / max) * 100}%` }}
        >
          {avgLabel}
        </span>

        {data.map((item, i) => {
          const pct = (item.value / max) * 100
          return (
            <div key={item.label} className="da-hchart__row">
              <div className="da-hchart__label-col">
                <span className={`da-hchart__name ${item.lowSample ? 'low' : ''}`}>
                  {item.label}
                </span>
                <span className="da-hchart__poss">({item.poss} Poss.)</span>
              </div>
              <div className="da-hchart__bar-col">
                <div
                  className={`da-hchart__bar ${item.lowSample ? 'low' : ''}`}
                  style={{
                    width: `${pct}%`,
                    transform: inView ? 'scaleX(1)' : 'scaleX(0)',
                    transitionDelay: `${i * 50}ms`,
                  }}
                />
              </div>
              <span
                className={`da-hchart__val ${inView ? 'visible' : ''}`}
                style={{ transitionDelay: `${i * 50 + 600}ms` }}
              >
                {item.value}
                {unit}
              </span>
            </div>
          )
        })}
      </div>

      <div className="da-hchart__legend">
        <span className="da-hchart__legend-item">
          <span className="da-hchart__legend-swatch" />
          Normal sample
        </span>
        <span className="da-hchart__legend-item">
          <span className="da-hchart__legend-swatch low" />
          Low sample (&lt;20 possessions)
        </span>
      </div>
    </div>
  )
}

export const HorizontalBarChart = memo(HorizontalBarChartInner)

/* ==========================================================================
   StackedBarChart — Contest Level by Action
   ========================================================================== */

const STACK_COLORS = {
  open: '#d4777b',
  light: '#841617',
  contested: '#a8a7a3',
  heavy: '#4a4a48',
}

const STACK_LABELS = [
  { key: 'open' as const, label: 'Open (4+ ft)' },
  { key: 'light' as const, label: 'Light / Late High-Hand' },
  { key: 'contested' as const, label: 'Contested / On-Time' },
  { key: 'heavy' as const, label: 'Heavy / Early High-Hand' },
]

function StackedBarChartInner({
  title,
  data,
  avgLabel,
}: {
  title: string
  data: StackedItem[]
  avgLabel: string
}) {
  const { ref, inView } = useInView()

  return (
    <div ref={ref} className="da-stacked">
      <div className="da-stacked__header">
        <span className="da-stacked__title">{title}</span>
      </div>
      <div className="da-stacked__avg-note">{avgLabel}</div>

      <div className="da-stacked__rows">
        {data.map((item, i) => (
          <div key={item.label} className="da-stacked__row">
            <div className="da-stacked__label-col">
              <span className="da-stacked__name">{item.label}</span>
              <span className="da-stacked__poss">({item.poss} Poss.)</span>
            </div>
            <div className="da-stacked__bar-col">
              {STACK_LABELS.map(({ key }) => {
                const val = item[key]
                return (
                  <div
                    key={key}
                    className="da-stacked__seg"
                    style={{
                      width: `${val}%`,
                      backgroundColor: STACK_COLORS[key],
                    }}
                  >
                    {val >= 12 && <span className="da-stacked__seg-val">{val}%</span>}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="da-stacked__legend">
        {STACK_LABELS.map(({ key, label }) => (
          <span key={key} className="da-stacked__legend-item">
            <span
              className="da-stacked__legend-swatch"
              style={{ backgroundColor: STACK_COLORS[key] }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export const StackedBarChart = memo(StackedBarChartInner)

/* ==========================================================================
   CourtDiagram — Opp PPP on Next Possession by OU Miss Zone
   ========================================================================== */

const ZONE_COLORS = [
  { max: 0.65, fill: '#2d6a4f', label: '≤ 0.65 (great)' },
  { max: 0.80, fill: '#52796f', label: '0.66–0.80 (good)' },
  { max: 1.00, fill: '#c77b40', label: '0.81–1.00 (avg)' },
  { max: 1.25, fill: '#9b2226', label: '1.01–1.25 (poor)' },
  { max: Infinity, fill: '#6b0f12', label: '> 1.25 (bad)' },
]

function zoneFill(ppp: number): string {
  for (const { max, fill } of ZONE_COLORS) {
    if (ppp <= max) return fill
  }
  return ZONE_COLORS[ZONE_COLORS.length - 1].fill
}

/* Badge dimensions per zone type */
function zoneBadge(id: string): { w: number; h: number } {
  if (id === 'rim') return { w: 100, h: 54 }
  if (id === 'paint') return { w: 140, h: 54 }
  if (id.startsWith('corner')) return { w: 60, h: 70 }
  if (id === 'long-mid') return { w: 140, h: 54 }
  if (id.startsWith('wing')) return { w: 80, h: 60 }
  if (id === 'top-3') return { w: 140, h: 54 }
  return { w: 110, h: 54 }
}

export function CourtDiagram({
  title,
  zones,
  liveBallPpp,
  liveBallPoss,
}: {
  title: string
  zones: CourtZone[]
  liveBallPpp: number
  liveBallPoss: number
}) {
  const { ref, inView } = useInView(0.12)

  return (
    <div ref={ref} className="da-court">
      <div className="da-court__title">{title}</div>
      <div className="da-court__wrap">
        <svg viewBox="0 0 500 460" className="da-court__svg">
          {/* Court background */}
          <rect x="0" y="0" width="500" height="460" fill="#1a1a1f" rx="4" />

          {/* Paint / lane */}
          <rect x="170" y="8" width="160" height="190" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />

          {/* Free throw line */}
          <line x1="170" y1="198" x2="330" y2="198" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />

          {/* Free throw circle */}
          <circle
            cx="250" cy="198" r="60"
            fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"
          />

          {/* Restricted area */}
          <path
            d="M 210 55 A 40 40 0 0 0 290 55"
            fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"
          />

          {/* Three-point line — corners + arc */}
          <line x1="30" y1="8" x2="30" y2="148" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
          <line x1="470" y1="8" x2="470" y2="148" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
          <path
            d="M 30 148 A 238 238 0 0 0 470 148"
            fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"
          />

          {/* Basket */}
          <rect x="238" y="38" width="24" height="2" fill="rgba(255,255,255,0.4)" rx="1" />
          <circle cx="250" cy="52" r="8" fill="none" stroke="#e65100" strokeWidth="2" />

          {/* Half-court line */}
          <line x1="0" y1="458" x2="500" y2="458" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

          {/* Sidelines */}
          <line x1="1" y1="8" x2="1" y2="458" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          <line x1="499" y1="8" x2="499" y2="458" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          <line x1="0" y1="8" x2="500" y2="8" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />

          {/* Zone badges */}
          {zones.map((z, i) => {
            const { w, h } = zoneBadge(z.id)
            const isCorner = z.id.startsWith('corner')
            return (
              <g key={z.id}>
                <rect
                  x={z.x - w / 2}
                  y={z.y - h / 2}
                  width={w}
                  height={h}
                  rx="6"
                  fill={zoneFill(z.value)}
                  opacity="0.92"
                  className={`da-court__zone-rect ${inView ? 'visible' : ''}`}
                  style={{ transitionDelay: `${i * 80}ms` }}
                />
                {isCorner ? (
                  /* Corner 3 badges — rotated text in narrow vertical rect */
                  <>
                    <text
                      x={z.x}
                      y={z.y - 20}
                      textAnchor="middle"
                      fill="white"
                      fontWeight="700"
                      fontSize="18"
                      className={`da-court__zone-text ${inView ? 'visible' : ''}`}
                      style={{ transitionDelay: `${i * 80 + 200}ms` }}
                    >
                      {z.value.toFixed(2)}
                    </text>
                    <text
                      x={z.x}
                      y={z.y + 2}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.7)"
                      fontSize="8"
                      fontWeight="600"
                      letterSpacing="0.05em"
                      className={`da-court__zone-text ${inView ? 'visible' : ''}`}
                      style={{ transitionDelay: `${i * 80 + 300}ms` }}
                    >
                      {z.label.toUpperCase()}
                    </text>
                    <text
                      x={z.x}
                      y={z.y + 18}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.5)"
                      fontSize="9"
                      className={`da-court__zone-text ${inView ? 'visible' : ''}`}
                      style={{ transitionDelay: `${i * 80 + 400}ms` }}
                    >
                      {z.poss} poss
                    </text>
                  </>
                ) : (
                  /* Standard horizontal badge */
                  <>
                    <text
                      x={z.x}
                      y={z.y - 8}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.7)"
                      fontSize="9"
                      fontWeight="600"
                      letterSpacing="0.05em"
                      className={`da-court__zone-text ${inView ? 'visible' : ''}`}
                      style={{ transitionDelay: `${i * 80 + 200}ms` }}
                    >
                      {z.label.toUpperCase()}
                    </text>
                    <text
                      x={z.x}
                      y={z.y + 12}
                      textAnchor="middle"
                      fill="white"
                      fontWeight="700"
                      fontSize="20"
                      className={`da-court__zone-text ${inView ? 'visible' : ''}`}
                      style={{ transitionDelay: `${i * 80 + 300}ms` }}
                    >
                      {z.value.toFixed(2)}
                    </text>
                    {z.poss > 0 && (
                      <text
                        x={z.x}
                        y={z.y + 25}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.5)"
                        fontSize="10"
                        className={`da-court__zone-text ${inView ? 'visible' : ''}`}
                        style={{ transitionDelay: `${i * 80 + 400}ms` }}
                      >
                        {z.poss} poss
                      </text>
                    )}
                  </>
                )}
              </g>
            )
          })}
        </svg>

        {/* Live-ball turnover callout */}
        <div className={`da-court__callout ${inView ? 'visible' : ''}`}>
          <span className="da-court__callout-label">AFTER OU LIVE-BALL TURNOVER</span>
          <span className="da-court__callout-val">{liveBallPpp} PPP</span>
          <span className="da-court__callout-poss">{liveBallPoss} possessions</span>
        </div>
      </div>

      {/* Color scale legend */}
      <div className="da-court__legend">
        {ZONE_COLORS.map(({ fill, label }) => (
          <span key={label} className="da-court__legend-item">
            <span className="da-court__legend-swatch" style={{ backgroundColor: fill }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ==========================================================================
   Callout — left-border pull-quote for key findings
   ========================================================================== */

export function Callout({ children }: { children: React.ReactNode }) {
  return <div className="da-callout">{children}</div>
}

/* ==========================================================================
   StatCard — hero stat (811 possessions, 15 opponents, etc.)
   ========================================================================== */

export function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="da-stat">
      <span className="da-stat__value">{value}</span>
      <span className="da-stat__label">{label}</span>
    </div>
  )
}

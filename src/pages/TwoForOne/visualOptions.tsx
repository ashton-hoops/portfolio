// Ten visual concepts for "NBA grew, WBB stayed flat". Built as a showcase.

const INK = '#111111'
const MUTED = '#5c6370'
const BORDER = '#d7d9df'
const PANEL = '#f7f7f9'
const NBA = '#C9082A'
const NCAA = '#003478'

const NBA_LOGO = 'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png'

function NcaaBadge({ size = 48, color = NCAA }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="44" height="44" rx="8" fill={color} />
      <text x="24" y="29" textAnchor="middle" fontSize="11" fontWeight="800"
        fontFamily="system-ui, sans-serif" letterSpacing="0.5" fill="#ffffff">NCAA</text>
    </svg>
  )
}

// 1. SLOPE CHART
export function SlopeChart() {
  const W = 800, H = 360
  const m = { t: 70, r: 130, b: 60, l: 130 }
  const iW = W - m.l - m.r, iH = H - m.t - m.b
  const y = (v: number) => iH - ((v - 25) / (50) * iH)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="t41v">
      <text x={m.l} y={28} fontSize="14" fontWeight="700" fill={INK}>1. Slope chart</text>
      <g transform={`translate(${m.l},${m.t})`}>
        {[25, 40, 55, 70].map(v => (
          <g key={v}>
            <line x1={0} y1={y(v)} x2={iW} y2={y(v)} stroke={BORDER} strokeWidth="0.5" strokeDasharray="3 3" />
            <text x={-10} y={y(v) + 4} textAnchor="end" fontSize="10" fill={MUTED}>{v}%</text>
          </g>
        ))}
        <line x1={0} y1={y(38)} x2={iW} y2={y(67)} stroke={NBA} strokeWidth="3" className="t41-line-draw" />
        <line x1={0} y1={y(35)} x2={iW} y2={y(35)} stroke={NCAA} strokeWidth="3" className="t41-line-draw" style={{ animationDelay: '0.2s' }} />
        <circle cx={0} cy={y(38)} r="6" fill={NBA} />
        <circle cx={iW} cy={y(67)} r="6" fill={NBA} />
        <circle cx={0} cy={y(35)} r="6" fill={NCAA} />
        <circle cx={iW} cy={y(35)} r="6" fill={NCAA} />
        <image href={NBA_LOGO} x={iW + 15} y={y(67) - 16} width={32} height={32} />
        <foreignObject x={iW + 15} y={y(35) - 16} width={32} height={32}><NcaaBadge size={32} /></foreignObject>
        <text x={-14} y={y(38) - 8} textAnchor="end" fontSize="11" fontWeight="700" fill={NBA}>NBA 38%</text>
        <text x={iW + 52} y={y(67) + 4} fontSize="13" fontWeight="700" fill={NBA}>67%</text>
        <text x={-14} y={y(35) + 4} textAnchor="end" fontSize="11" fontWeight="700" fill={NCAA}>WBB 35%</text>
        <text x={iW + 52} y={y(35) + 4} fontSize="13" fontWeight="700" fill={NCAA}>35%</text>
        <text x={0} y={iH + 30} fontSize="10" fill={MUTED}>2007-2018 era</text>
        <text x={iW} y={iH + 30} textAnchor="end" fontSize="10" fill={MUTED}>2018+</text>
      </g>
    </svg>
  )
}

// 2. DUMBBELL CHART
export function DumbbellChart() {
  const W = 800, H = 300
  const m = { t: 70, r: 50, b: 50, l: 220 }
  const iW = W - m.l - m.r, iH = H - m.t - m.b
  const x = (v: number) => (v / 80) * iW
  const rows = [
    { name: 'NBA', logo: 'img', color: NBA, then: 38, now: 67 },
    { name: "D1 Women's CBB", logo: 'svg', color: NCAA, then: 35, now: 35 },
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="t41v">
      <text x={m.l} y={28} fontSize="14" fontWeight="700" fill={INK}>2. Dumbbell chart</text>
      <g transform={`translate(${m.l},${m.t})`}>
        {[0, 20, 40, 60, 80].map(v => (
          <g key={v}>
            <line x1={x(v)} y1={0} x2={x(v)} y2={iH} stroke={BORDER} strokeWidth="0.5" strokeDasharray="3 3" />
            <text x={x(v)} y={iH + 18} textAnchor="middle" fontSize="10" fill={MUTED}>{v}%</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = iH * (i + 0.5) / rows.length
          return (
            <g key={r.name}>
              <foreignObject x={-200} y={y - 24} width={190} height={48}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: '100%' }}>
                  {r.logo === 'img' ? <img src={NBA_LOGO} alt="" width={42} height={42} /> : <NcaaBadge size={42} />}
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: INK }}>{r.name}</div>
                </div>
              </foreignObject>
              <line x1={x(r.then)} y1={y} x2={x(r.now)} y2={y} stroke={r.color} strokeWidth="4" />
              <circle cx={x(r.then)} cy={y} r="9" fill="#fff" stroke={r.color} strokeWidth="3" />
              <circle cx={x(r.now)} cy={y} r="9" fill={r.color} />
              <text x={x(r.then)} y={y - 16} textAnchor="middle" fontSize="10" fill={MUTED}>then {r.then}%</text>
              <text x={x(r.now)} y={y - 16} textAnchor="middle" fontSize="11" fontWeight="700" fill={r.color}>now {r.now}%</text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

// 3. BAR WITH REFERENCE LINE
export function BarRefLine() {
  const W = 800, H = 300
  const m = { t: 70, r: 80, b: 30, l: 220 }
  const iW = W - m.l - m.r, iH = H - m.t - m.b
  const rows = [
    { name: 'NBA', color: NBA, now: 67, then: 38, logo: 'img' },
    { name: "D1 Women's CBB", color: NCAA, now: 35, then: 35, logo: 'svg' },
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="t41v">
      <text x={m.l} y={28} fontSize="14" fontWeight="700" fill={INK}>3. Bar with reference line</text>
      <g transform={`translate(${m.l},${m.t})`}>
        {rows.map((r, i) => {
          const yc = iH * (i + 0.5) / rows.length
          const barH = 48
          const x = (v: number) => (v / 80) * iW
          return (
            <g key={r.name}>
              <foreignObject x={-200} y={yc - 24} width={190} height={48}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: '100%' }}>
                  {r.logo === 'img' ? <img src={NBA_LOGO} alt="" width={42} height={42} /> : <NcaaBadge size={42} />}
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: INK }}>{r.name}</div>
                </div>
              </foreignObject>
              <rect x={0} y={yc - barH/2} width={iW} height={barH} fill={PANEL} rx={4} />
              <rect x={0} y={yc - barH/2} width={x(r.now)} height={barH} fill={r.color} rx={4}
                className="t41-bar-grow" style={{ transformOrigin: '0 50%', animationDelay: `${i * 0.15}s` }} />
              {r.then !== r.now && (
                <g>
                  <line x1={x(r.then)} y1={yc - barH/2 - 6} x2={x(r.then)} y2={yc + barH/2 + 6} stroke={INK} strokeWidth="1.5" strokeDasharray="4 3" />
                  <text x={x(r.then)} y={yc - barH/2 - 10} textAnchor="middle" fontSize="9" fill={MUTED}>{r.then}% prior</text>
                </g>
              )}
              <text x={x(r.now) + 12} y={yc + 6} fontSize="20" fontWeight="700" fill={r.color}>{r.now}%</text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

// 4. STEP CHART
export function StepChart() {
  const W = 800, H = 320
  const m = { t: 70, r: 130, b: 60, l: 60 }
  const iW = W - m.l - m.r, iH = H - m.t - m.b
  const x = (v: number) => v * (iW / 2)
  const y = (v: number) => iH - ((v - 25) / 50 * iH)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="t41v">
      <text x={m.l} y={28} fontSize="14" fontWeight="700" fill={INK}>4. Step chart with growth annotation</text>
      <g transform={`translate(${m.l},${m.t})`}>
        {[25, 40, 55, 70].map(v => (
          <g key={v}>
            <line x1={0} y1={y(v)} x2={iW} y2={y(v)} stroke={BORDER} strokeWidth="0.5" strokeDasharray="3 3" />
            <text x={-10} y={y(v) + 4} textAnchor="end" fontSize="10" fill={MUTED}>{v}%</text>
          </g>
        ))}
        <path d={`M${x(0)},${y(38)} L${x(1)},${y(38)} L${x(1)},${y(67)} L${x(2)},${y(67)}`} stroke={NBA} strokeWidth="3" fill="none" className="t41-line-draw" />
        <path d={`M${x(0)},${y(35)} L${x(2)},${y(35)}`} stroke={NCAA} strokeWidth="3" fill="none" className="t41-line-draw" style={{ animationDelay: '0.2s' }} />
        <image href={NBA_LOGO} x={x(2) + 12} y={y(67) - 16} width={32} height={32} />
        <foreignObject x={x(2) + 12} y={y(35) - 16} width={32} height={32}><NcaaBadge size={32} /></foreignObject>
        <text x={x(2) + 48} y={y(67) + 5} fontSize="13" fontWeight="700" fill={NBA}>NBA 67% (+29)</text>
        <text x={x(2) + 48} y={y(35) + 5} fontSize="13" fontWeight="700" fill={NCAA}>WBB 35% (+0)</text>
        <text x={x(0)} y={iH + 25} textAnchor="middle" fontSize="10" fill={MUTED}>2007-2018</text>
        <text x={x(1)} y={iH + 25} textAnchor="middle" fontSize="10" fill={MUTED}>2018</text>
        <text x={x(2)} y={iH + 25} textAnchor="middle" fontSize="10" fill={MUTED}>2022+</text>
      </g>
    </svg>
  )
}

// 5. GROWTH ARROW INFOGRAPHIC
export function GrowthArrow() {
  const W = 800, H = 280
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="t41v">
      <text x={40} y={28} fontSize="14" fontWeight="700" fill={INK}>5. Growth arrow infographic</text>
      <g transform="translate(40,60)">
        <image href={NBA_LOGO} x={0} y={20} width={80} height={80} />
        <text x={110} y={50} fontSize="36" fontWeight="800" fill={NBA}>67%</text>
        <path d="M250,60 L330,60 L330,40 L380,70 L330,100 L330,80 L250,80 Z" fill={NBA} className="t41-bar-grow" style={{ transformOrigin: 'left center' }}/>
        <text x={400} y={75} fontSize="22" fontWeight="700" fill={NBA}>+29 pts</text>
      </g>
      <g transform="translate(40,170)">
        <foreignObject x={0} y={20} width={80} height={80}><NcaaBadge size={80} /></foreignObject>
        <text x={110} y={50} fontSize="36" fontWeight="800" fill={NCAA}>35%</text>
        <line x1={250} y1={60} x2={380} y2={60} stroke={NCAA} strokeWidth="6" className="t41-bar-grow" style={{ transformOrigin: 'left center' }}/>
        <text x={400} y={66} fontSize="22" fontWeight="700" fill={NCAA}>no change</text>
      </g>
    </svg>
  )
}

// 6. STAT PANELS WITH DELTA CHIP
export function StatPanels() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <img src={NBA_LOGO} width={36} height={36} alt="" />
          <div style={{ fontWeight: 700, fontSize: '1rem', color: INK }}>NBA</div>
        </div>
        <div style={{ fontSize: '3.6rem', fontWeight: 800, color: INK, lineHeight: 1 }}>67%</div>
        <div style={{ display: 'inline-block', marginTop: 12, padding: '4px 10px', borderRadius: 999, background: NBA, color: '#fff', fontSize: 11, fontWeight: 700 }}>
          +29 pts since 2007-18
        </div>
      </div>
      <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <NcaaBadge size={36} />
          <div style={{ fontWeight: 700, fontSize: '1rem', color: INK }}>D1 Women's CBB</div>
        </div>
        <div style={{ fontSize: '3.6rem', fontWeight: 800, color: INK, lineHeight: 1 }}>35%</div>
        <div style={{ display: 'inline-block', marginTop: 12, padding: '4px 10px', borderRadius: 999, background: NCAA, color: '#fff', fontSize: 11, fontWeight: 700 }}>
          0 pts. flat eight seasons
        </div>
      </div>
    </div>
  )
}

// 7. HALF-DOUGHNUT GAUGES
export function HalfGauges() {
  const arc = (pct: number, color: string) => {
    const r = 100, cx = 110, cy = 110
    const angle = Math.PI * (pct / 100)
    const ex = cx - r * Math.cos(angle)
    const ey = cy - r * Math.sin(angle)
    const large = angle > Math.PI / 2 ? 1 : 0
    return (
      <g>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={BORDER} strokeWidth="18" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`} fill="none" stroke={color} strokeWidth="18" strokeLinecap="round" />
      </g>
    )
  }
  return (
    <svg viewBox="0 0 800 280" className="t41v">
      <text x={40} y={28} fontSize="14" fontWeight="700" fill={INK}>7. Half-doughnut gauges</text>
      <g transform="translate(80,60)">
        {arc(67, NBA)}
        <image href={NBA_LOGO} x={70} y={50} width={80} height={50} preserveAspectRatio="xMidYMid meet" />
        <text x={110} y={140} textAnchor="middle" fontSize="32" fontWeight="800" fill={INK}>67%</text>
        <text x={110} y={160} textAnchor="middle" fontSize="11" fill={MUTED}>NBA</text>
      </g>
      <g transform="translate(440,60)">
        {arc(35, NCAA)}
        <foreignObject x={70} y={50} width={80} height={50}><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%'}}><NcaaBadge size={40} /></div></foreignObject>
        <text x={110} y={140} textAnchor="middle" fontSize="32" fontWeight="800" fill={INK}>35%</text>
        <text x={110} y={160} textAnchor="middle" fontSize="11" fill={MUTED}>D1 Women's CBB</text>
      </g>
    </svg>
  )
}

// 8. RACE TRACK
export function RaceTrack() {
  const W = 800, H = 260
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="t41v">
      <text x={40} y={28} fontSize="14" fontWeight="700" fill={INK}>8. Race track</text>
      <g transform="translate(40,80)">
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={v / 100 * 720} y1={-10} x2={v / 100 * 720} y2={120} stroke={BORDER} strokeWidth="0.5" strokeDasharray="3 3" />
            <text x={v / 100 * 720} y={140} textAnchor="middle" fontSize="10" fill={MUTED}>{v}%</text>
          </g>
        ))}
        <rect x={0} y={0} width={720} height={50} fill={PANEL} rx={25} />
        <rect x={0} y={55} width={720} height={50} fill={PANEL} rx={25} />
        <image href={NBA_LOGO} x={67 / 100 * 720 - 25} y={0} width={50} height={50} />
        <foreignObject x={35 / 100 * 720 - 25} y={55} width={50} height={50}><NcaaBadge size={50} /></foreignObject>
        <text x={67 / 100 * 720 + 32} y={28} fontSize="18" fontWeight="700" fill={NBA}>67%</text>
        <text x={35 / 100 * 720 + 32} y={83} fontSize="18" fontWeight="700" fill={NCAA}>35%</text>
      </g>
    </svg>
  )
}

// 9. ARROW WITH START/END LABELS
export function StartEndArrow() {
  const W = 800, H = 280
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="t41v">
      <text x={40} y={28} fontSize="14" fontWeight="700" fill={INK}>9. Start/end arrows</text>
      <g transform="translate(60,70)">
        <image href={NBA_LOGO} x={0} y={0} width={48} height={48} />
        <text x={56} y={20} fontSize="12" fontWeight="600" fill={INK}>NBA</text>
        <text x={56} y={36} fontSize="10" fill={MUTED}>2007-2018 → 2018-2022</text>
        <g transform="translate(220,12)">
          <text x={0} y={16} fontSize="11" fill={MUTED}>38%</text>
          <path d="M30,12 L420,12 L420,4 L450,14 L420,24 L420,16 L30,16 Z" fill={NBA} className="t41-bar-grow" style={{ transformOrigin: 'left center' }}/>
          <text x={460} y={18} fontSize="20" fontWeight="700" fill={NBA}>67%</text>
        </g>
      </g>
      <g transform="translate(60,170)">
        <foreignObject x={0} y={0} width={48} height={48}><NcaaBadge size={48} /></foreignObject>
        <text x={56} y={20} fontSize="12" fontWeight="600" fill={INK}>D1 Women's CBB</text>
        <text x={56} y={36} fontSize="10" fill={MUTED}>2018-19 → 2025-26</text>
        <g transform="translate(220,12)">
          <text x={0} y={16} fontSize="11" fill={MUTED}>35%</text>
          <circle cx={245} cy={12} r="14" fill={NCAA} />
          <text x={295} y={18} fontSize="20" fontWeight="700" fill={NCAA}>35%</text>
        </g>
      </g>
    </svg>
  )
}

// 11. STOCK-STYLE CHART connecting each year
export function StockChart() {
  const W = 1000, H = 440
  const m = { t: 70, r: 110, b: 50, l: 70 }
  const iW = W - m.l - m.r, iH = H - m.t - m.b
  const NBA_DATA = [
    { yr: 2008, v: 36.8 }, { yr: 2009, v: 40.9 }, { yr: 2010, v: 40.1 },
    { yr: 2011, v: 39.9 }, { yr: 2012, v: 40.3 }, { yr: 2013, v: 40.4 },
    { yr: 2014, v: 42.0 }, { yr: 2015, v: 42.3 }, { yr: 2016, v: 42.3 },
    { yr: 2017, v: 43.2 }, { yr: 2018, v: 44.4 }, { yr: 2019, v: 42.0 },
    { yr: 2020, v: 43.3 }, { yr: 2021, v: 44.5 }, { yr: 2022, v: 44.9 },
    { yr: 2023, v: 46.8 }, { yr: 2024, v: 49.3 }, { yr: 2025, v: 47.0 },
  ]
  const WBB_DATA = [
    { yr: 2008, v: 28.4 }, { yr: 2009, v: 31.1 }, { yr: 2010, v: 32.0 },
    { yr: 2011, v: 34.6 }, { yr: 2012, v: 31.2 }, { yr: 2013, v: 31.9 },
    { yr: 2014, v: 36.0 }, { yr: 2015, v: 37.4 }, { yr: 2016, v: 37.3 },
    { yr: 2017, v: 40.2 }, { yr: 2018, v: 35.4 }, { yr: 2019, v: 34.5 },
    { yr: 2020, v: 34.3 }, { yr: 2021, v: 35.4 }, { yr: 2022, v: 35.0 },
    { yr: 2023, v: 35.2 }, { yr: 2024, v: 35.1 }, { yr: 2025, v: 35.5 },
  ]
  const x = (yr: number) => ((yr - 2008) / 17) * iW
  const y = (v: number) => iH - ((v - 25) / 30) * iH

  const linePath = (data: typeof NBA_DATA) =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(d.yr)},${y(d.v)}`).join(' ')

  const nbaLast = NBA_DATA[NBA_DATA.length - 1]
  const wbbLast = WBB_DATA[WBB_DATA.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="t41v">
      <text x={m.l} y={28} fontSize="14" fontWeight="700" fill={INK}>
        11. Stock chart, year-by-year
      </text>
      <text x={m.l} y={48} fontSize="11" fill={MUTED}>
        Season-by-season utilization rate, NBA vs D1 women's CBB
      </text>
      <g transform={`translate(${m.l},${m.t})`}>
        {/* Y axis grid + right-side labels */}
        {[25, 30, 35, 40, 45, 50].map(v => (
          <g key={v}>
            <line x1={0} y1={y(v)} x2={iW} y2={y(v)} stroke={BORDER} strokeWidth="0.5" strokeDasharray="3 3" />
            <text x={iW + 10} y={y(v) + 4} fontSize="10" fill={MUTED}>{v}%</text>
          </g>
        ))}

        {/* Lines */}
        <path d={linePath(NBA_DATA)} stroke={NBA} strokeWidth="2.5" fill="none" className="t41-line-draw" />
        <path d={linePath(WBB_DATA)} stroke={NCAA} strokeWidth="2.5" fill="none" className="t41-line-draw" style={{ animationDelay: '0.3s' }} />

        {/* Points */}
        {NBA_DATA.map((d, i) => (
          <circle key={d.yr} cx={x(d.yr)} cy={y(d.v)} r="3.5" fill={NBA}
            className="t41-dot-fade" style={{ animationDelay: `${1.8 + i * 0.04}s` }} />
        ))}
        {WBB_DATA.map((d, i) => (
          <circle key={d.yr} cx={x(d.yr)} cy={y(d.v)} r="3.5" fill={NCAA}
            className="t41-dot-fade" style={{ animationDelay: `${2.0 + i * 0.04}s` }} />
        ))}

        {/* Latest-value price tags */}
        <g transform={`translate(${x(nbaLast.yr)},${y(nbaLast.v)})`} className="t41-dot-fade" style={{ animationDelay: '2.8s' }}>
          <line x1={0} y1={0} x2={iW - x(nbaLast.yr) + 8} y2={0} stroke={NBA} strokeWidth="1" strokeDasharray="3 3" />
          <rect x={iW - x(nbaLast.yr) + 8} y={-12} width={56} height={24} fill={NBA} rx={3} />
          <text x={iW - x(nbaLast.yr) + 36} y={4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">{nbaLast.v}%</text>
        </g>
        <g transform={`translate(${x(wbbLast.yr)},${y(wbbLast.v)})`} className="t41-dot-fade" style={{ animationDelay: '3.0s' }}>
          <line x1={0} y1={0} x2={iW - x(wbbLast.yr) + 8} y2={0} stroke={NCAA} strokeWidth="1" strokeDasharray="3 3" />
          <rect x={iW - x(wbbLast.yr) + 8} y={-12} width={56} height={24} fill={NCAA} rx={3} />
          <text x={iW - x(wbbLast.yr) + 36} y={4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">{wbbLast.v}%</text>
        </g>

        {/* Logos near the start of each line */}
        <image href={NBA_LOGO} x={-58} y={y(NBA_DATA[0].v) - 16} width={32} height={32} />
        <foreignObject x={-58} y={y(WBB_DATA[0].v) - 16} width={32} height={32}><NcaaBadge size={32} /></foreignObject>

        {/* X axis with sparse ticks */}
        <line x1={0} y1={iH} x2={iW} y2={iH} stroke={BORDER} />
        {NBA_DATA.filter((_, i) => i % 2 === 0).map(d => (
          <g key={d.yr} transform={`translate(${x(d.yr)},${iH})`}>
            <line y1={0} y2={4} stroke={BORDER} />
            <text y={18} textAnchor="middle" fontSize="10" fill={MUTED}>'{d.yr.toString().slice(-2)}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}

// 10. VERTICAL LADDER
export function VerticalLadder() {
  const W = 600, H = 380
  const yScale = (v: number) => 60 + (1 - (v - 0) / 80) * 280
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="t41v">
      <text x={40} y={28} fontSize="14" fontWeight="700" fill={INK}>10. Vertical ladder</text>
      <g transform="translate(100,0)">
        {[0, 20, 40, 60, 80].map(v => (
          <g key={v}>
            <line x1={0} y1={yScale(v)} x2={400} y2={yScale(v)} stroke={BORDER} strokeWidth="0.5" strokeDasharray="3 3" />
            <text x={-10} y={yScale(v) + 4} textAnchor="end" fontSize="10" fill={MUTED}>{v}%</text>
          </g>
        ))}
        <line x1={130} y1={yScale(0)} x2={130} y2={yScale(67)} stroke={NBA} strokeWidth="3" strokeDasharray="4 4" />
        <image href={NBA_LOGO} x={100} y={yScale(67) - 30} width={60} height={60} />
        <text x={170} y={yScale(67) + 4} fontSize="18" fontWeight="700" fill={NBA}>NBA 67%</text>
        <line x1={290} y1={yScale(0)} x2={290} y2={yScale(35)} stroke={NCAA} strokeWidth="3" strokeDasharray="4 4" />
        <foreignObject x={260} y={yScale(35) - 30} width={60} height={60}><NcaaBadge size={60} /></foreignObject>
        <text x={330} y={yScale(35) + 4} fontSize="18" fontWeight="700" fill={NCAA}>WBB 35%</text>
      </g>
    </svg>
  )
}

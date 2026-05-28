import {
  SlopeChart, DumbbellChart, BarRefLine, StepChart, GrowthArrow,
  StatPanels, HalfGauges, RaceTrack, StartEndArrow, VerticalLadder,
  StockChart,
} from './visualOptions'
import './TwoForOne.css'

const items = [
  { id: 1, title: 'Slope chart', el: <SlopeChart /> },
  { id: 2, title: 'Dumbbell chart', el: <DumbbellChart /> },
  { id: 3, title: 'Bar with reference line', el: <BarRefLine /> },
  { id: 4, title: 'Step chart with growth annotation', el: <StepChart /> },
  { id: 5, title: 'Growth arrow infographic', el: <GrowthArrow /> },
  { id: 6, title: 'Stat panels with delta chip', el: <StatPanels /> },
  { id: 7, title: 'Half-doughnut gauges', el: <HalfGauges /> },
  { id: 8, title: 'Race track', el: <RaceTrack /> },
  { id: 9, title: 'Start/end arrows', el: <StartEndArrow /> },
  { id: 10, title: 'Vertical ladder', el: <VerticalLadder /> },
  { id: 11, title: 'Stock chart, year-by-year', el: <StockChart /> },
]

export default function Options() {
  return (
    <article className="t41" style={{ minHeight: '100vh' }}>
      <header className="t41__header">
        <div className="t41__header-inner">
          <h1 className="t41__title" style={{ fontSize: '2rem' }}>
            Utilization gap visual options
          </h1>
          <p className="t41__subtitle">
            Ten approaches to "NBA grew, WBB stayed flat". Pick one.
          </p>
        </div>
      </header>
      <div className="t41__body">
        <div className="t41__container" style={{ maxWidth: 980 }}>
          {items.map(item => (
            <section key={item.id} className="t41__section" style={{ borderBottom: '1px solid #d7d9df', paddingBottom: 32 }}>
              <h2 style={{ marginBottom: 8 }}>{item.id}. {item.title}</h2>
              <div style={{
                background: '#fff',
                border: '1px solid #d7d9df',
                borderRadius: 12,
                padding: 24,
                margin: '12px 0 32px',
                overflow: 'hidden',
              }}>
                {item.el}
              </div>
            </section>
          ))}
        </div>
      </div>
    </article>
  )
}

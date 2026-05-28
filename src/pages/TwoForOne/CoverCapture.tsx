import { LeagueComparisonCover } from './charts2'
import './TwoForOne.css'

// Headless capture target: just the cover chart, no surrounding chrome.
// A tall spacer above the chart so the IntersectionObserver fires only when
// the capture script scrolls to it — that guarantees the animation restarts
// the moment frame capture begins.
export default function CoverCapture() {
  return (
    <div style={{ background: '#ffffff' }}>
      <div style={{ height: '1200px' }} />
      <div
        id="cover-chart-wrap"
        style={{ background: '#ffffff', padding: 0, margin: 0, width: '1280px', height: '560px' }}
      >
        <LeagueComparisonCover />
      </div>
    </div>
  )
}

import { lazy, Suspense, useEffect, useState } from 'react'

const ThreeJsShotChartPrototype = lazy(() => import('../../threejs_shot_chart_prototype'))

interface ShotRaw {
  id: string
  x: number
  y: number
  made: boolean
  isOpp: boolean
  value: number
  player: string
  period: number
  clock: string
}

interface GameRaw {
  gameId: string
  opponent: string
  shots: ShotRaw[]
}

interface FeaturedData {
  games: GameRaw[]
}

/**
 * Embeds the actual Three.js shot chart engine on the defensive analysis page.
 * Defaults to top-down view, zones-mode coloring, showing OU's miss locations
 * so coaches can see where misses came from and orbit around the court.
 */
export default function MissZoneChart3D() {
  const [dataset, setDataset] = useState<FeaturedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Initial nonce of 1 fires the top-down view as soon as the engine mounts.
  const [topDownViewNonce, setTopDownViewNonce] = useState(1)
  const [resetViewNonce, setResetViewNonce] = useState(0)

  useEffect(() => {
    fetch('/data/featured-shots.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: FeaturedData) => setDataset(data))
      .catch((err) => setError(err.message))
  }, [])

  if (error) {
    return <div className="da-3d-loading">Failed to load shot data: {error}</div>
  }
  if (!dataset) {
    return <div className="da-3d-loading">Loading 3D shot chart...</div>
  }

  // Show all OU misses across the season — that's the miss-zone data the
  // article is analyzing. `isOpp: false` filters to OU shots, `made: false`
  // filters to misses.
  const shots = dataset.games
    .flatMap((g) => g.shots)
    .filter((s) => !s.isOpp && !s.made)
    .map((s, i) => ({
      id: s.id ?? `miss-${i}`,
      x: s.x,
      y: s.y,
      made: false,
      isOpponent: false,
      attemptValue: s.value,
      athleteName: s.player,
      period: s.period,
      clock: s.clock,
      points: 0,
    }))

  return (
    <div className="da-3d">
      <div className="da-3d__title">OPP PPP ON NEXT POSSESSION BY OU MISS ZONE</div>

      <div className="da-3d__controls">
        <button
          type="button"
          className="da-3d__btn"
          onClick={() => setTopDownViewNonce((n) => n + 1)}
        >
          Top-Down
        </button>
        <button
          type="button"
          className="da-3d__btn"
          onClick={() => setResetViewNonce((n) => n + 1)}
        >
          Reset View
        </button>
        <span className="da-3d__hint">drag to orbit · scroll to zoom</span>
      </div>

      <div className="da-3d__canvas">
        <Suspense fallback={<div className="da-3d-loading">Loading 3D scene...</div>}>
          <ThreeJsShotChartPrototype
            shots={shots}
            viewMode="zones"
            initialChartWidth={780}
            initialChartHeight={560}
            resetViewNonce={resetViewNonce}
            topDownViewNonce={topDownViewNonce}
          />
        </Suspense>
      </div>

      <div className="da-3d__zone-table">
        <div className="da-3d__zone-table-title">Opp PPP after the miss</div>
        <div className="da-3d__zone-grid">
          {[
            { label: 'At Rim', ppp: 0.66, poss: 82, tone: 'good' },
            { label: 'Paint + Short Mid', ppp: 0.61, poss: 137, tone: 'good' },
            { label: 'Long Midrange', ppp: 0.76, poss: 62, tone: 'good' },
            { label: 'Corner 3', ppp: 1.18, poss: 17, tone: 'bad' },
            { label: 'Wing 3', ppp: 1.22, poss: 55, tone: 'bad' },
            { label: 'Top of Key 3', ppp: 1.22, poss: 71, tone: 'bad' },
          ].map((z) => (
            <div key={z.label} className={`da-3d__zone-cell da-3d__zone-cell--${z.tone}`}>
              <span className="da-3d__zone-label">{z.label}</span>
              <span className="da-3d__zone-ppp">{z.ppp.toFixed(2)}</span>
              <span className="da-3d__zone-poss">{z.poss} poss</span>
            </div>
          ))}
          <div className="da-3d__zone-cell da-3d__zone-cell--turnover">
            <span className="da-3d__zone-label">After OU Live-Ball TO</span>
            <span className="da-3d__zone-ppp">1.21</span>
            <span className="da-3d__zone-poss">85 poss</span>
          </div>
        </div>
      </div>
    </div>
  )
}

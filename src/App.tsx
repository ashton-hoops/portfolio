import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useParams,
  useLocation,
} from 'react-router-dom'
import { Layout } from './components/Layout'
import PortfolioDeck from './pages/PortfolioDeck'
import { Research } from './pages/Research'
import { Article } from './pages/Article'
import { capturePageview } from './lib/analytics'

function ProjectRedirect() {
  const { slug } = useParams<{ slug: string }>()
  return <Navigate to={slug ? `/research/${slug}` : '/research'} replace />
}

// HashRouter navigation is a same-document hash change, so PostHog's automatic
// pageview capture never fires. Capture one manually whenever the route changes.
function RouteAnalytics() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    capturePageview(pathname + search)
  }, [pathname, search])
  return null
}
// After a new deploy, an already-open tab still points at the previous
// build's chunk filenames, so the first lazy import for a route rejects with
// a ChunkLoadError and renders blank until a manual reload. Catch that once
// and reload to pull fresh HTML + assets, so the route loads on first click.
function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const KEY = 'chunk-reload-once'
    try {
      const mod = await factory()
      window.sessionStorage.removeItem(KEY)
      return mod
    } catch (err) {
      if (!window.sessionStorage.getItem(KEY)) {
        window.sessionStorage.setItem(KEY, '1')
        window.location.reload()
        // Keep the Suspense fallback up until the reload takes over.
        return new Promise<{ default: T }>(() => {})
      }
      throw err
    }
  })
}

const ShotChartTool = lazyWithRetry(() => import('./pages/ShotChartTool'))
const DefensiveAnalysis = lazyWithRetry(() => import('./pages/DefensiveAnalysis'))
const TwoForOne = lazyWithRetry(() => import('./pages/TwoForOne'))
const TwoForOneOptions = lazyWithRetry(() => import('./pages/TwoForOne/Options'))
const TwoForOneCoverCapture = lazyWithRetry(() => import('./pages/TwoForOne/CoverCapture'))

const PDFPage06 = lazyWithRetry(() => import('./pages/PDFPage06'))
const PDFPreviewAll = lazyWithRetry(() => import('./pages/PDFPreviewAll'))

function App() {
  return (
    <HashRouter>
      <RouteAnalytics />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<PortfolioDeck />} />
          <Route path="projects" element={<Navigate to="/research" replace />} />
          <Route path="projects/:slug" element={<ProjectRedirect />} />
          <Route path="research" element={<Research />} />
          <Route
            path="research/defensive-analysis"
            element={
              <Suspense fallback={<div style={{ padding: 40, fontFamily: 'system-ui' }}>Loading…</div>}>
                <DefensiveAnalysis />
              </Suspense>
            }
          />
          <Route
            path="research/two-for-one"
            element={
              <Suspense fallback={<div style={{ padding: 40, fontFamily: 'system-ui' }}>Loading…</div>}>
                <TwoForOne />
              </Suspense>
            }
          />
          <Route
            path="research/two-for-one/options"
            element={
              <Suspense fallback={<div style={{ padding: 40, fontFamily: 'system-ui' }}>Loading…</div>}>
                <TwoForOneOptions />
              </Suspense>
            }
          />
          <Route
            path="research/two-for-one/cover-capture"
            element={
              <Suspense fallback={<div />}>
                <TwoForOneCoverCapture />
              </Suspense>
            }
          />
          <Route path="research/:slug" element={<Article />} />
          <Route
            path="shot-chart"
            element={
              <Suspense fallback={<div style={{ padding: 40, fontFamily: 'system-ui' }}>Loading…</div>}>
                <ShotChartTool />
              </Suspense>
            }
          />
          <Route path="playbook" element={<Navigate to="/shot-chart" replace />} />
        </Route>
        <Route
          path="/pdf/page-06"
          element={
            <Suspense fallback={<div style={{ padding: 40, fontFamily: 'system-ui' }}>Loading…</div>}>
              <PDFPage06 />
            </Suspense>
          }
        />
        <Route
          path="/pdf/all"
          element={
            <Suspense fallback={<div style={{ padding: 40, fontFamily: 'system-ui' }}>Loading…</div>}>
              <PDFPreviewAll />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App

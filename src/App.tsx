import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import PortfolioDeck from './pages/PortfolioDeck'
import { Projects } from './pages/Projects'
import { ProjectDetail } from './pages/ProjectDetail'
import { Research } from './pages/Research'
import { Article } from './pages/Article'
const ShotChartTool = lazy(() => import('./pages/ShotChartTool'))

const PDFPage06 = lazy(() => import('./pages/PDFPage06'))
const PDFPreviewAll = lazy(() => import('./pages/PDFPreviewAll'))

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<PortfolioDeck />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:slug" element={<ProjectDetail />} />
          <Route path="research" element={<Research />} />
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

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App'
import { trackVisit } from './lib/trackVisit'
import { initAnalytics } from './lib/analytics'

initAnalytics()
trackVisit()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

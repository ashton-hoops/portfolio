/**
 * PortfolioDeck — the 8-page portfolio rendered as the site's landing
 * page (`/`), inside the normal site Layout (Header above, Footer below).
 * Each tile is the same iframe-of-static-HTML pattern as PDFPreviewAll,
 * but without the floating PDF HUD — the site Header handles nav. On
 * mobile the entire tile is zoomed down to fit the viewport width.
 *
 * `/pdf/all` continues to render the standalone PDFPreviewAll variant
 * for printing / PDF export, with its own jump-nav HUD.
 */
import { useEffect } from 'react'
import './PortfolioDeck.css'

type Pg = {
  num: string
  label: string
  src: string
}

const PAGES: Pg[] = [
  { num: '01', label: 'Cover', src: '/pdf/cover.html' },
  { num: '02', label: 'Contents', src: '/pdf/page-02-toc.html' },
  { num: '03', label: 'About', src: '/pdf/page-03-approach.html' },
  { num: '04', label: 'Defense Dashboard', src: '/pdf/page-04-defense.html' },
  { num: '05', label: 'Computer Vision Pipeline', src: '/pdf/page-05-cv-pipeline.html' },
  { num: '06', label: 'Software Development', src: '/#/pdf/page-06' },
  { num: '07', label: 'Research & Writing', src: '/pdf/page-07-research.html' },
  { num: '08', label: "What I'd Bring", src: '/pdf/page-08-bring.html' },
]

export default function PortfolioDeck() {
  // Scale each tile so it reads comfortably. Width still hard-caps, but
  // we let the height-fit be a bit bigger than the viewport (×1.2) so a
  // single tile is intentionally slightly taller than the screen on desktop.
  // Coaches scroll through the deck rather than viewing one page at a time.
  useEffect(() => {
    const TILE_W = 920 // 880 paper + small breathing room
    const TILE_H = 1170 // 1120 paper + ~50 meta label and gap
    const update = () => {
      const stack = document.querySelector<HTMLElement>('.deck-stack')
      if (!stack) return
      const cs = getComputedStyle(document.documentElement)
      const headerH = parseFloat(cs.getPropertyValue('--header-height')) || 48
      const availW = window.innerWidth - 24
      const availH = window.innerHeight - headerH - 24
      const scale = Math.min(availW / TILE_W, (availH / TILE_H) * 1.2, 1)
      stack.style.setProperty('--deck-scale', String(scale))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Forward wheel events from inside each page iframe to the outer window
  // so cursor-over-iframe scrolling keeps moving the page stack. Wheel
  // events fired inside an iframe contentDocument don't bubble to the
  // parent window, so we manually re-emit scroll on the host page.
  // Deltas are batched per animation frame so a burst of trackpad ticks
  // doesn't jitter — each frame applies the accumulated delta as one
  // scrollBy, matching native scroll feel.
  useEffect(() => {
    const cleanups: Array<() => void> = []
    let pendingY = 0
    let pendingX = 0
    let rafId = 0
    const flush = () => {
      rafId = 0
      if (pendingY === 0 && pendingX === 0) return
      window.scrollBy({ top: pendingY, left: pendingX, behavior: 'auto' })
      pendingY = 0
      pendingX = 0
    }
    PAGES.forEach((_, idx) => {
      const section = document.getElementById(`deck-tile-${idx}`)
      const iframe = section?.querySelector('iframe') as HTMLIFrameElement | null
      if (!iframe) return
      const attach = () => {
        try {
          const doc = iframe.contentDocument
          if (!doc) return
          if ((doc as unknown as { __wheelBound?: boolean }).__wheelBound) return
          ;(doc as unknown as { __wheelBound: boolean }).__wheelBound = true
          const onWheel = (e: WheelEvent) => {
            const modal = doc.getElementById('pdfModal') as HTMLElement | null
            if (modal && !modal.hidden) return
            pendingY += e.deltaY
            pendingX += e.deltaX
            if (!rafId) rafId = requestAnimationFrame(flush)
          }
          doc.addEventListener('wheel', onWheel, { passive: true })
          cleanups.push(() => doc.removeEventListener('wheel', onWheel))
        } catch {
          /* cross-origin or not ready */
        }
      }
      iframe.addEventListener('load', attach)
      attach()
      cleanups.push(() => iframe.removeEventListener('load', attach))
    })
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      cleanups.forEach((fn) => fn())
    }
  }, [])

  return (
    <div className="deck-stack">
      {PAGES.map((p, idx) => (
        <section key={p.num} id={`deck-tile-${idx}`} className="deck-tile-frame">
          <div className="deck-tile">
            <div className="deck-tile-meta">
              <span className="deck-tile-num">{p.num}</span>
              <span className="deck-tile-label">{p.label}</span>
            </div>
            <div className="deck-paper">
              <iframe
                className="deck-iframe"
                title={`Page ${p.num} · ${p.label}`}
                src={p.src}
                scrolling="no"
              />
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}

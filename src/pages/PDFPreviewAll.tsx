/**
 * PDFPreviewAll — scroll-through preview of every portfolio page stacked
 * vertically. Each page renders inside its own 816×1056 iframe so the
 * actual production HTML is exactly what's shown (no separate "preview"
 * branch to drift). Page 6 points at the React route on /#/pdf/page-06
 * so the 3D shot chart still loads with full WebGL.
 */
import { useEffect, useState } from 'react'

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

export default function PDFPreviewAll() {
  // Track which page is currently visible for the floating page indicator.
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    PAGES.forEach((_, idx) => {
      const el = document.getElementById(`pdf-preview-page-${idx}`)
      if (!el) return
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
              setActiveIdx(idx)
            }
          })
        },
        { threshold: [0.4, 0.6, 0.8] }
      )
      io.observe(el)
      observers.push(io)
    })
    return () => observers.forEach((o) => o.disconnect())
  }, [])

  // Forward wheel events from inside each page iframe up to the outer
  // window so cursor-over-iframe scrolling keeps moving the page stack.
  // Without this, Safari swallows wheel events because the iframe body
  // has padding that creates a few px of internal overflow.
  useEffect(() => {
    const cleanups: Array<() => void> = []
    PAGES.forEach((_, idx) => {
      const section = document.getElementById(`pdf-preview-page-${idx}`)
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
            window.scrollBy({ top: e.deltaY, left: e.deltaX, behavior: 'auto' })
          }
          doc.addEventListener('wheel', onWheel, { passive: true })
          cleanups.push(() => doc.removeEventListener('wheel', onWheel))
        } catch { /* cross-origin or not ready */ }
      }
      iframe.addEventListener('load', attach)
      attach() // try immediately in case it's already loaded
      cleanups.push(() => iframe.removeEventListener('load', attach))
    })
    return () => cleanups.forEach((fn) => fn())
  }, [])

  const scrollTo = (idx: number) => {
    const el = document.getElementById(`pdf-preview-page-${idx}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div style={rootStyle}>
      {/* Floating page indicator + jump nav */}
      <div style={hudStyle}>
        <div style={hudInnerStyle}>
          <span style={hudLabelStyle}>Portfolio · 2026</span>
          <span style={hudCountStyle}>
            <strong style={hudCountNumStyle}>{PAGES[activeIdx].num}</strong>
            <span style={hudCountSepStyle}>/ {PAGES.length.toString().padStart(2, '0')}</span>
          </span>
          <span style={hudPageNameStyle}>{PAGES[activeIdx].label}</span>
        </div>
        <div style={hudDotsStyle}>
          {PAGES.map((p, i) => (
            <button
              key={p.num}
              type="button"
              onClick={() => scrollTo(i)}
              title={`${p.num} · ${p.label}`}
              aria-label={`Jump to page ${p.num}: ${p.label}`}
              style={{
                ...hudDotStyle,
                ...(i === activeIdx ? hudDotActiveStyle : null),
              }}
            />
          ))}
        </div>
      </div>

      {/* Stack of pages */}
      <div style={stackStyle}>
        {PAGES.map((p, idx) => (
          <section key={p.num} id={`pdf-preview-page-${idx}`} style={pageWrapStyle}>
            <div style={pageMetaStyle}>
              <span style={pageMetaNumStyle}>{p.num}</span>
              <span style={pageMetaLabelStyle}>{p.label}</span>
            </div>
            <div style={paperStyle}>
              <iframe
                title={`Page ${p.num} · ${p.label}`}
                src={p.src}
                scrolling="no"
                style={iframeStyle}
                allow="autoplay; fullscreen"
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

/* ----- styles ----- */

const rootStyle: React.CSSProperties = {
  background: '#ddd',
  minHeight: '100vh',
  fontFamily: "'Inter', system-ui, sans-serif",
  color: '#18171a',
  paddingTop: 64, // room for sticky HUD
}

const hudStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  background: 'rgba(24, 23, 26, 0.95)',
  backdropFilter: 'blur(8px)',
  color: '#fafaf6',
  padding: '12px 24px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 20,
  zIndex: 100,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
}

const hudInnerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 18,
}

const hudLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.22em',
  color: '#cfceca',
}

const hudCountStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 6,
  fontFamily: "'Source Serif 4', Georgia, serif",
}

const hudCountNumStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  color: '#fafaf6',
  letterSpacing: '-0.01em',
}

const hudCountSepStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#7a7976',
  fontWeight: 400,
}

const hudPageNameStyle: React.CSSProperties = {
  fontFamily: "'Source Serif 4', Georgia, serif",
  fontSize: 16,
  fontWeight: 500,
  color: '#fafaf6',
  letterSpacing: '-0.005em',
}

const hudDotsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const hudDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  border: 0,
  padding: 0,
  background: 'rgba(255,255,255,0.22)',
  cursor: 'pointer',
  transition: 'all 150ms ease',
}

const hudDotActiveStyle: React.CSSProperties = {
  background: '#6b1018',
  width: 22,
  borderRadius: 999,
}

const stackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 32,
  padding: '24px 20px 80px',
}

const pageWrapStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
  scrollMarginTop: 80,
}

const pageMetaStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 14,
  width: 880,
  paddingLeft: 4,
}

const pageMetaNumStyle: React.CSSProperties = {
  fontFamily: "'Source Serif 4', Georgia, serif",
  fontSize: 14,
  fontWeight: 600,
  color: '#6b1018',
  letterSpacing: '-0.005em',
}

const pageMetaLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.22em',
  color: '#4a4a48',
}

/* Each tile is a 880×1120 gray card (32px gray border on all sides)
   with the cream 816×1056 iframe sitting in the center. The gray frame
   lives on the WRAPPER, not inside the iframe, so each inner page can
   render flush at 816×1056 with no body padding / no clipping. */
const paperStyle: React.CSSProperties = {
  width: 880,
  height: 1120,
  background: '#ddd',
  boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
  padding: 32,
  boxSizing: 'border-box',
  overflow: 'hidden',
}

const iframeStyle: React.CSSProperties = {
  width: 816,
  height: 1056,
  border: 0,
  display: 'block',
  background: '#fafaf6',
}

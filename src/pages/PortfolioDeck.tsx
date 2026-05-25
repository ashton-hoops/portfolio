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

const MOBILE_BREAKPOINT = 768
const DECK_IFRAME_BASE_HEIGHT = 1056
const HEIGHT_SYNC_DELAYS = [50, 250, 750, 1500]
const MOBILE_IFRAME_STYLE_ID = '__deck-mobile-style'
const MOBILE_ORIGINAL_FONT_ATTR = 'data-deck-original-font-size'

const MOBILE_IFRAME_CSS = `
  html,
  body {
    height: auto !important;
    min-height: ${DECK_IFRAME_BASE_HEIGHT}px !important;
    overflow: visible !important;
  }

  .page,
  .pdf06-page {
    height: auto !important;
    min-height: ${DECK_IFRAME_BASE_HEIGHT}px !important;
    overflow: visible !important;
  }

  .top,
  .pdf06-top {
    display: none !important;
  }

  .page {
    padding-top: 34px !important;
  }

  .pdf06-page {
    padding-top: 24px !important;
  }

  .text-col {
    padding-top: 34px !important;
  }

  .masthead {
    margin-top: 0 !important;
    padding-top: 8px !important;
  }

  .pdf06-masthead {
    margin-top: 0 !important;
    padding-top: 4px !important;
  }

  .text-col .name-block {
    margin-top: 16px !important;
  }

  .pdf-modal-close {
    top: 8px !important;
    right: 8px !important;
    z-index: 2 !important;
    width: 34px !important;
    height: 34px !important;
    padding: 0 !important;
    border-radius: 999px !important;
    background: rgba(24, 23, 26, 0.72) !important;
    color: #fafaf6 !important;
  }
`

const MOBILE_TITLE_TEXT_SELECTOR = [
  '.title',
  '.name',
  '.role',
  '.stat-value',
  '.skill-name',
  '.ref-name',
  '.num',
  '.meta-v',
  '.pdf06-title',
].join(', ')

const MOBILE_BODY_TEXT_SELECTOR = [
  '.lede',
  '.deck',
  '.bio',
  '.row-value',
  '.block-body',
  '.findings-table td',
  '.caption',
  '.caption-meta',
  '.report-link-url',
  '.skill-body',
  '.ref-title',
  '.ref-contact-value',
  '.pdf06-lede',
  '.pdf06-stat-v',
  '.pdf06-zone-table td',
].join(', ')

function scaleIframeText(doc: Document, selector: string, factor: number) {
  const win = doc.defaultView
  if (!win) return

  doc.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    let original = el.getAttribute(MOBILE_ORIGINAL_FONT_ATTR)
    if (!original) {
      const size = parseFloat(win.getComputedStyle(el).fontSize)
      if (!Number.isFinite(size)) return
      original = String(size)
      el.setAttribute(MOBILE_ORIGINAL_FONT_ATTR, original)
    }

    const base = parseFloat(original)
    if (!Number.isFinite(base)) return
    el.style.setProperty('font-size', `${(base * factor).toFixed(2)}px`, 'important')
  })
}

function restoreIframeText(doc: Document) {
  doc
    .querySelectorAll<HTMLElement>(`[${MOBILE_ORIGINAL_FONT_ATTR}]`)
    .forEach((el) => {
      el.style.removeProperty('font-size')
      el.removeAttribute(MOBILE_ORIGINAL_FONT_ATTR)
    })
}

function getDeckScale() {
  const stack = document.querySelector<HTMLElement>('.deck-stack')
  if (!stack) return 1

  const scale = parseFloat(getComputedStyle(stack).getPropertyValue('--deck-scale'))
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

function getIframeContentHeight(doc: Document) {
  const page = doc.querySelector<HTMLElement>('.page, .pdf06-page')
  const pageRectHeight = page ? page.getBoundingClientRect().height : 0
  const pageHeight = page ? page.scrollHeight : 0
  const bodyHeight = doc.body?.scrollHeight ?? 0
  const documentHeight = doc.documentElement?.scrollHeight ?? 0

  return Math.max(
    DECK_IFRAME_BASE_HEIGHT,
    Math.ceil(pageRectHeight),
    Math.ceil(pageHeight),
    Math.ceil(bodyHeight),
    Math.ceil(documentHeight),
  )
}

function syncMobileIframeHeight(iframe: HTMLIFrameElement, enabled: boolean) {
  const paper = iframe.closest<HTMLElement>('.deck-paper')
  const frame = iframe.closest<HTMLElement>('.deck-tile-frame')

  if (!enabled) {
    iframe.style.removeProperty('height')
    paper?.style.removeProperty('height')
    frame?.style.removeProperty('height')
    return
  }

  const doc = iframe.contentDocument
  if (!doc?.body) return

  const contentHeight = getIframeContentHeight(doc)
  const scaledHeight = Math.ceil(contentHeight * getDeckScale())

  iframe.style.setProperty('height', `${contentHeight}px`)
  paper?.style.setProperty('height', `${contentHeight}px`)
  frame?.style.setProperty('height', `${scaledHeight}px`)
}

function syncMobileIframeStyle(
  doc: Document,
  enabled: boolean,
  onContentChange?: () => void,
) {
  type DeckDocument = Document & {
    __deckMobileObserver?: MutationObserver
    __deckMobileContentChange?: () => void
  }
  const deckDoc = doc as DeckDocument
  const existing = doc.getElementById(MOBILE_IFRAME_STYLE_ID)

  if (!enabled) {
    existing?.remove()
    restoreIframeText(doc)
    deckDoc.__deckMobileObserver?.disconnect()
    deckDoc.__deckMobileObserver = undefined
    deckDoc.__deckMobileContentChange = undefined
    return
  }

  deckDoc.__deckMobileContentChange = onContentChange

  if (!existing) {
    const style = doc.createElement('style')
    style.id = MOBILE_IFRAME_STYLE_ID
    style.textContent = MOBILE_IFRAME_CSS
    doc.head.appendChild(style)
  }

  scaleIframeText(doc, MOBILE_TITLE_TEXT_SELECTOR, 1.04)
  scaleIframeText(doc, MOBILE_BODY_TEXT_SELECTOR, 1.08)

  if (!deckDoc.__deckMobileObserver && doc.body) {
    const Observer = doc.defaultView?.MutationObserver ?? MutationObserver
    deckDoc.__deckMobileObserver = new Observer(() => {
      scaleIframeText(doc, MOBILE_TITLE_TEXT_SELECTOR, 1.04)
      scaleIframeText(doc, MOBILE_BODY_TEXT_SELECTOR, 1.08)
      deckDoc.__deckMobileContentChange?.()
    })
    deckDoc.__deckMobileObserver.observe(doc.body, { childList: true, subtree: true })
  }

  deckDoc.__deckMobileContentChange?.()
}

export default function PortfolioDeck() {
  // Scale each tile so it reads comfortably. On desktop, fit by both
  // width AND height (with a slight 1.2x height bias so the tile is
  // intentionally a touch taller than the screen). On mobile, fit by
  // width only — text ends up around 44% of design size, readable
  // enough on a phone without needing horizontal pan.
  useEffect(() => {
    // On mobile we scale to the IFRAME width (816), not the paper width
    // (880), because the mobile @media drops the paper's 32px padding —
    // so the iframe content fills the viewport directly and renders ~8%
    // bigger than scaling to paper width would give.
    const IFRAME_W = 816
    const TILE_W = 920 // desktop tile = paper + breathing room
    const TILE_H = 1170 // paper + meta label and gap (desktop)
    const update = () => {
      const stack = document.querySelector<HTMLElement>('.deck-stack')
      if (!stack) return
      const cs = getComputedStyle(document.documentElement)
      const headerH = parseFloat(cs.getPropertyValue('--header-height')) || 48
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT
      let scale: number
      if (isMobile) {
        const w = document.documentElement.clientWidth || window.innerWidth
        scale = Math.min(w / IFRAME_W, 1)
      } else {
        const availW = window.innerWidth - 24
        const availH = window.innerHeight - headerH - 24
        scale = Math.min(availW / TILE_W, (availH / TILE_H) * 1.2, 1)
      }
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
    const heightSyncTimers = new Set<number>()
    let pendingY = 0
    let pendingX = 0
    let rafId = 0
    const scheduleHeightSync = (iframe: HTMLIFrameElement, enabled: boolean) => {
      syncMobileIframeHeight(iframe, enabled)
      if (!enabled) return

      HEIGHT_SYNC_DELAYS.forEach((delay) => {
        const timer = window.setTimeout(() => {
          heightSyncTimers.delete(timer)
          syncMobileIframeHeight(iframe, window.innerWidth < MOBILE_BREAKPOINT)
        }, delay)
        heightSyncTimers.add(timer)
      })
    }
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
          if (!doc?.head) return

          const mobile = window.innerWidth < MOBILE_BREAKPOINT
          syncMobileIframeStyle(doc, mobile, () => {
            syncMobileIframeHeight(iframe, window.innerWidth < MOBILE_BREAKPOINT)
          })
          scheduleHeightSync(iframe, mobile)
          void doc.fonts?.ready.then(() => {
            scheduleHeightSync(iframe, window.innerWidth < MOBILE_BREAKPOINT)
          })

          if (!(doc as unknown as { __wheelBound?: boolean }).__wheelBound) {
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
          }
        } catch {
          /* cross-origin or not ready */
        }
      }
      iframe.addEventListener('load', attach)
      attach()
      cleanups.push(() => iframe.removeEventListener('load', attach))
    })

    const syncAllIframeStyles = () => {
      document.querySelectorAll<HTMLIFrameElement>('.deck-iframe').forEach((iframe) => {
        try {
          const doc = iframe.contentDocument
          if (!doc?.head) return

          const mobile = window.innerWidth < MOBILE_BREAKPOINT
          syncMobileIframeStyle(doc, mobile, () => {
            syncMobileIframeHeight(iframe, window.innerWidth < MOBILE_BREAKPOINT)
          })
          scheduleHeightSync(iframe, mobile)
        } catch {
          /* cross-origin or not ready */
        }
      })
    }
    window.addEventListener('resize', syncAllIframeStyles)
    cleanups.push(() => window.removeEventListener('resize', syncAllIframeStyles))

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      heightSyncTimers.forEach((timer) => window.clearTimeout(timer))
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

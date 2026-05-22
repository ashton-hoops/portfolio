import { useEffect, useRef, useState } from 'react'
import './CVDemoCarousel.css'

/**
 * CVDemoCarousel — React port of the PDF page-05 video carousel.
 *
 * Behavior:
 *   - Crossfades between two <video> elements so the next clip is preloaded
 *     and the swap is seamless.
 *   - Auto-advances to the next clip when the current one ends.
 *   - Click the video to expand into native fullscreen. While fullscreen,
 *     auto-advance keeps loading clips into the SAME element so it doesn't
 *     freeze on the original.
 *   - Dot indicators jump to any clip.
 */

const BASE = 'https://pub-f1e4215f277b4aba9425176b59903d78.r2.dev/derived/clips/'

// A clip can be sourced two ways: an R2 `id` (CV pipeline demos) or a local
// `src` path under /public (shot-chart demo). Article entries pick whichever
// fits — both shapes flow through clipUrl() below.
type Clip = { id?: string; src?: string }

interface CVDemoCarouselProps {
  clips: Clip[]
  label?: string
}

function clipUrl(clip: Clip) {
  if (clip.src) return clip.src
  if (clip.id) return `${BASE}${clip.id}/v1/clip.mp4`
  return ''
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m
}

export function CVDemoCarousel({ clips, label = 'Computer Vision Demo' }: CVDemoCarouselProps) {
  const aRef = useRef<HTMLVideoElement>(null)
  const bRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState<0 | 1>(0) // which <video> is on screen
  const [clipIdx, setClipIdx] = useState(0) // which clip in the array
  const transitioningRef = useRef(false)
  const clipIdxRef = useRef(clipIdx)
  const activeIdxRef = useRef(activeIdx)

  // Keep refs in sync so callbacks see latest values
  useEffect(() => { clipIdxRef.current = clipIdx }, [clipIdx])
  useEffect(() => { activeIdxRef.current = activeIdx }, [activeIdx])

  // Initial load: A=0, B=1
  useEffect(() => {
    if (!aRef.current || !bRef.current) return
    aRef.current.src = clipUrl(clips[0])
    bRef.current.src = clipUrl(clips[mod(1, clips.length)])
    aRef.current.load()
    bRef.current.load()
    aRef.current.play().catch(() => {})
  }, [clips])

  // Match the frame's aspect ratio to the actual video so the container
  // never crops or letterboxes. Fires once per video on `loadedmetadata`.
  useEffect(() => {
    const apply = (v: HTMLVideoElement | null) => {
      if (!v || !frameRef.current) return
      const onMeta = () => {
        if (v.videoWidth && v.videoHeight && frameRef.current) {
          frameRef.current.style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}`
        }
      }
      v.addEventListener('loadedmetadata', onMeta)
      if (v.readyState >= 1) onMeta()
      return () => v.removeEventListener('loadedmetadata', onMeta)
    }
    const cleanups = [apply(aRef.current), apply(bRef.current)].filter(Boolean) as (() => void)[]
    return () => cleanups.forEach((fn) => fn())
  }, [clips])

  const swapTo = (target: number) => {
    if (transitioningRef.current) return
    const normalized = mod(target, clips.length)
    if (normalized === mod(clipIdxRef.current, clips.length)) return
    transitioningRef.current = true

    const next: 0 | 1 = activeIdxRef.current === 0 ? 1 : 0
    const prevEl = (activeIdxRef.current === 0 ? aRef : bRef).current!
    const nextEl = (next === 0 ? aRef : bRef).current!

    const doSwap = () => {
      nextEl.currentTime = 0
      nextEl.classList.add('cv-active')
      prevEl.classList.remove('cv-active')
      nextEl.play().catch(() => {})
      setActiveIdx(next)
      setClipIdx(target)
      window.setTimeout(() => {
        prevEl.pause()
        prevEl.src = clipUrl(clips[mod(target + 1, clips.length)])
        prevEl.load()
        transitioningRef.current = false
      }, 1550)
    }

    const targetSrc = clipUrl(clips[normalized])
    if (nextEl.src.endsWith(targetSrc.split('/').pop() ?? '') && nextEl.readyState >= 3) {
      doSwap()
    } else {
      nextEl.src = targetSrc
      nextEl.load()
      const ready = () => {
        nextEl.removeEventListener('canplay', ready)
        doSwap()
      }
      if (nextEl.readyState >= 3) ready()
      else nextEl.addEventListener('canplay', ready)
    }
  }

  const handleEnded = () => {
    // If currently in fullscreen, advance within the SAME element so fullscreen
    // continues seamlessly.
    const fsEl =
      (document.fullscreenElement as HTMLVideoElement | null) ||
      ((document as unknown as { webkitFullscreenElement?: HTMLVideoElement | null })
        .webkitFullscreenElement ?? null)
    if (fsEl && (fsEl === aRef.current || fsEl === bRef.current)) {
      const nextIdx = clipIdxRef.current + 1
      const normalized = mod(nextIdx, clips.length)
      fsEl.src = clipUrl(clips[normalized])
      const play = () => {
        fsEl.removeEventListener('canplay', play)
        fsEl.play().catch(() => {})
      }
      fsEl.addEventListener('canplay', play)
      fsEl.load()
      setClipIdx(nextIdx)
      const otherEl = fsEl === aRef.current ? bRef.current : aRef.current
      if (otherEl) {
        otherEl.src = clipUrl(clips[mod(nextIdx + 1, clips.length)])
        otherEl.load()
      }
      return
    }
    swapTo(clipIdxRef.current + 1)
  }

  const handleClick = () => {
    const el = (activeIdxRef.current === 0 ? aRef : bRef).current
    if (!el) return
    const anyEl = el as HTMLVideoElement & {
      webkitRequestFullscreen?: () => void
      webkitEnterFullscreen?: () => void
    }
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
    else if (anyEl.webkitRequestFullscreen) anyEl.webkitRequestFullscreen()
    else if (anyEl.webkitEnterFullscreen) anyEl.webkitEnterFullscreen()
  }

  const displayIdx = mod(clipIdx, clips.length)

  return (
    <div className="cv-demo">
      <div ref={frameRef} className="cv-demo__frame">
        <video
          ref={aRef}
          className={`cv-demo__video${activeIdx === 0 ? ' cv-active' : ''}`}
          muted
          playsInline
          preload="auto"
          onEnded={handleEnded}
          onClick={handleClick}
        />
        <video
          ref={bRef}
          className={`cv-demo__video${activeIdx === 1 ? ' cv-active' : ''}`}
          muted
          playsInline
          preload="auto"
          onEnded={handleEnded}
          onClick={handleClick}
        />
        <span className="cv-demo__hint" aria-hidden="true">⤢ Click to expand</span>
      </div>
      <p className="cv-demo__caption">
        {label} · clip {displayIdx + 1} of {clips.length}
      </p>
      <div className="cv-demo__dots" role="tablist" aria-label="Select clip">
        {clips.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-label={`Clip ${i + 1}`}
            aria-selected={i === displayIdx}
            className={`cv-demo__dot${i === displayIdx ? ' active' : ''}`}
            onClick={() => swapTo(i)}
          />
        ))}
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import './MediaPreview.css'

/**
 * MediaPreview — animated cover for research cards.
 *
 *   - videos: array of R2 clip IDs, plays one at a time muted/looped, advances on `ended`
 *   - images: array of image src URLs, crossfades every `interval` ms
 *
 * Two layered elements ping-pong: one is visible while the other preloads the
 * next item. Source URLs are state-driven (not imperatively set) so React's
 * re-render cycle doesn't clobber them.
 */

const R2_BASE = 'https://pub-f1e4215f277b4aba9425176b59903d78.r2.dev/derived/clips/'

interface VideoItem {
  /** R2 clip ID (preferred for game footage). */
  id?: string
  /** Direct URL for a local or external video (used for the shot-chart demo). */
  src?: string
}

interface Props {
  videos?: VideoItem[]
  images?: string[]
  interval?: number
  alt?: string
}

function clipUrl(v: VideoItem) {
  if (v.src) return v.src
  if (v.id) return `${R2_BASE}${v.id}/v1/clip.mp4`
  return ''
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m
}

export function MediaPreview({ videos, images, interval = 3500, alt = '' }: Props) {
  // Each of the two layers (A, B) holds an index into the items array.
  // `active` says which layer is currently visible.
  const items = videos ?? images ?? []
  const len = items.length

  const [active, setActive] = useState<0 | 1>(0)
  const [aIdx, setAIdx] = useState(0)
  const [bIdx, setBIdx] = useState(len > 1 ? 1 : 0)
  const activeRef = useRef<0 | 1>(0)
  const aIdxRef = useRef(0)
  const bIdxRef = useRef(len > 1 ? 1 : 0)

  useEffect(() => { activeRef.current = active }, [active])
  useEffect(() => { aIdxRef.current = aIdx }, [aIdx])
  useEffect(() => { bIdxRef.current = bIdx }, [bIdx])

  // For images: auto-advance on an interval.
  useEffect(() => {
    if (!images || images.length < 2) return
    const id = window.setInterval(advance, interval)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, interval])

  // For videos: kick off playback whenever the active element changes.
  const aVideoRef = useRef<HTMLVideoElement>(null)
  const bVideoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (!videos) return
    const a = aVideoRef.current
    const b = bVideoRef.current
    if (active === 0 && a) {
      a.currentTime = 0
      a.play().catch(() => {})
    } else if (active === 1 && b) {
      b.currentTime = 0
      b.play().catch(() => {})
    }
  }, [active, videos])

  function advance() {
    if (len < 2) return
    if (activeRef.current === 0) {
      // A is visible. B already shows the next item. Swap visibility, then
      // queue the FOLLOWING item into A so it's ready for the next cycle.
      setActive(1)
      window.setTimeout(() => setAIdx(mod(bIdxRef.current + 1, len)), 900)
    } else {
      setActive(0)
      window.setTimeout(() => setBIdx(mod(aIdxRef.current + 1, len)), 900)
    }
  }

  if (videos?.length) {
    // Single-video case — just a looping autoplaying clip, no carousel/swap logic.
    if (videos.length === 1) {
      return <SingleVideo src={clipUrl(videos[0])} />
    }
    return (
      <div className="media-preview">
        <video
          ref={aVideoRef}
          key={`a-${aIdx}`}
          className={`media-preview__layer${active === 0 ? ' is-active' : ''}`}
          src={clipUrl(videos[aIdx])}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={advance}
        />
        <video
          ref={bVideoRef}
          key={`b-${bIdx}`}
          className={`media-preview__layer${active === 1 ? ' is-active' : ''}`}
          src={clipUrl(videos[bIdx])}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={advance}
        />
      </div>
    )
  }

  if (images?.length) {
    return (
      <div className="media-preview">
        <img
          className={`media-preview__layer${active === 0 ? ' is-active' : ''}`}
          src={images[aIdx]}
          alt={alt}
          loading="lazy"
        />
        <img
          className={`media-preview__layer${active === 1 ? ' is-active' : ''}`}
          src={images[bIdx]}
          alt=""
          loading="lazy"
        />
      </div>
    )
  }

  return null
}

function SingleVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.muted = true
    el.loop = true
    el.playsInline = true
    const attempt = () => el.play().catch(() => {})
    if (el.readyState >= 2) attempt()
    else el.addEventListener('canplay', attempt, { once: true })
  }, [src])
  return (
    <div className="media-preview">
      <video
        ref={ref}
        className="media-preview__layer is-active"
        src={src}
        autoPlay
        muted
        playsInline
        loop
        preload="auto"
      />
    </div>
  )
}

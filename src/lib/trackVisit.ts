// Per-recipient visit tracking via Discord webhook.
//
// Coaches get a link like https://ashton-portfolio.onrender.com/?ref=oklahoma-coley
// On load, if `?ref=` is present, we POST to a Discord webhook with the
// recipient's name, school, role, and device class (mobile/tablet/desktop).
// Discord timestamps the message itself, so we don't send a time. Then we
// strip the param from the URL so the address bar looks clean.
//
// Why a Discord webhook:
//   - free, real-time push to your phone
//   - no backend to maintain
//   - the URL is exposed in the JS bundle but the worst case is spam in the
//     channel, which is contained and revocable. Rotate the webhook URL if abused.
//
// Set VITE_OUTREACH_WEBHOOK in Render env vars to enable. If unset, no-op.

import { REF_DIRECTORY } from './refDirectory'
import { identifyVisitor } from './analytics'

const WEBHOOK = import.meta.env.VITE_OUTREACH_WEBHOOK as string | undefined

// Coarse device class from the UA. iPadOS 13+ reports as "Macintosh", so we
// disambiguate tablets via touch points.
function deviceType(): string {
  const ua = navigator.userAgent
  const tablet =
    /iPad|Tablet|PlayBook|Silk/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ||
    (/Android/.test(ua) && !/Mobile/i.test(ua))
  if (tablet) return 'Tablet'
  if (/Mobile|iPhone|iPod|Android|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'Mobile'
  return 'Desktop'
}

export function trackVisit() {
  try {
    const url = new URL(window.location.href)

    // A ref can arrive two ways:
    //   1. ?ref=jackson-state-dobo            (legacy query form)
    //   2. /s/jackson-state-d  (clean path)   served to the SPA by the
    //      render.yaml  /* -> /index.html  rewrite. The path form needs NO
    //      per-recipient page and NO redeploy — any /s/<ref> just works, so
    //      new schools/people can be added forever without touching the site.
    //      The short role suffix (-d/-a) expands back to the full ref so the
    //      directory lookup and PostHog/Discord identity stay unchanged.
    let ref = url.searchParams.get('ref')
    let fromPath = false
    if (!ref) {
      const m = url.pathname.match(/^\/s\/([^/]+)\/?$/)
      if (m) {
        fromPath = true
        const p = m[1]
        ref = p.endsWith('-d') ? p.slice(0, -2) + '-dobo'
            : p.endsWith('-a') ? p.slice(0, -2) + '-asst'
            : p
      }
    }
    if (!ref) return

    // Strip the ref/path from the URL so it's not visible / shareable.
    if (fromPath) {
      window.history.replaceState({}, '', '/' + (url.hash || '#/'))
    } else {
      url.searchParams.delete('ref')
      const cleanPath = url.pathname + (url.search || '') + (url.hash || '')
      window.history.replaceState({}, '', cleanPath)
    }

    // Map the ref to the recipient (public name/school/role, no email).
    const who = REF_DIRECTORY[ref]
    const label = who ? `${who.name} · ${who.school} · ${who.role}` : ref

    // Tag the PostHog session with the coach. Runs regardless of the Discord
    // webhook / cooldown below so engagement always ties to the right person.
    identifyVisitor(ref, who)

    if (!WEBHOOK) {
      // Dev / unconfigured: log to console so you can see it works locally.
      // eslint-disable-next-line no-console
      console.info('[trackVisit] %s (ref=%s) (no webhook configured)', label, ref)
      return
    }

    // Throttle: localStorage cooldown so the same ref doesn't ping on every
    // page reload within a short window (1 hour). First click of the session wins.
    const cooldownKey = `tv:${ref}`
    const last = Number(localStorage.getItem(cooldownKey) || 0)
    if (Date.now() - last < 60 * 60 * 1000) return
    localStorage.setItem(cooldownKey, String(Date.now()))

    const device = deviceType()
    const payload = {
      content: who
        ? `🏀 ${who.name} · ${who.school} · ${who.role} · ${device}`
        : `🏀 Portfolio visit (ref=${ref}) · ${device}`,
    }

    // sendBeacon is fire-and-forget and survives page navigation. Falls back to fetch.
    const body = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    if ('sendBeacon' in navigator && navigator.sendBeacon(WEBHOOK, body)) return
    fetch(WEBHOOK, { method: 'POST', body, keepalive: true }).catch(() => {})
  } catch {
    // Silent — never break the page over telemetry.
  }
}

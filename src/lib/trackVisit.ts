// Per-recipient visit tracking via Discord webhook.
//
// Coaches get a link like https://ashton-portfolio.onrender.com/?ref=oklahoma-coley
// On load, if `?ref=` is present, we POST to a Discord webhook with the ref,
// timestamp, UA, screen, and referrer. Then we strip the param from the URL
// so the address bar looks clean and the user can share/bookmark without the tag.
//
// Why a Discord webhook:
//   - free, real-time push to your phone
//   - no backend to maintain
//   - the URL is exposed in the JS bundle but the worst case is spam in the
//     channel, which is contained and revocable. Rotate the webhook URL if abused.
//
// Set VITE_OUTREACH_WEBHOOK in Render env vars to enable. If unset, no-op.

const WEBHOOK = import.meta.env.VITE_OUTREACH_WEBHOOK as string | undefined

export function trackVisit() {
  try {
    const url = new URL(window.location.href)
    const ref = url.searchParams.get('ref')
    if (!ref) return

    // Strip the ref from the URL so it's not visible / shareable.
    url.searchParams.delete('ref')
    const cleanPath = url.pathname + (url.search || '') + (url.hash || '')
    window.history.replaceState({}, '', cleanPath)

    if (!WEBHOOK) {
      // Dev / unconfigured: log to console so you can see it works locally.
      // eslint-disable-next-line no-console
      console.info('[trackVisit] ref=%s (no webhook configured)', ref)
      return
    }

    // Throttle: localStorage cooldown so the same ref doesn't ping on every
    // page reload within a short window (1 hour). First click of the session wins.
    const cooldownKey = `tv:${ref}`
    const last = Number(localStorage.getItem(cooldownKey) || 0)
    if (Date.now() - last < 60 * 60 * 1000) return
    localStorage.setItem(cooldownKey, String(Date.now()))

    const payload = {
      content: null,
      embeds: [
        {
          title: 'Portfolio visit',
          color: 0xb4975a, // vegas gold
          fields: [
            { name: 'ref', value: ref, inline: true },
            { name: 'time', value: new Date().toISOString(), inline: true },
            { name: 'page', value: cleanPath || '/', inline: false },
            { name: 'ua', value: navigator.userAgent.slice(0, 200), inline: false },
            { name: 'referer', value: document.referrer || '(direct)', inline: false },
            { name: 'screen', value: `${screen.width}x${screen.height}`, inline: true },
            { name: 'lang', value: navigator.language || 'unknown', inline: true },
          ],
        },
      ],
    }

    // sendBeacon is fire-and-forget and survives page navigation. Falls back to fetch.
    const body = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    if ('sendBeacon' in navigator && navigator.sendBeacon(WEBHOOK, body)) return
    fetch(WEBHOOK, { method: 'POST', body, keepalive: true }).catch(() => {})
  } catch {
    // Silent — never break the page over telemetry.
  }
}

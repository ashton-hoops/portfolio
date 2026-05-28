// Engagement analytics via PostHog. The win here is that every outreach link
// carries ?ref=, so we identify(ref) and the dashboard reads
// "Carter Caplan · SMU · DOBO viewed the SMU shot chart for 4 min" instead of
// anonymous traffic. PostHog gives time-on-site, pageviews, click autocapture,
// and (if enabled in the project) session replay — no backend needed.
//
// Set VITE_POSTHOG_KEY (the project API key) in Render env vars to enable.
// Optionally VITE_POSTHOG_HOST (defaults to PostHog US cloud). If the key is
// unset, every function here is a no-op, so dev and key-less builds don't track.
import posthog from 'posthog-js'

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com'

let ready = false

export function initAnalytics() {
  if (!KEY) return
  posthog.init(KEY, {
    api_host: HOST,
    // HashRouter changes the hash, not the path, so PostHog's automatic
    // pageview capture never fires. We capture manually on route change.
    capture_pageview: false,
    // Pairs each visit with a leave event so time-on-page is accurate.
    capture_pageleave: true,
  })
  ready = true
}

// Tie this session to the named recipient. distinct_id = ref means every visit
// from a coach's link rolls up under one person in the dashboard.
export function identifyVisitor(
  ref: string,
  info?: { name: string; school: string; role: string },
) {
  if (!ready) return
  posthog.identify(ref, info && { name: info.name, school: info.school, role: info.role })
}

export function capturePageview(path: string) {
  if (!ready) return
  posthog.capture('$pageview', { path })
}

export function captureEvent(event: string, props?: Record<string, unknown>) {
  if (!ready) return
  posthog.capture(event, props)
}

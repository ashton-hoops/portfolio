/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OUTREACH_WEBHOOK?: string
  readonly VITE_POSTHOG_KEY?: string
  readonly VITE_POSTHOG_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

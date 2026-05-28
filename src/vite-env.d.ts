/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OUTREACH_WEBHOOK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Multiplayer server URL (Cloudflare Worker), e.g. https://quiz-hub-multi.<compte>.workers.dev */
  readonly VITE_MP_URL?: string
}

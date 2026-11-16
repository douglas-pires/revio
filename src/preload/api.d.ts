import type { RevioApi } from '../shared/api'

declare global {
  interface Window {
    revio: RevioApi
  }
}

export {}

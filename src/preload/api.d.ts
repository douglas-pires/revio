import type { RevioApi } from '../shared/api.contract'

declare global {
  interface Window {
    revio: RevioApi
  }
}

export {}

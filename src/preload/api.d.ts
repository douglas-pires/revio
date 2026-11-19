import type { RevioApi } from '../shared/api.contract.ts'

declare global {
  /** The preload's bridge to the main process, exposed on the renderer's global object. */
  // biome-ignore lint/style/useVarsOnTop: a global declaration needs `var`; `let` and `const` do not reach globalThis.
  var revio: RevioApi
}

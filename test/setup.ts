import { vi } from 'vitest'

/** Main-process modules import Electron at load time; tests never need the real one. */
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/revio-test', isPackaged: false },
  safeStorage: { isEncryptionAvailable: () => false },
}))

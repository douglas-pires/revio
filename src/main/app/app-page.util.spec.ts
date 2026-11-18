import { describe, expect, it } from 'vitest'
import { isAppPage } from './app-page.util'

describe('isAppPage', () => {
  const built = { indexFile: '/Applications/Revio.app/Contents/Resources/app.asar/out/renderer/index.html' }
  const dev = { devUrl: 'http://localhost:5173', indexFile: built.indexFile }

  it('accepts the built index.html, with or without a hash or query', () => {
    expect(isAppPage(`file://${built.indexFile}`, built)).toBe(true)
    expect(isAppPage(`file://${built.indexFile}#x?y=1`, built)).toBe(true)
  })

  it('rejects other files and web pages for a built app', () => {
    expect(isAppPage('file:///etc/passwd', built)).toBe(false)
    expect(isAppPage('https://attacker.example/x', built)).toBe(false)
    expect(isAppPage(`https://attacker.example/${built.indexFile}`, built)).toBe(false)
  })

  it('accepts only the dev server origin in development', () => {
    expect(isAppPage('http://localhost:5173/', dev)).toBe(true)
    expect(isAppPage('http://localhost:5173/src/x?t=1', dev)).toBe(true)
    expect(isAppPage('http://localhost:5174/', dev)).toBe(false)
    expect(isAppPage('http://localhost.attacker.example:5173/', dev)).toBe(false)
    expect(isAppPage(`file://${built.indexFile}`, dev)).toBe(false)
  })

  it('rejects missing and malformed URLs', () => {
    expect(isAppPage(undefined, built)).toBe(false)
    expect(isAppPage('', built)).toBe(false)
    expect(isAppPage('not a url', built)).toBe(false)
  })
})

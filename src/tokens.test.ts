import { describe, expect, it } from 'vitest'
import { TOKENS, token } from './tokens'

const REQUIRED = [
  '--bg-base',
  '--bg-panel',
  '--bg-elevated',
  '--border',
  '--border-strong',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--state-pending',
  '--state-closed',
  '--state-closed-text',
  '--state-reopened',
  '--accent',
  '--g-up2',
  '--g-up',
  '--g-flat',
  '--g-dn',
  '--g-dn2',
  '--map-casing',
  '--notice-bg',
  '--notice-text',
]

describe('tokens', () => {
  it('exposes every token the system defines', () => {
    for (const name of REQUIRED) expect(TOKENS[name]).toBeDefined()
  })

  it('parses colours as hex', () => {
    for (const name of REQUIRED) expect(token(name)).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('throws on an unknown token rather than emitting undefined into a paint expression', () => {
    expect(() => token('--nope')).toThrow(/Unknown design token/)
  })

  it('keeps the three closure states distinct', () => {
    const states = [token('--state-pending'), token('--state-closed'), token('--state-reopened')]
    expect(new Set(states).size).toBe(3)
  })
})

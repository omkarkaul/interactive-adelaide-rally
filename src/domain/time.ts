import type { Closure } from './types'

export const MINUTES_PER_DAY = 24 * 60

export interface Window {
  closesAt: number
  reopensAt: number
}

export function parseClock(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) throw new Error(`Not a HH:MM clock time: ${value}`)
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) throw new Error(`Out of range clock time: ${value}`)
  return hours * 60 + minutes
}

export function formatClock(minutes: number): string {
  const wrapped = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const hh = String(Math.floor(wrapped / 60)).padStart(2, '0')
  const mm = String(wrapped % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

export function parseWindow(closesAt: string, reopensAt: string): Window {
  return { closesAt: parseClock(closesAt), reopensAt: parseClock(reopensAt) }
}

export function windowOf(closure: Closure): Window {
  return parseWindow(closure.closesAt, closure.reopensAt)
}

// Closed from the stated closing minute up to, but not including, the reopening
// minute: a road advertised as reopening at 17:10 is open at 17:10.
export function isClosedAt(closure: Closure, minutes: number): boolean {
  const { closesAt, reopensAt } = windowOf(closure)
  return minutes >= closesAt && minutes < reopensAt
}

export function formatWindow(closure: Closure): string {
  return `${closure.closesAt}–${closure.reopensAt}`
}

export function durationMinutes(closure: Closure): number {
  const { closesAt, reopensAt } = windowOf(closure)
  return reopensAt - closesAt
}

export function envelopeOf(closures: Closure[]): Window | null {
  if (closures.length === 0) return null
  let closesAt = Infinity
  let reopensAt = -Infinity
  for (const closure of closures) {
    const span = windowOf(closure)
    closesAt = Math.min(closesAt, span.closesAt)
    reopensAt = Math.max(reopensAt, span.reopensAt)
  }
  return { closesAt, reopensAt }
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function clampToWindow(minutes: number, bounds: Window): number {
  return Math.min(Math.max(minutes, bounds.closesAt), bounds.reopensAt)
}

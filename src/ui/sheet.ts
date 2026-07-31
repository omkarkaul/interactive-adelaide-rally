// Fractions of the viewport the content sheet rests at: a peek that leaves the
// map dominant, a half-and-half, and nearly full for reading a stage.
export const SNAP_POINTS = [0.25, 0.55, 0.9] as const

export const MIN_SNAP = SNAP_POINTS[0]
export const MAX_SNAP = SNAP_POINTS[SNAP_POINTS.length - 1]

export function clampFraction(fraction: number): number {
  return Math.min(MAX_SNAP, Math.max(MIN_SNAP, fraction))
}

export function nearestSnap(fraction: number): number {
  return SNAP_POINTS.reduce((best, snap) =>
    Math.abs(snap - fraction) < Math.abs(best - fraction) ? snap : best,
  )
}

// Keyboard users get the same three positions without a drag gesture.
export function stepSnap(current: number, direction: 1 | -1): number {
  const index = SNAP_POINTS.indexOf(nearestSnap(current) as (typeof SNAP_POINTS)[number])
  const next = Math.min(SNAP_POINTS.length - 1, Math.max(0, index + direction))
  return SNAP_POINTS[next]
}

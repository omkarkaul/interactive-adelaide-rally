import { formatClock, windowOf } from '../domain/time'
import type { Closure } from '../domain/types'

export type ClosureState = 'pending' | 'closed' | 'reopened'

// "Not yet" and "already done" are the two a resident most needs to tell apart,
// and neither may be mistaken for "closed". Same boundary rule as isClosedAt:
// a road advertised as reopening at 17:10 is open at 17:10.
export function closureStateAt(closure: Closure, minutes: number | null): ClosureState {
  if (minutes === null) return 'pending'
  const { closesAt, reopensAt } = windowOf(closure)
  if (minutes < closesAt) return 'pending'
  return minutes < reopensAt ? 'closed' : 'reopened'
}

// Says what the road is doing now, not what kind of record this is. The detail
// header used to read "road closed" unconditionally, so at 07:45 it asserted a
// road was shut that did not close for another 85 minutes — while the timeline
// directly below it drew the same closure as not yet closed.
export function closureLabel(closure: Closure, minutes: number | null): string {
  const { closesAt, reopensAt } = windowOf(closure)
  switch (closureStateAt(closure, minutes)) {
    case 'closed':
      return 'closed now'
    case 'reopened':
      return `reopened ${formatClock(reopensAt)}`
    case 'pending':
      return minutes === null ? 'road closed' : `closes ${formatClock(closesAt)}`
  }
}

// A shared line carries several runs. It reads as closed if any run has it closed,
// and only as reopened once every run is done.
export function combineStates(states: ClosureState[]): ClosureState {
  if (states.includes('closed')) return 'closed'
  if (states.length > 0 && states.every((s) => s === 'reopened')) return 'reopened'
  return 'pending'
}

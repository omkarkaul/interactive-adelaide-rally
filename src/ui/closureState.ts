import { windowOf } from '../domain/time'
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

// A shared line carries several runs. It reads as closed if any run has it closed,
// and only as reopened once every run is done.
export function combineStates(states: ClosureState[]): ClosureState {
  if (states.includes('closed')) return 'closed'
  if (states.length > 0 && states.every((s) => s === 'reopened')) return 'reopened'
  return 'pending'
}

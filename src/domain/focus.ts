import type { Focus, StageCode } from './types'

export type FocusAction =
  | { type: 'hover'; code: StageCode }
  | { type: 'unhover'; code: StageCode }
  | { type: 'select'; code: StageCode }
  | { type: 'toggle'; code: StageCode }
  | { type: 'clear' }

export const NO_FOCUS: Focus = { kind: 'none' }

export function focusReducer(focus: Focus, action: FocusAction): Focus {
  switch (action.type) {
    case 'hover':
      // A selection is sticky: hovering elsewhere must not steal focus from it.
      return focus.kind === 'selected' ? focus : { kind: 'hover', code: action.code }
    case 'unhover':
      return focus.kind === 'hover' && focus.code === action.code ? NO_FOCUS : focus
    case 'select':
      return { kind: 'selected', code: action.code }
    case 'toggle':
      return focus.kind === 'selected' && focus.code === action.code
        ? NO_FOCUS
        : { kind: 'selected', code: action.code }
    case 'clear':
      return NO_FOCUS
  }
}

export function focusedCode(focus: Focus): StageCode | null {
  return focus.kind === 'none' ? null : focus.code
}

export type Emphasis = 'focused' | 'dimmed' | 'normal'

export function emphasis(focus: Focus, code: StageCode): Emphasis {
  if (focus.kind === 'none') return 'normal'
  return focus.code === code ? 'focused' : 'dimmed'
}

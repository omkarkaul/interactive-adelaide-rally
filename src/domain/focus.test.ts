import { describe, expect, it } from 'vitest'
import { emphasis, focusReducer, NO_FOCUS } from './focus'
import type { Focus } from './types'

const hover = (code: string): Focus => ({ kind: 'hover', code })
const selected = (code: string): Focus => ({ kind: 'selected', code })

describe('unhover without a code', () => {
  // Leaving a stage line is not a decision to close the open stage. This used to
  // dispatch 'clear', so moving the pointer off any line on the map dropped the
  // reader back to the day list.
  it('drops a hover', () => {
    const hovering = focusReducer(NO_FOCUS, { type: 'hover', code: 'SS4' })
    expect(focusReducer(hovering, { type: 'unhover' })).toEqual(NO_FOCUS)
  })

  it('leaves a selection alone', () => {
    const selected = focusReducer(NO_FOCUS, { type: 'select', code: 'SS4' })
    expect(focusReducer(selected, { type: 'unhover' })).toBe(selected)
  })

  it('still ignores an unhover naming a different stage', () => {
    const hovering = focusReducer(NO_FOCUS, { type: 'hover', code: 'SS4' })
    expect(focusReducer(hovering, { type: 'unhover', code: 'SS7' })).toBe(hovering)
  })
})

describe('focusReducer', () => {
  it('takes hover from nothing', () => {
    expect(focusReducer(NO_FOCUS, { type: 'hover', code: 'SS4' })).toEqual(hover('SS4'))
  })

  it('moves hover between stages', () => {
    expect(focusReducer(hover('SS4'), { type: 'hover', code: 'SS7' })).toEqual(hover('SS7'))
  })

  it('clears hover only for the stage that was hovered', () => {
    expect(focusReducer(hover('SS4'), { type: 'unhover', code: 'SS4' })).toEqual(NO_FOCUS)
    expect(focusReducer(hover('SS4'), { type: 'unhover', code: 'SS7' })).toEqual(hover('SS4'))
  })

  it('keeps a selection sticky against hover', () => {
    expect(focusReducer(selected('SS4'), { type: 'hover', code: 'SS7' })).toEqual(selected('SS4'))
    expect(focusReducer(selected('SS4'), { type: 'unhover', code: 'SS4' })).toEqual(selected('SS4'))
  })

  it('lets a later selection replace an earlier one', () => {
    expect(focusReducer(selected('SS4'), { type: 'select', code: 'SS7' })).toEqual(selected('SS7'))
  })

  it('toggles the selected stage off', () => {
    expect(focusReducer(selected('SS4'), { type: 'toggle', code: 'SS4' })).toEqual(NO_FOCUS)
    expect(focusReducer(selected('SS4'), { type: 'toggle', code: 'SS7' })).toEqual(selected('SS7'))
  })

  it('clears everything on a click outside', () => {
    expect(focusReducer(selected('SS4'), { type: 'clear' })).toEqual(NO_FOCUS)
    expect(focusReducer(hover('SS4'), { type: 'clear' })).toEqual(NO_FOCUS)
  })
})

describe('emphasis', () => {
  const cases: [Focus, string, string][] = [
    [NO_FOCUS, 'SS4', 'normal'],
    [NO_FOCUS, 'SS7', 'normal'],
    [hover('SS4'), 'SS4', 'focused'],
    [hover('SS4'), 'SS7', 'dimmed'],
    [selected('SS4'), 'SS4', 'focused'],
    [selected('SS4'), 'SS7', 'dimmed'],
  ]

  it.each(cases)('%o + %s -> %s', (focus, code, expected) => {
    expect(emphasis(focus, code)).toBe(expected)
  })

  it('dims nothing while nothing is focused', () => {
    expect(['SS1', 'SS2', 'SS3'].map((c) => emphasis(NO_FOCUS, c))).toEqual([
      'normal',
      'normal',
      'normal',
    ])
  })
})

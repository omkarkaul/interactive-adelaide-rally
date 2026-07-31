import { useRef } from 'react'
import { clampFraction, nearestSnap, stepSnap } from './sheet'

interface Props {
  fraction: number
  onChange: (fraction: number) => void
}

// Dragging upward grows the sheet, so the pointer delta is subtracted. Pointer
// capture keeps the gesture alive when the finger leaves the 24px handle, which
// it does almost immediately on a phone.
export function SheetHandle({ fraction, onChange }: Props) {
  const start = useRef<{ y: number; fraction: number } | null>(null)

  return (
    <div
      className="sheet-handle"
      role="slider"
      tabIndex={0}
      aria-label="Resize the stage panel"
      aria-valuemin={25}
      aria-valuemax={90}
      aria-valuenow={Math.round(fraction * 100)}
      aria-valuetext={`${Math.round(fraction * 100)}% of the screen`}
      onPointerDown={(event) => {
        start.current = { y: event.clientY, fraction }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!start.current) return
        const delta = (start.current.y - event.clientY) / window.innerHeight
        onChange(clampFraction(start.current.fraction + delta))
      }}
      onPointerUp={(event) => {
        if (!start.current) return
        start.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
        onChange(nearestSnap(fraction))
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') onChange(stepSnap(fraction, 1))
        else if (event.key === 'ArrowDown') onChange(stepSnap(fraction, -1))
        else return
        event.preventDefault()
      }}
    >
      <span className="sheet-handle__grip" />
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

// Hand-rolled charts draw in pixel space, so they need the real box rather than
// a viewBox that would distort strokes and text.
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // Bail on an unchanged box: setState with a fresh object always re-renders,
    // and the first measurement usually matches the initial zero.
    const measure = () =>
      setSize((current) =>
        current.width === element.clientWidth && current.height === element.clientHeight
          ? current
          : { width: element.clientWidth, height: element.clientHeight },
      )
    measure()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, size] as const
}

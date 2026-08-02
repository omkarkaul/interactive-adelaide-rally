import type { ReactNode } from 'react'

interface Props {
  to: string
  className?: string
  label?: string
  children: ReactNode
  // Absent means the anchor navigates for real, which is what a bare <App /> in a
  // test or an embed should do.
  onNavigate?: (to: string) => void
}

export function Link({ to, className, label, children, onNavigate }: Props) {
  return (
    <a
      href={to}
      className={className}
      aria-label={label}
      onClick={(event) => {
        if (!onNavigate) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        onNavigate(to)
      }}
    >
      {children}
    </a>
  )
}

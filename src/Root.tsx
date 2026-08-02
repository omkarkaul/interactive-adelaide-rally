import { useCallback, useEffect, useState } from 'react'
import App from './App'
import { About } from './ui/About'
import { routeOf } from './route'

// pushState rather than a full load: back from /about has to land on the map with
// the day, stage and time the reader left it on, and App reads those off the URL
// it is remounted with.
export function Root() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const sync = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const onNavigate = useCallback((to: string) => {
    window.history.pushState(null, '', to)
    setPathname(window.location.pathname)
  }, [])

  return routeOf(pathname) === 'about' ? (
    <About onNavigate={onNavigate} />
  ) : (
    <App onNavigate={onNavigate} />
  )
}

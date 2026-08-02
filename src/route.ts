export type Route = 'map' | 'about'

export const MAP_PATH = '/'
export const ABOUT_PATH = '/about'

export function routeOf(pathname: string): Route {
  return pathname.replace(/\/+$/, '') === ABOUT_PATH ? 'about' : 'map'
}

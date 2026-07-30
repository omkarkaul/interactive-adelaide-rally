import raw from './tokens.css?raw'

// MapLibre paint expressions take literal colours, not var(). Rather than keeping
// a second copy of the palette in TypeScript, read the one stylesheet that owns it.
function parse(css: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [, name, value] of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[name] = value.trim()
  }
  return out
}

export const TOKENS = parse(raw)

export function token(name: string): string {
  const value = TOKENS[name]
  if (!value) throw new Error(`Unknown design token: ${name}`)
  return value
}

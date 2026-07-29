import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { distance } from '@turf/distance'
import type { StageFeatureCollection } from '../src/domain/types.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const YEAR = Number(process.argv.find((a) => /^\d{4}$/.test(a)) ?? 2026)
const DATA = resolve(ROOT, 'data', String(YEAR))
const CACHE = resolve(ROOT, '.cache', 'terrarium')

const TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
const TILE_ZOOM = 13
const TILE_SIZE = 256
const SAMPLE_SPACING_M = 50
const ATTRIBUTION =
  'Mapzen Terrarium terrain tiles hosted by AWS Open Data, derived from SRTM, GMTED2010 and national datasets'

const force = process.argv.includes('--force')

const tiles = new Map<string, PNG>()

async function tile(x: number, y: number): Promise<PNG> {
  const key = `${TILE_ZOOM}/${x}/${y}`
  const cached = tiles.get(key)
  if (cached) return cached

  const path = resolve(CACHE, `${TILE_ZOOM}-${x}-${y}.png`)
  let buffer: Buffer
  if (existsSync(path)) {
    buffer = await readFile(path)
  } else {
    const url = TILE_URL.replace('{z}', String(TILE_ZOOM))
      .replace('{x}', String(x))
      .replace('{y}', String(y))
    const response = await fetch(url)
    if (!response.ok) throw new Error(`tile ${key}: HTTP ${response.status}`)
    buffer = Buffer.from(await response.arrayBuffer())
    await writeFile(path, buffer)
    process.stdout.write('.')
  }

  const png = PNG.sync.read(buffer)
  tiles.set(key, png)
  return png
}

// Terrarium packs metres above sea level into RGB: (R * 256 + G + B / 256) - 32768.
function decode(png: PNG, px: number, py: number): number {
  const x = Math.min(TILE_SIZE - 1, Math.max(0, px))
  const y = Math.min(TILE_SIZE - 1, Math.max(0, py))
  const i = (y * TILE_SIZE + x) * 4
  return png.data[i] * 256 + png.data[i + 1] + png.data[i + 2] / 256 - 32768
}

function globalPixel(lon: number, lat: number): [number, number] {
  const scale = TILE_SIZE * 2 ** TILE_ZOOM
  const sin = Math.sin((lat * Math.PI) / 180)
  return [
    ((lon + 180) / 360) * scale,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  ]
}

async function elevationAt(lon: number, lat: number): Promise<number> {
  const [gx, gy] = globalPixel(lon, lat)
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const fx = gx - x0
  const fy = gy - y0

  const corner = async (dx: number, dy: number) => {
    const px = x0 + dx
    const py = y0 + dy
    const png = await tile(Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE))
    return decode(png, px % TILE_SIZE, py % TILE_SIZE)
  }

  const [z00, z10, z01, z11] = await Promise.all([
    corner(0, 0),
    corner(1, 0),
    corner(0, 1),
    corner(1, 1),
  ])

  return (
    z00 * (1 - fx) * (1 - fy) + z10 * fx * (1 - fy) + z01 * (1 - fx) * fy + z11 * fx * fy
  )
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

// Densify rather than resample. The organisers already digitise most stages
// well below 50 m, and the Corkscrew hairpins have a tighter radius than the
// sample spacing, so replacing the source vertices with evenly spaced ones
// would visibly cut those corners. Every original vertex survives; extra points
// are inserted only where a segment is longer than the spacing.
export function densify(coordinates: number[][], spacingM: number): [number, number][] {
  const out: [number, number][] = [[round6(coordinates[0][0]), round6(coordinates[0][1])]]

  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1]
    const b = coordinates[i]
    const segmentM = distance(a, b, { units: 'kilometers' }) * 1000
    const steps = Math.ceil(segmentM / spacingM)

    for (let step = 1; step < steps; step++) {
      const t = step / steps
      out.push([round6(a[0] + (b[0] - a[0]) * t), round6(a[1] + (b[1] - a[1]) * t)])
    }
    out.push([round6(b[0]), round6(b[1])])
  }

  return out
}

async function main() {
  await mkdir(CACHE, { recursive: true })
  const files = (await readdir(resolve(DATA, 'geometry'))).filter((f) => f.endsWith('.geojson'))

  let enriched = 0
  let skipped = 0
  let samples = 0

  for (const file of files) {
    const path = resolve(DATA, 'geometry', file)
    const collection = JSON.parse(await readFile(path, 'utf8')) as StageFeatureCollection
    let changed = false

    for (const feature of collection.features) {
      const coordinates = feature.geometry.coordinates
      const alreadyHasZ = coordinates.every((c) => c.length > 2 && Number.isFinite(c[2]))
      if (alreadyHasZ && !force) {
        skipped++
        continue
      }

      const points = densify(coordinates, SAMPLE_SPACING_M)
      const withZ: number[][] = []
      for (const [lon, lat] of points) {
        withZ.push([lon, lat, Math.round((await elevationAt(lon, lat)) * 10) / 10])
      }

      feature.geometry.coordinates = withZ
      changed = true
      enriched++
      samples += withZ.length
      console.log(`  ${feature.properties.featureId}: ${coordinates.length} -> ${withZ.length} pts`)
    }

    if (changed) await writeFile(path, `${JSON.stringify(collection, null, 2)}\n`, 'utf8')
    console.log(`${file}: ${changed ? 'rewritten' : 'unchanged'}`)
  }

  const sourcesPath = resolve(DATA, 'sources.json')
  const sources = JSON.parse(await readFile(sourcesPath, 'utf8')) as Record<string, unknown>
  sources.elevation = {
    provider: 'AWS Open Data — Mapzen Terrarium terrain tiles',
    urlTemplate: TILE_URL,
    zoom: TILE_ZOOM,
    maxSampleSpacingM: SAMPLE_SPACING_M,
    method: 'densified: every source vertex kept, extra samples inserted on long segments',
    attribution: ATTRIBUTION,
    enrichedAt: enriched > 0 ? new Date().toISOString() : (sources.elevation as { enrichedAt?: string })?.enrichedAt,
  }
  await writeFile(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`, 'utf8')

  console.log(
    `\nenriched ${enriched} features (${samples} samples), skipped ${skipped} already carrying z, ${tiles.size} tiles used`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

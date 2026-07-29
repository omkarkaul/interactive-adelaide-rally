import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseKml, type KmlFolder } from '../src/domain/kml.ts'
import type { SourceRecord } from '../src/domain/types.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const YEAR = 2026
const DATA = resolve(ROOT, 'data', String(YEAR))

interface MapSource {
  mid: string
  key: string
  day: number | null
  note: string
}

// Only the three 2026 day maps contribute geometry. The other three are fetched,
// hashed and recorded so the provenance trail is complete, but their folders are
// parked: recon showed the "standalone" maps carry a prior year's stage numbering
// (SS2 EAGLE ON THE HILL, SS14 CORKSCREW PLUS) rather than duplicating 2026 content.
const DAY_MAPS: MapSource[] = [
  { mid: '1Afv-5RMTbEXqJNsyUOICNB-Ts7k_294', key: 'day-1', day: 1, note: 'SS1–SS11' },
  { mid: '1xpCx2cH8NgllswJUHqF5qYiHQx8LYPg', key: 'day-2', day: 2, note: 'SS12–SS22' },
  { mid: '1G00Y3xegPVNWTDaunvk_IWY_Kec0lLQ', key: 'day-3', day: 3, note: 'SS23–SS30' },
]

const ARCHIVE_MAPS: MapSource[] = [
  {
    mid: '1t-o-bkXJ-oGyjRwyu4S2vuZSSTRudYDd',
    key: 'ss4-standalone',
    day: null,
    note: 'Linked from /route as the SS4 tile; document is a prior-year Day 1 with different stage numbering',
  },
  {
    mid: '1knso66fdXIxKfe8d3tBXOxI4yW7XhGU3',
    key: 'ss29-tile',
    day: null,
    note: 'Linked from /route under Day 2; document is a prior-year Day 2 with different stage numbering',
  },
  {
    mid: '1Io0-kvxO3FFKarmYcScnLz31c3cs80M',
    key: 'gorge-rallysprint',
    day: null,
    note: 'Separate event, out of scope for v1',
  },
]

const MAPS = [...DAY_MAPS, ...ARCHIVE_MAPS]

const kmlUrl = (mid: string) => `https://www.google.com/maps/d/kml?mid=${mid}&forcekml=1`

const noFetch = process.argv.includes('--no-fetch')

async function priorFetchTimes(): Promise<Map<string, string>> {
  const path = resolve(DATA, 'sources.json')
  if (!existsSync(path)) return new Map()
  const prior = JSON.parse(await readFile(path, 'utf8')) as { sources: SourceRecord[] }
  return new Map(prior.sources.map((s) => [s.mid, s.fetchedAt]))
}

async function acquire(
  source: MapSource,
  prior: Map<string, string>,
): Promise<{ xml: string; fetchedAt: string }> {
  const rawPath = resolve(DATA, 'raw', `${source.key}.${source.mid}.kml`)

  if (noFetch && existsSync(rawPath)) {
    console.log(`  reused ${rawPath.replace(ROOT + '/', '')}`)
    return { xml: await readFile(rawPath, 'utf8'), fetchedAt: prior.get(source.mid) ?? 'unknown' }
  }

  const response = await fetch(kmlUrl(source.mid), { redirect: 'follow' })
  if (!response.ok) throw new Error(`${source.key}: HTTP ${response.status}`)
  const xml = await response.text()
  if (!xml.includes('<kml')) throw new Error(`${source.key}: response is not KML`)

  await writeFile(rawPath, xml, 'utf8')
  console.log(`  fetched ${xml.length} bytes -> ${rawPath.replace(ROOT + '/', '')}`)
  return { xml, fetchedAt: new Date().toISOString() }
}

interface StageFeature {
  type: 'Feature'
  id: string
  properties: {
    featureId: string
    stageCodes: string[]
    name: string
    day: number
    sourceMid: string
    termini: { name: string; coordinate: [number, number] }[]
  }
  geometry: { type: 'LineString'; coordinates: [number, number][] }
}

function toFeature(folder: KmlFolder, day: number, mid: string): StageFeature {
  return {
    type: 'Feature',
    id: folder.featureId,
    properties: {
      featureId: folder.featureId,
      stageCodes: folder.codes,
      name: folder.name,
      day,
      sourceMid: mid,
      termini: folder.termini,
    },
    geometry: { type: 'LineString', coordinates: folder.line! },
  }
}

async function main() {
  await mkdir(resolve(DATA, 'raw'), { recursive: true })
  await mkdir(resolve(DATA, 'geometry'), { recursive: true })

  const sources: SourceRecord[] = []
  const byDay = new Map<number, StageFeature[]>([
    [1, []],
    [2, []],
    [3, []],
  ])
  const claimed = new Map<string, { day: number; codes: string[]; mid: string }>()
  const duplicates: string[] = []
  const parked: string[] = []

  const prior = await priorFetchTimes()

  for (const source of MAPS) {
    console.log(`\n${source.key} (${source.mid})`)
    const { xml, fetchedAt } = await acquire(source, prior)
    const sha256 = createHash('sha256').update(xml).digest('hex')
    const document = parseKml(xml)

    sources.push({
      mid: source.mid,
      url: kmlUrl(source.mid),
      fetchedAt,
      sha256,
      documentName: document.name,
    })

    console.log(`  document: ${document.name}`)
    for (const folder of document.folders) {
      const label = `${folder.featureId} [${folder.codes.join(',') || 'no codes'}] "${folder.rawName}"`

      if (source.day === null) {
        parked.push(`${source.key}: ${label}`)
        console.log(`  parked   ${label}`)
        continue
      }
      if (!folder.line) {
        console.log(`  skipped  ${label} — no LineString`)
        continue
      }

      const prior = claimed.get(folder.featureId)
      if (prior) {
        duplicates.push(`${label} already emitted from ${prior.mid} (day ${prior.day})`)
        console.log(`  dup      ${label} — kept day ${prior.day} copy`)
        continue
      }

      claimed.set(folder.featureId, { day: source.day, codes: folder.codes, mid: source.mid })
      byDay.get(source.day)!.push(toFeature(folder, source.day, source.mid))
      console.log(`  emitted  ${label} (${folder.line.length} pts, ${folder.termini.length} termini)`)
    }
  }

  for (const [day, features] of byDay) {
    const collection = { type: 'FeatureCollection' as const, features }
    await writeFile(
      resolve(DATA, 'geometry', `day-${day}.geojson`),
      `${JSON.stringify(collection, null, 2)}\n`,
      'utf8',
    )
    console.log(`\nday-${day}.geojson: ${features.length} features`)
  }

  const roles = Object.fromEntries(MAPS.map((m) => [m.mid, { key: m.key, day: m.day, note: m.note }]))
  await writeFile(
    resolve(DATA, 'sources.json'),
    `${JSON.stringify({ year: YEAR, sources, roles, notes: { duplicates, parked } }, null, 2)}\n`,
    'utf8',
  )

  console.log(`\ncodes covered: ${[...claimed.values()].flatMap((c) => c.codes).sort().join(' ')}`)
  if (duplicates.length) console.log(`duplicates:\n  ${duplicates.join('\n  ')}`)
  if (parked.length) console.log(`parked:\n  ${parked.join('\n  ')}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

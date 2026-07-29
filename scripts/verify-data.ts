import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Closure, Stage } from '../src/domain/types.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const YEAR = Number(process.argv.find((a) => /^\d{4}$/.test(a)) ?? 2026)
const DATA = resolve(ROOT, 'data', String(YEAR))

const PAGES = {
  route: 'https://www.adelaiderally.com.au/route',
  'road-closures': 'https://www.adelaiderally.com.au/road-closures',
}

const noFetch = process.argv.includes('--no-fetch')

function plainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;|​/g, ' ')
    .replace(/&ndash;|&#8211;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

async function page(key: keyof typeof PAGES): Promise<string> {
  const path = resolve(DATA, 'raw', `${key}.txt`)
  if (noFetch && existsSync(path)) return readFile(path, 'utf8')

  const response = await fetch(PAGES[key])
  if (!response.ok) throw new Error(`${key}: HTTP ${response.status}`)
  const text = plainText(await response.text())
  await writeFile(path, `${text}\n`, 'utf8')
  return text
}

// "7.45am", "12.45pm", "8:45am", "3.00pm" -> "07:45"
function clock(raw: string): string | null {
  const match = /^(\d{1,2})[.:](\d{2})\s*(am|pm)$/i.exec(raw.trim())
  if (!match) return null
  let hours = Number(match[1]) % 12
  if (match[3].toLowerCase() === 'pm') hours += 12
  return `${String(hours).padStart(2, '0')}:${match[2]}`
}

// The page writes the same place a dozen ways: "Ave." and "Ave", "and" and "&",
// "Drive" and "Dve", with or without a trailing "Intersection". Only real
// differences should reach the report.
const normalise = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b(intersection of|intersection|approximately|approx\.?|and)\b/g, ' ')
    .replace(/\b(drive|dve)\b/g, 'dr')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bterrace\b/g, 'tce')
    .replace(/\bnone\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

interface PublishedClosure {
  codes: string[]
  name: string
  closesAt: string | null
  reopensAt: string | null
  roadsClosed: string
  start: string
  finish: string
  intersections: string
  note: string
}

// The blocks are prose, not markup: the page carries no structure to read.
// Splitting on the "SPECIAL STAGE" heading is the only seam available.
function parseClosures(text: string): PublishedClosure[] {
  const body = text
    .slice(text.indexOf('ROAD CLOSURE TIMES AND DETAILS'))
    .split(/Important safety information/i)[0]
  const blocks = body.split(/SPECIAL STAGE\s+/i).slice(1)

  return blocks.map((block) => {
    const head = /^([\d\s&]+)([\s\S]*?)Approximate closure times:/i.exec(block)
    const times =
      /Approximate closure times:\s*([\d.:]+\s*[ap]m)\s*(?:[–—-]+|to)\s*([\d.:]+\s*[ap]m)/i.exec(block)
    const field = (label: RegExp) => {
      const match = label.exec(block)
      return match ? match[1].trim() : ''
    }

    // The trailing sub-window sentence ("Note: ... will be closed from 1:30pm")
    // is appended to the intersections run rather than given a field of its own.
    const tail = field(/Intersections along Stage:\s*([\s\S]*?)(?:SPECIAL STAGE|DAY \d|$)/i)
    const [intersections, ...noteParts] = tail.split(/\bNote:\s*/i)

    return {
      codes: (head?.[1] ?? '')
        .split(/\s*&\s*/)
        .map((n) => `SS${n.trim()}`)
        .filter((c) => /^SS\d+$/.test(c)),
      name: (head?.[2] ?? '').replace(/\(NOTE[\s\S]*?\)/i, '').trim(),
      closesAt: times ? clock(times[1]) : null,
      reopensAt: times ? clock(times[2]) : null,
      roadsClosed: field(/Roads? Closed:\s*([\s\S]*?)Closure Start:/i),
      start: field(/Closure Start:\s*([\s\S]*?)Closure Finish:/i),
      finish: field(/Closure Finish:\s*([\s\S]*?)Intersections along Stage:/i),
      intersections: intersections.trim(),
      note: noteParts.join(' ').trim(),
    }
  })
}

function parseIndex(text: string): Map<string, string> {
  const index = new Map<string, string>()
  for (const match of text.matchAll(/\bSS(\d+)\s+([A-Za-z][A-Za-z0-9 '.&-]*?)(?=\s+SS\d+\b|\s+day \d|\s+Day \d|\s+Gorge|$)/g)) {
    const code = `SS${Number(match[1])}`
    if (!index.has(code)) index.set(code, match[2].trim())
  }
  return index
}

interface EventFile {
  stages: Stage[]
  closures: Closure[]
  spectators?: Record<string, { url: string }>
}

async function checkLinks(
  event: EventFile,
  mids: Set<string>,
): Promise<{ url: string; status: string }[]> {
  const urls = new Set<string>([
    ...Object.values(PAGES),
    'https://tiles.openfreemap.org/styles/liberty',
    'https://www.openstreetmap.org/copyright',
    ...Object.values(event.spectators ?? {}).map((s) => s.url),
    ...[...mids].map((mid) => `https://www.google.com/maps/d/viewer?mid=${mid}`),
  ])

  return Promise.all(
    [...urls].sort().map(async (url) => {
      try {
        const response = await fetch(url, { redirect: 'follow' })
        return { url, status: String(response.status) }
      } catch (error) {
        return { url, status: error instanceof Error ? error.message : 'failed' }
      }
    }),
  )
}

// Divergences already reviewed and deliberately kept. Anything not listed here
// is new since the last run and needs a decision, which is the point of the
// report: nothing gets corrected silently, and nothing gets re-litigated.
const ACKNOWLEDGED: { match: RegExp; why: string }[] = [
  {
    match: /^SS(3|9) — finish .*Rdtion/,
    why: 'Source typo: the tail of "Intersection" is run into the road name. The sensible reading is kept and the raw text is recorded in the closure notes.',
  },
  {
    match: /^SS14 — finish .*remains open to public/,
    why: 'The parenthetical is carried as a closure note instead of inside the finish location, so the location stays a location.',
  },
  {
    match: /^SS16 — intersections/,
    why: 'Source misspells Lobethal Rd as "Lobthal Rd" and lists Boundary Dr twice. The corrected, de-duplicated run is kept and the raw text is recorded in the closure notes.',
  },
  {
    match: /^SS27 — name/,
    why: 'Source labels both SS25 and SS27 "Strathalbyn Town Stage 1". SS27 is stage 2; the defect is recorded in the closure notes.',
  },
]

async function main() {
  await mkdir(resolve(DATA, 'raw'), { recursive: true })

  const closuresText = await page('road-closures')
  const routeText = await page('route')
  const event = JSON.parse(await readFile(resolve(DATA, 'event.json'), 'utf8')) as EventFile
  const geometry = new Set<string>()
  const geometryMids = new Set<string>()
  let withElevation = 0
  for (const day of [1, 2, 3]) {
    const fc = JSON.parse(
      await readFile(resolve(DATA, 'geometry', `day-${day}.geojson`), 'utf8'),
    ) as {
      features: {
        properties: { featureId: string; sourceMid: string }
        geometry: { coordinates: number[][] }
      }[]
    }
    for (const feature of fc.features) {
      geometry.add(feature.properties.featureId)
      geometryMids.add(feature.properties.sourceMid)
      if (feature.geometry.coordinates.every((c) => c.length > 2 && Number.isFinite(c[2]))) {
        withElevation++
      }
    }
  }

  const published = parseClosures(closuresText)
  const index = parseIndex(closuresText)
  const routeIndex = parseIndex(routeText)

  const findings: string[] = []
  const rows: string[] = []

  for (const stage of event.stages) {
    const closure = event.closures.find((c) => c.id === stage.closureId)!
    const block = published.find((p) => p.codes.includes(stage.code))
    const issues: string[] = []

    if (!block) {
      issues.push('no closure block found on the source page')
    } else {
      if (block.closesAt !== closure.closesAt) {
        issues.push(`closesAt ${closure.closesAt} vs published ${block.closesAt ?? 'unparsed'}`)
      }
      if (block.reopensAt !== closure.reopensAt) {
        issues.push(`reopensAt ${closure.reopensAt} vs published ${block.reopensAt ?? 'unparsed'}`)
      }
      if (normalise(block.roadsClosed) !== normalise(closure.roadsClosed.join(' '))) {
        issues.push(`roads "${closure.roadsClosed.join(', ')}" vs published "${block.roadsClosed}"`)
      }
      if (normalise(block.start) !== normalise(closure.start)) {
        issues.push(`start "${closure.start}" vs published "${block.start}"`)
      }
      if (normalise(block.finish) !== normalise(closure.finish)) {
        issues.push(`finish "${closure.finish}" vs published "${block.finish}"`)
      }
      if (normalise(block.intersections) !== normalise(closure.intersections.join(' '))) {
        issues.push(
          `intersections "${closure.intersections.join(', ') || 'none'}" vs published "${block.intersections}"`,
        )
      }
      // A sub-window sentence must survive into the closure notes, or the
      // narrower closure it describes would be lost.
      if (block.note && !closure.notes.some((n) => /sub-window/i.test(n))) {
        issues.push(`published note not carried into closure notes: "${block.note}"`)
      }
      if (block.codes.join(',') !== closure.stageCodes.join(',')) {
        issues.push(`grouping ${closure.stageCodes.join('+')} vs published ${block.codes.join('+')}`)
      }
    }

    const publishedName = index.get(stage.code)
    if (publishedName && normalise(publishedName) !== normalise(stage.name)) {
      issues.push(`name "${stage.name}" vs published "${publishedName}"`)
    }
    if (stage.featureId && !geometry.has(stage.featureId)) {
      issues.push(`featureId ${stage.featureId} does not resolve`)
    }
    if (!stage.featureId) issues.push('no geometry (featureId is null)')

    rows.push(
      `| ${stage.code} | ${stage.name} | ${closure.closesAt}–${closure.reopensAt} | ${
        stage.featureId ?? '—'
      } | ${issues.length === 0 ? 'match' : issues.length + ' difference(s)'} |`,
    )
    for (const issue of issues) findings.push(`${stage.code} — ${issue}`)
  }

  const missing = [...Array(30).keys()]
    .map((i) => `SS${i + 1}`)
    .filter((code) => !event.stages.some((s) => s.code === code))
  for (const code of missing) findings.push(`${code} — missing from event.json`)

  const reviewed: string[] = []
  const unreviewed: string[] = []
  for (const finding of findings) {
    const known = ACKNOWLEDGED.find((a) => a.match.test(finding))
    if (known) reviewed.push(`- **${finding}**\n  - ${known.why}`)
    else unreviewed.push(`- **${finding}**`)
  }

  const links = noFetch ? [] : await checkLinks(event, geometryMids)

  const report = [
    `# ${YEAR} data verification`,
    '',
    `Generated by \`npm run verify\` against the organisers' pages on ${new Date().toISOString().slice(0, 10)}.`,
    'Differences are reported, never silently corrected.',
    '',
    '## Stage by stage',
    '',
    '| Stage | Name | Window | Feature | Result |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    '## Unreviewed differences',
    '',
    unreviewed.length === 0
      ? 'None. Every stage matches the published closure detail, apart from the reviewed divergences below.'
      : unreviewed.join('\n'),
    '',
    '## Reviewed divergences',
    '',
    'Kept deliberately. Each is recorded in the closure notes so it reaches the reader too.',
    '',
    reviewed.length === 0 ? 'None.' : reviewed.join('\n'),
    '',
    '## Source page cross-check',
    '',
    `- Closures page indexes ${index.size} stage codes; route page indexes ${routeIndex.size}.`,
    `- Closure blocks parsed from the closures page: ${published.length}.`,
    `- Stages in event.json: ${event.stages.length}. Closures: ${event.closures.length}. Features: ${geometry.size}.`,
    `- Every stage SS1–SS30 present: ${missing.length === 0 ? 'yes' : `no (${missing.join(', ')})`}.`,
    `- Features carrying elevation: ${withElevation} of ${geometry.size}.`,
    '',
    '## External links',
    '',
    ...(links.length === 0
      ? ['Skipped (`--no-fetch`).']
      : ['| URL | Status |', '|---|---|', ...links.map((l) => `| ${l.url} | ${l.status} |`)]),
    '',
  ].join('\n')

  await mkdir(resolve(ROOT, 'docs'), { recursive: true })
  await writeFile(resolve(ROOT, 'docs', `verification-${YEAR}.md`), report, 'utf8')
  console.log(report)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

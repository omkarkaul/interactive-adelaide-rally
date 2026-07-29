import { XMLParser } from 'fast-xml-parser'

export interface KmlTerminus {
  name: string
  coordinate: [number, number]
}

export interface KmlFolder {
  rawName: string
  codes: string[]
  name: string
  featureId: string
  line: [number, number][] | null
  termini: KmlTerminus[]
}

export interface KmlDocument {
  name: string
  folders: KmlFolder[]
}

const COORD_PRECISION = 6
const DASH_CLASS = '\\u2010-\\u2015\\-:'
const CODE_TOKEN = /SS\s*0*(\d+)/gi

export function round(n: number, dp = COORD_PRECISION): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function stageCodesIn(raw: string): string[] {
  const codes: string[] = []
  for (const match of raw.matchAll(CODE_TOKEN)) {
    const code = `SS${Number(match[1])}`
    if (!codes.includes(code)) codes.push(code)
  }
  return codes
}

function stripCodesAndSeparators(segment: string): string {
  return segment
    .replace(CODE_TOKEN, '')
    .replace(new RegExp(`^[\\s${DASH_CLASS}]+`), '')
    .replace(new RegExp(`[\\s${DASH_CLASS}]+$`), '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseFolderName(raw: string): {
  codes: string[]
  name: string
  featureId: string
} {
  const trimmed = raw.trim()
  const codes = stageCodesIn(trimmed)

  const name =
    trimmed
      .replace(new RegExp(`SS\\s*0*\\d+\\s*[${DASH_CLASS}]?\\s*`, 'gi'), '')
      .replace(/^\s*&\s*/, '')
      .replace(/\s+/g, ' ')
      .trim() || trimmed

  const segmentNames = trimmed
    .split(/\s*&\s*/)
    .map(stripCodesAndSeparators)
    .filter(Boolean)

  const base = segmentNames[0] ?? name
  // Folders that merge repeated runs suffix a run number ("Cherryville Plus 1");
  // the shared feature must slug to the run-agnostic name.
  const featureBase = codes.length > 1 ? base.replace(/\s+\d+$/, '') : base

  return { codes, name, featureId: slugify(featureBase) || slugify(trimmed) }
}

export function parseCoordinates(text: string): [number, number][] {
  return text
    .trim()
    .split(/\s+/)
    .map((triple) => triple.split(','))
    .filter((parts) => parts.length >= 2)
    .map((parts) => [round(Number(parts[0])), round(Number(parts[1]))] as [number, number])
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

type XmlNode = Record<string, unknown>

function text(node: unknown): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (node && typeof node === 'object' && '#text' in (node as XmlNode)) {
    return String((node as XmlNode)['#text'])
  }
  return ''
}

function collectLineStrings(placemark: XmlNode): [number, number][][] {
  const geometries: [number, number][][] = []
  for (const ls of asArray(placemark.LineString as XmlNode | XmlNode[] | undefined)) {
    const coords = parseCoordinates(text(ls.coordinates))
    if (coords.length > 1) geometries.push(coords)
  }
  for (const mg of asArray(placemark.MultiGeometry as XmlNode | XmlNode[] | undefined)) {
    geometries.push(...collectLineStrings(mg))
  }
  return geometries
}

function collectPoints(placemark: XmlNode): [number, number][] {
  const points: [number, number][] = []
  for (const pt of asArray(placemark.Point as XmlNode | XmlNode[] | undefined)) {
    const coords = parseCoordinates(text(pt.coordinates))
    if (coords.length === 1) points.push(coords[0])
  }
  for (const mg of asArray(placemark.MultiGeometry as XmlNode | XmlNode[] | undefined)) {
    points.push(...collectPoints(mg))
  }
  return points
}

function folderFrom(node: XmlNode): KmlFolder | null {
  const rawName = text(node.name).trim()
  if (!rawName) return null

  let line: [number, number][] | null = null
  const termini: KmlTerminus[] = []

  for (const placemark of asArray(node.Placemark as XmlNode | XmlNode[] | undefined)) {
    const placemarkName = text(placemark.name).trim()
    for (const coords of collectLineStrings(placemark)) {
      if (!line || coords.length > line.length) line = coords
    }
    for (const point of collectPoints(placemark)) {
      termini.push({ name: placemarkName, coordinate: point })
    }
  }

  const { codes, name, featureId } = parseFolderName(rawName)
  return { rawName, codes, name, featureId, line, termini }
}

function walkFolders(node: XmlNode, out: KmlFolder[]): void {
  for (const folder of asArray(node.Folder as XmlNode | XmlNode[] | undefined)) {
    const parsed = folderFrom(folder)
    if (parsed && (parsed.line || parsed.termini.length)) out.push(parsed)
    walkFolders(folder, out)
  }
}

export function parseKml(xml: string): KmlDocument {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    parseTagValue: false,
  })
  const parsed = parser.parse(xml) as XmlNode
  const kml = (parsed.kml ?? parsed) as XmlNode
  const doc = asArray(kml.Document as XmlNode | XmlNode[] | undefined)[0] ?? kml

  const folders: KmlFolder[] = []
  walkFolders(doc, folders)

  // Some exports skip folders and hang stage placemarks directly off the document.
  if (folders.length === 0) {
    for (const placemark of asArray(doc.Placemark as XmlNode | XmlNode[] | undefined)) {
      const wrapped = folderFrom({ name: text(placemark.name), Placemark: placemark })
      if (wrapped && wrapped.line) folders.push(wrapped)
    }
  }

  return { name: text(doc.name).trim(), folders }
}

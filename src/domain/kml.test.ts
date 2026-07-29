import { describe, expect, it } from 'vitest'
import fixture from '../../tests/fixtures/two-folders.kml?raw'
import { parseCoordinates, parseFolderName, parseKml, slugify, stageCodesIn } from './kml'

describe('parseFolderName', () => {
  it('splits an en-dash folder joining two runs', () => {
    const parsed = parseFolderName('SS3 – Knotts Hill & SS9 – Knotts Hill Short')
    expect(parsed.codes).toEqual(['SS3', 'SS9'])
    expect(parsed.featureId).toBe('knotts-hill')
  })

  it('splits a hyphen folder whose name itself contains an ampersand', () => {
    const parsed = parseFolderName('SS4 & SS7 - Cherryville Plus 1 & 2')
    expect(parsed.codes).toEqual(['SS4', 'SS7'])
    expect(parsed.name).toBe('Cherryville Plus 1 & 2')
    expect(parsed.featureId).toBe('cherryville-plus')
  })

  it('handles a single-stage folder', () => {
    const parsed = parseFolderName('SS1 - Beaumont')
    expect(parsed.codes).toEqual(['SS1'])
    expect(parsed.name).toBe('Beaumont')
    expect(parsed.featureId).toBe('beaumont')
  })

  it('keeps a run number when the folder holds only one stage', () => {
    expect(parseFolderName('SS5 - Vista 1').featureId).toBe('vista-1')
    expect(parseFolderName('SS18 – Vista 2').featureId).toBe('vista-2')
  })

  it('tolerates a missing separator and stray punctuation', () => {
    expect(parseFolderName('SS12 HERMITAGE').featureId).toBe('hermitage')
    expect(parseFolderName('SS23 – Mt. Lofty').featureId).toBe('mt-lofty')
  })

  it('reads codes in order and de-duplicates', () => {
    expect(stageCodesIn('SS6 Norton Summit & SS10 Teringie & SS6')).toEqual(['SS6', 'SS10'])
  })
})

describe('slugify', () => {
  it('produces kebab-case ascii', () => {
    expect(slugify('Old Norton Summit')).toBe('old-norton-summit')
    expect(slugify('  Chain of Ponds  ')).toBe('chain-of-ponds')
  })
})

describe('parseCoordinates', () => {
  it('drops altitude and rounds to six decimal places', () => {
    expect(parseCoordinates('138.7401234567,-34.9187654321,0')).toEqual([[138.740123, -34.918765]])
  })

  it('splits on any whitespace', () => {
    expect(parseCoordinates('138.80,-34.88,0\n  138.81,-34.89,0')).toHaveLength(2)
  })
})

describe('parseKml', () => {
  const document = parseKml(fixture)

  it('reads the document name and ignores styles', () => {
    expect(document.name).toBe('2026 Shannons Adelaide Rally Day 1')
    expect(document.folders).toHaveLength(2)
  })

  it('takes the LineString placemark as the stage geometry', () => {
    const knotts = document.folders[0]
    expect(knotts.featureId).toBe('knotts-hill')
    expect(knotts.line).toEqual([
      [138.740123, -34.918765],
      [138.741235, -34.919877],
      [138.742346, -34.920988],
    ])
  })

  it('takes the Point placemarks as termini', () => {
    expect(document.folders[0].termini.map((t) => t.name)).toEqual([
      '215 Marble Hill Rd, Marble Hill SA 5137, Australia',
      '1 Pound Rd, Marble Hill SA 5137, Australia',
    ])
    expect(document.folders[1].termini).toHaveLength(1)
  })
})

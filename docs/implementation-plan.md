# Adelaide Rally interactive map — implementation plan

## Goal

Consolidate the 2026 Shannons Adelaide Rally routes and road closures into a single interactive map, selectable by day, with a stage panel that focuses a route and its closure on hover/select. Built so that adding historical years is a data drop, not a code change.

Replaces two disjoint pages:
- https://www.adelaiderally.com.au/route — image tiles linking to Google My Maps
- https://www.adelaiderally.com.au/road-closures — prose closure detail

## Decisions already made

| Decision | Choice |
|---|---|
| Stack | Vite + React + TypeScript, Vitest |
| Map | MapLibre GL JS v6 |
| Basemap | OpenFreeMap (keyless vector tiles) |
| Geometry source | Committed GeoJSON snapshots, ingested from Google My Maps KML |
| Geometry math | turf.js (modular imports) |
| Charting | Hand-rolled SVG. No charting library. |
| deck.gl | Not used |

Hard rule: `src/domain/**` imports nothing from React, MapLibre, or the DOM.

---

## Toolchain

All repo-level dependencies are managed by [hermit](https://cashapp.github.io/hermit/). No globally installed Node, npm, or any other binary is used or assumed — a fresh clone plus `. ./bin/activate-hermit` is the whole setup.

Bootstrap, run once locally:

```
hermit init
. ./bin/activate-hermit
hermit install node
```

`hermit init` creates `bin/` containing `hermit`, `activate-hermit`, `hermit.hcl` and `README.hermit.md`. Installing a package adds a symlink stub alongside them. **All of `bin/` is committed** — that is what makes the environment self-bootstrapping.

Rules:

- Every binary the project needs is a hermit package. If a phase needs a new tool, `hermit install <pkg>` and commit the stub with that phase.
- `.hermit/` (the local package cache) is gitignored. `bin/` is not.
- Scripts and CI reference tools through the activated environment, never through an absolute or global path.
- Pin the Node major version explicitly, e.g. `hermit install node@22`, so the toolchain is reproducible across machines and years.
- CI adds `<repo>/bin` to `$PATH`, or runs `./bin/hermit env` to export the environment.

Note for an executing agent: run the bootstrap on the developer's machine, not in a sandbox. Hermit resolves platform-specific binaries at activation, and installing hermit itself requires fetching its install script.

## Git workflow

- `git init` at the start of phase 0.
- **One commit per phase.** Do not commit mid-phase, and do not batch phases into a single commit.
- A phase is only committed once its exit criteria are met and `npm test` is green.
- Commit message format: `phase N: <what the phase achieved>`, with the exit criteria in the body.
- Prefer new commits over amending. Never force push. Never `reset --hard` without asking.
- Do not push unless explicitly asked.
- `.gitignore` covers `node_modules/`, `dist/`, `.hermit/`, `.DS_Store`. It does not cover `bin/` or anything under `data/` — committed snapshots are the provenance record and must be diffable.

---

## Source data

### KML endpoints

`https://www.google.com/maps/d/kml?mid=<MID>&forcekml=1`

| Map | MID | Notes |
|---|---|---|
| Day 1 | `1Afv-5RMTbEXqJNsyUOICNB-Ts7k_294` | SS1–SS11 |
| Day 2 | `1xpCx2cH8NgllswJUHqF5qYiHQx8LYPg` | SS12–SS22 |
| Day 3 | `1G00Y3xegPVNWTDaunvk_IWY_Kec0lLQ` | SS23–SS30 |
| SS4 standalone | `1t-o-bkXJ-oGyjRwyu4S2vuZSSTRudYDd` | Duplicates Day 1 content; reconcile |
| SS29 tile | `1knso66fdXIxKfe8d3tBXOxI4yW7XhGU3` | Filed under Day 2 on the site; SS29 is a Day 3 stage |
| Gorge rallysprint | `1Io0-kvxO3FFKarmYcScnLz31c3cs80M` | Out of scope for v1; ingest and park |

### KML shape

```
Document
  name                          "2026 Shannons Adelaide Rally Day 1"
  Style / StyleMap              ignore
  Folder                        one per stage group
    name                        "SS4 & SS7 - Cherryville Plus 1 & 2"
    Placemark                   the stage line
      name                      same as folder name
      LineString/coordinates    lon,lat,0 triples, newline separated
    Placemark × 2               start/end address markers
      name                      "215 Marble Hill Rd, Marble Hill SA 5137, Australia"
      Point/coordinates
```

Folder-name separators are inconsistent: hyphen `-` and en dash `–` both appear, and multi-stage folders join with `&`. Parse defensively.

Observed Day 1 folders: `SS1 - Beaumont`, `SS2 - Carey Gully`, `SS3 – Knotts Hill & SS9 – Knotts Hill Short`, `SS4 & SS7 - Cherryville Plus 1 & 2`, `SS5 - Vista 1`, `SS6 & SS10 - Old Norton Summit 1 & 2`, plus SS8 and SS11 (unverified — response truncation during recon).

Observed Day 2 folders: `SS12 - Hermitage`, `SS13 - Chain of Ponds Long`, `SS14 - Black Hill`, `SS15 & SS19 - Norton Summit 1 & 2`, `SS16 - Knotts Range`, plus remainder unverified.

### Known source defects

Carry these forward; do not silently correct.

- SS25 and SS27 are both labelled "Strathalbyn Town Stage 1" on the closures page. SS27 is stage 2.
- SS29 Warrawong appears in the Day 2 section of `/route` but is listed as Day 3 on `/road-closures`. Treat Day 3 as authoritative.
- SS29 Warrawong is SS24 Mylor reversed — same roads, start and finish swapped, identical closure window. Each gets its own feature, stored in its own run direction. Orientation is resolved at ingest and never at runtime.
- SS13 Chain of Ponds Long overlaps SS17 Millbrook. The site flags this explicitly.
- Route page tiles link to `/maps/d/u/0/edit?mid=` — edit URLs. Assume the maps are unstable and possibly world-writable.
- Tile images are named `StageMaps2024_*`. 2024 artwork reused for 2026; do not trust tiles as a data source.
- `/route` says "Stages in GREEN are spectator stages" but colour is not recoverable from text extraction. Spectator flags must be sourced from the site nav instead: Wairoa (SS20), Strathalbyn (SS25/SS27), plus Bridgewater lunch stop and North Adelaide finale which are not stages.
- Day 1 closure times carry no caveat. Days 2 and 3 state "all closure times are yet to be confirmed" — set `confirmed: false` for every closure on those days.

---

## Project structure

```
adelaide-rally/
├── data/
│   └── 2026/
│       ├── event.json
│       ├── geometry/day-{1,2,3}.geojson
│       ├── raw/*.kml
│       └── sources.json
├── scripts/
│   ├── ingest-kml.ts
│   └── enrich-elevation.ts
├── src/
│   ├── domain/
│   │   ├── types.ts
│   │   ├── registry.ts
│   │   ├── load.ts
│   │   ├── link.ts
│   │   ├── detail.ts
│   │   ├── profile.ts
│   │   ├── cursor.ts
│   │   ├── focus.ts
│   │   └── time.ts
│   ├── map/
│   │   ├── RallyMap.tsx
│   │   ├── layers.ts
│   │   └── basemap.ts
│   ├── ui/
│   │   ├── DayTabs.tsx
│   │   ├── StagePanel.tsx
│   │   ├── TimeScrubber.tsx
│   │   ├── ClosureGantt.tsx
│   │   ├── StageDetail.tsx
│   │   ├── ElevationProfile.tsx
│   │   └── SafetyNotice.tsx
│   ├── url.ts
│   └── App.tsx
└── tests/
```

Tests colocate as `*.test.ts` beside the domain modules they cover.

---

## Data model

`src/domain/types.ts`:

```ts
export type StageCode = string

export interface RallyEvent {
  year: number
  name: string
  days: RallyDay[]
}

export interface RallyDay {
  dayNumber: number
  date: string
  label: string
}

export interface Stage {
  code: StageCode
  name: string
  day: number
  order: number
  spectator: boolean
  featureId: string | null
  closureId: string
}

export interface Closure {
  id: string
  stageCodes: StageCode[]
  roadsClosed: string[]
  start: string
  finish: string
  intersections: string[]
  closesAt: string
  reopensAt: string
  confirmed: boolean
  notes: string[]
}

export interface SourceRecord {
  mid: string
  url: string
  fetchedAt: string
  sha256: string
  documentName: string
}

export interface RallyYear {
  event: RallyEvent
  stages: Stage[]
  closures: Closure[]
  features: GeoJSON.FeatureCollection<GeoJSON.LineString>
  sources: SourceRecord[]
}

export interface ProfileSample {
  distanceKm: number
  elevationM: number
  gradePct: number
}

export interface Profile {
  samples: ProfileSample[]
  lengthKm: number
  climbM: number
  descentM: number
  maxGradePct: number
  netM: number
}

export interface SpectatorInfo {
  name: string
  url: string
  description: string
}

export interface StageDetail {
  code: StageCode
  runsAs: StageCode[]
  name: string
  day: number
  line: GeoJSON.Feature<GeoJSON.LineString>
  closure: Closure
  profile: Profile | null
  spectator: SpectatorInfo | null
  officialMapUrl: string | null
}

export type Focus =
  | { kind: 'none' }
  | { kind: 'hover'; code: StageCode }
  | { kind: 'selected'; code: StageCode }

export interface Cursor {
  code: StageCode
  distanceKm: number
}
```

`line` and `closure` are required — every stage provably has both. Everything else is nullable and its UI section does not render when absent.

### Data structure to feature surface

| Structure | Powers |
|---|---|
| `RallyDay[]` | Day tabs, default camera bounds |
| `Stage.featureId` (many→one) | Shared geometry for SS4/SS7, SS3/SS9, SS6/SS10, SS15/SS19, SS25/SS27, SS26/SS28 |
| `Stage.closureId` (many→one) | Merged closure cards, repeat-run note |
| `Closure.closesAt/reopensAt` | Scrubber, Gantt bars, closed-now styling |
| `Closure.confirmed` | Provisional treatment on days 2–3 |
| `Closure.roadsClosed` | Searchable text block |
| `Closure.intersections` | Profile ticks, plan-view pins |
| `LineString` coords | Map render, focus bbox, length |
| `LineString` z values | `Profile`, grade colouring on both views |
| `Cursor` | Single scalar linking plan view and profile |
| `Focus` | Hover dim, sticky select, camera |
| `sources.json` | Provenance footer, staleness, diffable history |
| `registry.ts` | Year selector; adding 2025 is a directory |

---

## Phases

### Phase 0 — Scaffold

Achieves: toolchain proven before data exists.

- `git init`; add `.gitignore`
- `hermit init`, then `hermit install node@22`; commit `bin/`
- `. ./bin/activate-hermit` before any subsequent command
- `npm create vite@latest . -- --template react-ts`
- Add `maplibre-gl`, `@turf/turf` (or per-function packages), `vitest`, `@testing-library/react`, `jsdom`
- `vite.config.ts`: test environment `jsdom`, globals on
- `src/map/basemap.ts` exports the OpenFreeMap style URL: `https://tiles.openfreemap.org/styles/liberty`
- `RallyMap.tsx` renders a full-height map centred on Adelaide Hills, roughly `[138.75, -34.93]`, zoom 10
- `npm run dev`, `npm run build`, `npm test` all pass

Exit: map of Adelaide renders, one trivial passing test, hermit environment committed. Commit as `phase 0: scaffold`.

### Phase 1 — Ingest and provenance

Achieves: `data/2026/` complete, committed, and reproducible.

**Note for the executing agent:** `web_fetch` truncates responses around 78k characters, which is smaller than these KML files. Ingest must run as a Node script on the user's machine, not through agent web fetching. Write the script, ask the user to run `npm run ingest`, then work from the emitted files.

`scripts/ingest-kml.ts`:

1. For each MID, fetch KML, write verbatim to `data/2026/raw/<mid>.kml`, record sha256 and timestamp in `sources.json`
2. Parse with `fast-xml-parser` or `@xmldom/xmldom`. Do not regex XML.
3. For each `Folder`: take the `LineString` placemark as the stage geometry, the `Point` placemarks as terminus markers
4. Parse folder name into stage codes and a display name. Handle `-`, `–`, and `&`. Example: `SS3 – Knotts Hill & SS9 – Knotts Hill Short` → codes `[SS3, SS9]`, name `Knotts Hill`
5. Assign a stable `featureId` — slug of the display name, e.g. `cherryville-plus`
6. Emit `data/2026/geometry/day-N.geojson`, one `Feature<LineString>` per group, properties `{ featureId, stageCodes, name }`
7. Reconcile: if the same `featureId` appears in more than one MID, prefer the day map and log the duplicate. Do not emit twice.
8. Coordinate precision: round to 6 decimal places

Feature granularity follows the source: **one feature per KML folder.** Where the organisers merged repeated runs into a single folder — `SS4 & SS7`, `SS3 – Knotts Hill & SS9` — that is one feature and both stages point at it, which is what makes the map draw one line and the Gantt show one closure bar. Where the source gives separate folders, emit separate features. Do not merge geometries the source kept apart, and do not split ones it merged.

Coordinate order is the run direction. If a stage's geometry has to be derived by reversing another's, reverse the coordinate array in this script and emit an independent, correctly-oriented feature. Nothing downstream should ever need to know.

`data/2026/event.json` is hand-curated from the closures page. Seed data below is authoritative as captured 29 Jul 2026.

**Day 1 — 16 October. `confirmed: true`.**

| Stages | Name | Window | Roads closed | Start | Finish | Intersections |
|---|---|---|---|---|---|---|
| SS1 | Beaumont | 07:45–12:45 | Hayward Dve | Caithness Ave & Hayward Dr | Centre Track & Hayward Dve | — |
| SS2 | Carey Gully | 07:55–12:55 | Greenhill Rd | Beaumont Rd & Greenhill Rd | Deviation Rd & Greenhill Rd | Tanahmerah Rd, Ostigh Rd |
| SS3 | Knotts Hill | 08:40–18:30 | Hunters Rd, Knotts Hill Rd, Pound Rd | Hunters Rd/Lobethal Rd | Pound Rd/Marble Hill Rd | Blockers Rd, Burdetts Rd, Raymonds Rd, Osborne Rd, Wightmans Rd |
| SS4, SS7 | Cherryville Plus 1 & 2 | 09:10–17:10 | Marble Hill Rd, Montacute Rd, Corkscrew Rd, Gorge Rd | Tembys Rd/Marble Hill Rd | Prairie Rd/Gorge Rd | Old Cherryville Rd, Cherryville Rd, Narrow Range Rd, Hill Rd, Montacute Rd, Church Rd, Valley Rd, Gorge Rd, Batchelor Rd |
| SS5 | Vista 1 | 09:30–15:00 | Lower North East Rd | Range Rd Sth | Perseverance Rd | — |
| SS6, SS10 | Old Norton Summit 1 & 2 | 11:10–18:35 | Old Norton Summit Rd | Horsnells Gully Rd | Lobethal Rd | — |
| SS8 | Stafford Hillclimb | 11:25–17:40 | Fox Creek Rd, Mawson Trail, Staffords Rd | Fox Creek Bike Park Carpark | Staffords Rd ~750m from Mawson Trail | Croft Rd, Coldstore Rd |
| SS9 | Knotts Hill Short | 08:40–18:30 | Hunters Rd, Knotts Hill Rd, Pound Rd | Hunters Rd/Lobethal Rd | Pound Rd/Marble Hill Rd | Blockers Rd, Burdetts Rd |
| SS11 | Summit Road | 13:40–19:10 | Mt Lofty Summit Rd | Greenhill Rd | Cleland Wildlife Park Entry | — |

SS3 and SS9 share one KML geometry despite SS9 being the short version. Set both `featureId` to the shared feature and add a note: geometry shown is the full-length SS3 route.

**Day 2 — 17 October. `confirmed: false` for all.**

| Stages | Name | Window | Roads closed | Start | Finish | Intersections |
|---|---|---|---|---|---|---|
| SS12 | Hermitage | 07:45–13:30 | Range Rd North, Seaview Rd, One Tree Hill Rd | Verrall Rd (North) | Hannaford Hump Rd | One Tree Hill Rd, Seaview Rd |
| SS13 | Chain of Ponds Long | 08:15–13:20 | North East Rd, Tippett Rd | Fiddlers Hill Rd | Gorge Rd | Ballans Rd, Millbrook Rd, Tippett Rd, Sunninghill Rd |
| SS14 | Black Hill | 08:30–14:15 | Corkscrew Rd, Montacute Rd | Corkscrew Rd | Black Hill Conservation Park Entry | Montacute Rd, Institute Rd, Smiths Gully Rd |
| SS15, SS19 | Norton Summit 1 & 2 | 08:45–18:00 | (New) Norton Summit Rd | Coach House Dr | Lobethal Rd | Teringie Dr, Valley Dr, Ridgeland Dr |
| SS16 | Knotts Range | 10:45–16:30 | Pound Rd, Knotts Hill Rd, Hunters Rd, Lobethal Rd, Deviation Rd | Marble Hill Rd | Boundary Dr (South) | Wightmans Rd, Osborne Rd, Raymonds Rd, Burdetts Rd, Blockers Rd, Lobethal Rd, Steer Rd, Mawson Rd, Deviation Rd, Boundary Dr, Kneen Ln |
| SS17 | Millbrook | 08:15–17:00 | Tippett Rd, North East Rd | Gorge Rd | Millbrook Rd | North East Rd |
| SS18 | Vista 2 | 11:45–17:15 | Lower North East Rd | Range Rd South | Perseverance Rd | — |
| SS20 | Wairoa | 12:15–19:30 | Mount Barker Rd | Kingsland Rd | Snows Rd | Euston Rd, Kemp Rd, Arkaba Rd, Glades Ln |
| SS21 | Skinny Pole | 13:15–17:45 | Pole Rd | Learmonth Ct | Upper Sturt Rd | — |
| SS22 | Windy Point | 14:15–18:00 | Belair Rd | Cornish Ct | Culley Ave | Kalyra Rd, Marina Ave, Aerial Rd, Briar Grove |

Notes: SS13 overlaps SS17. SS14 finish point remains open to the public. SS20 has a sub-window — Mount Barker Rd between Kingsland Rd and Euston Rd closed 13:30–18:00. SS20 is a spectator stage.

**Day 3 — 18 October. `confirmed: false` for all.**

| Stages | Name | Window | Roads closed | Start | Finish | Intersections |
|---|---|---|---|---|---|---|
| SS23 | Mt Lofty | 08:00–13:30 | Greenhill Rd, Mt Lofty Summit Rd | 661 Greenhill Rd | Cleland Wildlife Park Entry | Quintin Ave, Yarrabee Rd, Yanagin Rd, Sprigg Rd, Gores Rd |
| SS24 | Mylor | 08:15–17:30 | Forbes Rd, Aldgate Valley Rd | Emery Rd | Stock Rd & Aldgate Valley Rd | Williams Rd, Aldgate Valley Rd, Shanks Rd, Blackwood Ln, Kiley Rd, Stevens Ln, Mi Mi Rd, Nation Ridge Rd |
| SS25, SS27 | Strathalbyn Town Stage 1 & 2 | 08:00–18:00 | Commercial Rd, Albyn Tce, Catherine St, Donald St, Rankine St, Sunter St | North Parade | Grey St | Donald St, Catherine St, Rankine St, Albyn Tce, Alfred Pl, River Ln, Swale St |
| SS26, SS28 | Macclesfield 1 & 2 | 09:00–17:30 | Strathalbyn Rd | Waterman Rd | Cosgrove Rd | Nyoka Rd |
| SS29 | Warrawong | 08:15–17:30 | Aldgate Valley Rd, Forbes Rd | Stock Rd | Emery Rd | Nation Ridge Rd, Mi Mi Rd, Stevens Ln, Kiley Rd, Blackwood Ln, Shanks Rd, Aldgate Valley Rd, Williams Rd |
| SS30 | Manoah | 12:30–17:45 | Sturt Valley Rd | Longwood Dr | Elmstead Dr | Heather Rd, Ironbank Rd, Whitewood Dr, Manoah Dr, Wychwood Gr |

Notes: SS25/SS27 has a sub-window — Albyn Terrace between Dawson St and 23 Albyn Terrace closed 08:00–13:00. SS25/SS27 is a spectator stage. SS24 and SS29 run the same roads in opposite directions across an identical window; emit two features, each oriented in its own run direction.

Exit: `data/2026/` committed. All 30 stages present in `event.json`. Every `featureId` referenced resolves to a feature in a day GeoJSON, or is explicitly `null` with a logged reason. Commit as `phase 1: ingest and provenance`.

### Phase 2 — Domain layer

Achieves: multi-year correctness, fully tested, zero UI.

- `registry.ts` — `availableYears(): number[]`, `datasetPath(year): string`
- `load.ts` — `loadYear(year): Promise<RallyYear>`, fetches JSON, validates shape
- `link.ts` — `stagesForDay`, `featureForStage`, `closureForStage`, `stagesSharingFeature`
- `detail.ts` — `resolveStageDetail(year: RallyYear, code: StageCode): StageDetail`
- `time.ts` — `parseWindow('09:10','17:10')`, `isClosedAt(closure, minutes)`, `formatWindow`
- `focus.ts` — reducer over `Focus`, plus `emphasis(focus, code): 'focused' | 'dimmed' | 'normal'`
- `profile.ts` — `buildProfile(line, lengthKm): Profile`, smoothing over a ~200m window
- `cursor.ts` — `cursorFromPoint(line, point, previous?): Cursor`, `pointFromCursor(line, cursor)`

Tests, all required:

- Every stage SS1–SS30 resolves to a closure and to a feature or explicit null. This is the guard rail for future years.
- Shared-geometry groups resolve to one feature: SS4/SS7, SS3/SS9, SS6/SS10, SS15/SS19, SS25/SS27, SS26/SS28
- `emphasis` truth table: selection outranks hover, dimming applies only to non-focused when something is focused
- `isClosedAt` boundary cases at exactly `closesAt` and `reopensAt`
- `cursorFromPoint` continuity: given two candidate points equidistant from the pointer, the one nearer `previous` wins
- KML parse fixture: a trimmed two-folder KML committed under `tests/fixtures/`, asserting folder-name splitting across `-`, `–` and `&`

Exit: `npm test` green, no React imported anywhere under `src/domain/`. Commit as `phase 2: domain layer`.

### Phase 3 — Day view

Achieves: the core consolidated view.

- `DayTabs` — day 1/2/3, date labels
- `RallyMap` — one GeoJSON source per day; casing layer plus line layer; symbol layer for termini
- `layers.ts` — paint expressions reading `feature-state` for `focused` and `dimmed`. Focus changes call `setFeatureState`, never add/remove layers.
- `StagePanel` — stages for the selected day in run order; code, name, closure window, roads
- Hover emits `{kind:'hover'}`, click emits `{kind:'selected'}`, click outside clears
- On select, `fitBounds` to the feature bbox with left padding equal to panel width; on deselect, fit to day bbox
- Transparent 20px hit layer under each line for pointer targeting

Exit: all three days render, focus and dim work from both map and panel, camera behaves. Commit as `phase 3: day view`.

### Phase 4 — Time

Achieves: the capability the official site does not have.

- `TimeScrubber` — range input over the day's closure envelope, 5-minute steps, formatted readout
- `ClosureGantt` — one row per closure group, bar spanning the window, now-line tracking the scrubber
- Map lines and Gantt bars restyle by `isClosedAt`
- Unconfirmed windows render visibly distinct — softened or hatched bar ends, and a provisional badge
- Hovering a Gantt row focuses the corresponding stage
- Default scrubber position: current time if the user is viewing during the event, otherwise the day's first closure

Exit: scrubbing changes closure state across map, panel and Gantt in sync. Commit as `phase 4: time`.

### Phase 5 — Stage detail

Achieves: the full per-stage view, driven entirely by `StageDetail`.

First, `scripts/enrich-elevation.ts`:
- Resample each LineString every ~50m
- Query OpenTopoData or decode AWS Terrarium tiles; cache aggressively
- Write z values into the committed GeoJSON, re-hash `sources.json`
- Idempotent — skips features that already carry z

Then `StageDetail.tsx`, rendering in this order. Nullable sections omit entirely when absent.

| Section | Source | Reason |
|---|---|---|
| Header | `code`, `runsAs`, `name`, `day` | SS4/SS7 ambiguity |
| Plan view | `line` | Spatial context, direction arrows |
| Profile | `profile` | Vertical character; null → omit |
| Stat strip | `profile` | Scannable at a glance |
| Closure window | `closure.closesAt/reopensAt/confirmed` | Most-asked question |
| Roads closed | `closure.roadsClosed` | Plain text; people scan for their street |
| Start / finish | `closure.start/finish` | Where the tape is |
| Intersections | `closure.intersections` | Resident lookup; also profile ticks |
| Repeat run | `runsAs.length > 1` | Road stays closed between runs |
| Spectator | `spectator` | Null → omit |
| Safety notice | static | Organiser requirement |
| Source | `sources` | Provenance and staleness |

Shared cursor:
- Single state `Cursor | null`, owned by `StageDetail`
- Map pointer → `cursorFromPoint(line, point, previous)`
- Profile pointer → index lookup into `profile.samples`
- Both views render markers from the same cursor
- Continuity bias is mandatory. Without it, the Corkscrew switchbacks make the marker teleport hundreds of metres between hairpin legs.
- rAF-throttle the map pointer handler
- Hit tolerance computed in screen pixels via `map.project()`, not degrees
- Plan view and profile share the gradient colour ramp so the two read as one object before any interaction

Exit: every stage opens a detail view. Stages without elevation render without a profile and without visual gaps. Commit as `phase 5: stage detail`, with the re-ingested elevation data in the same commit.

### Phase 6 — Mobile and accessibility

Achieves: usable on a phone at the roadside.

- Detail view stacks vertically with a sticky header carrying the closure window
- Profile is drag-to-scrub, `touch-action: none` so the gesture is not stolen by scroll
- Map is tap-to-place rather than hover
- Intersections and roads collapse behind "show all" beyond ~8 entries
- Day view on narrow screens: map plus bottom sheet for the stage list
- Keyboard: profile focusable, arrow keys step the cursor, `aria-live` announces distance, elevation, grade
- URL state in `url.ts`: `?year=2026&day=1&stage=SS4&t=14:30`, read on load, written on change without history spam

Exit: full flow works on a real phone. Keyboard reaches every interaction. Commit as `phase 6: mobile and accessibility`.

### Phase 7 — Verification

Achieves: confidence in the data and proof the year abstraction holds.

- Stage-by-stage diff of `event.json` against both source pages. Emit a report listing discrepancies. Do not silently correct.
- Confirm SS8 and SS11 geometry exists — unverified during recon
- Confirm SS24 and SS29 each carry geometry oriented in their own run direction — spot-check that the SS29 profile descends where SS24 climbs
- Add a second year fixture, synthetic if necessary, and assert the app renders it with no code change
- Lighthouse pass; mobile check on real hardware
- Verify every external link resolves

Exit: verification report committed. Two years render. Commit as `phase 7: verification`.

---

## Risks

| Risk | Handling |
|---|---|
| Google My Maps disappears or is re-keyed | Raw KML committed; app never fetches at runtime |
| Hairpin cursor teleporting | Continuity bias in `cursorFromPoint`; test covers it |
| DEM noise producing absurd gradients | Smooth over ~200m; label grade indicative |
| Times read as authoritative | `confirmed` flag surfaced; safety notice travels with every window |
| SS9 geometry is wrong | Annotate, do not fabricate a shortened line |
| Stage with no geometry | `featureId: null` renders a list-only card |

## Non-goals for v1

Gorge rallysprint closures, live timing, entrant data, cross-year diffing, 3D terrain, stage flythrough, address proximity search. Each is additive and none changes the data model.

## Attribution

Data is the organisers'. Every view carries a source link to adelaiderally.com.au, the capture date, a statement that this is not the official source, and the organisers' safety warning.

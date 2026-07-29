# Phase 7 verification report

Covers the 2026 dataset and the app built from it. The stage-by-stage data diff
is generated separately and lives in [verification-2026.md](verification-2026.md);
re-run it with `npm run verify`.

## 1. Data diff against the source pages

`scripts/verify-data.ts` fetches `/route` and `/road-closures`, extracts the
plain text into `data/2026/raw/*.txt`, parses the closure blocks and compares
every field against `event.json`.

**Result: 0 unreviewed differences across all 30 stages.**

Five divergences are deliberate and each is recorded in the closure notes, so
the caveat reaches the reader and not just this document:

| Stage | Divergence | Why it is kept |
|---|---|---|
| SS3, SS9 | Source prints the finish as "Pound Rd/Marble Hill Rdtion" | Source typo: the tail of "Intersection" is run into the road name |
| SS14 | Source finish carries "(remains open to public)" | Carried as a closure note so the location field stays a location |
| SS16 | Source spells "Lobthal Rd" and lists Boundary Dr twice | Source typo and duplicate; the raw text is recorded in the notes |
| SS27 | Source labels it "Strathalbyn Town Stage 1" | Both SS25 and SS27 carry that label; SS27 is stage 2 |

One correction went the other way during this phase: SS8's closure start was
missing the source's "(Fox Creek Rd)" qualifier, which has been restored.

The `/route` page indexes zero stage codes. It is built from image tiles named
`StageMaps2024_*` linking to Google My Maps *edit* URLs, so it carries no
machine-readable stage text and is unusable as a data source. The closures page
is the only authoritative text.

## 2. SS8 and SS11 geometry — confirmed

Both were unverified during recon because the KML responses were truncated.
Running the ingest as a Node script rather than through agent fetching resolved
it: the Day 1 map contains `SS8 - Stafford Hillclimb` (223 source points) and
`SS11 - Summit Road` (190). All 30 stage codes are covered by 24 features across
the three day maps, with no gaps and no stage left on `featureId: null`.

## 3. SS24 and SS29 orientation — confirmed

SS29 Warrawong is SS24 Mylor reversed. The organisers digitise the two lines in
opposing directions already, so no ingest-time reversal was needed, and the
elevation data proves the orientation survived:

| | Start | Finish | Net |
|---|---|---|---|
| SS24 Mylor | 422 m | 319 m | −103 m |
| SS29 Warrawong | 318 m | 425 m | +107 m |

SS29 climbs where SS24 descends, over the same roads and an identical closure
window. The two profiles mirror to within 4 m, which is the difference between
where the two independently digitised lines start and stop. Asserted in
`tests/stage-detail.test.tsx`.

## 4. Second year renders with no code change

`data/2025/` is a synthetic fixture — clearly labelled as such in its
`event.json` name and `sources.json`. It is deliberately shaped to exercise the
paths the real year does not:

- two days rather than three, proving the day count is not assumed
- a shared-geometry repeat run (SS1/SS3) resolving to one feature
- a spectator stage
- one unconfirmed day
- **a stage with `featureId: null`**, which 2026 has none of

`tests/second-year.test.tsx` asserts the registry discovers it from the
directory alone, that loading and linking behave identically, and that the app
renders it from `?year=2025`. The unmapped stage renders a list-only card and
opening it is a no-op rather than a crash.

No source file changed to add the year.

## 5. Lighthouse

Run against `vite preview` of the production build, headless Chrome, mobile
emulation, `lighthouse@12`.

| Category | Before | After |
|---|---|---|
| Performance | 74 | 90–91 |
| Accessibility | 97 | 100 |
| Best practices | 93 | 100 |
| SEO | 91 | 100 |

Four real defects were found and fixed:

- **The MapLibre web worker 404'd in production.** MapLibre resolves it with
  `new URL(..., import.meta.url)`, which the bundler does not rewrite, so the
  built app requested `/assets/maplibre-gl-worker.mjs`, got the SPA's HTML
  fallback, logged a MIME-type error and silently fell back to a classic worker.
  Now pointed at the hashed asset via `config.WORKER_URL`.
- **Insufficient contrast** on the closed-road clock: `#e5484d` on `#1b1e26` is
  4.25:1 against a 4.5:1 requirement. Text now uses a lighter `--closed-text`
  while the map lines keep the stronger red.
- **Sub-12px prose** in the safety notice, source notice, badges, tab dates and
  several labels. All raised to at least 12px. Three in-SVG chart annotations
  stay at 10–11px, which is conventional for dense chart labels and does not
  affect the score.
- **No robots.txt**, now served.

Performance moved from 74 to 90 by loading MapLibre lazily. The entry chunk
dropped from 1.17 MB to 226 kB; the map arrives in its own 943 kB chunk behind a
Suspense boundary. The stage list, closure times and Gantt are readable before
the map finishes loading, which is the right trade at the roadside on mobile
data. Source maps are emitted.

## 6. External links

All checked automatically as part of `npm run verify`; the current statuses are
in the generated report. Every link resolves. `openstreetmap.org/copyright`
intermittently answers 429 when the checker runs repeatedly in quick succession,
which is rate limiting rather than a broken link.

## 7. Mobile on real hardware — not done

This is the one exit criterion not met. The environment has no device and no
browser automation, so the responsive layout, touch scrubbing and tap-to-place
behaviour are covered by tests against a MapLibre fake and by the Lighthouse
mobile emulation, not by a real phone. A hands-on pass is still needed before
this is put in front of the public.

## Test suite

254 tests across 18 files, stable over ten consecutive runs. Bugs found by the
phase tests themselves, all reachable by a user, are recorded in the phase
commits: a shared line resolving to the wrong stage, `pointFromCursor` walking
off the end of a line, an out-of-range `day` in the URL wedging the app, and
gradients computed over adjacent vertices rather than fixed ground distance.

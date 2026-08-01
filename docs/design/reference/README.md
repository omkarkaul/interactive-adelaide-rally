# Reference screenshots

Captured by `npm run shots` (app) and `npm run shots target` (mockups) at 1440×900,
834×1112 and 390×844, `deviceScaleFactor: 2`.

`current-*` is the build as it stands at the start of the redesign — commit `34c42be`.
`target-*` is `docs/design/mockups/` rendered at the same three widths.

Re-capture `current-*` at the end of each R-stage. Do not re-capture `target-*`; if a
mockup changes, that is a spec change and belongs in its own commit.

## R0 baseline

All 261 tests green. `?year=`, `?day=`, `?stage=` and `?t=` all round-trip
(`src/url.ts`), so the captured states are the states named.

Lighthouse, re-measured on this build at `/?year=2026&day=1`:

| | phase 7 | R0 | note |
|---|---|---|---|
| Performance | 90 | **62** | phase 7 measured a page whose map never painted |
| Accessibility | 100 | 100 | must stay at 100 |
| Best practices | 100 | 100 | |
| SEO | 100 | 100 | |

R1–R4 are held to **62 / 100 / 100 / 100**, not the plan's 90. The drop is entirely
`total-blocking-time` at 2,250 ms — the 942 kB MapLibre chunk parsing on the main
thread once the map actually renders. FCP 1.3 s and CLS 0.029 both still score ≥98.
Recovering performance is not in this plan's scope; not regressing it is.

## R5 review outcome

A full-UI critique returned three blockers and twenty-two items. Each was checked
by measurement before being acted on, because two earlier passes had each made a
confidently-wrong claim.

Rejected on the evidence:
- "Day tabs clipped, Day 2 and 3 unreachable on phone and tablet" — real when the
  review ran, already fixed by then. Tabs measure full height with top >= 0 at
  every width.
- "Route casing is #667498 and does not dim with the line" — that colour is the
  basemap road under the route, not our casing.
- "The map wastes a third of its canvas" — routes fill 94-97% of the width and
  96-100% of the height at every breakpoint.
- "The attribution pill covers 89% of the phone" — 91% of the map's width but 9%
  of its area, a 26px strip at the bottom edge, which is how every major map
  renders attribution.

Accepted and fixed: sentence case throughout, per the spec's "sentence case
everywhere, including buttons and headings"; the stat strip's label/value order
and its hairline gutters; the safety notice moved above the stage list; road
names no longer breaking across their own suffix; "Show all 9" and the timeline
toggle given a link affordance rather than borrowing the read-only chip styling;
stage code labels lifted above the detail route, which had been drawing over
them; the scrubber's Gantt-gutter indent dropped when no Gantt is on screen; a
real minus in the Net stat; intermediate distance ticks on the profile axis.

Open, and the reason:
- Pending and reopened sit 1.23:1 apart. This is the R1b resolution, not an
  oversight: no two greys can clear 3:1 against the basemap, stay below the red,
  and remain distinguishable. Dash and weight carry the difference. Worth
  revisiting if the dash proves too subtle on short stages.
- Focused routes draw a light periwinkle halo. Proven to be the casing layer —
  forcing it green turns the halo green — but the casing token is #0e1015 and
  that exact string reaches MapLibre in the browser. A near-black paint cannot
  composite to #9ab0e7, and #000000 removes the halo entirely. Best hypothesis
  is a SwiftShader software-renderer artifact in the capture harness rather than
  something a user sees. Left alone rather than changing the design system to
  work around something unreproducible outside headless. **First item for the
  real-device pass.**
- The panel lists eleven stages where the Gantt merges to nine rows, so a repeat
  run is "SS4" on the card and "SS4 / SS7" in the timeline. Deliberate: the card
  carries the pairing in its repeat-run line instead.

## Honesty check

The plan gates R0 on `current-mobile-detail.png` reproducing a clipped elevation
chart. **It does not.** That defect was fixed in `34c42be`, before this plan started,
so R4 criterion 1 is already met at baseline. The harness is honest — it is
photographing a real app — but the plan's picture of the app is one commit stale.

What `current-mobile-detail.png` does show is the grade legend clipped by the
scrubber footer. That is a live R4 defect and replaces the sliver as the mobile check.

The defects the plan describes for R1 and R2 are all present and visible in
`current-desktop-day-view-scrubbed.png`:

- Orange on day tabs, scrubber, stage codes, closure times, route lines and pending
  Gantt bars alike — R1.2
- Two closure states, not three; nothing distinguishes reopened from never-closed —
  R1.1
- Light `liberty` basemap, with red route lines over pale road fill — R1.3
- The stage list is cut off mid-card at SS6 of 30, and the timeline holds its full
  height with a stage open — R2.2
- No stage codes on the map at any zoom — R2.4

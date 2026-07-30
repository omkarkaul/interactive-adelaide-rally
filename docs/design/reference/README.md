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

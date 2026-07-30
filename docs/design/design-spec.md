# Design spec

Durable visual rules for the Adelaide Rally map. Written after the first build shipped a UI where every feature carried equal visual weight and one hue encoded everything.

Sequenced work lives in [`docs/plans/ui-redesign-plan.md`](../plans/ui-redesign-plan.md). This document holds the rules; that one holds the order.

---

## Principle

Two independent visual channels. Never mix them.

- **Closure state owns hue.** Pending, closed, reopened.
- **Focus owns opacity and weight.** Never colour.

The first build encoded both with orange, so neither read. This single rule fixes most of what was wrong.

A third encoding — the gradient ramp — exists only inside the stage detail view and never appears on the day map.

---

## Tokens

**Token values and component patterns live in [`.interface-design/system.md`](../../.interface-design/system.md).** That file is authoritative and is loaded automatically by the `interface-design` skill. Do not restate values here — one source of truth, or they drift.

This document holds what a token file cannot: the reasoning, the domain rules, the layout proportions, and the record of what went wrong.

Two constraints that are easy to lose in a token list:

- `--accent` is restricted to day tabs, the scrubber handle, cursor markers, and links. It never encodes closure state. In the first build it did both, which is why the whole screen read as one colour.
- `--state-closed` is for graphics only. Type uses `--state-closed-text`; the plain red fails 4.5:1 on the panel background, which Lighthouse already flagged once.

---

## Three temporal states

At 09:40 SS1 is closed, SS11 has not closed yet, and by 13:00 SS1 has reopened. The first build distinguished two states. A resident cares most about the difference between "not yet" and "already done", and neither may be mistaken for "closed".

| State | Map line | Gantt bar | Panel card |
|---|---|---|---|
| Pending | `--state-pending`, 3px | outlined, `--state-pending` | normal |
| Closed | `--state-closed`, 4px | filled `--state-closed` | left border `--state-closed`, time in `--state-closed-text` |
| Reopened | `--state-reopened`, 2px | filled `--state-reopened` | 60% opacity |

A closure with `confirmed: false` renders its Gantt bar with a 4px dashed end cap on both sides and carries a "provisional" badge. Never render provisional times as if they were fixed.

---

## Focus scale

| | Line opacity | Line width | Card |
|---|---|---|---|
| Focused | 1.0 | 6px + 2px casing | `--bg-elevated`, 1px `--border-strong` |
| Normal | 0.85 | 4px | `--bg-panel` |
| Dimmed | 0.20 | 3px | 40% opacity |

Dimmed must be unmistakable at a glance. 0.20, not 0.7. If a screenshot leaves any doubt about which stage is focused, the value is too high.

Focus is orthogonal to closure state: a dimmed closed stage keeps `--state-closed` hue at 0.20 opacity. Do not substitute a grey.

---

## Basemap

Dark UI requires a dark basemap. A white map slab inside dark chrome was the second most visible defect in the first build.

Swap `https://tiles.openfreemap.org/styles/liberty` for `https://tiles.openfreemap.org/styles/dark` in `src/map/basemap.ts`. Same provider, same attribution, no key. `fiord` is a viable alternative if `dark` proves too low-contrast under the route lines.

Route lines must hold ≥3:1 contrast against the basemap at every zoom. Verify against both the pale road fills and the green reserve polygons — the Adelaide Hills stages sit on top of both.

---

## Layout

### One expanded secondary surface at a time

The map is primary. The panel, timeline and detail view are secondary and compete with each other, not with the map.

Timeline expanded **or** detail open. Never both. In the first build the nine-row Gantt persisted into the detail view and consumed 40% of the viewport while the user was reading a stage.

### Desktop, ≥1280px

- Panel 380px fixed; map fills the remainder
- Timeline ≤30vh when expanded; collapses to a 36px summary row when a stage is selected
- **Detail view: the profile moves under the map, full width.** Not into the sidebar.

That last rule is the largest single layout fix. The profile is a distance-axis chart; at 200px it conveys nothing, and in the first build its stats grid wrapped and clipped mid-word.

### Tablet, 768–1279px

Panel overlays the map as a scrim sheet. Timeline collapsed by default.

### Mobile, <768px

- Map fixed at 40vh
- Content in a draggable sheet with three snap points: peek 25%, half 55%, full 90%
- Timeline is not persistent — toggle only
- Profile full width, ≥120px tall
- **No chart may clip.** If it cannot meet its minimum, render a sparkline with an expand control.

The first build reused the desktop layout at 390px and clipped the elevation chart to a 20px sliver.

---

## Type and density

| Role | Size | Weight |
|---|---|---|
| Screen title | 18px | 500 |
| Stage name | 15px | 500 |
| Body, metadata | 13px | 400 |
| Labels, captions | 12px | 400 |
| In-SVG chart annotation | 10–11px | 400 |

12px is the floor for prose. 10px is permitted only for axis and tick labels inside a chart, which is conventional and does not affect the accessibility score.

Times always render as `07:45–12:45` with an en dash. Numeric stats use tabular figures in the mono stack so columns align. Sentence case everywhere, including buttons and headings.

---

## Copy

State labels are plain: "closed now", "closes 13:40", "reopened 12:45". Avoid "active" and "inactive" — they read as system state rather than road state.

The safety notice is not a tooltip and is not collapsible. It travels with any surface that displays a closure time.

---

## Accessibility floor

Lighthouse accessibility stays at 100. It was reached once; regressing it is a failed change.

- Text contrast ≥4.5:1, graphical objects ≥3:1
- Every interaction reachable by keyboard, including the profile cursor
- The cursor readout is announced through an `aria-live` region
- Focus rings visible against `--bg-panel` and `--bg-elevated`

---

## Performance floor

MapLibre stays lazy behind its Suspense boundary. The stage list, closure times and Gantt must remain readable before the map chunk arrives — that is the right trade at the roadside on mobile data, and it is why the entry chunk is 226kB rather than 1.17MB.

---

## Anti-patterns

Recorded because they shipped.

1. Same hue for state and chrome
2. Focus encoded by colour rather than opacity and weight
3. Light basemap under dark chrome
4. A chart sized to whatever container it landed in, rather than to its axis
5. Secondary surfaces that never yield to each other
6. Desktop layout reused at mobile widths
7. Grade values displayed without smoothing — SS1 Beaumont showed 29.9%, which is DEM noise on a suburban road

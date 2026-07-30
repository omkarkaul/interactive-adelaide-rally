---
name: rally-ui
description: UI and visual design rules for the Adelaide Rally map. Use whenever writing or changing anything under src/ui/ or src/map/, or touching CSS, component layout, colour, spacing, typography, or responsive behaviour. Also use when reviewing screenshots of the running app or comparing it against the reference mockups.
---

# Rally UI rules

Project-specific rules. Generic craft comes from the `interface-design` skill —
use both. This file wins where they disagree.

- Tokens and component patterns: `.interface-design/system.md` (authoritative)
- Domain rules, layout, rationale: `docs/design/design-spec.md`
- Sequence and acceptance criteria: `docs/plans/ui-redesign-plan.md`
- Visual targets: `docs/design/mockups/`

Never restate a token value in another file. One source of truth.

## Non-negotiable

1. Closure state owns hue. Focus owns opacity and weight. Never encode focus with colour.
2. Three closure states — pending, closed, reopened — all visually distinct.
3. `--accent` is chrome only: day tabs, scrubber handle, links. Never state.
4. One expanded secondary surface at a time. Timeline expanded or detail open, never both.
5. Charts are sized by their axis, not by whatever container they sit in.
6. No chart may clip. If it cannot meet its minimum, render a sparkline with an expand control.
7. 12px minimum for prose. 10px only for in-SVG chart annotations.
8. Dimmed means 0.20 opacity, not 0.7.

## Before claiming a visual change is done

```
npm run shots            # builds, serves, captures the app, tears down
npm run shots target     # captures the reference mockups
```

Then read the PNGs in `docs/design/reference/` at all three widths and compare
against `docs/design/mockups/`.

Compiling is not done. Passing unit tests is not done. Seeing it is done.

The Playwright MCP is also available for one-off exploration — hovering a
specific element, checking a transient state. Use the script for anything that
should be recorded or diffed across stages; use the MCP for poking.

## Guardrails

- Never edit `src/domain/**`, `data/**`, or the ingest scripts
- Lighthouse accessibility stays 100; other categories do not regress
- MapLibre stays lazy behind its Suspense boundary
- All existing tests stay green

## Known traps

- MapLibre is WebGL. A blank map in a headless screenshot is a renderer flag, not a bug in the app — launch Chromium with `--use-gl=swiftshader`.
- Playwright defaults to 1280×720. Always set the viewport explicitly; that width hides the mobile breakage entirely.
- Grade values must be smoothed over ~200m before display. Raw DEM samples on winding hills roads produce absurd gradients.

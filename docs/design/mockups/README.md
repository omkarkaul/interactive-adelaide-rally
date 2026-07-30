# Reference mockups

Static, self-contained HTML. Open directly in a browser or screenshot with `npm run shots target`.

| File | Shows |
|---|---|
| `day-view.html` | Day view at 1440px. Three closure states, focus and dim, timeline. |
| `stage-detail.html` | Stage detail at 1440px. Profile under the map at full width, shared cursor, full metadata stack. |
| `stage-detail-mobile.html` | Stage detail at 390px. Map at 40vh, sheet, drag-to-scrub profile. |
| `elevation-profile.html` | The profile component alone, across three stages of differing character. |

## What these are

Visual targets. They encode the decisions in [`../design-spec.md`](../design-spec.md) — colour semantics, focus treatment, layout proportion, information order.

## What these are not

Implementation references. The markup is throwaway: inline styles, hand-drawn SVG paths standing in for real geometry, no framework, no accessibility work beyond the obvious.

**Do not copy the markup or the JavaScript into `src/`.** Copy the decisions.

Specifically, ignore:

- The schematic SVG "maps" — the real thing is MapLibre
- The interpolated elevation curves — real profiles come from the DEM in the committed GeoJSON
- Event handling, which is deliberately naive and has no rAF throttling or continuity bias
- Every hardcoded hex — the real app reads tokens

## Using them

Screenshot the mockup and the build at the same viewport, then compare:

```
npm run shots target     # mockups → docs/design/reference/target-*.png
npm run shots            # running app → docs/design/reference/current-*.png
```

The comparison worth making is hierarchy, contrast and proportion — not pixel alignment. If the mockup and the build disagree about which element the eye lands on first, the build is wrong.

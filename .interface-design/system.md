# Design System

Authoritative for tokens and component patterns. Rationale, domain rules and layout
proportions live in `docs/design/design-spec.md` — read both.

## Direction

Personality: Data & Analysis — chart-optimised, numbers-first
Foundation: Cool, dark
Depth: Borders-only. No shadows, no gradients.

The audience reads this at the roadside on a phone to decide whether a road is
passable. Legibility beats polish.

## Tokens

Emitted as CSS custom properties by `src/tokens.css`, which is the only file in
`src/` allowed to contain a literal colour. `src/tokens.ts` parses that same file
so the MapLibre paint expressions cannot drift from the stylesheet.

### Spacing

Base: 4px
Scale: 4, 6, 8, 10, 12, 14, 16, 24

### Radius

```
--radius-control  8px    controls and cards
--radius-sheet    14px   sheets, top corners only
--radius-bar      3px    bars and pills
```

### Surfaces

```
--bg-base      #12141a   page
--bg-panel     #1b1e26   panel, timeline, sheet
--bg-elevated  #242832   focused card, popover
```

### Borders

```
--border         #2f3440   default hairline, 1px
--border-strong  #454b5a   emphasis, focused card
```

### Text

```
--text-primary    #eef0f4
--text-secondary  #a2a9b8
--text-muted      #8189a0
```

All three clear 4.5:1 on both `--bg-base` and `--bg-panel`. `--text-muted` was
`#6f7787`, which reached only 3.7:1 on the panel — a token that fails wherever it
is used for type is a trap, not a shade.

### State — closure

Hue encodes closure state and nothing else.

```
--state-pending      #c2c9d6   not yet closed
--state-closed       #e5484d   closed now, graphics only
--state-closed-text  #ff8b8e   closed now, type only
--state-reopened     #6f7887   already reopened
```

Pending is the brightest because it is the route itself before anything happens to
it; closed is the only hue; reopened fades because it has stopped being actionable.

Measured on the `dark` basemap, against its lightest fill `rgb(36,36,36)`: pending
9.33:1, closed 3.97:1, reopened 3.48:1 — all clear of the 3:1 floor, and pending
and reopened stay 2.68:1 apart from each other.

The first values here, `#7d8798` and `#3f4654`, were chosen as bar fills on a panel
and could not survive on a map. `#3f4654` reached only 1.64:1 against the basemap,
and every grey light enough to clear 3:1 came within 1.4:1 of pending — the two
states collapsed into one. Separating them by lightness is what makes both work.

### Accent

```
--accent  #f2733d
```

Chrome only: day tabs, scrubber handle, cursor markers, links. Never state.

### Gradient ramp

Stage detail only. Never on the day map.

```
--g-up2   #e5484d   climb >8%
--g-up    #f2915d   climb
--g-flat  #7d8798   flat
--g-dn    #6aa9e0   descent
--g-dn2   #3d87d6   descent >8%
```

### Map

```
--map-casing  #0e1015   route line casing, label halo, hollow terminus fill
```

Darker than `--bg-base` so a route line separates from the dark basemap over both
road fill and reserve green.

Termini are a form difference, not a hue one: start is filled `--text-primary`,
finish is hollow — `--map-casing` fill with a `--text-primary` stroke. Hue on the
map is spoken for by closure state.

### Notice

```
--notice-bg    #2a1416
--notice-text  #ffb3b5
```

### Type

```
Screen title    18px / 500
Stage name      15px / 500
Body, metadata  13px / 400
Label, caption  12px / 400
Chart annotation 10–11px / 400 — in-SVG only
```

Two weights: 400 and 500. Numeric values use the mono stack with tabular figures.
12px is the floor for prose.

## Patterns

### Stage card

Padding 10px 12px · radius 8px · `border-left: 3px` in the closure state colour
Normal: transparent background
Focused: `--bg-elevated`, 1px `--border-strong`
Dimmed: 40% opacity
Reopened: rail switches to `dashed`, card to 75% opacity

The dashed rail is not decoration. Pending and reopened are 1.23:1 apart, so
without it the panel is the one surface that cannot tell them apart. 75% is the
opacity floor — 60% drops the stage code and closure time to 3.4:1, under AA.

### Map route line

Focused: 8px + 2px casing, opacity 1.0
Normal: 6px closed / 4px pending / 3px reopened, opacity 0.85
Dimmed: 3px, opacity 0.20
Reopened also carries a 1.6/1.6 dash, punched through with `--map-casing`

Quoted at zoom 12 and scaled 0.75 / 1 / 1.3 across zooms 8 / 12 / 14.

Focus is opacity and weight. Never substitute a colour.

Closed is the heaviest because it cannot be the brightest. `--state-closed`
sits at relative luminance 0.218, and clearing 3:1 against the basemap's
lightest fill needs 0.169, so every grey that stays legible on the map is also
brighter than the red. Weight carries the ranking that lightness cannot, and the
dash — not a lightness step — is what separates reopened from pending, which are
only 1.23:1 apart.

The earlier 4 / 3 / 2 ladder was quoted against the mockup's bare canvas. On a
real basemap those weights read as one more line in the OSM road graph.

### Gantt bar

Height 12px · radius 3px
Pending: filled `--state-pending`
Closed: filled `--state-closed`
Reopened: transparent with a 1px dashed `--state-reopened` outline
Provisional: 4px dashed end caps both sides

Ink decreases as a closure completes, which is the same ranking the map uses —
closed heaviest, reopened lightest and the only dashed treatment. Hollowing the
pending bar instead inverted the two surfaces against each other: the emptier
treatment meant "not yet" in the timeline and "already done" on the map.

### Stat strip

Equal columns, 1px `--border` gutters on `--bg-panel`
Label 12px `--text-muted` above, value 16px mono 500 below
Never reflows into ragged rows — reduce column count instead

### Metadata section

Padding 11px 14px · `border-bottom: 1px --border`
Label 12px `--text-muted`, value 13px line-height 1.6
Omits entirely when its data is null — no empty heading, no gap

### Safety notice

Background `#2a1416`, text `#ffb3b5`, 12px, line-height 1.55
Not collapsible. Not a tooltip. Travels with any surface showing a closure time.

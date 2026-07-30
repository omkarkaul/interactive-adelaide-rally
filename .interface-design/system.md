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
--text-muted      #6f7787
```

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

### Map route line

Focused: 6px + 2px casing, opacity 1.0
Normal: 4px closed / 3px pending / 2px reopened, opacity 0.85
Dimmed: 3px, opacity 0.20

Focus is opacity and weight. Never substitute a colour.

### Gantt bar

Height 12px · radius 3px
Pending: transparent with 1px `--state-pending` outline
Closed: filled `--state-closed`
Reopened: filled `--state-reopened`
Provisional: 4px dashed end caps both sides

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

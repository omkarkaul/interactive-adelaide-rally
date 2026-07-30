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

### Spacing

Base: 4px
Scale: 4, 6, 8, 10, 12, 14, 16, 24

### Radius

Controls and cards: 8px
Sheets: 14px top corners only
Bars and pills: 3px

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
--state-pending      #7d8798   not yet closed
--state-closed       #e5484d   closed now, graphics only
--state-closed-text  #ff8b8e   closed now, type only
--state-reopened     #3f4654   already reopened
```

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

# UI redesign plan

Executable by an agent. Follows the initial build in [`implementation-plan.md`](implementation-plan.md).

Three inputs, each with one job:

- [`.interface-design/system.md`](../../.interface-design/system.md) — tokens and component patterns. Authoritative. Loaded by the `interface-design` skill.
- [`../design/design-spec.md`](../design/design-spec.md) — domain rules, layout proportions, rationale, anti-patterns.
- [`../design/mockups/`](../design/mockups/) — visual targets.

The `rally-ui` skill enforces the project rules; `interface-design` supplies generic craft and the review passes. This document holds the sequence and the acceptance criteria.

## Why this exists

The first build met every functional exit criterion and failed visually. The phase 7 verification report named the cause in section 7: *"the environment has no device and no browser automation"*. The agent built to a written spec and never looked at the result.

Everything below is downstream of fixing that. R0 gives the loop; R1–R4 use it.

## What is not wrong

The data layer is sound. 254 tests, Lighthouse 90 / 100 / 100 / 100, all 30 stages verified against the source pages, elevation on 24 of 24 features. This is a narrow redesign.

## Scope

Visual and layout only. Do not touch `src/domain/**`, `data/**`, or the ingest scripts.

Two exceptions, both carried over from phase 5 and both visible on screen:

- **Grade smoothing** — specified, not implemented. SS1 Beaumont reports a 29.9% max grade, which is DEM noise on a suburban road.
- **Stage detail metadata** — the phase 5 section table specified twelve sections. The build has four.

## Guardrails

- All 254 tests stay green
- Lighthouse does not regress from 90 / 100 / 100 / 100; accessibility stays at 100
- MapLibre stays lazy behind its Suspense boundary
- `src/domain/**` is not edited

## Working rules

One R-stage per commit: `redesign R<n>: <what changed>`, criteria in the body.

Each stage runs the same loop:

1. `/interface-design` while building — it loads `.interface-design/system.md` and applies the established patterns rather than inventing new ones
2. `npm run shots` and **read the images**
3. `/interface-design:design-deslop` to close the stage while the diff is still small
4. Critique subagent against the numbered criteria
5. Commit

A stage is done when the criteria are visibly satisfied, not when it compiles.

If `interface-design` proposes a token or pattern that is not in `system.md`, add it to `system.md` in the same commit. An undocumented value is how drift starts.

Then check the numbered criteria against the screenshots using a critique subagent. Give it the criteria and the image paths, **not the diff** — handed a diff it reviews the code, which is how the first build passed its own checks.

If a criterion cannot be met, stop and report rather than reinterpreting it.

Test policy: updating a test is allowed when its assertion is about markup. Changing one that asserts behaviour is not — fix the component instead.

---

## R0 — Eyes and baseline

Nothing here needs a human beyond the plugin install, which is two slash commands.

Install `interface-design` via the plugin flow, not the global skill install — the plugin ships the `design-review` and `design-deslop` commands this plan depends on:

```
/plugin marketplace add Dammyjay93/interface-design
/plugin menu          # select interface-design, then restart Claude Code
```

`.interface-design/system.md` is already seeded, so the skill will load the established system rather than asking for a direction.

Then:

```
npm i -D playwright
npx playwright install chromium
npm run shots            # builds, serves, captures, tears down
npm run shots target     # captures the reference mockups
```

`scripts/shots.mjs` manages its own lifecycle. Set `SHOTS_BASE` to use an already-running server instead.

Output: `docs/design/reference/{current,target}-{desktop,tablet,mobile}-*.png`. Commit both sets.

Fix here if broken:

- The app must honour `?year=`, `?day=`, `?stage=` and `?t=`, or the captured states are not the states named
- A blank map means the SwiftShader flags are not taking effect, not that the map is broken

**Honesty check before proceeding:** open `current-mobile-detail.png` and confirm it reproduces the clipped elevation chart you can see by hand. If the harness produces clean screenshots of a broken app, R1–R4 verify against nothing.

**Exit:**

- `interface-design` installed via the plugin flow; `/interface-design:design-review` and `/interface-design:design-deslop` both resolve
- Invoking `/interface-design` reports that it loaded `.interface-design/system.md` rather than asking for a direction
- Both screenshot sets committed; known defects visible in `current-*`

---

## R1 — Tokens and colour semantics

Likely files: a new token stylesheet, `src/map/basemap.ts`, `src/map/layers.ts`, `src/ui/StagePanel.tsx`, `src/ui/ClosureGantt.tsx`.

Emit the tokens from `.interface-design/system.md` as CSS custom properties. Swap `basemap.ts` from `styles/liberty` to `styles/dark`. Implement three closure states. Strip `--accent` back to chrome.

1. At 09:40 a closed stage, a pending stage and a reopened stage are three visibly different colours — in the panel, on the map, and in the Gantt
2. No orange anywhere except day tabs, the scrubber handle, cursor markers, and links
3. Route lines hold ≥3:1 against the basemap, over both road fill and reserve green
4. Provisional closures — all of days 2 and 3 — are distinguishable from confirmed ones
5. Panel closure times use `--state-closed-text`, not `--state-closed`
6. `rg -n '#[0-9a-fA-F]{3,6}' src/ui src/map` returns nothing outside the token file and the MapLibre style expressions

Criterion 6 exists because the likeliest R1 failure is landing tokens that nothing consumes — components keep their hardcoded hex and the screenshots barely change. If R1 output looks close to baseline, that is what happened.

Verify against `current-desktop-day-view-scrubbed.png` and `target-desktop-day-view.png`.

---

## R2 — Day view hierarchy

Likely files: `src/map/layers.ts`, `src/ui/StagePanel.tsx`, `src/ui/ClosureGantt.tsx`, `src/ui/TimeScrubber.tsx`.

Apply the map route line and stage card patterns from `system.md`. Map labels. Timeline yields on selection.

1. Hovering a stage card drops every other line to 0.20 opacity — measurable in the image
2. Selecting a stage collapses the timeline to ≤40px
3. The focused line is identifiable on the map without reading the panel
4. Stage codes label their lines at zoom ≥11
5. The focused panel card is distinguishable from its neighbours at a glance

---

## R3 — Stage detail

Likely files: `src/ui/StageDetail.tsx`, `src/ui/ElevationProfile.tsx`, `src/domain/profile.ts` (smoothing only), `src/ui/SafetyNotice.tsx`.

Move the profile under the map at full width. Restore the missing metadata using the metadata section, stat strip and safety notice patterns from `system.md`. Fix grade smoothing.

1. The profile is ≥400px wide at 1440px and ≥320px at 390px
2. All twelve sections present — header, plan view, profile, stat strip, closure window, roads closed, start/finish, intersections, repeat-run note, spectator, safety notice, source. Nullable sections omit with no gap.
3. Grade smoothed over ~200m; SS1 Beaumont reports a plausible max
4. No text clipped, truncated or wrapped mid-word at any breakpoint — the current build clips "MAX GRADE"
5. The stat strip does not reflow into ragged rows
6. Shared cursor holds continuity through the Corkscrew hairpins on SS4

Verify against `target-desktop-stage-detail.png`.

---

## R4 — Mobile

Likely files: `src/ui/StageDetail.tsx`, `src/App.tsx`, layout CSS.

1. At 390×844 the elevation profile renders complete — compare against `current-mobile-detail.png`, where it is a 20px sliver
2. The content sheet drags between all three snap points: 25 / 55 / 90%
3. The timeline is behind a toggle, not shown by default
4. The closure window is readable without scrolling, in every state
5. No horizontal scroll at any breakpoint
6. Touch scrub works on the profile; tap-to-place works on the map
7. No desktop resize affordance is reachable below 768px

Verify against `target-mobile-stage-detail-mobile.png`.

---

## R5 — Review and real device

- `/interface-design:design-review` against the full UI — focal point, hierarchy, typography, colour, surfaces, states, motion, judged against an approval bar
- `/interface-design:design-deslop` across the whole redesign branch, not just the last diff
- Side-by-side against `docs/design/mockups/` at all three widths
- Re-run Lighthouse; confirm no regression against 90 / 100 / 100 / 100
- Reconcile `.interface-design/system.md` with what actually shipped — if the build diverged, the system file is now wrong
- Hands-on pass on a real phone

The device pass is the phase 7 exit criterion still outstanding, and the only item in this plan that needs a person. It is the honest check for touch-target size and scroll-gesture conflicts, neither of which emulation catches.

**Exit:** critique findings resolved or recorded with reasons; real-device pass signed off.

---

## Not in scope

Address proximity search, 3D terrain, stage flythrough, cross-year diffing, the Gorge rallysprint. Unchanged from the implementation plan.

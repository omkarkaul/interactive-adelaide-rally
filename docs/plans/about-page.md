# About page

Standalone task. Not part of the redesign, which is complete.

Branch: `about-page`.

## What

An `/about` route, reached from a `made with ❤️` button in the header beside the day tabs.

Visual target: [`../design/mockups/about.html`](../design/mockups/about.html) — open it, screenshot it, match its hierarchy and proportion. It is a target, not an implementation reference; the markup is throwaway.

## Content, in order

1. **Attribution** — "Made with ❤️ by omkar", where `omkar` links to `https://www.rakmo.io`
2. **Safety** — in the notice pattern: *Rally cars are fast, and a closed road stays closed between runs. Spectate only from approved areas. Never enter a closed stage — wait for officials to remove the tape.*
3. **Why this exists** — *The official route and closures live on two separate pages — a grid of images on one, a wall of prose on the other. This is the same information on a single map, by day, with every closure attached to the road it closes.*
4. **And going forward** — *No public record of past years is kept anywhere. Each year here is captured from the source, checksummed and committed, so 2026 stays readable long after 2027 replaces it.*
5. **Footer** — not the official source, link to `adelaiderally.com.au`, capture date read from `sources.json` rather than hardcoded

Copy is final. Don't expand it — terseness is the point.

## Rules

Follow the `rally-ui` skill and `.interface-design/system.md`. No new tokens. Colours come from `src/tokens.css`, which stays the only file in `src/` containing a literal colour.

Use `/interface-design` while building and `/interface-design:design-deslop` before committing.

## Acceptance criteria

Verified from screenshots at 1440 / 834 / 390px, not from the diff.

1. `/about` resolves on a hard refresh, not only via client-side navigation — the SPA fallback must cover it
2. The header button collapses to the bare ❤️ below 500px and never wraps the header or crowds the day tabs
3. Copy column capped at ~470px and centred; no full-width prose at 1440px
4. The safety block reuses `--notice-bg` / `--notice-text`, visually identical to the stage detail warning
5. External links carry `rel="noopener"`, are keyboard reachable, and show a visible focus ring on `--bg-base`
6. **No `--state-closed` anywhere on this page.** The ❤️ is a glyph, not a colour token
7. Back-navigation returns to the map without losing the previously selected day
8. Lighthouse accessibility stays at 100 on the new route

Criterion 6 is not fussiness. The button sits in the header of the map view, inches from closure-red lines and closure-red times. A decorative red there re-introduces exactly the state/chrome collision the redesign removed — which is why the emoji was chosen over a tinted `♥`.

## Guardrails

- Do not edit `src/domain/**`, `data/**`, or the ingest scripts
- Existing tests stay green; add coverage for the new route
- MapLibre stays lazy — the about route must not pull the map chunk

## Verification

`npm run shots` already includes `/about` in `appStates` and `about` in the mockups list, so both the build and the target are captured.

Emoji rendering is platform-dependent. Locally on macOS it is fine; headless Chromium on Linux without an emoji font renders tofu. If the heart is missing from a CI screenshot, that is a font on the image, not a bug in the page.

## Commit

Single commit on `about-page`: `feat: about page at /about`.

# Handoff: Stash Design System → app implementation

## Overview
Everything needed to apply the Stash brand ("Earn it. Save it. Stash it." — kids' earn-and-save money app) to an existing build. Extracted verbatim from the brand's Figma file (Stash.fig: Brand Guidelines V1.0 + Character Sheet).

## About these files
The `.jsx`/`.html` files here are **design references built in HTML/React** — recreate them in your codebase's existing framework and patterns; don't ship them as-is. The CSS token files, however, can be dropped in directly.

## Fidelity
**High-fidelity.** All values (colors, radii, shadows, type sizes, paddings) are exact transcriptions from the Figma source. Do not snap to a 4/8px grid — if it says 26px, use 26px.

## How to wire it up (suggested Claude Code prompt)
1. Import `styles.css` (or copy `tokens/*.css`) into the global stylesheet. It defines all CSS custom properties (`--leaf-green`, `--text-body`, `--shadow-card`, …) and loads the fonts.
2. Fonts: **Baloo 2** (600/700/800) for display and **Nunito** (400/700/800 + italic) for body, via Google Fonts (already `@import`ed in `tokens/fonts.css`).
3. Recreate the six primitives documented in `COMPONENTS.md` (`Button`, `Card`, `Chip`, `Money`, `Eyebrow`, `ForestBackdrop`) as native components in the app's framework, keeping the exact inline values. Each entry carries usage, a props contract, and the reference JSX implementation.
4. Read `DESIGN_GUIDE.md` for voice, color-usage rules, and character rules; `SKILL.md` is a Claude Code-compatible agent skill — place this whole folder in `.claude/skills/stash-design/` (rename SKILL.md's folder accordingly) to make it invocable.

## Design tokens (quick reference)
Colors: Leaf Green `#2FBF71` (primary — LOCKED), Deep Leaf `#1E8F52` (hover/pressed), Warm Cream `#FAF3E3` (app bg), Stash Chestnut `#8B4A2B` (headings), Mustache Brown `#5C3319` (body text), Acorn Gold `#F2B93B` (earned wins ONLY), Coral `#D96B4A` (caution accent), border cream `#E5DBC7`.
Shadows: card `0 6px 18px rgba(92,51,25,.10)` · button `0 4px 14px rgba(0,0,0,.14)`.
Radii: cards 20 · inset panels 12 · pills/CTAs 999 · hero bottoms 32.
Type: Baloo 2 ExtraBold titles 28–32 / Bold card titles 20–22 / Bold buttons 18; Nunito body 16 min lh 1.5–1.6; labels Bold 13–14 all-caps (tracking .12–.16em); money = Baloo 2 ExtraBold with cents at 60% size.

## Hard rules
- One primary CTA per screen; every CTA is a pill, min-height 56.
- Hover: lift 2px + scale 1.02 (primary darkens to Deep Leaf). Press: scale 0.97. Gold earnings "bounce in" (~600ms spring).
- Gold only when the kid wins. Faint forest layer (tone-on-tone shapes ≤10% opacity) over Leaf Green ONLY — never on cream, never behind text.
- Mascot only from `assets/stash-pose-sheet.png` (locked master); min 64px tall, one per screen, flat brand colors behind him, never redrawn/recolored/outlined.
- No logo file exists: set the wordmark "Stash." in Baloo 2 ExtraBold.

## Files
- `styles.css` + `tokens/` — drop-in CSS custom properties, fonts, type scale
- `COMPONENTS.md` — reference implementations + props contracts for the six primitives
- `assets/stash-pose-sheet.png` (locked character master) · `assets/stash-welcome-screen.png` (canonical green welcome layout)
- `DESIGN_GUIDE.md` — full brand guide (voice, color, type, character, iconography)
- `SKILL.md` — agent-skill entry point for Claude Code

# Stash Design System

**Stash — Earn it. Save it. Stash it.** A kids' earn-and-save money app. Children earn real money through real achievements (chores, reading, good habits); parents approve every achievement before money moves. The brand mascot is Stash: a 3D Pixar-style chipmunk with an enormous mustache and black rectangular glasses — "the kid's tiny financial advisor — proud, warm, a little theatrical."

## Sources
- Figma file **"Stash.fig"** (attached, mounted): two pages — *Brand-Guidelines* (Stash Brand Guide, node 3:10) and *Stash-Character* (Character Sheet, node 3:125). Brand Guidelines V1.0 · August 2026.
- No codebase, no product screens beyond one reference image. **No logo file exists in the source** — the wordmark is set in type: "Stash." in Baloo 2 ExtraBold. Do not draw a logo.

## CONTENT FUNDAMENTALS
- **Tagline:** "Earn it. Save it. Stash it." Wordmark always "Stash." with the period.
- **Voice pillars** (from the guide):
  - *Playful, not silly* — "Acorn puns OK. Baby talk never. Talk up, not down." → "That's the good stuff. Stash it away!"
  - *Clear about money* — real amounts, real words: earn, save, spend, goal. → "You earned $2.00 for reading 20 minutes."
  - *Parent-trustworthy* — parent copy is calm and plain, no gimmicks. → "You approve every achievement before money moves."
  - *Encouraging* — celebrate effort, not just results. → "3 more to go — your Stash is growing!"
- Second person ("You earned…"), sentence case for prose, exclamation points at win moments only. Stash never sends negative messages — he only encourages.
- Nav labels are ALL-CAPS Nunito Bold: HOME · ACHIEVEMENTS · GOALS · PIGGY BANK.
- Emoji: essentially none in UI copy (the character sheet title uses 🐿️ once, decoratively). Checkmarks ✓ / ✗ appear as list markers in do/don't lists.

## VISUAL FOUNDATIONS
- **Color** — "Forest + treasure. One dominant green warmed by colors sampled from Stash himself." Leaf Green `#2FBF71` is **LOCKED — it is the brand**. Ratio ≈ Leaf 50% · Cream 30% · Browns 12% · Gold 8%. **Gold is an earned color: it only appears when the kid wins.** Palette: Leaf Green #2FBF71 (primary), Deep Leaf #1E8F52 (hover/pressed, eyebrows), Warm Cream #FAF3E3 (app background, inset panels), Stash Chestnut #8B4A2B (headings — his fur), Mustache Brown #5C3319 (body text — his mustache), Acorn Gold #F2B93B (rewards & celebration only). Coral #D96B4A appears only as a caution/"never" accent.
- **Type** — Baloo 2 (Bold/ExtraBold) for display: titles 28–32, card titles 20–22, buttons 18. Nunito for body (Regular 16 min, line-height 1.5–1.6), labels/nav (Bold 13–14, often ALL-CAPS with 0.12–0.16em tracking), italic for example quotes. Money: Baloo 2 ExtraBold with **cents at 60% size**; earnings deltas bounce in gold.
- **Buttons** — every primary CTA is a pill: radius 999, min-height 56, Baloo 2 Bold 18. **One primary CTA per screen.** Hover: lift 2px + scale 1.02. Press: scale 0.97. Variants: Leaf pill/white text (default), Gold pill/mustache text (wins only), White pill/leaf text (on green surfaces, shadow 0 4px 14px rgba(0,0,0,.14)).
- **Cards** — white, radius 20, shadow `0 6px 18px rgba(92,51,25,.10)` (swatch cards .12). Do/don't cards add a 6px top border (green/coral). Inset example panels: cream, radius 12. Hero/section blocks: radius 20–32, green blocks may round only the bottom (0 0 32 32).
- **Backgrounds** — Warm Cream app background; full-bleed Leaf Green for heroes/celebrations. The "Faint Forest Layer" (LOCKED): acorns/leaves/nuts tone-on-tone, white @ 6–8% or black @ 4–5%, **over Leaf Green ONLY**, max 10% opacity, large scale (80–160px), cropped at edges, 3–6 per screen. Never on cream, never behind text, never another color, never louder than Stash. "Felt, not seen."
- **Motion** — hover lift+scale, press shrink, gold earnings "bounce in". Playful springy micro-motion; nothing else specified.
- **Imagery** — warm 3D renders of the mascot on flat brand colors; soft drop shadow beneath him on flat color. Never over busy imagery.
- **Spacing** — generous: section gaps 48–72, card padding 20–32, element gaps 8–24. Values are as-designed; don't snap to a grid.

## THE CHARACTER (Stash)
Locked to `assets/stash-pose-sheet.png` (master reference). Always: chestnut fur, cream belly, fluffy striped tail; oversized mustache (never trimmed); black rectangular glasses; new poses only from the master; clear space ≥ width of his glasses; min height 64px in UI; soft drop shadow on flat color. Never: remove/shrink mustache or glasses, recolor fur, stretch/skew/outline, place over busy imagery, more than one Stash per screen, negative messages. Pose → moment: hugging giant acorn → savings goals; holding nut pile → balance; coin toss → earning; confetti arms-up → achievement complete; jump-spin ta-da → first login & big wins.

## ICONOGRAPHY
The source defines **no icon set** — no icon font, no SVG glyphs. Icons in the guide are limited to unicode/emoji markers (✓, ✗, ·) and the mascot imagery. When building Stash UI, prefer text labels; if icons are unavoidable use a rounded, filled, friendly set (e.g. Phosphor Fill via CDN) tinted with brand colors and flag it as a substitution. Never hand-roll SVG approximations of the mascot.

## Index
- `styles.css` → `tokens/` (fonts, fig-tokens = Figma variables, colors = semantic aliases, typography)
- `assets/` — `stash-pose-sheet.png` (locked master reference), `stash-welcome-screen.png` (canonical green welcome layout). No logo file exists (by design — wordmark is typeset).
- `components/core/` — Button, Card, Chip, Money, Eyebrow, ForestBackdrop (+ .d.ts, .prompt.md, specimen card)
- `guidelines/` — foundation specimen cards (colors, type, buttons, cards, backdrop, voice, character)
- `SKILL.md` — agent skill entry point

## Intentional additions
The .fig defines zero Figma components; the guide documents patterns in prose/demos instead. These primitives are direct codifications of documented patterns, nothing invented: **Button** (§02 Calls to Action), **Card** (recurring white card + do/don't accent variants), **Chip** (version pill), **Money** (§03 money type rules), **Eyebrow** (section label style), **ForestBackdrop** (§04 locked background recipe).

## Caveats
- Fonts load from Google Fonts (Baloo 2, Nunito) — the .fig embedded no binaries; these are the same families, not substitutes.
- No product UI kit: the source contains a brand guide and character sheet only. The welcome-screen PNG is a reference image, not a built screen — no screens were recreated to avoid inventing designs.

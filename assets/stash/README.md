# Stash — character asset pipeline

Raw Higgsfield renders in, app and store assets out. One command:

```bash
python3 tools/build.py
```

Needs Pillow and nothing else (`pip3 install Pillow`). Re-running is safe — it
rebuilds everything from the raw renders every time.

## Layout

| Path | What it holds |
| --- | --- |
| `stash-poses/` | Raw renders, straight from Higgsfield. Never edited. |
| `tools/key_pose.py` | The keyer — background and shadow removal, plate splitting. |
| `tools/build.py` | The recipe: which poses exist, what to punch, what to export. |
| `tools/qa.py` | Contact sheet on Leaf Green, Warm Cream and magenta. |
| `processed/masters/` | Full-resolution transparent PNG per pose. The archive. |
| `processed/exports/` | `@1x` 128 / `@2x` 256 / `@3x` 384, PNG + WebP, plus icons. |
| `../../coinquest/public/stash/` | What the app actually loads. Generated — don't hand-edit. |

## Adding a pose

1. Drop the render in `stash-poses/`.
2. Add a row to `POSES` in `tools/build.py` with `punch: []` for now.
3. Run `python3 tools/build.py`. It writes `processed/masters/<name>-pockets.png`.
4. Open that overlay and decide (see below). Fill in `punch` with a coordinate
   inside each pocket that is really background.
5. Run again. Check with `python3 tools/qa.py processed/masters/<name>.png qa.png`.
6. Register it in the app: one line in `POSES` in `src/components/Mascot.tsx`,
   the name in `Pose` in `shared/types.ts`, and the screen in `HERO_POSE`.

## The one judgement call: pockets

The keyer removes background by finding pixels that are desaturated, bright, and
**reachable from the frame edge**. The reachability test is what protects his eye
whites and teeth — they are background-coloured, but nothing reaches them from
outside.

Some background is *not* reachable: the gap between an arm and the tail, the loop
inside a mustache curl. Those are "pockets", and they have to be punched out by
hand — because the things that must be *kept* look identical. On S-06 the tail
gap and a lens highlight both measured ~250 mean luminance, ~3 saturation, and
77% vs 83% pure white. Size, flatness and distance-to-open-background were all
tested as discriminators and all overlap.

So the tool numbers every pocket on a magenta overlay and waits. Magenta on
purpose: against cream, a punched hole and a white specular highlight look the
same, which defeats the check.

**Rule of thumb:** punch gaps between limbs, inside curls, and between the legs.
Keep anything inside the glasses or the mouth.

Record the decision as a coordinate (`--at` / the `punch` list), never a pocket
number — numbers are sorted by size and reshuffle whenever the mask changes.

## Why the shadow needs two thresholds

The contact shadow is achromatic, saturation 0–8. So is nothing else on Stash
except the black glasses — the palest mustache fur still measures 43+. That is
why saturation is the primary test.

But the shadow darkens to luma 78 where it meets the feet, well below the
brightness floor. Dropping that floor globally would start nibbling the glasses,
so there is a second, darker band at a stricter saturation instead
(`SHADOW_SAT_MAX` / `SHADOW_LUMA_MIN`). The glasses core sits at luma 20–45 and
stays out of it.

## Why resizing is premultiplied

Straight LANCZOS on unpremultiplied RGBA samples the colour of transparent
pixels — which here is the white background — and bleeds a pale rim into every
edge. `resize_premul()` multiplies by alpha first and divides back out after.
Skip it and Stash gets a halo that only shows up on Leaf Green.

## Rejection criteria

From the production bible. Send a render back if:

- the mustache is smaller than the sheet, or reads as moustache-and-beard
- the glasses have rounded corners or metal rims (they are black rectangular)
- the tail loses its stripes or its fluff
- the fur shifts off chestnut, or the belly off cream
- he has an outline
- the shading drifts toward flat illustration or toy plastic
- anything reads as negative, scolding, or defeated

## Status

Built: **S-00** identity plate (4 views), **S-06** ta-da, **S-23** icon bust.

Still to come — Tier 1: S-07 wave hello · S-08 timer tap · S-09 patient perch ·
S-10 warm shrug · S-11 almost there · S-12 presenter · S-13 curled asleep.
Then Tier 2 (parent register, S-14–17), Tier 3 (states, S-18–22), Tier 4
(brand and marketing, S-24–26).

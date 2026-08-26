#!/usr/bin/env python3
"""
Stash pose keyer — white-background render in, transparent PNG out.

Higgsfield renders Stash on white with a baked contact shadow. The brand shadow
has to be reapplied in CSS (he sits on both Leaf Green and Warm Cream), so the
baked one goes with the background.

HOW THE KEY WORKS
The contact shadow is achromatic — measured saturation 0-8 — while the palest
part of Stash, the outer mustache fur, measures 43+. So a background pixel is
"desaturated AND bright AND reachable from the frame edge". Connectivity is what
protects his eye whites, teeth and lens highlights: they are background-coloured
but nothing reaches them from outside.

POCKETS — why this is not fully automatic
Some background is enclosed by the character and never reached from the edge:
the gap between arm and tail, the loop inside a mustache curl. Those must be
punched out. But so are his eye whites and the specular highlights on his
glasses — and those must be kept. The two are not separable by colour, size,
flatness, or distance to open background (all measured, all overlap).

So the tool detects every enclosed pocket, numbers them on a QA overlay, and
waits to be told. Run once to see the overlay, then again with --holes.

    python3 key_pose.py in.png out.png                 # writes out-pockets.png
    python3 key_pose.py in.png out.png --holes=1,2     # punch pockets 1 and 2
    python3 key_pose.py in.png out.png --at=770x1016   # punch by coordinate
    python3 key_pose.py plate.png out.png --split=4    # turnaround -> 4 files

Prefer --at for anything recorded in build.py. Pocket numbers are sorted by
size and shuffle whenever the mask changes; a coordinate inside the pocket
does not.

Requires Pillow only.
"""
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter

# A pixel is background-coloured if it is this desaturated and this bright.
# Mustache edge — the palest thing on Stash — measures sat 43+, so the
# saturation test is what protects him.
SAT_MAX = 22
LUMA_MIN = 165
# The contact shadow darkens to luma 78 where it meets the feet, well under
# LUMA_MIN. Rather than drop that floor for everything (which would start
# nibbling the black glasses, the only other achromatic thing in frame), allow
# a second, darker band at a stricter saturation. The glasses core sits at
# luma 20-45 and stays out of it.
SHADOW_SAT_MAX = 14
SHADOW_LUMA_MIN = 95
# Foreground blobs smaller than this are render specks, not Stash.
MIN_ISLAND = 400
# Enclosed pockets smaller than this are noise, never worth reporting.
MIN_POCKET = 1500


def candidate_mask(rgb):
    """255 where the pixel is background-coloured (not yet: is background)."""
    r, g, b = rgb.split()
    mx = ImageChops.lighter(ImageChops.lighter(r, g), b)
    mn = ImageChops.darker(ImageChops.darker(r, g), b)
    sat = ImageChops.subtract(mx, mn)
    luma = rgb.convert("L")

    plain = ImageChops.multiply(
        sat.point(lambda v: 255 if v <= SAT_MAX else 0),
        luma.point(lambda v: 255 if v >= LUMA_MIN else 0),
    )
    shadow = ImageChops.multiply(
        sat.point(lambda v: 255 if v <= SHADOW_SAT_MAX else 0),
        luma.point(lambda v: 255 if v >= SHADOW_LUMA_MIN else 0),
    )
    return ImageChops.lighter(plain, shadow)


def _fill(src, out, seeds, w, h, mark=1):
    """Scanline flood through `src`, recording into `out`. Returns filled pixels."""
    stack, got = list(seeds), []
    while stack:
        x, y = stack.pop()
        row = y * w
        if out[row + x] or not src[row + x]:
            continue
        x0 = x
        while x0 > 0 and src[row + x0 - 1] and not out[row + x0 - 1]:
            x0 -= 1
        x1 = x
        while x1 < w - 1 and src[row + x1 + 1] and not out[row + x1 + 1]:
            x1 += 1
        for i in range(x0, x1 + 1):
            out[row + i] = mark
            got.append(row + i)
        for ny in (y - 1, y + 1):
            if 0 <= ny < h:
                nrow = ny * w
                i = x0
                while i <= x1:
                    if src[nrow + i] and not out[nrow + i]:
                        stack.append((i, ny))
                        while i <= x1 and src[nrow + i]:
                            i += 1
                    i += 1
    return got


def separate(rgb):
    """Split background-coloured pixels into open background and enclosed pockets."""
    w, h = rgb.size
    src = bytearray(candidate_mask(rgb).tobytes())
    bg = bytearray(w * h)

    seeds = [(x, y) for x in range(w) for y in (0, h - 1) if src[y * w + x]]
    seeds += [(x, y) for y in range(h) for x in (0, w - 1) if src[y * w + x]]
    _fill(src, bg, seeds, w, h)

    # Whatever is background-coloured but was not reached from outside is a pocket.
    pockets, claimed = [], bytearray(bg)
    for p in range(w * h):
        if src[p] and not claimed[p]:
            got = _fill(src, claimed, [(p % w, p // w)], w, h)
            if len(got) >= MIN_POCKET:
                pockets.append(got)
    pockets.sort(key=len, reverse=True)
    return bg, pockets


def despeck(alpha, w, h, min_size):
    """Drop foreground blobs smaller than min_size — stray render specks."""
    seen = bytearray(w * h)
    for start in range(w * h):
        if seen[start] or not alpha[start]:
            continue
        got = _fill(alpha, seen, [(start % w, start // w)], w, h)
        if len(got) < min_size:
            for p in got:
                alpha[p] = 0
    return alpha


def key(path, holes=(), at=()):
    im = Image.open(path)
    rgb = im.convert("RGB")
    w, h = rgb.size

    bg, pockets = separate(rgb)
    chosen = set(i - 1 for i in holes if 1 <= i <= len(pockets))
    for x, y in at:
        hit = next((i for i, pk in enumerate(pockets) if y * w + x in set(pk)), None)
        if hit is None:
            print(f"  ! --at={x}x{y} is not inside any pocket", file=sys.stderr)
        else:
            chosen.add(hit)
    for i in chosen:
        for p in pockets[i]:
            bg[p] = 1

    alpha = bytearray(0 if v else 255 for v in bg)
    alpha = despeck(alpha, w, h, MIN_ISLAND)

    a = Image.frombytes("L", (w, h), bytes(alpha))
    # Eat the 1px white halo left by antialiasing against the background,
    # then soften so the cut edge is not stair-stepped.
    a = a.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))

    out = rgb.convert("RGBA")
    out.putalpha(a)
    return out, pockets


def pocket_sheet(im, pockets, path):
    """Numbered overlay so a human can say which pockets are background.

    Magenta ground on purpose: on cream, a punched hole and a white specular
    highlight look identical, which defeats the whole point of the check.
    """
    w, h = im.size
    sheet = Image.new("RGBA", (w, h), (255, 0, 255, 255))
    sheet.alpha_composite(im)
    sheet = sheet.convert("RGB")
    d = ImageDraw.Draw(sheet)
    rows = []
    for i, got in enumerate(pockets, 1):
        xs = [p % w for p in got]
        ys = [p // w for p in got]
        x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
        d.rectangle([x0 - 6, y0 - 6, x1 + 6, y1 + 6], outline=(0, 200, 255), width=6)
        d.text((x0 - 4, max(0, y0 - 40)), str(i), fill=(0, 200, 255))
        rows.append(f"    {i}: {len(got):7d}px  bbox=({x0},{y0})-({x1},{y1})")
    sheet.thumbnail((1100, 1100), Image.LANCZOS)
    sheet.save(path)
    return rows


def split_figures(im, n):
    """Cut a turnaround plate into n figures.

    Splitting on vertical gaps does not work: on the identity plate the profile
    view's tail reaches into the back view's column, so their bounding boxes
    overlap and a column scan merges them. Connected components do not care —
    the figures never physically touch. Each figure is masked to its own
    component so a neighbour's tail cannot bleed into the crop.
    """
    w, h = im.size
    a = bytearray(im.getchannel("A").point(lambda v: 1 if v > 8 else 0).tobytes())
    seen, comps = bytearray(w * h), []
    for start in range(w * h):
        if a[start] and not seen[start]:
            comps.append(_fill(a, seen, [(start % w, start // w)], w, h))
    comps = sorted(comps, key=len, reverse=True)[:n]
    if len(comps) != n:
        print(f"  ! found {len(comps)} figures, expected {n}", file=sys.stderr)
    comps.sort(key=lambda c: sum(p % w for p in c) / len(c))

    out = []
    for comp in comps:
        mask = bytearray(w * h)
        for p in comp:
            mask[p] = 255
        fig = im.copy()
        keep = Image.frombytes("L", (w, h), bytes(mask))
        fig.putalpha(ImageChops.multiply(fig.getchannel("A"), keep))
        out.append(fig)
    return out


def trim(im, pad=0.0):
    im = im.crop(im.getchannel("A").getbbox())
    if pad:
        w, h = im.size
        p = int(max(w, h) * pad)
        canvas = Image.new("RGBA", (w + 2 * p, h + 2 * p), (0, 0, 0, 0))
        canvas.paste(im, (p, p))
        im = canvas
    return im


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = dict(a.lstrip("-").split("=", 1) for a in sys.argv[1:] if "=" in a)
    src, dst = args[0], args[1]
    holes = [int(v) for v in opts["holes"].split(",")] if opts.get("holes") else []
    at = [tuple(int(n) for n in v.split("x")) for v in opts["at"].split(",")] if opts.get("at") else []
    pad = float(opts.get("pad", 0))

    keyed, pockets = key(src, holes, at)

    if pockets:
        sheet_path = dst.replace(".png", "-pockets.png")
        rows = pocket_sheet(keyed, pockets, sheet_path)
        print(f"  {len(pockets)} enclosed pocket(s) — check {sheet_path}")
        print("\n".join(rows))
        punched = ", ".join(f"{x}x{y}" for x, y in at) or (str(holes) if holes else "none")
        print(f"  punched: {punched}")

    if "split" in opts:
        for i, part in enumerate(split_figures(keyed, int(opts["split"]))):
            out = dst.replace(".png", f"-{i}.png")
            part = trim(part, pad)
            part.save(out)
            print(f"  {out}  {part.size}")
    else:
        keyed = trim(keyed, pad)
        keyed.save(dst)
        print(f"  {dst}  {keyed.size}")

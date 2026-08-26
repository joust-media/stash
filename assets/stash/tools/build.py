#!/usr/bin/env python3
"""
Build every Stash asset the app and the store need, from the raw Higgsfield
renders. Idempotent — safe to re-run whenever a new pose lands.

    python3 build.py

Adding a pose: drop the render in ../stash-poses/, add a row to POSES below,
run once to get the pocket overlay, then fill in `punch` with a coordinate
inside each pocket that is background (not an eye, not a lens highlight, not
a tooth). See key_pose.py for why that call cannot be automated.
"""
import shutil
import sys
from pathlib import Path
from PIL import Image, ImageChops

sys.path.insert(0, str(Path(__file__).parent))
from key_pose import key, trim

HERE = Path(__file__).resolve().parent
RAW = HERE.parent / "stash-poses"
MASTERS = HERE.parent / "processed" / "masters"
EXPORTS = HERE.parent / "processed" / "exports"
APP = HERE.parents[2] / "coinquest" / "public" / "stash"

# Per the production bible: @3x 384 / @2x 256 / @1x 128, brand floor 64.
TIERS = {"@3x": 384, "@2x": 256, "@1x": 128}
# The hero column is 52% of the screen; on a 430pt phone at 3x that is 671px
# wide, so the shipped asset needs roughly 800px of height to stay sharp.
APP_HEIGHT = 800
WEBP_Q = 80

# `punch`: a point inside each enclosed pocket that is really background.
# Coordinates are in the RAW render's frame, and are stable across changes to
# the keyer — pocket *numbers* are not.
POSES = [
    {
        "id": "S06",
        "name": "tada",
        "src": "stash-S06-tada.png",
        # (846,1150) gap between arm, tail and body · (710,680) mustache curl loop
        "punch": [(846, 1150), (710, 680)],
        "ship": True,
    },
    {
        "id": "S00",
        "name": "view",
        "src": "stash-S00-identity-plate.png",
        "split": 4,
        "views": ["front", "three-quarter", "profile", "back"],
        # the four mustache curl loops, one per figure
        "punch": [(137, 600), (626, 600), (2130, 600), (2618, 600)],
        "ship": False,
    },
]


def resize_premul(im, height):
    """Resize on premultiplied alpha.

    Straight LANCZOS on unpremultiplied RGBA samples the RGB of transparent
    pixels — which here is the white background — and bleeds a pale rim into
    every edge. Premultiplying first keeps the cut clean.
    """
    im = im.convert("RGBA")
    w, h = im.size
    tw = max(1, round(w * height / h))
    r, g, b, a = im.split()
    pre = Image.merge("RGBA", (
        ImageChops.multiply(r, a), ImageChops.multiply(g, a), ImageChops.multiply(b, a), a
    )).resize((tw, height), Image.LANCZOS)

    ch = [bytearray(c.tobytes()) for c in pre.split()]
    sr, sg, sb, sa = ch
    for i, al in enumerate(sa):
        if al == 0:
            sr[i] = sg[i] = sb[i] = 0
        elif al < 255:
            sr[i] = min(255, sr[i] * 255 // al)
            sg[i] = min(255, sg[i] * 255 // al)
            sb[i] = min(255, sb[i] * 255 // al)
    return Image.merge("RGBA", [Image.frombytes("L", (tw, height), bytes(c)) for c in ch])


def export(im, stem):
    for suffix, h in TIERS.items():
        small = resize_premul(im, h)
        small.save(EXPORTS / f"{stem}{suffix}.png")
        small.save(EXPORTS / f"{stem}{suffix}.webp", quality=WEBP_Q, method=6)


def icon_bust(front, out_dir):
    """S-23 — head and shoulders, cropped so mustache and glasses fill the frame.

    Derived from the identity plate's front view rather than generated: it is
    the same approved artwork, dead-on, which is exactly what the spec asks for.
    """
    w, h = front.size
    a = front.getchannel("A")
    # The mustache is the widest thing on him; find it in the upper body.
    head = a.crop((0, 0, w, int(h * 0.46)))
    x0, y0, x1, y1 = head.getbbox()
    cx = (x0 + x1) // 2
    side = int((x1 - x0) * 1.10)
    top = max(0, y0 - int(side * 0.06))
    box = (cx - side // 2, top, cx + side // 2, top + side)

    bust = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    bust.alpha_composite(front.crop(box), (0, 0))

    # The App Store icon must be 1024x1024 with no alpha, so he sits on Leaf Green.
    for size in (1024, 512, 192, 180, 32):
        ground = Image.new("RGB", (size, size), (47, 191, 113))
        ground.paste(resize_premul(bust, size), (0, 0), resize_premul(bust, size))
        ground.save(out_dir / f"stash-icon-{size}.png")
    bust.save(MASTERS / "stash-S23-icon-bust.png")
    return bust


def main():
    for d in (MASTERS, EXPORTS, APP):
        d.mkdir(parents=True, exist_ok=True)

    front = None
    for pose in POSES:
        stem = f"stash-{pose['id']}-{pose['name']}"
        keyed, pockets = key(RAW / pose["src"], at=pose.get("punch", []))
        print(f"{pose['src']}: {len(pockets)} pocket(s), punched {len(pose.get('punch', []))}")

        if "split" in pose:
            from key_pose import split_figures
            for fig, view in zip(split_figures(keyed, pose["split"]), pose["views"]):
                fig = trim(fig)
                name = f"{stem}-{view}"
                fig.save(MASTERS / f"{name}.png")
                export(fig, name)
                print(f"   {name}  {fig.size}")
                if view == "front":
                    front = fig
        else:
            keyed = trim(keyed)
            keyed.save(MASTERS / f"{stem}.png")
            export(keyed, stem)
            print(f"   {stem}  {keyed.size}")
            if pose["ship"]:
                app_file = APP / f"stash-{pose['name']}.webp"
                resize_premul(keyed, APP_HEIGHT).save(app_file, quality=WEBP_Q, method=6)
                print(f"   -> {app_file.name}  {app_file.stat().st_size // 1024}KB")

    if front is not None:
        # The bust ships as the icon only — no screen calls for it as a pose.
        bust = icon_bust(front, EXPORTS)
        shutil.copy(EXPORTS / "stash-icon-180.png", APP.parent / "apple-touch-icon.png")
        shutil.copy(EXPORTS / "stash-icon-32.png", APP.parent / "favicon.png")
        print(f"   icon bust {bust.size} -> 1024/512/192/180/32 + favicon")


if __name__ == "__main__":
    main()

"""QA sheet: the cut-out on both brand grounds, plus a magenta ground that
makes any surviving white fringe or shadow remnant impossible to miss."""
import sys
from PIL import Image

paths = sys.argv[1:-1]
out = sys.argv[-1]
GROUNDS = [(47,191,113,"leaf"), (250,243,227,"cream"), (255,0,255,"fringe check")]

H = 420
tiles = []
for p in paths:
    im = Image.open(p).convert("RGBA")
    im.thumbnail((H*2, H), Image.LANCZOS)
    tiles.append(im)

cw = max(t.width for t in tiles) + 24
sheet = Image.new("RGB", (cw*len(tiles), (H+24)*len(GROUNDS)), (255,255,255))
for gi,(r,g,b,_) in enumerate(GROUNDS):
    band = Image.new("RGBA", (cw*len(tiles), H+24), (r,g,b,255))
    for ti,t in enumerate(tiles):
        band.alpha_composite(t, (ti*cw + (cw-t.width)//2, 12))
    sheet.paste(band.convert("RGB"), (0, gi*(H+24)))
sheet.save(out)
print(f"{out} {sheet.size}")

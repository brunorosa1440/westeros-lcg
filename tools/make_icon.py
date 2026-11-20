# Gera os ícones originais do jogo: couro castanho com costuras + medalhão prateado com coroa e "GOT"
import sys, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
FONT = sys.argv[1]; OUT = sys.argv[2]
S = 1024
# ---- couro castanho ----
n1 = Image.effect_noise((S, S), 55).convert('L').filter(ImageFilter.GaussianBlur(3))
n2 = Image.effect_noise((S // 8, S // 8), 80).convert('L').resize((S, S), Image.BICUBIC).filter(ImageFilter.GaussianBlur(6))
n3 = Image.effect_noise((S, S), 60).convert('L')
tex = ImageChops.blend(ImageChops.blend(n1, n2, 0.55), n3, 0.18)
bg = Image.composite(Image.new('RGB', (S, S), (168, 98, 48)), Image.new('RGB', (S, S), (74, 38, 18)), tex)
# vinheta
vig = Image.new('L', (S, S), 0); dv = ImageDraw.Draw(vig)
dv.ellipse([-S * .15, -S * .15, S * 1.15, S * 1.15], fill=255); vig = vig.filter(ImageFilter.GaussianBlur(140))
bg = Image.composite(bg, Image.new('RGB', (S, S), (28, 13, 6)), vig)
d = ImageDraw.Draw(bg)
# linhas douradas e costura
for inset, w, col in [(40, 6, (205, 160, 70)), (58, 3, (150, 105, 40))]:
    d.rounded_rectangle([inset, inset, S - inset, S - inset], radius=40, outline=col, width=w)
for i in range(84, S - 84, 26):
    for (x0, y0, x1, y1) in [(i, 84, i + 14, 84), (i, S - 84, i + 14, S - 84), (84, i, 84, i + 14), (S - 84, i, S - 84, i + 14)]:
        d.line([(x0, y0), (x1, y1)], fill=(222, 190, 130), width=4)
# ---- medalhão prateado ----
cx, cy, R = S // 2, S // 2, 330
def radial(r0, r1, c0, c1):
    m = Image.new('RGB', (S, S)); md = ImageDraw.Draw(m)
    for r in range(r1, r0, -2):
        t = (r - r0) / (r1 - r0); col = tuple(int(c0[k] + (c1[k] - c0[k]) * t) for k in range(3))
        md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    return m
mask = Image.new('L', (S, S), 0); ImageDraw.Draw(mask).ellipse([cx - R, cy - R, cx + R, cy + R], fill=255)
shadow = mask.filter(ImageFilter.GaussianBlur(22))
bg.paste(Image.new('RGB', (S, S), (0, 0, 0)), (10, 18), shadow)
rim = radial(0, R, (235, 238, 240), (120, 126, 132))
bg.paste(rim, (0, 0), mask)
inner = Image.new('L', (S, S), 0); ImageDraw.Draw(inner).ellipse([cx - R + 34, cy - R + 34, cx + R - 34, cy + R - 34], fill=255)
bg.paste(radial(0, R - 34, (62, 74, 80), (20, 26, 30)), (0, 0), inner)
d = ImageDraw.Draw(bg)
d.ellipse([cx - R + 34, cy - R + 34, cx + R - 34, cy + R - 34], outline=(200, 205, 210), width=5)
# pontos decorativos no aro
for k in range(24):
    a = 2 * math.pi * k / 24; x = cx + (R - 17) * math.cos(a); y = cy + (R - 17) * math.sin(a)
    d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(250, 250, 252), outline=(90, 95, 100))
# ---- texto e coroa em prata ----
def silver(maskimg, top, h):
    grad = Image.new('RGB', (S, S)); gd = ImageDraw.Draw(grad)
    for y in range(S):
        t = min(1, max(0, (y - top) / max(1, h))); v = int(252 - 110 * t)
        gd.line([(0, y), (S, y)], fill=(v, v, min(255, v + 10)))
    bg.paste(Image.new('RGB', (S, S), (0, 0, 0)), (4, 7), maskimg.filter(ImageFilter.GaussianBlur(5)))
    bg.paste(grad, (0, 0), maskimg)
    edge = ImageChops.subtract(maskimg, maskimg.filter(ImageFilter.MinFilter(7))).filter(ImageFilter.GaussianBlur(1.5))
    bg.paste(Image.new('RGB', (S, S), (255, 255, 255)), (0, 0), ImageChops.offset(edge, -2, -2).point(lambda v: v // 2))
# coroa
cm = Image.new('L', (S, S), 0); cd = ImageDraw.Draw(cm)
by, w = cy - 95, 230
pts = [(cx - w // 2, by), (cx - w // 2 + 10, by - 110), (cx - w // 4, by - 50), (cx, by - 140), (cx + w // 4, by - 50), (cx + w // 2 - 10, by - 110), (cx + w // 2, by)]
cd.polygon(pts, fill=255); cd.rectangle([cx - w // 2, by, cx + w // 2, by + 26], fill=255)
for (x, y) in [(cx - w // 2 + 10, by - 110), (cx, by - 140), (cx + w // 2 - 10, by - 110)]: cd.ellipse([x - 14, y - 14, x + 14, y + 14], fill=255)
silver(cm, by - 155, 185)
# GOT
f = ImageFont.truetype(FONT, 210)
try: f.set_variation_by_axes([800])
except Exception: pass
tm = Image.new('L', (S, S), 0); td = ImageDraw.Draw(tm)
bb = td.textbbox((0, 0), 'GOT', font=f); tw, th = bb[2] - bb[0], bb[3] - bb[1]
ty = cy - 30
td.text((cx - tw // 2 - bb[0], ty - bb[1]), 'GOT', font=f, fill=255)
silver(tm, ty, th)
# LCG pequeno
f2 = ImageFont.truetype(FONT, 78)
try: f2.set_variation_by_axes([700])
except Exception: pass
lm = Image.new('L', (S, S), 0); ld = ImageDraw.Draw(lm)
bb = ld.textbbox((0, 0), 'L C G', font=f2); lw = bb[2] - bb[0]
ld.text((cx - lw // 2 - bb[0], cy + 200 - bb[1]), 'L C G', font=f2, fill=255)
bg.paste(Image.new('RGB', (S, S), (214, 172, 92)), (0, 0), lm)
for n in [512, 192, 180, 64, 32]:
    bg.resize((n, n), Image.LANCZOS).save(f'{OUT}/icon-{n}.png', optimize=True)
print('ok')

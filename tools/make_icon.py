# Gera os ícones originais do jogo (couro castanho, letras prateadas, moldura dourada)
import random, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
FONT = sys.argv[1]
S = 1024
random.seed(7)
# fundo: couro castanho com textura
base = Image.new('RGB', (S, S), (58, 32, 20))
noise = Image.effect_noise((S, S), 40).convert('L').filter(ImageFilter.GaussianBlur(1.2))
fine = Image.effect_noise((S, S), 70).convert('L')
tex = ImageChops.blend(noise, fine, 0.35)
dark, light = Image.new('RGB', (S, S), (38, 19, 11)), Image.new('RGB', (S, S), (110, 64, 38))
bg = Image.composite(light, dark, tex)
# vinheta
vig = Image.new('L', (S, S), 0); d = ImageDraw.Draw(vig)
for i in range(60):
    r = int(S * (0.95 - i * 0.008)); a = int(255 * (i / 60) ** 1.4)
    d.ellipse([(S - r) // 2 - S // 6, (S - r) // 2 - S // 8, (S + r) // 2 + S // 6, (S + r) // 2 + S // 8], fill=a)
vig = vig.filter(ImageFilter.GaussianBlur(40))
bg = Image.composite(bg, Image.new('RGB', (S, S), (12, 6, 3)), vig)
# moldura dourada dupla
d = ImageDraw.Draw(bg)
for inset, w in [(46, 10), (72, 4)]:
    d.rounded_rectangle([inset, inset, S - inset, S - inset], radius=60 - inset // 3, outline=(196, 152, 74), width=w)
# letras prateadas com relevo
def metal_text(img, text, size, cy, tracking=0):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([800])
    except Exception: pass
    widths = [f.getbbox(ch)[2] - f.getbbox(ch)[0] for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    mask = Image.new('L', (S, S), 0); md = ImageDraw.Draw(mask)
    x = (S - total) // 2
    for ch, w in zip(text, widths):
        bb = f.getbbox(ch); md.text((x - bb[0], cy - size // 2 - bb[1] + (size - (bb[3] - bb[1])) // 2), ch, font=f, fill=255); x += w + tracking
    # sombra
    sh = mask.filter(ImageFilter.GaussianBlur(10))
    img.paste(Image.new('RGB', (S, S), (0, 0, 0)), (8, 12), sh)
    # gradiente prateado
    grad = Image.new('RGB', (S, S)); gd = ImageDraw.Draw(grad)
    for y in range(S):
        t = (y - (cy - size // 2)) / max(1, size)
        t = min(1, max(0, t))
        v = int(250 - 120 * t + 40 * (1 if 0.45 < t < 0.55 else 0))
        gd.line([(0, y), (S, y)], fill=(v, v, min(255, v + 8)))
    img.paste(grad, (0, 0), mask)
    # brilho / relevo
    edge = ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(9))).filter(ImageFilter.GaussianBlur(2))
    hl = ImageChops.offset(edge, -3, -3)
    img.paste(Image.new('RGB', (S, S), (255, 255, 255)), (0, 0), hl.point(lambda v: v // 2))
metal_text(bg, 'GOT', 300, 480, tracking=14)
metal_text(bg, 'LCG', 150, 812, tracking=28)
# pequeno losango dourado entre as linhas
d = ImageDraw.Draw(bg); cx, cy = S // 2, 700
d.polygon([(cx, cy - 16), (cx + 16, cy), (cx, cy + 16), (cx - 16, cy)], fill=(214, 170, 88))
d.line([(cx - 190, cy), (cx - 30, cy)], fill=(196, 152, 74), width=4); d.line([(cx + 30, cy), (cx + 190, cy)], fill=(196, 152, 74), width=4)
out = sys.argv[2]
for n in [512, 192, 180, 64, 32]:
    bg.resize((n, n), Image.LANCZOS).save(f'{out}/icon-{n}.png', optimize=True)
bg.resize((512, 512), Image.LANCZOS).save(f'{out}/preview.png')
print('ok')

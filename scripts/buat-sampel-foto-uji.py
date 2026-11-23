"""Buat foto uji: selfie-like JPEG + HEIC asli + versi MIME-dump untuk verifikasi."""
import io
import os

from PIL import Image, ImageDraw
from pillow_heif import register_heif_opener

register_heif_opener()

os.makedirs('/tmp/uji-foto', exist_ok=True)

# Foto "selfie" 1600x1200: gradasi latar + lingkaran wajah sederhana
img = Image.new('RGB', (1600, 1200))
px = img.load()
for y in range(1200):
    for x in range(1600):
        px[x, y] = (int(90 + 80 * x / 1600), int(140 - 40 * y / 1200), 120)
d = ImageDraw.Draw(img)
d.ellipse((650, 300, 950, 700), fill=(210, 170, 140), outline=(120, 90, 70), width=6)  # wajah
d.ellipse((720, 430, 780, 480), fill=(60, 50, 45))  # mata kiri
d.ellipse((820, 430, 880, 480), fill=(60, 50, 45))  # mata kanan
d.arc((700, 480, 900, 620), 30, 150, fill=(90, 60, 50), width=8)  # senyum
d.ellipse((350, 900, 1250, 1300), fill=(50, 90, 140))  # baju

img.save('/tmp/uji-foto/selfie.jpg', 'JPEG', quality=92)

# HEIC asli (kualitas tinggi, ciri kamera HP)
img.save('/tmp/uji-foto/selfie.heic', 'HEIF', quality=88)

# Verifikasi magic bytes
for f in ('selfie.jpg', 'selfie.heic'):
    with open(f'/tmp/uji-foto/{f}', 'rb') as fh:
        head = fh.read(12)
    print(f, os.path.getsize(f'/tmp/uji-foto/{f}'), 'byte | head:', head[:4], '| ftyp brand:', head[8:12])

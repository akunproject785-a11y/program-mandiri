#!/usr/bin/env python3
"""Siapkan aset logo dari screenshot upload (MIN 6 Sukoharjo):
trim margin putih -> kanvas persegi putih -> ekspor
  - public/logo.png (400x400, dipakai UI)
  - src/app/icon.png (192x192, favicon konvensi App Router)
  - src/app/apple-icon.png (180x180)
  - src/app/favicon.ico (16/32/48, jalur legacy /favicon.ico)
"""
from PIL import Image, ImageChops

SRC = 'upload/Screenshot 2026-11-04 083154.png'

src = Image.open(SRC).convert('RGBA')
rgb = Image.new('RGB', src.size, 'white')
rgb.paste(src, mask=src.split()[3])

# Trim: bbox piksel yang berbeda dari putih murni (dengan sedikit toleransi)
diff = ImageChops.difference(rgb, Image.new('RGB', src.size, 'white'))
gray = diff.convert('L').point(lambda p: 255 if p > 12 else 0)
bbox = gray.getbbox()
print('bbox konten:', bbox, 'dari', src.size)

logo = rgb.crop(bbox)
w, h = logo.size
side = int(max(w, h) * 1.08)  # padding ~4% per sisi
square = Image.new('RGB', (side, side), 'white')
square.paste(logo, ((side - w) // 2, (side - h) // 2))
print('kanvas persegi:', square.size)

square.resize((400, 400), Image.LANCZOS).save('public/logo.png')
square.resize((192, 192), Image.LANCZOS).save('src/app/icon.png')
square.resize((180, 180), Image.LANCZOS).save('src/app/apple-icon.png')
square.resize((256, 256), Image.LANCZOS).convert('RGBA').save(
    'src/app/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)]
)
print('OK: logo.png, icon.png, apple-icon.png, favicon.ico')

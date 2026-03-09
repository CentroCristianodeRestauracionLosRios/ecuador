#!/usr/bin/env python3
"""Corre esto en tu carpeta de PNG para medir dimensiones exactas"""
try:
    from PIL import Image
except ImportError:
    import subprocess, sys
    subprocess.run([sys.executable,"-m","pip","install","pillow","--break-system-packages","--quiet"])
    from PIL import Image

import os, json

files = [
    "Water_tiles.png","Floors_Tiles.png","Wall_Tiles.png",
    "Wall_Variations.png","Dungeon_Tiles.png",
    "Slice_DownSheet.png","Slice_UpSheet.png","Slice_SideSheet.png"
]

results = {}
for f in files:
    if os.path.exists(f):
        img = Image.open(f)
        w,h = img.size
        results[f] = {"w":w,"h":h}
        print(f"✅ {f}: {w} x {h} px")
    else:
        print(f"❌ {f}: NO ENCONTRADO")

print("\nPega este resultado en el chat:")
print(json.dumps(results, indent=2))

#!/usr/bin/env python3
"""
Mide el centro visual del personaje en el primer frame de cada spritesheet.
Corre esto en tu carpeta con los PNG.
"""
try:
    from PIL import Image
    import numpy as np
except ImportError:
    import subprocess, sys
    subprocess.run([sys.executable,"-m","pip","install","pillow","numpy","--break-system-packages","--quiet"])
    from PIL import Image
    import numpy as np

import os, json

SHEETS = [
    "Stop_DownSheet.png",
    "Stop_UpSheet.png",
    "Stop_SideSheet.png",
    "Run_DownSheet.png",
    "Run_UpSheet.png",
    "Run_SideSheet.png",
    "Slice_DownSheet.png",
    "Slice_UpSheet.png",
    "Slice_SideSheet.png",
    "Crush_DownSheet.png",
    "Crush_UpSheet.png",
    "Crush_SideSheet.png",
    "Pierce_DownSheet.png",
    "Pierce_UpSheet.png",
    "Pierce_SideSheet.png",
    "Fishing_DownSheet.png",
    "Fishing_UpSheet.png",
    "Fishing_SideSheet.png",
    "Collect_DownSheet.png",
    "Collect_UpSheet.png",
    "Collect_SideSheet.png",
    "Death_DownSheet.png",
    "Death_UpSheet.png",
    "Death_SideSheet.png",
]

FRAME_W = 64
results = {}

for fname in SHEETS:
    if not os.path.exists(fname):
        print(f"❌ {fname}: no encontrado")
        continue
    img = Image.open(fname).convert("RGBA")
    # Solo primer frame
    frame = img.crop((0, 0, FRAME_W, img.height))
    arr = np.array(frame)
    # Encontrar píxeles con alpha > 10 (personaje visible)
    mask = arr[:,:,3] > 10
    if not mask.any():
        print(f"⚠️  {fname}: sin píxeles visibles")
        continue
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    top, bottom = int(rows[0]), int(rows[-1])
    left, right  = int(cols[0]), int(cols[-1])
    cx = (left + right) // 2
    cy = (top + bottom) // 2
    h  = bottom - top
    results[fname] = {"cx":cx,"cy":cy,"top":top,"bottom":bottom,"left":left,"right":right,"h":h}
    print(f"✅ {fname}: centro=({cx},{cy})  bbox=[{left},{top} → {right},{bottom}]  alto={h}px")

print("\n// Pega esto en el chat:")
print(json.dumps(results, indent=2))

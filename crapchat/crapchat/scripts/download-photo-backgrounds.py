#!/usr/bin/env python3
"""Download freely-licensed photos, resize to 1280x720 JPEG ~150-250KB."""
import json, io, urllib.request, ssl
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'public' / 'assets' / 'backgrounds'
OUT.mkdir(parents=True, exist_ok=True)

# Unsplash (Unsplash License), Pexels (Pexels License), Wikimedia Commons (CC0/CC-BY)
# images.unsplash.com crop params for 1280x720
SCENES = [
  # id, name, category, url, credit, license, source_page
  ("business-office", "Business Office", "office",
   "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&h=900&fit=crop&q=80",
   "Nastuh Abootalebi / Unsplash", "Unsplash License", "https://unsplash.com/photos/jqO_hxFErjE"),
  ("home-office", "Home Office", "office",
   "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=1600&h=900&fit=crop&q=80",
   "Glenn Carstens-Peters / Unsplash", "Unsplash License", "https://unsplash.com/photos/npxXWgQ33ZQ"),
  ("living-room", "Cozy Living Room", "home",
   "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1600&h=900&fit=crop&q=80",
   "Spacejoy / Unsplash", "Unsplash License", "https://unsplash.com/photos/xG5VFqeAzVY"),
  ("library", "Quiet Library", "home",
   "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1600&h=900&fit=crop&q=80",
   "Alfons Morales / Unsplash", "Unsplash License", "https://unsplash.com/photos/YLSwjSy7stg"),
  ("kitchen", "Modern Kitchen", "home",
   "https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=1600&h=900&fit=crop&q=80",
   "Sidekix Media / Unsplash", "Unsplash License", "https://unsplash.com/photos/mOZDd1H6efo"),
  ("bedroom", "Calm Bedroom", "home",
   "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1600&h=900&fit=crop&q=80",
   "Spacejoy / Unsplash", "Unsplash License", "https://unsplash.com/photos/YI2YkyaREHk"),
  ("tropical-beach", "Tropical Beach", "nature",
   "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&h=900&fit=crop&q=80",
   "Sean Oulashin / Unsplash", "Unsplash License", "https://unsplash.com/photos/KMn4VEeEPR8"),
  ("sunset-beach", "Sunset Beach", "nature",
   "https://images.unsplash.com/photo-1414609245224-afa02bfb3fda?w=1600&h=900&fit=crop&q=80",
   "Jordan McDonald / Unsplash", "Unsplash License", "https://unsplash.com/photos/nbtocChRUb4"),
  ("blue-sky", "Blue Sky & Clouds", "nature",
   "https://images.unsplash.com/photo-1534088568598-e2edd0c7e7c0?w=1600&h=900&fit=crop&q=80",
   "Alexander Andrews / Unsplash", "Unsplash License", "https://unsplash.com/photos/mEdKuPYJe1w"),
  ("sunset-sky", "Dramatic Sunset Sky", "nature",
   "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1600&h=900&fit=crop&q=80",
   "Johannes Plenio / Unsplash", "Unsplash License", "https://unsplash.com/photos/RwHv7LgeC7s"),
  ("mountains", "Mountain Range", "nature",
   "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&h=900&fit=crop&q=80",
   "Kalen Emsley / Unsplash", "Unsplash License", "https://unsplash.com/photos/Bkci_8qcdvQ"),
  ("snowy-peaks", "Snowy Peaks", "nature",
   "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600&h=900&fit=crop&q=80",
   "Benjamin Voros / Unsplash", "Unsplash License", "https://unsplash.com/photos/phIFdC6lA4E"),
  ("forest", "Dense Forest", "nature",
   "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600&h=900&fit=crop&q=80",
   "Casey Horner / Unsplash", "Unsplash License", "https://unsplash.com/photos/4u2U8EO9OzY"),
  ("enchanted-forest", "Enchanted Forest", "nature",
   "https://images.unsplash.com/photo-1511497584788-876760111969?w=1600&h=900&fit=crop&q=80",
   "Sebastian Unrau / Unsplash", "Unsplash License", "https://unsplash.com/photos/sp-p7UUQQqQ"),
  ("city-night", "City Skyline Night", "urban",
   "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1600&h=900&fit=crop&q=80",
   "Pedro Lastra / Unsplash", "Unsplash License", "https://unsplash.com/photos/Nyvq2juw4_o"),
  ("city-day", "City Skyline Day", "urban",
   "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1600&h=900&fit=crop&q=80",
   "Andre Benz / Unsplash", "Unsplash License", "https://unsplash.com/photos/eOcyhe5iO84"),
  ("coffee-shop", "Hip Coffee Shop", "urban",
   "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1600&h=900&fit=crop&q=80",
   "Mike Kenneally / Unsplash", "Unsplash License", "https://unsplash.com/photos/tNALoIJnTJM"),
  ("coworking", "Coworking Space", "office",
   "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1600&h=900&fit=crop&q=80",
   "Nastuh Abootalebi / Unsplash", "Unsplash License", "https://unsplash.com/photos/yWwob8kwOCk"),
  ("conference", "Conference Room", "office",
   "https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=1600&h=900&fit=crop&q=80",
   "Benjamin Child / Unsplash", "Unsplash License", "https://unsplash.com/photos/GWe0dlVD9e0"),
  ("rooftop", "Rooftop Terrace", "urban",
   "https://images.unsplash.com/photo-1470219556762-7c09cd488748?w=1600&h=900&fit=crop&q=80",
   "Jacek Dylag / Unsplash", "Unsplash License", "https://unsplash.com/photos/kL3LuQxpMEC"),
  ("park", "Sunny Park", "nature",
   "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=1600&h=900&fit=crop&q=80",
   "Mirza Babic / Unsplash", "Unsplash License", "https://unsplash.com/photos/WKusPtbQ-0s"),
  ("lake", "Serene Lake", "nature",
   "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1600&h=900&fit=crop&q=80",
   "Aaron Burden / Unsplash", "Unsplash License", "https://unsplash.com/photos/5AiWn2U10cw"),
  ("desert", "Desert Dunes", "nature",
   "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1600&h=900&fit=crop&q=80",
   "Wolfgang Hasselmann / Unsplash", "Unsplash License", "https://unsplash.com/photos/bs2jWmwWYun"),
  ("space", "Space Nebula", "fun",
   "https://images.unsplash.com/photo-1462331940025-496dfbfcba31?w=1600&h=900&fit=crop&q=80",
   "NASA / Unsplash", "Unsplash License", "https://unsplash.com/photos/Q1p7bh3SHj8"),
  ("underwater", "Under the Sea", "fun",
   "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1600&h=900&fit=crop&q=80",
   "Silas Baisch / Unsplash", "Unsplash License", "https://unsplash.com/photos/K785Da4A_Ik"),
  ("arcade", "Retro Arcade", "fun",
   "https://images.unsplash.com/photo-1511882150382-421056c89033?w=1600&h=900&fit=crop&q=80",
   "Carl Raw / Unsplash", "Unsplash License", "https://unsplash.com/photos/kOqBCFsGTs8"),
  ("zen-garden", "Zen Garden", "fun",
   "https://images.unsplash.com/photo-1528164344705-47542687000d?w=1600&h=900&fit=crop&q=80",
   "David Edelstein / Unsplash", "Unsplash License", "https://unsplash.com/photos/N4DbvTUDikw"),
  ("abstract-waves", "Abstract Waves", "fun",
   "https://images.unsplash.com/photo-1557683316-973635b880a9?w=1600&h=900&fit=crop&q=80",
   "Gradienta / Unsplash", "Unsplash License", "https://unsplash.com/photos/m_7pL8FhOzU"),
  ("bookshelf", "Bookshelf Wall", "home",
   "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1600&h=900&fit=crop&q=80",
   "Susan Q Yin / Unsplash", "Unsplash License", "https://unsplash.com/photos/2JIvboGLeho"),
  ("marble-lobby", "Marble Lobby", "office",
   "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600&h=900&fit=crop&q=80",
   "Ralph (Ravi) Kayden / Unsplash", "Unsplash License", "https://unsplash.com/photos/mR1CIEhYITw"),
]

UA = "CrapChatBackgroundFetcher/1.0 (educational novelty app; attribution in CREDITS.md)"
ctx = ssl.create_default_context()

def fetch(url):
  req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/*"})
  with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
    return r.read()

def cover_resize(img, tw=1280, th=720):
  img = img.convert("RGB")
  scale = max(tw / img.width, th / img.height)
  nw, nh = int(img.width * scale + 0.5), int(img.height * scale + 0.5)
  img = img.resize((nw, nh), Image.Resampling.LANCZOS)
  left = (nw - tw) // 2
  top = (nh - th) // 2
  return img.crop((left, top, left + tw, top + th))

def save_jpeg(img, path):
  # Aim 150–250KB by adjusting quality
  for q in (82, 75, 68, 60, 52):
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=q, optimize=True, progressive=True)
    data = buf.getvalue()
    if len(data) <= 250_000 or q <= 52:
      path.write_bytes(data)
      return len(data), q
  path.write_bytes(data)
  return len(data), q

credits = ["# Background photo credits\n",
           "All scenes are photographic stills resized to 1280×720 JPEG for CrapChat.\n",
           "Unsplash License: https://unsplash.com/license (free to use; attribution appreciated).\n\n"]
manifest = {"scenes": [], "generated": None}
from datetime import datetime, timezone
manifest["generated"] = datetime.now(timezone.utc).isoformat()

errors = []
for sid, name, cat, url, credit, lic, page in SCENES:
  dest = OUT / f"{sid}.jpg"
  try:
    print(f"Fetching {sid}…", flush=True)
    raw = fetch(url)
    img = Image.open(io.BytesIO(raw))
    img = cover_resize(img)
    size, q = save_jpeg(img, dest)
    print(f"  -> {dest.name} {size} bytes q={q}")
    manifest["scenes"].append({"id": sid, "name": name, "category": cat, "file": f"{sid}.jpg"})
    credits.append(f"## {name} (`{sid}.jpg`)\n")
    credits.append(f"- Photographer / source: {credit}\n")
    credits.append(f"- License: {lic}\n")
    credits.append(f"- Original: {page}\n")
    credits.append(f"- Download used: `{url.split('?')[0]}`\n\n")
  except Exception as e:
    errors.append((sid, str(e)))
    print(f"  FAIL {sid}: {e}")

(OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
(OUT / "CREDITS.md").write_text("".join(credits))
print("Done. scenes=", len(manifest["scenes"]), "errors=", errors)
if len(manifest["scenes"]) < 25:
  raise SystemExit(1)

"""Writes the list of files for offline use (and a version stamp) into sw.js.

Run from the repo root after adding, removing or changing files, before committing:

    python3 tools/build_sw.py

The version is a hash of every listed file, so any change makes browsers fetch the update.
"""
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
INCLUDE = ['index.html', 'manifest.webmanifest', 'src', 'assets']
SKIP_SUFFIX = {'.txt', '.md', '.py'}

files = []
for entry in INCLUDE:
    p = ROOT / entry
    for f in sorted([p] if p.is_file() else p.rglob('*')):
        if f.is_file() and f.suffix not in SKIP_SUFFIX and not f.name.startswith('.'):
            files.append(f)

h = hashlib.sha256()
for f in files:
    h.update(f.relative_to(ROOT).as_posix().encode())
    h.update(f.read_bytes())
version = h.hexdigest()[:12]

urls = ['./'] + [f.relative_to(ROOT).as_posix() for f in files if f.name != 'index.html']
block = f"// <generated>\nconst VERSION = '{version}';\nconst FILES = {json.dumps(urls, indent=0)};\n// </generated>"
sw = ROOT / 'sw.js'
text = sw.read_text()
text = re.sub(r'// <generated>.*?// </generated>', lambda _: block, text, flags=re.S)
sw.write_text(text)
size = sum(f.stat().st_size for f in files)
print(f'sw.js: version {version}, {len(urls)} files, {size / 1e6:.1f} MB')

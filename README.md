# Hearthwood — a cozy 3D reading village

No build step. PDFs, reading progress, bookmarks, highlights and notes are all stored locally in your browser (IndexedDB).

```bash
python3 -m http.server 5180 --directory ebook3d
```
Open http://localhost:5180 (three.js, cannon-es, pdf.js and lucide load from the jsDelivr CDN).

## World
Arrows / WASD walk · Shift run · Space jump · scroll zoom · Enter or click a book to read · Del remove ·
C change character · I import · G grid view · T day/night · M music

## Reader
Scroll view or 3D book (3) · ←/→ pages · C contents · S sidebar · B bookmark · N page note ·
select text to highlight · click a highlight to edit/add a note · Ctrl+scroll or +/- zoom · Esc back

## Files
- `src/world.js` – renderer, physics, player, shelves & books, camera
- `src/scenery.js` – the village: ground/water/grass shaders, pond, farm, windmill, barn, cottage, campfire, forest
- `src/toon.js` – shared toon material, wind sway + see-through shader patches
- `src/reader.js` – continuous PDF viewer, table of contents, annotations
- `src/book3d.js` – 3D page-flip view
- `src/audio.js` – procedural lo-fi music + sound effects (WebAudio)
- `src/character.js` – loads the KayKit characters + shared animation rigs

## Credits
Characters & spellbook: **KayKit Adventurers 2.0** by Kay Lousberg (CC0) — `assets/kaykit/License.txt`
Nature & farm props: **Kenney Nature Kit** and **Kenney Survival Kit** (CC0) — `assets/nature`, `assets/survival`

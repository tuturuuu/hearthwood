# Hearthwood — a cozy 3D reading village

No build step. PDFs, reading progress, bookmarks, highlights and notes are all stored locally in your browser (IndexedDB).

```bash
python3 -m http.server 5180 --directory ebook3d
```
Open http://localhost:5180 (three.js, cannon-es, pdf.js and lucide load from the jsDelivr CDN).

## World
Arrows / WASD walk · Shift run · Space jump · scroll zoom · Enter or click a book to read · Del remove ·
E sit on a bench/log/dock · C change character · P pomodoro · I import · G grid view · T time of day · M sound

## Phones & tablets
On touch screens a joystick appears bottom-left (push gently to walk, all the way to run), a jump button bottom-right,
pinch to zoom, and every key hint in the on-screen prompt is tappable.

## Reading spots & focus
Walk up to a plaza bench, a log by the campfire, the end of the dock or the garden stump and press **E** to sit.
Press **Enter** to keep reading your last book right there (the world stays alive behind the pages) or **B** to pick another.
The Pomodoro timer (bottom-left, **P**) turns the hourglass on the plaza table and softens the music while you focus.

## Việt's Garden, gallery & critters
Walk north through the Reading Grove, past the cover gallery (the books you read hang as paintings on easels), into a portfolio
clearing: giant physics letters you can knock over, project boards (press **Enter** to open on
GitHub) and GitHub / LinkedIn pads. Around it, one themed area per role: **UI Plaza** (frontend), **Agent Lab** (AI engineer),
**Data Observatory** (DS&AI: fraud detection, data engineering, ML) and **Origins** (Swinburne). Press **Enter** at an area's sign
for details. Edit the content in `src/profile.js`; the areas are built in `src/experience.js`.
In the middle of the garden, a fountain has your tech stack orbiting above it (edit `SKILLS` in `src/profile.js`).
The back of the Reading Grove is a rustic reading corner: a vine-covered pergola with string lights, a picnic blanket and hay bales you can sit on.
Ducks paddle on the pond, chickens peck by the barn and a cat follows you around. Sit at the end of the dock and press
**F** to fish: wait for the bobber to dip and press **F** again.

## Time, seasons & weather
The sky follows your real clock (sunrise, golden hour, night) and the season follows the calendar: autumn tints the trees and
drops leaves, winter brings snow. Weather changes every few hours (rain ripples the pond). Override both in the ⚙ panel.

## Backup
Everything lives in your browser, so back it up from the ⚙ panel: a **full backup** includes your PDFs, a **notes backup**
is tiny and merges progress, bookmarks, highlights and notes into books you already have.

## Reader
Scroll view or 3D book (3) · ←/→ pages · C contents · S sidebar · B bookmark · N page note ·
select text to highlight · click a highlight to edit/add a note · Ctrl+scroll or +/- zoom · Esc back

## Files
- `src/world.js` – renderer, physics, player, shelves & books, camera
- `src/scenery.js` – the village: ground/water/grass shaders, pond, farm, windmill, barn, cottage, campfire, forest
- `src/toon.js` – shared toon material + wind sway shader patch
- `src/environment.js` – real-clock daylight, seasons, auto weather, palette blending
- `src/weather.js` – GPU rain / snow / falling-leaf particles
- `src/pomodoro.js` – focus timer · `src/backup.js` – export / restore
- `tools/strip_rig.py` – trims KayKit animation rigs to the clips we use (1.5 MB → 0.23 MB)
- `src/portfolio.js` + `src/profile.js` – the portfolio clearing · `src/life.js` – ducks, chickens, cat · `src/fishing.js` – fishing · `src/experience.js` – role areas · `src/nook.js` – reading nook
- `src/reader.js` – continuous PDF viewer, table of contents, annotations
- `src/book3d.js` – 3D page-flip view
- `src/audio.js` – procedural lo-fi music + sound effects (WebAudio)
- `src/character.js` – loads the KayKit characters + shared animation rigs

## Credits
Characters & spellbook: **KayKit Adventurers 2.0** by Kay Lousberg (CC0) — `assets/kaykit/License.txt`
Nature & farm props: **Kenney Nature Kit** and **Kenney Survival Kit** (CC0) — `assets/nature`, `assets/survival`

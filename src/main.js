import { DefaultLoadingManager } from 'three';
import { db } from './db.js';
import { describePdf } from './pdf.js';
import { Library } from './world.js';
import { ZONE_NAMES } from './scenery.js';
import { Reader } from './reader.js';
import { sound } from './audio.js';
import { toast, refreshIcons, icon } from './ui.js';
import { environmentFor, TIME_MODES, WEATHER_MODES } from './environment.js';
import { Pomodoro, MODE_LABELS, fmt } from './pomodoro.js';
import { exportBackup, importBackup } from './backup.js';
import { PROFILE } from './profile.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

// ---------- time of day + weather ----------
let timeMode = store.get('worldTime') || 'auto';
let weatherMode = store.get('weather') || 'auto';
let env = environmentFor({ timeMode, weatherMode });
root.dataset.time = timeMode;
root.dataset.theme = env.day < 0.45 ? 'dark' : 'light';

function updateEnvironment(instant = false) {
  env = environmentFor({ timeMode, weatherMode });
  library.setEnvironment(env, instant);
  root.dataset.time = timeMode;
  const theme = env.day < 0.45 ? 'dark' : 'light';   // the UI follows the sky
  if (root.dataset.theme !== theme) { root.dataset.theme = theme; reader.setTheme(theme === 'dark'); }
  syncPanel();
}

function cycleTime() {
  timeMode = { auto: 'day', day: 'night', night: 'auto' }[timeMode];
  store.set('worldTime', timeMode);
  updateEnvironment();
  sound.sfx('click');
  toast(TIME_MODES[timeMode]);
}
document.querySelectorAll('.themeToggle').forEach((b) => (b.onclick = cycleTime));

// ---------- music ----------
function syncMusicUI() {
  for (const id of ['btnMusic', 'rMusic']) $(id).classList.toggle('music-off', !sound.musicOn);
}
function toggleMusic() { sound.setMusic(!sound.musicOn); syncMusicUI(); }
$('btnMusic').onclick = toggleMusic;
$('rMusic').onclick = toggleMusic;
syncMusicUI();
// browsers only allow audio after a user gesture
const unlock = () => { sound.ensure(); sound.startMusic(); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
addEventListener('pointerdown', unlock);
addEventListener('keydown', unlock);

// ---------- loading screen ----------
// Every model, texture and font goes through three's DefaultLoadingManager, so it drives the progress bar.
const TIPS = [
  'Walk up to a bench, log or hay bale and press E to sit and read.',
  'Sit at the end of the dock and press F to fish.',
  'The sky follows your real clock — come back at sunset.',
  'Push the hedge letters in Việt’s Garden. They don’t mind.',
  'Press P to start a focus session; the hourglass on the plaza table keeps time.',
];
const loader = {
  el: $('loader'), started: performance.now(), done: false, quietT: 0,
  update(loaded, total) {
    const pct = total ? loaded / total : 0;
    this.el.querySelector('.ld-bar i').style.width = `${Math.max(4, pct * 100)}%`;
    this.el.querySelector('.ld-status').textContent = loaded < total ? `Planting trees… ${loaded} / ${total}` : 'Almost there…';
    clearTimeout(this.quietT);
    // finished once nothing new has started loading for a moment
    if (loaded >= total) this.quietT = setTimeout(() => this.ready(), 500);
  },
  ready() {
    if (this.done) return;
    this.done = true;
    this.el.querySelector('.ld-bar i').style.width = '100%';
    this.el.querySelector('.ld-status').textContent = 'The village is ready.';
    $('ldEnter').hidden = false;
    refreshIcons();
  },
  enter() {
    this.el.classList.add('done');
    setTimeout(() => this.el.remove(), 700);
  },
};
loader.el.querySelector('.ld-tip').textContent = `Tip: ${TIPS[Math.floor(Math.random() * TIPS.length)]}`;
DefaultLoadingManager.onProgress = (_url, loaded, total) => loader.update(loaded, total);
DefaultLoadingManager.onError = (url) => console.warn('failed to load', url);
setTimeout(() => loader.ready(), 15000);    // never trap anyone behind a slow request
$('ldEnter').onclick = () => { loader.enter(); sound.sfx('pop'); };

// ---------- world + reader ----------
const library = new Library($('library'), { onOpen: (id) => openBook(id, 'shelf'), onDelete: removeBook });
let readingFrom = null;   // 'shelf' | 'grid' | 'seat'
const reader = new Reader({
  onClose: async (id) => {
    $('fade').classList.remove('on');
    const from = readingFrom;
    readingFrom = null;
    library.reading = false;
    if (from === 'shelf') {
      library.resume();
      await library.playClose(id);
    }
    await refresh();
    if (from === 'seat' && library.seated) showSeatedPrompt(library.seated);
  },
});
updateEnvironment(true);
setInterval(() => updateEnvironment(), 30_000);

let zoneT;
library.onZone = (zone) => {
  const el = $('zone');
  el.textContent = ZONE_NAMES[zone] || '';
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(zoneT);
  zoneT = setTimeout(() => el.classList.remove('on'), 2600);
};

function prompt(html, cover) {
  const p = $('prompt');
  p.innerHTML = html;
  if (cover) p.querySelector('img').src = cover;
  p.hidden = false;
  refreshIcons();
  return p;
}

library.onFocus = (book) => {
  if (!book) { $('prompt').hidden = true; return; }
  const pct = book.pages ? Math.round(((book.lastPage || 1) / book.pages) * 100) : 0;
  const extra = [
    book.bookmarks?.length && `${book.bookmarks.length} bookmarks`,
    book.highlights?.length && `${book.highlights.length} highlights`,
  ].filter(Boolean).join(' · ');
  const p = prompt(`${book.cover ? '<img alt="">' : ''}<div class="info"><div class="t"></div><div class="s"></div><div class="bar"><i style="width:${pct}%"></i></div></div><kbd>Enter</kbd>`, book.cover);
  p.querySelector('.t').textContent = book.title;
  p.querySelector('.s').textContent = `${book.author ? book.author + ' · ' : ''}page ${book.lastPage || 1} / ${book.pages} · ${pct}%${extra ? ' · ' + extra : ''}`;
};

// ---------- sit & read ----------
library.onSeatFocus = (seat) => {
  const p = prompt(`<div class="info"><div class="t"></div><div class="s">A cozy spot to read</div></div><kbd>E</kbd> sit`);
  p.querySelector('.t').textContent = seat.name;
};

library.onThingFocus = (thing) => {
  const p = prompt(`<div class="info"><div class="t"></div><div class="s"></div></div><kbd>Enter</kbd>`);
  p.querySelector('.t').textContent = thing.title;
  p.querySelector('.s').textContent = thing.sub;
};
library.onInfo = (e) => {
  const card = $('infoCard');
  card.style.setProperty('--c', e.color);
  card.querySelector('.ic-area').textContent = e.area;
  card.querySelector('h3').textContent = e.title;
  card.querySelector('.ic-org').textContent = [e.org, e.when, e.where].filter(Boolean).join(' · ');
  card.querySelector('ul').replaceChildren(...e.points.map((p) => Object.assign(document.createElement('li'), { textContent: p })));
  card.querySelector('.ic-tags').replaceChildren(...e.tags.map((t) => Object.assign(document.createElement('span'), { textContent: t })));
  card.hidden = false;
  sound.sfx('pop');
};
$('icClose').onclick = () => { $('infoCard').hidden = true; };
$('icLinkedIn').onclick = () => window.open(PROFILE.links.linkedin, '_blank', 'noopener');

library.onFishMessage = (msg, rare) => {
  toast(msg);
  if (library.seated) showSeatedPrompt(library.seated);
  if (rare) $('toast').classList.add('rare'), setTimeout(() => $('toast').classList.remove('rare'), 2400);
};

async function lastBook() {
  const books = await db.allBooks();
  return books.sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0))[0];
}

async function showSeatedPrompt(seat) {
  const book = await lastBook();
  const p = prompt(`<div class="info"><div class="t"></div><div class="s"></div>
    <div class="keys">${seat.fishing ? '<span><kbd>F</kbd> fish</span>' : ''}${book ? '<span><kbd>Enter</kbd> read</span>' : ''}<span><kbd>B</kbd> choose a book</span><span><kbd>E</kbd> stand up</span></div></div>`);
  p.querySelector('.t').textContent = seat.name;
  const fish = library.fishing.stats;
  const fishLine = seat.fishing && fish.total ? ` · 🎣 ${fish.total} caught, ${fish.kinds} kinds` : '';
  p.querySelector('.s').textContent = (book ? `Continue “${book.title}” — page ${book.lastPage || 1}` : 'Your shelves are empty — add a PDF first') + fishLine;
}
library.onSeated = (seat) => showSeatedPrompt(seat);
library.onSeatRead = async () => {
  const book = await lastBook();
  if (book) openBook(book.id, 'seat'); else openPicker();
};
library.onSeatPick = () => openPicker();

// ---------- touch controls ----------
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
root.classList.toggle('touch', isTouch);
addEventListener('touchstart', () => root.classList.add('touch'), { once: true, passive: true });
{
  const joy = $('joy'), knob = $('joyKnob');
  let id = null;
  const move = (e) => {
    const r = joy.getBoundingClientRect(), max = r.width / 2 - 14;
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    library.stick.x = dx / max;
    library.stick.z = dy / max;
  };
  const end = () => { id = null; knob.style.transform = ''; library.stick.x = library.stick.z = 0; };
  joy.addEventListener('pointerdown', (e) => { id = e.pointerId; try { joy.setPointerCapture(id); } catch {} move(e); sound.ensure(); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  joy.addEventListener('pointerup', end);
  joy.addEventListener('pointercancel', end);
  $('jumpBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); library.jump(); });
}
// every key hint in the prompt is tappable; tapping the prompt itself does its first action
const KEY_FOR = { Enter: 'Enter', E: 'e', B: 'b', F: 'f' };
$('prompt').addEventListener('click', (e) => {
  const kbd = e.target.closest('kbd') || $('prompt').querySelector('kbd');
  const key = kbd && KEY_FOR[kbd.textContent.trim()];
  if (!key) return;
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  document.body.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
});

// ---------- open / remove ----------
async function removeBook(id) {
  const b = await db.getBook(id);
  if (b && confirm(`Remove "${b.title}" from your library? Its highlights and notes will be deleted too.`)) {
    await db.deleteBook(id);
    await refresh();
    toast('Book removed');
  }
}

async function refresh() {
  const books = await db.allBooks();
  library.setBooks(books);
  renderGrid(books);
}

let opening = false;
async function openBook(id, from) {
  if (opening) return;
  opening = true;
  closePicker();
  try {
    const book = await db.getBook(id);
    $('prompt').hidden = true;
    readingFrom = from;
    if (from === 'seat') {
      library.reading = true;           // keep the world rendering behind the pages
      sound.sfx('flip');
      await reader.open(book, { cozy: true });
    } else {
      if (from === 'shelf') await library.playOpen(id);
      $('fade').classList.add('on');
      await new Promise((r) => setTimeout(r, 300));
      library.pause();
      await reader.open(book);
    }
    refreshIcons();
    $('fade').classList.remove('on');
  } catch (e) {
    console.error(e);
    toast('Could not open this book');
    $('fade').classList.remove('on');
    library.reading = false;
    if (from === 'shelf') { library.resume(); await library.playClose(id); }
    readingFrom = null;
  } finally {
    opening = false;
  }
}

// ---------- classic grid view (also used as the book picker while seated) ----------
let gridMode = store.get('view') === 'grid';
let picking = false;
function setGridMode(on) {
  gridMode = on;
  store.set('view', on ? 'grid' : 'world');
  $('classic').hidden = !on;
  $('help').hidden = on;
  $('btnView').classList.toggle('grid-mode', on);
  $('prompt').hidden = true;
  on ? library.pause() : library.resume();
}
function openPicker() {
  picking = true;
  library.reading = true;
  $('classic').classList.add('picker');
  $('classic').querySelector('h1').textContent = 'What shall we read?';
  $('classic').hidden = false;
}
function closePicker() {
  if (!picking) return;
  picking = false;
  library.reading = false;
  $('classic').classList.remove('picker');
  $('classic').querySelector('h1').textContent = 'Your books';
  $('classic').hidden = !gridMode;
}
$('btnChar').onclick = async () => {
  sound.sfx('pop');
  await library.nextCharacter();
  toast(`Playing as ${library.charName.replace('_', ' ')}`);
};
$('btnView').onclick = () => { closePicker(); setGridMode(!gridMode); sound.sfx('click'); };
setGridMode(gridMode);

function renderGrid(books) {
  const grid = $('grid');
  books = [...books].sort((a, b) => (b.lastOpened || b.added) - (a.lastOpened || a.added));
  if (!books.length) { grid.innerHTML = '<div class="grid-empty">No books yet — drop some PDFs here or click “Add PDFs”.</div>'; return; }
  grid.replaceChildren(...books.map((b) => {
    const pct = b.pages ? Math.round(((b.lastPage || 1) / b.pages) * 100) : 0;
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = `<div class="cover">${b.cover ? '<img alt="">' : ''}</div><button class="del icon-btn" title="Remove">${icon('trash-2')}</button>
      <div class="t"></div><div class="s">${pct}% · ${b.pages} pages</div><div class="bar"><i style="width:${pct}%"></i></div>`;
    if (b.cover) c.querySelector('img').src = b.cover;
    c.querySelector('.t').textContent = b.title;
    c.onclick = (e) => {
      if (e.target.closest('.del')) removeBook(b.id);
      else openBook(b.id, picking ? 'seat' : 'grid');
    };
    return c;
  }));
  refreshIcons();
}

// ---------- pomodoro ----------
const pomo = new Pomodoro({
  onChange: (p) => {
    const el = $('pomo');
    el.classList.toggle('running', p.running);
    el.classList.toggle('break', p.mode !== 'focus');
    $('pomoTime').textContent = fmt(p.left);
    $('pomoMode').textContent = MODE_LABELS[p.mode];
    el.querySelector('.bar').style.strokeDashoffset = String(97.4 * (1 - p.progress));
    library.setPomodoro({ progress: p.progress, mode: p.mode, running: p.running });
    sound.setFocus(p.running && p.mode === 'focus');
    if (p.running) document.title = `${fmt(p.left)} · ${MODE_LABELS[p.mode]} — Hearthwood`;
    else if (document.title !== 'Hearthwood') document.title = 'Hearthwood';
  },
  onDone: (finished, next) => {
    sound.sfx('bell');
    const msg = finished === 'focus' ? `Focus session done — enjoy a ${pomo.settings[next]} minute ${next === 'long' ? 'long ' : ''}break` : 'Break over — ready when you are';
    toast(msg);
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Hearthwood', { body: msg });
  },
});
$('pomoToggle').onclick = () => {
  if (!pomo.running && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  pomo.toggle();
  sound.sfx('click');
};
$('pomoReset').onclick = () => pomo.reset();
$('pomoSkip').onclick = () => pomo.skip();
$('pomoMode').onclick = () => { if (!pomo.running) pomo.cycleMode(); };

// ---------- world settings panel ----------
function syncPanel() {
  for (const [id, val] of [['wpTime', timeMode], ['wpWeather', weatherMode]]) {
    $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === val));
  }
  const hh = Math.floor(env.hours), mm = Math.round((env.hours % 1) * 60);
  const clock = timeMode === 'auto' ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : TIME_MODES[timeMode].toLowerCase();
  $('wpStatus').textContent = `${env.season[0].toUpperCase()}${env.season.slice(1)} · ${clock} · ${WEATHER_MODES[env.weather].toLowerCase()}`;
}
$('btnWorld').onclick = () => {
  const panel = $('worldPanel');
  panel.hidden = !panel.hidden;
  if (!panel.hidden) {
    $('wpFocus').value = pomo.settings.focus; $('wpBreak').value = pomo.settings.break; $('wpLong').value = pomo.settings.long;
    syncPanel();
  }
};
$('wpClose').onclick = () => { $('worldPanel').hidden = true; };
$('wpTime').onclick = (e) => {
  const v = e.target.closest('button')?.dataset.v;
  if (!v) return;
  timeMode = v; store.set('worldTime', v); updateEnvironment(); sound.sfx('click');
};
$('wpWeather').onclick = (e) => {
  const v = e.target.closest('button')?.dataset.v;
  if (!v) return;
  weatherMode = v; store.set('weather', v); updateEnvironment(); sound.sfx('click');
};
for (const [id, key] of [['wpFocus', 'focus'], ['wpBreak', 'break'], ['wpLong', 'long']]) {
  $(id).onchange = (e) => pomo.setSettings({ [key]: Math.max(1, Math.min(180, Math.round(+e.target.value) || 1)) });
}
$('wpExportFull').onclick = async () => {
  toast('Packing your library…');
  const r = await exportBackup({ includeFiles: true });
  toast(`Saved ${r.books} books (${(r.bytes / 1048576).toFixed(1)} MB)`);
};
$('wpExportNotes').onclick = async () => {
  const r = await exportBackup({ includeFiles: false });
  toast(`Saved notes & progress for ${r.books} books`);
};
$('wpImport').onclick = () => $('backupInput').click();
$('backupInput').onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const r = await importBackup(file);
    await refresh();
    toast(`Restored: ${r.added} added, ${r.updated} updated${r.skipped ? `, ${r.skipped} skipped (PDF not on this device)` : ''}`);
  } catch (err) {
    toast(err.message);
  }
};

// ---------- import ----------
async function importFiles(files) {
  const pdfs = [...files].filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  if (!pdfs.length) return toast('Only PDF files are supported');
  const existing = await db.allBooks();
  let added = 0;
  for (const f of pdfs) {
    if (existing.some((b) => b.fileName === f.name && b.size === f.size)) { toast(`“${f.name}” is already shelved`); continue; }
    toast(`Shelving ${f.name}…`);
    try {
      const bytes = await f.arrayBuffer();
      const info = await describePdf(bytes, f.name);
      const id = crypto.randomUUID();
      await db.putFile(id, bytes);
      await db.putBook({ id, ...info, fileName: f.name, size: f.size, added: Date.now(), lastPage: 1,
        zoom: null, bookmarks: [], highlights: [], notes: [] });
      added++;
    } catch (e) {
      console.error(e);
      toast(`Couldn't read ${f.name}`);
    }
  }
  if (added) { await refresh(); sound.sfx('pop'); toast(`Added ${added} book${added > 1 ? 's' : ''} to your shelves`); }
}

$('btnImport').onclick = () => $('fileInput').click();
$('fileInput').onchange = (e) => { importFiles(e.target.files); e.target.value = ''; };

let dragDepth = 0;
addEventListener('dragenter', (e) => { if (e.dataTransfer?.types.includes('Files') && !reader.isOpen) { dragDepth++; $('dropzone').hidden = false; } });
addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('dropzone').hidden = true; } });
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0; $('dropzone').hidden = true;
  if (!reader.isOpen && e.dataTransfer?.files.length) importFiles(e.dataTransfer.files);
});

addEventListener('keydown', (e) => {
  if (loader.done && loader.el.isConnected && !loader.el.classList.contains('done') && (e.key === 'Enter' || e.key === ' ')) { loader.enter(); return; }
  if (e.target.matches?.('input, textarea') || !$('modal').hidden) return;
  if (e.key === 'Escape') {
    if (picking) { closePicker(); return; }
    if (!$('infoCard').hidden) { $('infoCard').hidden = true; return; }
    if (!$('worldPanel').hidden) { $('worldPanel').hidden = true; return; }
  }
  if (e.key === 't') cycleTime();
  if (e.key === 'm') toggleMusic();
  if (e.key === 'p') $('pomoToggle').click();
  if (reader.isOpen || picking) return;
  if (e.key === 'i') $('fileInput').click();
  if (e.key === 'g') $('btnView').click();
  if (!gridMode && e.key === 'c') $('btnChar').click();
});

refreshIcons();
refresh();
window.shelfspace = { library, reader, pomo }; // handy for debugging in the console

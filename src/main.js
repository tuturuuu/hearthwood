import { db } from './db.js';
import { describePdf } from './pdf.js';
import { Library } from './world.js';
import { ZONE_NAMES } from './scenery.js';
import { Reader } from './reader.js';
import { sound } from './audio.js';
import { toast, refreshIcons, icon } from './ui.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

// ---------- theme ----------
root.dataset.theme = store.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function toggleTheme() {
  const dark = root.dataset.theme !== 'dark';
  root.dataset.theme = dark ? 'dark' : 'light';
  store.set('theme', root.dataset.theme);
  library.setTheme(dark);
  reader.setTheme(dark);
  sound.sfx('click');
}
document.querySelectorAll('.themeToggle').forEach((b) => (b.onclick = toggleTheme));

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

// ---------- world + reader ----------
const library = new Library($('library'), { onOpen: (id) => openBook(id, true), onDelete: removeBook });
const reader = new Reader({
  onClose: async (id) => {
    $('fade').classList.remove('on');
    if (gridMode) { await refresh(); return; }
    library.resume();
    await library.playClose(id);
    await refresh();
  },
});

let zoneT;
library.onZone = (zone) => {
  const el = $('zone');
  el.textContent = ZONE_NAMES[zone] || '';
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(zoneT);
  zoneT = setTimeout(() => el.classList.remove('on'), 2600);
};

library.onFocus = (book) => {
  const p = $('prompt');
  if (!book) { p.hidden = true; return; }
  const pct = book.pages ? Math.round(((book.lastPage || 1) / book.pages) * 100) : 0;
  const extra = [
    book.bookmarks?.length && `${book.bookmarks.length} bookmarks`,
    book.highlights?.length && `${book.highlights.length} highlights`,
  ].filter(Boolean).join(' · ');
  p.innerHTML = `${book.cover ? '<img alt="">' : ''}<div class="info"><div class="t"></div><div class="s"></div><div class="bar"><i style="width:${pct}%"></i></div></div><kbd>Enter</kbd>`;
  if (book.cover) p.querySelector('img').src = book.cover;
  p.querySelector('.t').textContent = book.title;
  p.querySelector('.s').textContent = `${book.author ? book.author + ' · ' : ''}page ${book.lastPage || 1} / ${book.pages} · ${pct}%${extra ? ' · ' + extra : ''}`;
  p.hidden = false;
};

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
async function openBook(id, animate) {
  if (opening) return;
  opening = true;
  try {
    const book = await db.getBook(id);
    $('prompt').hidden = true;
    if (animate && !gridMode) await library.playOpen(id);
    $('fade').classList.add('on');
    await new Promise((r) => setTimeout(r, 300));
    library.pause();
    await reader.open(book);
    refreshIcons();
    $('fade').classList.remove('on');
  } catch (e) {
    console.error(e);
    toast('Could not open this book');
    $('fade').classList.remove('on');
    if (!gridMode) { library.resume(); await library.playClose(id); }
  } finally {
    opening = false;
  }
}

// ---------- classic grid view ----------
let gridMode = store.get('view') === 'grid';
function setGridMode(on) {
  gridMode = on;
  store.set('view', on ? 'grid' : 'world');
  $('classic').hidden = !on;
  $('help').hidden = on;
  $('btnView').classList.toggle('grid-mode', on);
  $('prompt').hidden = true;
  on ? library.pause() : library.resume();
}
$('btnChar').onclick = async () => {
  sound.sfx('pop');
  await library.nextCharacter();
  toast(`Playing as ${library.charName.replace('_', ' ')}`);
};
$('btnView').onclick = () => { setGridMode(!gridMode); sound.sfx('click'); };
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
    c.onclick = (e) => { if (e.target.closest('.del')) removeBook(b.id); else openBook(b.id, false); };
    return c;
  }));
  refreshIcons();
}

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
  if (e.target.matches?.('input, textarea') || !$('modal').hidden) return;
  if (e.key === 't') toggleTheme();
  if (e.key === 'm') toggleMusic();
  if (!reader.isOpen && e.key === 'i') $('fileInput').click();
  if (!reader.isOpen && e.key === 'g') $('btnView').click();
  if (!reader.isOpen && !gridMode && e.key === 'c') $('btnChar').click();
});

refreshIcons();
refresh();
window.shelfspace = { library, reader }; // handy for debugging in the console

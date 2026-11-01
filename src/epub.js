// EPUB support, built on epub.js. Its prebuilt browser bundle (plus JSZip) is loaded on first use, so
// PDF readers never download it. (jsDelivr's automatic ES-module build of epub.js has a broken dependency.)
const SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js',
];
const CHARS_PER_PAGE = 1100;     // EPUBs reflow, so a "page" is a fixed run of text (epub.js locations)
let ready;

export function loadEpubJs() {
  return (ready ??= SCRIPTS.reduce((p, src) => p.then(() => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error(`Couldn't load ${src}`));
    document.head.appendChild(s);
  })), Promise.resolve()).then(() => window.ePub).catch((e) => { ready = null; throw e; }));
}

export const isEpub = (file) => file.type === 'application/epub+zip' || /\.epub$/i.test(file.name);

const HL = { yellow: '#ffd600', green: '#50dc78', blue: '#50aaff', pink: '#ff6eb4' };

/** Title, author, cover and the page map, worked out once when the book is shelved. */
export async function describeEpub(bytes, fileName) {
  const ePub = await loadEpubJs();
  const book = ePub(bytes.slice(0));
  try {
    await book.ready;
    const meta = book.packaging?.metadata ?? {};
    const title = meta.title?.trim() || fileName.replace(/\.epub$/i, '').replace(/[_-]+/g, ' ').trim();
    const author = meta.creator?.trim() || '';
    await book.locations.generate(CHARS_PER_PAGE);
    let cover = null;
    try { const url = await book.coverUrl(); if (url) cover = await imageToDataUrl(url, 640); } catch {}
    return { format: 'epub', title, author, pages: Math.max(1, book.locations.length()), aspect: 2 / 3,
      cover: cover ?? drawCover(title, author), epubLocations: book.locations.save() };
  } finally {
    book.destroy();
  }
}

function imageToDataUrl(url, height) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.height = height; c.width = Math.round((img.width / img.height) * height);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

/** Books without cover art get a simple cloth-bound one. */
function drawCover(title, author) {
  const c = document.createElement('canvas'); c.width = 427; c.height = 640;
  const g = c.getContext('2d');
  const hue = [...title].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 17);
  g.fillStyle = `hsl(${hue}, 32%, 38%)`; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(255, 240, 210, .55)'; g.lineWidth = 6; g.strokeRect(26, 26, c.width - 52, c.height - 52);
  g.fillStyle = '#fbf3e4'; g.textAlign = 'center';
  g.font = '800 40px Nunito, sans-serif';
  const words = title.split(' '), lines = [];
  let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > c.width - 90 && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line);
  lines.slice(0, 6).forEach((l, i) => g.fillText(l, c.width / 2, 200 + i * 50));
  g.font = '600 24px Nunito, sans-serif'; g.fillStyle = 'rgba(251, 243, 228, .85)';
  if (author) g.fillText(author, c.width / 2, c.height - 80, c.width - 80);
  return c.toDataURL('image/jpeg', 0.85);
}

/**
 * One open EPUB rendered into `el`. Reports where the reader is (onRelocated), text selections
 * (onSelected) and clicks on highlights (onHighlightClick); forwards keys, wheel and swipes from
 * inside the book's iframe so the reader's shortcuts keep working.
 */
export class EpubView {
  constructor(el, handlers) {
    this.el = el;
    this.h = handlers;
    this.highlights = [];
  }

  async open(bytes, { locations, flow, dark, fontScale = 1, start }) {
    const ePub = await loadEpubJs();
    this.book = ePub(bytes.slice(0));
    await this.book.ready;
    if (locations) this.book.locations.load(locations);
    else await this.book.locations.generate(CHARS_PER_PAGE);
    this.toc = this.book.navigation?.toc ?? [];
    this.dark = dark; this.fontScale = fontScale;
    await this.render(flow, start);
  }

  get total() { return Math.max(1, this.book?.locations.length() || 1); }
  /** epub.js gives the insertion index: a spot partway through a page reports the next page's index. */
  pageOf(cfi) {
    const loc = this.book.locations, i = loc.locationFromCfi(cfi) ?? 0;
    return loc._locations[i] === cfi ? i + 1 : Math.max(1, i);
  }

  /** Page number where a table-of-contents entry starts (by the first page inside its chapter file). */
  pageOfHref(href) {
    const sec = this.book.spine.get(href.split('#')[0]);
    if (!sec) return null;
    const i = this.book.locations._locations.findIndex((c) => c.includes(`${sec.cfiBase}!`));
    return i >= 0 ? i + 1 : null;
  }

  /** 'paged' turns pages; 'scroll' reads as one long column. Rebuilds the rendition at `start`. */
  async render(flow, start) {
    this.flow = flow;
    this.rendition?.destroy();
    this.el.replaceChildren();
    const scroll = flow === 'scroll';
    const r = (this.rendition = this.book.renderTo(this.el, {
      width: '100%', height: '100%', spread: 'none', allowScriptedContent: false,
      flow: scroll ? 'scrolled' : 'paginated', manager: scroll ? 'continuous' : 'default',
    }));
    const base = { 'line-height': '1.6 !important', 'font-family': 'Georgia, "Iowan Old Style", serif' };
    // color-scheme must match the page's, or Chrome paints an opaque white backdrop behind the iframe
    r.themes.register('light', { html: { 'color-scheme': 'light' }, body: { ...base, color: '#2e2620 !important', background: 'transparent !important' }, a: { color: '#c0573c !important' } });
    r.themes.register('dark', { html: { 'color-scheme': 'dark' }, body: { ...base, color: '#e9e3d8 !important', background: 'transparent !important' }, a: { color: '#f2a57e !important' } });
    r.themes.select(this.dark ? 'dark' : 'light');
    r.themes.fontSize(`${Math.round(this.fontScale * 100)}%`);

    r.on('relocated', (loc) => {
      this.cfi = loc.start.cfi;
      this.h.onRelocated?.({ cfi: loc.start.cfi, page: (loc.start.location ?? 0) + 1, href: loc.start.href });
    });
    r.on('selected', (cfi, contents) => {
      const sel = contents.window.getSelection();
      const text = sel?.toString().replace(/\s+/g, ' ').trim();
      if (!text || !sel.rangeCount) return;
      const rr = sel.getRangeAt(0).getBoundingClientRect(), fr = contents.window.frameElement.getBoundingClientRect();
      const anchor = new DOMRect(rr.left + fr.left, rr.top + fr.top, rr.width, rr.height);
      this.h.onSelected?.({ cfi, text, page: this.pageOf(cfi), anchor, clear: () => sel.removeAllRanges() });
    });
    r.hooks.content.register((contents) => {
      const doc = contents.document;
      doc.addEventListener('keydown', (e) => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'PageUp', 'PageDown'].includes(e.key) && this.flow === 'paged') e.preventDefault();
        dispatchEvent(new KeyboardEvent('keydown', { key: e.key, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey }));
      });
      doc.addEventListener('keyup', (e) => dispatchEvent(new KeyboardEvent('keyup', { key: e.key, code: e.code })));
      doc.addEventListener('wheel', (e) => this.h.onWheel?.(e), { passive: false });
      doc.addEventListener('mousedown', () => this.h.onPointerDown?.());
      let t0 = null;
      doc.addEventListener('touchstart', (e) => { t0 = e.touches[0] && [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
      doc.addEventListener('touchend', (e) => {
        const t = e.changedTouches[0];
        if (!t0 || !t || this.flow !== 'paged') return;
        const dx = t.clientX - t0[0], dy = t.clientY - t0[1];
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) this.h.onSwipe?.(dx < 0 ? 1 : -1);
      }, { passive: true });
    });
    for (const h of this.highlights) this.paint(h);
    await r.display(start || undefined);
    // continuous scrolling loads the neighbouring chapters around the target, which shifts the view: land again
    if (scroll && start) { await new Promise((res) => setTimeout(res, 350)); if (this.rendition === r) await r.display(start); }
  }

  display(target) {
    if (typeof target === 'number') target = this.book.locations.cfiFromLocation(Math.max(0, target - 1));
    return this.rendition.display(target);
  }
  next() { return this.rendition.next(); }
  prev() { return this.rendition.prev(); }

  setDark(dark) { this.dark = dark; this.rendition?.themes.select(dark ? 'dark' : 'light'); }
  setFontScale(f) { this.fontScale = f; this.rendition?.themes.fontSize(`${Math.round(f * 100)}%`); }

  // ---------- highlights (anchored by CFI, so they survive reflow and font changes) ----------
  setHighlights(list) { for (const h of this.highlights) this.unpaint(h); this.highlights = [...list]; for (const h of list) this.paint(h); }
  addHighlight(h) { this.highlights.push(h); this.paint(h); }
  updateHighlight(h) { this.unpaint(h); this.paint(h); }
  removeHighlight(h) { this.unpaint(h); this.highlights = this.highlights.filter((x) => x.id !== h.id); }
  paint(h) {
    this.rendition?.annotations.highlight(h.cfi, { id: h.id }, () => this.h.onHighlightClick?.(h.id), `hl-${h.color}`,
      { fill: HL[h.color] || HL.yellow, 'fill-opacity': '0.35', 'mix-blend-mode': 'multiply' });
  }
  unpaint(h) { try { this.rendition?.annotations.remove(h.cfi, 'highlight'); } catch {} }

  destroy() {
    this.rendition?.destroy();
    this.book?.destroy();
    this.el.replaceChildren();
    this.rendition = this.book = null;
  }
}

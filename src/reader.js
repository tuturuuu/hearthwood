import { pdfjsLib, loadPdf, renderPageToCanvas } from './pdf.js';
import { Book3DView } from './book3d.js';
import { EpubView } from './epub.js';
import { db } from './db.js';
import { sound } from './audio.js';
import { toast, editNote, modalOpen, refreshIcons, icon } from './ui.js';

const $ = (id) => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10);
const COLORS = { yellow: '#ffd600', green: '#50dc78', blue: '#50aaff', pink: '#ff6eb4' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const TAB_TITLES = { contents: 'Contents', bookmarks: 'Bookmarks', highlights: 'Highlights', notes: 'Notes' };

export class Reader {
  constructor({ onClose }) {
    this.onClose = onClose;
    this.el = $('reader');
    this.wrap = $('pageWrap');
    this.tab = 'contents';
    this.fit = true;
    this.scale = 1.2;
    this.view = 'scroll';        // 'scroll' (vertical), 'paged' (flip sideways) or '3d'
    this.last2d = 'scroll';
    this.pages = [];
    this.visible = new Set();
    this.bind();
  }

  get isOpen() { return !this.el.hidden; }
  get mode3d() { return this.view === '3d'; }
  get isEpub() { return !!this.epub; }
  get numPages() { return this.pdf?.numPages ?? this.epub?.total ?? 0; }

  // ---------- open / close ----------
  async open(book, { cozy = false } = {}) {
    const bytes = await db.getFile(book.id);
    if (!bytes) throw new Error('Book data missing');
    this.book = book;
    book.bookmarks ??= [];
    book.highlights ??= [];
    book.notes ??= [];
    if (book.format === 'epub') return this.openEpub(book, bytes, { cozy });
    $('rMode3d').hidden = false;
    $('epubView').hidden = true;
    const pdf = (this.pdf = await loadPdf(bytes));
    const vp = (await pdf.getPage(1)).getViewport({ scale: 1 });
    this.base = { width: vp.width, height: vp.height };
    this.pageNum = Math.min(Math.max(1, book.lastPage || 1), pdf.numPages);
    this.fit = book.zoom == null;
    this.scale = book.zoom || 1.2;
    this.outline = null;
    this.flatToc = [];
    $('rTitle').textContent = book.title;
    $('rPage').max = pdf.numPages;
    this.el.hidden = false;
    this.el.classList.toggle('cozy', cozy);
    if (innerWidth < 760) $('sidebar').classList.add('closed');
    book.lastOpened = Date.now();

    const view = book.view ?? (book.mode3d ? '3d' : 'scroll');
    await this.setMode(view, true);          // layout first: the page scale depends on it
    this.buildPages();
    this.loadOutline().then(() => this.renderSidebar());
    if (view !== '3d') this.scrollToPage(this.pageNum);
    this.updatePageUI();
    this.renderSidebar();
  }

  /** EPUBs reflow, so they render through epub.js instead of page canvases (see epub.js). */
  async openEpub(book, bytes, { cozy }) {
    this.pdf = null;
    this.pageNum = Math.max(1, book.lastPage || 1);
    this.fit = book.zoom == null;
    this.fontScale = book.zoom || 1;
    this.outline = null;
    this.flatToc = [];
    $('rTitle').textContent = book.title;
    this.el.hidden = false;
    this.el.classList.toggle('cozy', cozy);
    if (innerWidth < 760) $('sidebar').classList.add('closed');
    book.lastOpened = Date.now();
    $('rMode3d').hidden = true;                       // the 3D book needs fixed page images
    this.wrap.hidden = true;
    $('view3d').hidden = true;
    $('epubView').hidden = false;
    $('rFit').title = 'Default text size';
    this.epub = new EpubView($('epubPage'), {
      onRelocated: ({ cfi, page }) => {
        this.cfi = cfi;
        if (performance.now() > (this.settleUntil || 0)) this.movedSinceSwitch = true;   // the reader moved on
        if (page !== this.pageNum) { this.pageNum = page; this.save(); }
        this.updatePageUI();
      },
      onSelected: (s) => { this.pending = s; this.showSelBar(s); },
      onHighlightClick: (id) => { const h = this.book.highlights.find((x) => x.id === id); if (h) this.editHighlight(h); },
      onPointerDown: () => this.hideSelBar(),
      onWheel: (e) => this.epubWheel(e),
      onSwipe: (dir) => this.step(dir),
    });
    const view = book.view === 'scroll' ? 'scroll' : 'paged';   // books read best page by page
    this.setModeButtons(view);
    await this.epub.open(bytes, { locations: book.epubLocations, flow: view, dark: document.documentElement.dataset.theme === 'dark',
      fontScale: this.fontScale, start: book.lastCfi || undefined });
    if (!book.lastCfi && this.pageNum > 1) await this.epub.display(this.pageNum);
    this.epub.setHighlights(book.highlights.filter((h) => h.cfi));
    $('rPage').max = this.numPages;
    this.loadOutline().then(() => this.renderSidebar());
    this.updatePageUI();
    this.renderSidebar();
  }

  /** Mouse wheel turns pages in paged EPUBs (scrolling within a page isn't a thing there). */
  epubWheel(e) {
    if (this.view !== 'paged' || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (performance.now() < (this.wheelLock || 0)) return;
    this.wheelAcc = (this.wheelAcc || 0) + e.deltaY;
    if (Math.abs(this.wheelAcc) > 40) { this.step(Math.sign(this.wheelAcc)); this.wheelAcc = 0; this.wheelLock = performance.now() + 380; }
  }

  async close() {
    if (!this.isOpen) return;
    this.hideSelBar();
    await this.saveNow();
    if (this.epub) { this.epub.destroy(); this.epub = null; $('epubView').hidden = true; this.wrap.hidden = false; }
    this.io?.disconnect();
    this.thumbIO?.disconnect();
    if (this.view3d) { this.view3d.dispose(); this.view3d = null; }
    this.cancelFlip();
    $('pages').replaceChildren();
    this.pages = [];
    this.visible.clear();
    this.el.hidden = true;
    this.el.classList.remove('cozy');
    this.pdf?.destroy();
    this.pdf = null;
    this.onClose(this.book.id);
  }

  save() { clearTimeout(this.saveT); this.saveT = setTimeout(() => this.saveNow(), 400); }
  async saveNow() {
    clearTimeout(this.saveT);
    if (!this.book) return;
    this.book.lastPage = this.pageNum;
    if (this.epub) { this.book.lastCfi = this.cfi ?? this.book.lastCfi; this.book.zoom = this.fit ? null : this.fontScale; }
    else this.book.zoom = this.fit ? null : this.scale;
    this.book.view = this.view;
    this.book.mode3d = this.mode3d;      // older backups only know this flag
    await db.putBook(this.book);
  }

  // ---------- continuous pages ----------
  computeScale() {
    if (!this.fit) return this.scale;
    if (this.view === 'paged') {           // the whole page on screen
      const w = this.wrap.clientWidth - 48, h = this.wrap.clientHeight - 64;
      return Math.max(0.3, Math.min(w / this.base.width, h / this.base.height, 2.5));
    }
    const avail = this.wrap.clientWidth - 64;
    return Math.max(0.3, Math.min(avail / this.base.width, 2.5));
  }

  buildPages() {
    this.io?.disconnect();
    const host = $('pages');
    host.replaceChildren();
    this.pages = [];
    this.visible.clear();
    this.scale = this.computeScale();
    this.io = new IntersectionObserver((entries) => {
      if (this.view === 'paged') return;     // paged mode picks its own pages (see layoutPaged)
      for (const e of entries) {
        const p = this.pages[+e.target.dataset.page - 1];
        if (e.isIntersecting) { this.visible.add(p); this.renderPage(p); }
        else { this.visible.delete(p); this.releasePage(p); }
      }
    }, { root: this.wrap, rootMargin: '1200px 0px' });
    for (let n = 1; n <= this.pdf.numPages; n++) {
      const el = document.createElement('div');
      el.className = 'page2d';
      el.dataset.page = n;
      el.innerHTML = `<div class="num">${n}</div>`;
      const p = { n, el, size: null, state: 'empty', scale: 0 };
      this.sizePage(p);
      host.appendChild(el);
      this.pages.push(p);
      this.io.observe(el);
    }
  }

  sizePage(p) {
    const s = p.size || this.base;
    p.el.style.width = `${Math.floor(s.width * this.scale)}px`;
    p.el.style.height = `${Math.floor(s.height * this.scale)}px`;
  }

  async renderPage(p) {
    if (!this.pdf || (p.state === 'rendered' && p.scale === this.scale) || p.state === 'rendering') return;
    p.state = 'rendering';
    const scale = this.scale;
    try {
      const page = await this.pdf.getPage(p.n);
      const v1 = page.getViewport({ scale: 1 });
      if (!p.size || p.size.width !== v1.width) { p.size = { width: v1.width, height: v1.height }; this.sizePage(p); }
      const vp = page.getViewport({ scale });
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width * dpr);
      canvas.height = Math.floor(vp.height * dpr);
      p.task = page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
      await p.task.promise;
      if (!this.visible.has(p) || scale !== this.scale) { p.state = 'stale'; if (scale !== this.scale && this.visible.has(p)) this.renderPage(p); return; }

      const hl = document.createElement('div'); hl.className = 'hlLayer';
      const tl = document.createElement('div'); tl.className = 'textLayer';
      for (const v of ['--scale-factor', '--total-scale-factor']) tl.style.setProperty(v, scale);
      tl.style.setProperty('--user-unit', 1);
      const num = p.el.querySelector('.num');
      p.el.replaceChildren(canvas, hl, tl, num);
      p.state = 'rendered';
      p.scale = scale;
      this.drawHighlights(p.n);
      await new pdfjsLib.TextLayer({ textContentSource: page.streamTextContent(), container: tl, viewport: vp }).render();
    } catch (e) {
      if (e?.name !== 'RenderingCancelledException') console.warn(e);
      p.state = 'empty';
    }
  }

  releasePage(p) {
    p.task?.cancel();
    if (p.state === 'empty') return;
    const num = p.el.querySelector('.num');
    p.el.replaceChildren(num);
    p.state = 'empty';
  }

  setScale(next) {
    if (this.view === 'paged') {
      this.scale = next;
      for (const p of this.pages) this.sizePage(p);
      for (const p of this.visible) this.renderPage(p);
      this.save();
      return;
    }
    const anchor = this.pageNum;
    const pEl = this.pages[anchor - 1]?.el;
    const frac = pEl ? (this.wrap.scrollTop - pEl.offsetTop) / pEl.offsetHeight : 0;
    this.scale = next;
    for (const p of this.pages) this.sizePage(p);
    const el = this.pages[anchor - 1]?.el;
    if (el) this.wrap.scrollTop = el.offsetTop + frac * el.offsetHeight;
    for (const p of this.visible) this.renderPage(p);
    this.save();
  }

  zoom(f) {
    if (this.mode3d) return;
    if (this.epub) {                                   // EPUB text reflows: zoom means a bigger font
      this.fit = false;
      this.fontScale = Math.min(2.2, Math.max(0.7, this.fontScale * f));
      this.epub.setFontScale(this.fontScale);
      return this.save();
    }
    this.fit = false;
    // paged: zoom up to the window's width at most, so a turning page stays on screen (tall pages scroll down)
    const max = this.view === 'paged' ? (this.wrap.clientWidth - 24) / this.base.width : 5;
    this.setScale(Math.min(max, Math.max(0.3, this.scale * f)));
  }

  fitWidth() {
    if (this.epub) { this.fit = true; this.fontScale = 1; this.epub.setFontScale(1); return this.save(); }
    this.fit = true; this.setScale(this.computeScale());
  }

  scrollToPage(n) {
    const p = this.pages[n - 1];
    if (!p) return;
    if (this.view === 'paged') {
      this.cancelFlip();
      this.pageNum = n;
      this.layoutPaged();
      this.wrap.scrollTop = 0;
      this.updatePageUI();
      return;
    }
    this.wrap.scrollTop = p.el.offsetTop - 16;
    this.pageNum = n;
    this.updatePageUI();
  }

  onScroll() {
    if (this.mode3d || !this.pages.length) return;
    if (this.view === 'paged') return;     // vertical scrolling there only pans a zoomed-in page
    const mid = this.wrap.scrollTop + this.wrap.clientHeight * 0.35;
    // binary search on offsetTop
    let lo = 0, hi = this.pages.length - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (this.pages[m].el.offsetTop <= mid) lo = m; else hi = m - 1;
    }
    const n = lo + 1;
    if (n !== this.pageNum) {
      this.pageNum = n;
      this.updatePageUI();
      this.save();
    }
  }

  // ---------- navigation ----------
  async go(n) {
    if (!this.numPages) return;
    n = Math.min(Math.max(1, n), this.numPages);
    if (this.epub) { await this.epub.display(n); return; }
    if (this.mode3d) {
      this.pageNum = n;
      await this.view3d.show(n);
      sound.sfx('flip');
    } else this.scrollToPage(n);
    this.updatePageUI();
    this.save();
  }

  /** Jump to a precise spot (EPUB highlights, bookmarks and contents carry a CFI or chapter link). */
  goTo(target) { if (this.epub && target) this.epub.display(target); }

  async step(dir) {
    if (this.epub) {
      if (this.view === 'paged') this.turnSheet(dir);
      return dir > 0 ? this.epub.next() : this.epub.prev();
    }
    if (this.mode3d) {
      const before = this.pageNum;
      this.pageNum = await this.view3d.flip(dir, () => sound.sfx('flip'));
      if (before !== this.pageNum) { this.updatePageUI(); this.save(); }
    } else if (this.view === 'paged') {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {   // no swinging paper: just change page
        const n = this.pageNum + dir;
        if (n >= 1 && n <= this.pdf.numPages) { this.scrollToPage(n); this.save(); }
        return;
      }
      const f = this.startFlip(dir);
      if (f) this.animateFlip(f, dir > 0 ? 1 : 0, 640);
    } else this.go(this.pageNum + dir);
  }

  /** EPUB pages can't be grabbed as images, so a blank sheet swings over as the text changes underneath. */
  turnSheet(dir) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const sheet = $('epubTurn');
    sheet.classList.remove('fwd', 'back');
    void sheet.offsetWidth;                            // restart the animation
    sheet.classList.add(dir > 0 ? 'fwd' : 'back');
    sound.sfx('flip');
  }

  // ---------- paged mode: one sheet at a time, turned like paper ----------
  // Pages sit stacked in one spot. Turning forward lifts the current sheet by its right edge and swings it
  // over the spine on its left; turning back lays the previous sheet down on top again.

  /** Show the current page and keep its neighbours rendered, so a turn never reveals a blank sheet. */
  layoutPaged(extra = []) {
    const keep = new Set([this.pageNum - 1, this.pageNum, this.pageNum + 1, ...extra]);
    for (const p of this.pages) {
      p.el.classList.toggle('cur', p.n === this.pageNum);
      const near = keep.has(p.n);
      if (near && !this.visible.has(p)) { this.visible.add(p); this.renderPage(p); }
      else if (!near && this.visible.has(p)) { this.visible.delete(p); this.releasePage(p); }
    }
  }

  startFlip(dir) {
    this.finishFlip();                                   // a new turn completes the one in progress
    const target = this.pageNum + dir;
    if (target < 1 || target > this.pdf.numPages) return null;
    const sheet = this.pages[(dir > 0 ? this.pageNum : target) - 1];   // the sheet that moves
    const under = this.pages[(dir > 0 ? target : this.pageNum) - 1];   // the page it uncovers (or covers)
    this.layoutPaged([target - 1, target + 1]);
    sheet.el.classList.add('turning');
    under.el.classList.add('under');
    this.wrap.classList.add('turning');      // the swinging sheet would otherwise spill scrollbars
    this.hideSelBar();
    getSelection()?.removeAllRanges();
    const f = { dir, target, sheet, under, t: 0 };
    this.flipping = f;
    this.setTurn(f, dir > 0 ? 0 : 1);
    sound.sfx('flip');
    return f;
  }

  /** t: how far the moving sheet has turned, 0 = lying flat on the right, 1 = turned over to the left. */
  setTurn(f, t) {
    f.t = t;
    f.sheet.el.style.transform = `rotateY(${-180 * t}deg)`;
    f.sheet.el.style.setProperty('--t', t.toFixed(3));
    f.under.el.style.setProperty('--t', t.toFixed(3));
  }

  /** Ease the sheet to `to`; landing on the far side commits the turn, landing back cancels it. */
  animateFlip(f, to, ms) {
    cancelAnimationFrame(f.raf);
    const from = f.t, start = performance.now();
    const dur = Math.max(120, ms * Math.abs(to - from));
    const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);   // paper picks up speed, then settles
    const tick = (now) => {
      const k = Math.min(1, (now - start) / dur);
      this.setTurn(f, from + (to - from) * ease(k));
      if (k < 1) f.raf = requestAnimationFrame(tick);
      else this.endFlip(f, to === (f.dir > 0 ? 1 : 0));
    };
    f.raf = requestAnimationFrame(tick);
  }

  endFlip(f, done) {
    if (this.flipping !== f) return;
    cancelAnimationFrame(f.raf);
    this.flipping = null;
    this.wrap.classList.remove('turning');
    for (const el of [f.sheet.el, f.under.el]) {
      el.classList.remove('turning', 'under');
      el.style.transform = '';
      el.style.removeProperty('--t');
    }
    if (done) {
      this.pageNum = f.target;
      this.wrap.scrollTop = 0;
      this.updatePageUI();
      this.save();
    }
    this.layoutPaged();
  }

  finishFlip() { if (this.flipping) this.endFlip(this.flipping, true); }
  cancelFlip() { if (this.flipping) this.endFlip(this.flipping, false); }

  updatePageUI() {
    if (!this.numPages) return;
    const n = this.pageNum, total = this.numPages;
    $('rPage').value = n;
    $('rTotal').textContent = this.mode3d && n + 1 <= total ? `–${n + 1} / ${total}` : `/ ${total}`;
    $('rBookmark').classList.toggle('on', this.book.bookmarks.some((b) => b.page === n));
    $('progress').firstElementChild.style.width = `${(n / total) * 100}%`;
    $('rFlipPrev').disabled = n <= 1;
    $('rFlipNext').disabled = n >= total;
    this.markCurrentToc();
  }

  // ---------- highlights ----------
  drawHighlights(n) {
    const p = this.pages[n - 1];
    const layer = p?.el.querySelector('.hlLayer');
    if (!layer) return;
    layer.replaceChildren();
    for (const h of this.book.highlights.filter((x) => x.page === n)) {
      h.rects.forEach(([x, y, w, hh], i) => {
        const d = document.createElement('div');
        d.className = `hl ${h.color}`;
        Object.assign(d.style, { left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${hh * 100}%` });
        layer.appendChild(d);
        if (i === 0 && h.note) {
          const m = document.createElement('div');
          m.className = 'hl-note';
          m.innerHTML = icon('message-square-text');
          Object.assign(m.style, { left: `${x * 100}%`, top: `${y * 100}%` });
          layer.appendChild(m);
        }
      });
    }
    refreshIcons();
  }

  readSelection() {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const startEl = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    const pageEl = startEl?.closest('.page2d');
    if (!pageEl || !$('pages').contains(pageEl)) return null;
    const pr = pageEl.getBoundingClientRect();
    const raw = [...range.getClientRects()]
      .filter((r) => r.width > 1 && r.height > 2 && r.top >= pr.top - 2 && r.bottom <= pr.bottom + 2)
      .map((r) => ({ l: r.left - pr.left, t: r.top - pr.top, r: r.right - pr.left, b: r.bottom - pr.top }))
      .sort((a, b) => a.t - b.t || a.l - b.l);
    const merged = [];
    for (const r of raw) {
      const m = merged.find((q) => Math.abs((q.t + q.b) / 2 - (r.t + r.b) / 2) < (r.b - r.t) * 0.5 && r.l <= q.r + 6 && r.r >= q.l - 6);
      if (m) { m.l = Math.min(m.l, r.l); m.r = Math.max(m.r, r.r); m.t = Math.min(m.t, r.t); m.b = Math.max(m.b, r.b); }
      else merged.push({ ...r });
    }
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (!merged.length || !text) return null;
    return {
      page: +pageEl.dataset.page,
      text,
      rects: merged.map((r) => [r.l / pr.width, r.t / pr.height, (r.r - r.l) / pr.width, (r.b - r.t) / pr.height]),
      anchor: range.getBoundingClientRect(),
    };
  }

  showSelBar(s = this.readSelection()) {
    if (!s) return this.hideSelBar();
    this.pending = s;
    const bar = $('selBar');
    bar.hidden = false;
    const bw = bar.offsetWidth, bh = bar.offsetHeight;
    let y = s.anchor.top - bh - 10;
    if (y < 70) y = s.anchor.bottom + 10;
    bar.style.left = `${Math.max(8, Math.min(innerWidth - bw - 8, s.anchor.left + s.anchor.width / 2 - bw / 2))}px`;
    bar.style.top = `${y}px`;
  }

  hideSelBar() { $('selBar').hidden = true; this.pending = null; }

  async addHighlight(color, withNote) {
    const s = this.pending;
    if (!s) return;
    const h = { id: uid(), page: s.page, text: s.text, color, note: '', created: Date.now() };
    if (s.cfi) h.cfi = s.cfi; else h.rects = s.rects;          // EPUB highlights are anchored by CFI
    s.clear?.();
    getSelection().removeAllRanges();
    this.hideSelBar();
    if (withNote) {
      const r = await editNote({ title: 'Note on highlight', quote: h.text, color });
      if (!r || r.action !== 'save') return;
      h.note = r.text; h.color = r.color;
    }
    this.book.highlights.push(h);
    sound.sfx('pop');
    this.paintHighlight(h);
    this.tab = withNote ? 'notes' : 'highlights';
    this.openSidebar();
    this.renderSidebar();
    this.save();
  }

  async editHighlight(h) {
    const r = await editNote({ title: `Highlight · page ${h.page}`, quote: h.text, text: h.note, color: h.color, canDelete: true });
    if (!r) return;
    if (r.action === 'delete') { this.book.highlights = this.book.highlights.filter((x) => x !== h); this.paintHighlight(h, true); }
    else { h.note = r.text; h.color = r.color; this.paintHighlight(h); }
    this.renderSidebar();
    this.save();
  }

  /** Draw (or erase) one highlight in whichever renderer the book uses. */
  paintHighlight(h, removed = false) {
    if (this.epub) {
      if (removed) this.epub.removeHighlight(h);
      else if (this.epub.highlights.some((x) => x.id === h.id)) this.epub.updateHighlight(h);
      else this.epub.addHighlight(h);
    } else this.drawHighlights(h.page);
  }

  highlightAt(pageEl, clientX, clientY) {
    const n = +pageEl.dataset.page;
    const pr = pageEl.getBoundingClientRect();
    const x = (clientX - pr.left) / pr.width, y = (clientY - pr.top) / pr.height;
    return this.book.highlights.find((h) => h.page === n &&
      h.rects.some(([rx, ry, rw, rh]) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh));
  }

  // ---------- bookmarks & notes ----------
  toggleBookmark() {
    const bm = this.book.bookmarks;
    const i = bm.findIndex((b) => b.page === this.pageNum);
    if (i >= 0) { bm.splice(i, 1); toast('Bookmark removed'); }
    else {
      const chapter = this.currentTocItem()?.title;
      bm.push({ id: uid(), page: this.pageNum, label: chapter ? `${chapter}` : `Page ${this.pageNum}`, created: Date.now(), ...(this.epub && { cfi: this.cfi }) });
      bm.sort((a, b) => a.page - b.page);
      toast(`Bookmarked page ${this.pageNum}`);
      sound.sfx('pop');
    }
    this.tab = 'bookmarks';
    this.updatePageUI();
    this.renderSidebar();
    this.save();
  }

  async pageNote(existing) {
    const page = existing?.page ?? this.pageNum;
    const r = await editNote({ title: `Note · page ${page}`, text: existing?.text ?? '', canDelete: !!existing });
    if (!r) return;
    if (r.action === 'delete') this.book.notes = this.book.notes.filter((n) => n !== existing);
    else if (existing) existing.text = r.text;
    else if (r.text) this.book.notes.push({ id: uid(), page, text: r.text, created: Date.now(), ...(this.epub && { cfi: this.cfi }) });
    this.tab = 'notes';
    this.openSidebar();
    this.renderSidebar();
    this.save();
  }

  // ---------- table of contents ----------
  async loadOutline() {
    if (this.epub) {
      const walk = (items, depth) => items.map((it) => ({ title: it.label.trim(), depth, href: it.href,
        page: this.epub.pageOfHref(it.href), items: it.subitems?.length ? walk(it.subitems, depth + 1) : [] }));
      this.outline = walk(this.epub.toc, 0);
      const flat = [];
      const flatten = (items) => items.forEach((it) => { flat.push(it); flatten(it.items); });
      flatten(this.outline);
      this.flatToc = flat.filter((x) => x.page);
      return;
    }
    const pdf = this.pdf;
    let outline = null;
    try { outline = await pdf.getOutline(); } catch {}
    if (!outline?.length || pdf !== this.pdf) { this.outline = []; return; }
    const resolve = async (dest) => {
      try {
        if (typeof dest === 'string') dest = await pdf.getDestination(dest);
        if (!Array.isArray(dest)) return null;
        const ref = dest[0];
        if (ref && typeof ref === 'object') return (await pdf.getPageIndex(ref)) + 1;
        if (Number.isInteger(ref)) return ref + 1;
      } catch {}
      return null;
    };
    const walk = async (items, depth) => Promise.all(items.map(async (it) => ({
      title: it.title, depth, page: await resolve(it.dest), items: it.items?.length ? await walk(it.items, depth + 1) : [],
    })));
    this.outline = await walk(outline, 0);
    const flat = [];
    const flatten = (items) => items.forEach((it) => { flat.push(it); flatten(it.items); });
    flatten(this.outline);
    this.flatToc = flat.filter((x) => x.page);
  }

  currentTocItem() {
    let cur = null;
    for (const it of this.flatToc) if (it.page <= this.pageNum && (!cur || it.page >= cur.page)) cur = it;
    return cur;
  }

  markCurrentToc() {
    if (this.tab !== 'contents') return;
    const list = $('sbList');
    if (this.outline?.length) {
      const cur = this.currentTocItem();
      list.querySelectorAll('.toc-row').forEach((r) => r.classList.toggle('current', r._item === cur));
    } else {
      list.querySelectorAll('.thumb').forEach((t) => t.classList.toggle('current', +t.dataset.page === this.pageNum));
    }
  }

  renderToc(list) {
    if (this.outline === null) { list.innerHTML = `<div class="empty">${icon('loader')}Reading contents…</div>`; return; }
    if (this.outline.length) {
      const build = (items) => {
        const ul = document.createElement('ul');
        ul.className = 'toc';
        for (const it of items) {
          const li = document.createElement('li');
          if (it.depth >= 1 && it.items.length) li.classList.add('collapsed');
          const row = document.createElement('div');
          row.className = 'toc-row';
          row._item = it;
          row.innerHTML = `<button class="tw">${it.items.length ? icon('chevron-down') : ''}</button><span class="lbl" title="${esc(it.title)}">${esc(it.title)}</span><span class="pg">${it.page ?? ''}</span>`;
          row.onclick = (e) => {
            if (e.target.closest('.tw') && it.items.length) { li.classList.toggle('collapsed'); return; }
            if (it.href && this.epub) { this.goTo(it.href); sound.sfx('click'); }
            else if (it.page) { this.go(it.page); sound.sfx('click'); }
          };
          li.appendChild(row);
          if (it.items.length) li.appendChild(build(it.items));
          ul.appendChild(li);
        }
        return ul;
      };
      list.replaceChildren(build(this.outline));
    } else if (this.epub) {
      list.innerHTML = `<div class="empty">${icon('list-tree')}This book has no table of contents. Use the page box above to jump around.</div>`;
    } else {
      // no outline in this PDF → page thumbnails as a visual table of contents
      this.thumbIO?.disconnect();
      const note = document.createElement('div');
      note.className = 'toc-note';
      note.textContent = 'This PDF has no table of contents — jump by page instead.';
      const grid = document.createElement('div');
      grid.className = 'thumbs';
      grid.style.setProperty('--ar', this.base.width / this.base.height);
      this.thumbIO = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || e.target.dataset.done) continue;
          e.target.dataset.done = 1;
          const n = +e.target.dataset.page;
          renderPageToCanvas(this.pdf, n, 220).then((c) => e.target.querySelector('.ph').appendChild(c)).catch(() => {});
        }
      }, { root: list, rootMargin: '300px' });
      for (let n = 1; n <= this.pdf.numPages; n++) {
        const t = document.createElement('div');
        t.className = 'thumb';
        t.dataset.page = n;
        t.innerHTML = `<div class="ph"></div>${n}`;
        t.onclick = () => this.go(n);
        grid.appendChild(t);
        this.thumbIO.observe(t);
      }
      list.replaceChildren(note, grid);
    }
    this.markCurrentToc();
    list.querySelector('.current')?.scrollIntoView({ block: 'center' });
  }

  // ---------- sidebar ----------
  openSidebar() { $('sidebar').classList.remove('closed'); }

  renderSidebar() {
    if (!this.book) return;
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === this.tab));
    $('sbTitle').textContent = TAB_TITLES[this.tab];
    const list = $('sbList');
    const b = this.book;
    if (this.tab === 'contents') { this.renderToc(list); refreshIcons(); return; }
    this.thumbIO?.disconnect();

    let items = [];
    const quote = (h) => `<div class="q" style="--c:${COLORS[h.color]}">${esc(h.text)}</div>`;
    if (this.tab === 'bookmarks') {
      items = b.bookmarks.map((x) => ({ kind: 'bm', ref: x, page: x.page,
        html: `<div class="meta"><span>${icon('bookmark')} p. ${x.page}</span>${this.acts(['rename', 'delete'])}</div><div class="n">${esc(x.label)}</div>` }));
    } else if (this.tab === 'highlights') {
      items = b.highlights.map((h) => ({ kind: 'hl', ref: h, page: h.page,
        html: `<div class="meta"><span>${icon('highlighter')} p. ${h.page}</span>${this.acts(['edit', 'delete'])}</div>${quote(h)}${h.note ? `<div class="n">${esc(h.note)}</div>` : ''}` }));
    } else {
      items = [
        ...b.notes.map((n) => ({ kind: 'note', ref: n, page: n.page,
          html: `<div class="meta"><span>${icon('sticky-note')} p. ${n.page}</span>${this.acts(['edit', 'delete'])}</div><div class="n">${esc(n.text)}</div>` })),
        ...b.highlights.filter((h) => h.note).map((h) => ({ kind: 'hl', ref: h, page: h.page,
          html: `<div class="meta"><span>${icon('message-square-text')} p. ${h.page}</span>${this.acts(['edit', 'delete'])}</div>${quote(h)}<div class="n">${esc(h.note)}</div>` })),
      ];
    }
    items.sort((x, y) => x.page - y.page);
    if (!items.length) {
      const [ic, hint] = {
        bookmarks: ['bookmark-plus', 'No bookmarks yet. Press B to bookmark the current page.'],
        highlights: ['highlighter', 'Select any text on a page to highlight it.'],
        notes: ['notebook-pen', 'Press N to write a note on this page, or add a note to a highlight.'],
      }[this.tab];
      list.innerHTML = `<div class="empty">${icon(ic)}${hint}</div>`;
      refreshIcons();
      return;
    }
    list.replaceChildren(...items.map((it) => {
      const d = document.createElement('div');
      d.className = 'item';
      d.innerHTML = it.html;
      d.onclick = async (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (!act) return it.ref.cfi && this.epub ? this.goTo(it.ref.cfi) : this.go(it.page);
        e.stopPropagation();
        if (it.kind === 'bm') {
          if (act === 'delete') b.bookmarks = b.bookmarks.filter((x) => x !== it.ref);
          if (act === 'rename') {
            const r = await editNote({ title: 'Rename bookmark', text: it.ref.label });
            if (r?.action === 'save' && r.text) it.ref.label = r.text;
          }
          this.updatePageUI();
        } else if (it.kind === 'hl') {
          if (act === 'delete') { b.highlights = b.highlights.filter((x) => x !== it.ref); this.paintHighlight(it.ref, true); }
          else return this.editHighlight(it.ref);
        } else {
          if (act === 'delete') b.notes = b.notes.filter((x) => x !== it.ref);
          else return this.pageNote(it.ref);
        }
        this.renderSidebar();
        this.save();
      };
      return d;
    }));
    refreshIcons();
  }

  acts(names) {
    const icons = { rename: 'pencil', edit: 'pencil', delete: 'trash-2' };
    return `<span class="acts">${names.map((n) => `<button data-act="${n}" title="${n}">${icon(icons[n])}</button>`).join('')}</span>`;
  }

  // ---------- modes ----------
  setModeButtons(view) {
    this.view = view;
    $('rModeScroll').classList.toggle('on', view === 'scroll');
    $('rModePaged').classList.toggle('on', view === 'paged');
    $('rMode3d').classList.toggle('on', view === '3d');
  }

  async setMode(view, initial = false) {
    if (this.epub) {                                   // EPUB: scroll or paged, re-flowed at the same spot
      if (view === '3d' || view === this.view) return;
      this.setModeButtons(view);
      this.hideSelBar();
      // scroll mode reports the very top edge (often the previous page's last line) as the position, so
      // flipping modes back and forth would creep backwards; reuse the anchor unless the reader moved since
      const anchor = this.modeAnchor && !this.movedSinceSwitch ? this.modeAnchor : this.cfi;
      this.modeAnchor = anchor;
      this.movedSinceSwitch = false;
      this.settleUntil = performance.now() + 2500;
      await this.epub.render(view, anchor);
      return this.save();
    }
    if (view !== '3d') this.last2d = view;
    this.view = view;
    const three = view === '3d';
    $('rModeScroll').classList.toggle('on', view === 'scroll');
    $('rModePaged').classList.toggle('on', view === 'paged');
    $('rMode3d').classList.toggle('on', three);
    $('zoomGroup').style.visibility = three ? 'hidden' : '';
    $('rFit').title = view === 'paged' ? 'Fit page' : 'Fit width';
    this.wrap.classList.toggle('paged', view === 'paged');
    $('rMain').classList.toggle('paged', view === 'paged');
    this.wrap.hidden = three;
    $('view3d').hidden = !three;
    this.cancelFlip();
    this.hideSelBar();
    if (view !== 'paged') this.pages.forEach((p) => p.el.classList.remove('cur'));
    if (three) {
      if (!this.view3d) {
        const pdf = this.pdf;
        this.view3d = new Book3DView($('view3d'), {
          numPages: pdf.numPages,
          aspect: this.base.width / this.base.height,
          renderPage: (n) => renderPageToCanvas(pdf, n, 1600),
        });
        this.view3d.setDark(document.documentElement.dataset.theme === 'dark');
      }
      await this.view3d.show(this.pageNum);
    } else {
      this.view3d?.dispose();
      this.view3d = null;
      if (!initial) {
        if (view === 'paged' && this.scale * this.base.width > this.wrap.clientWidth - 24) this.fit = true;  // too wide to flip
        if (this.fit) this.setScale(this.computeScale());
        else for (const p of this.pages) this.sizePage(p);
        if (view === 'scroll' && this.io) {            // let the observer pick the visible pages again
          this.io.disconnect();
          this.pages.forEach((p) => this.io.observe(p.el));
        }
        this.scrollToPage(this.pageNum);
      }
    }
    this.updatePageUI();
    if (!initial) this.save();
  }

  setTheme(dark) { this.view3d?.setDark(dark); this.epub?.setDark(dark); }

  /** Grab a page and turn it by hand: swipe anywhere on touch; with a mouse, drag it by its outer edge
   *  (the middle of the page stays free for selecting text). */
  bindPageDrag() {
    const w = this.wrap;
    let drag = null;
    const edge = (e) => {
      const r = this.pages[this.pageNum - 1]?.el.getBoundingClientRect();
      if (!r) return null;
      const x = (e.clientX - r.left) / r.width;
      return x > 0.86 && x < 1.08 ? 1 : x < 0.14 && x > -0.08 ? -1 : null;
    };
    w.addEventListener('pointerdown', (e) => {
      if (this.view !== 'paged' || e.button !== 0 || !this.pdf) return;
      const touch = e.pointerType !== 'mouse';
      const dir = touch ? 0 : edge(e);
      if (dir === null) return;
      if (!touch) e.preventDefault();                  // no text selection while grabbing the edge
      drag = { x0: e.clientX, y0: e.clientY, dir, id: e.pointerId, f: null, w: this.pages[this.pageNum - 1].el.offsetWidth, last: [] };
    });
    w.addEventListener('pointermove', (e) => {
      if (this.view !== 'paged') return;
      if (!drag) { if (e.pointerType === 'mouse' && !e.buttons) w.style.cursor = edge(e) ? 'grab' : ''; return; }
      if (e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.f) {
        if (Math.abs(dx) < 8) return;
        if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; }      // a vertical swipe: let it scroll
        drag.f = this.startFlip(drag.dir || (dx < 0 ? 1 : -1));
        if (!drag.f) { drag = null; return; }
        try { w.setPointerCapture(e.pointerId); } catch {}   // keep the sheet even if the pointer leaves the page
        w.style.cursor = 'grabbing';
      }
      const f = drag.f, t = f.dir > 0 ? -dx / (drag.w * 1.1) : 1 - dx / (drag.w * 1.1);
      this.setTurn(f, Math.min(1, Math.max(0, t)));
      drag.last.push([performance.now(), e.clientX]);
      if (drag.last.length > 5) drag.last.shift();
    });
    const release = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { f, last } = drag;
      drag = null;
      w.style.cursor = '';
      if (!f || this.flipping !== f) return;
      // finish the turn if the sheet is past a third of the way, or was flicked in that direction
      const recent = last.filter(([t]) => performance.now() - t < 100);   // a finger that paused isn't flicking
      const [t0, x0] = recent[0] || [0, 0], [t1, x1] = recent.at(-1) || [1, 0];
      const v = recent.length > 1 ? (x1 - x0) / Math.max(1, t1 - t0) : 0;   // px per ms, negative = towards the left
      const progress = f.dir > 0 ? f.t : 1 - f.t;
      const flick = f.dir > 0 ? v < -0.4 : v > 0.4;
      const done = e.type === 'pointerup' && (progress > 0.33 || flick);
      this.animateFlip(f, done === (f.dir > 0) ? 1 : 0, 560);
    };
    w.addEventListener('pointerup', release);
    w.addEventListener('pointercancel', release);
  }

  // ---------- events ----------
  bind() {
    $('rBack').onclick = () => this.close();
    $('rPrev').onclick = () => this.step(-1);
    $('rNext').onclick = () => this.step(1);
    $('rPage').onchange = (e) => this.go(+e.target.value || 1);
    $('rZoomIn').onclick = () => this.zoom(1.15);
    $('rZoomOut').onclick = () => this.zoom(1 / 1.15);
    $('rFit').onclick = () => this.fitWidth();
    $('rBookmark').onclick = () => this.toggleBookmark();
    $('rAddNote').onclick = () => this.pageNote();
    $('rModeScroll').onclick = () => this.view !== 'scroll' && this.setMode('scroll');
    $('rModePaged').onclick = () => this.view !== 'paged' && this.setMode('paged');
    $('rMode3d').onclick = () => !this.mode3d && this.setMode('3d');
    $('rFlipPrev').onclick = () => this.step(-1);
    $('rFlipNext').onclick = () => this.step(1);
    // paged mode: refit the page whenever the reading area changes size (window, sidebar)
    new ResizeObserver(() => {
      if (this.isOpen && this.view === 'paged' && this.pages.length && this.fit) this.setScale(this.computeScale());
    }).observe(this.wrap);
    this.bindPageDrag();
    $('rSidebarBtn').onclick = () => {
      $('sidebar').classList.toggle('closed');
      if (this.fit && !this.mode3d) this.setScale(this.computeScale());
    };
    document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => { this.tab = b.dataset.tab; this.renderSidebar(); }));

    $('selBar').addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection alive
    $('selBar').onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.color) this.addHighlight(btn.dataset.color, false);
      else if (btn.id === 'selNote') this.addHighlight('yellow', true);
      else if (btn.id === 'selCopy') {
        navigator.clipboard?.writeText(this.pending?.text || '').then(() => toast('Copied'));
        this.hideSelBar();
      }
    };

    document.addEventListener('mouseup', (e) => {
      if (!this.isOpen || this.mode3d || this.epub || $('selBar').contains(e.target) || !$('modal').hidden) return;
      setTimeout(() => {
        if (this.readSelection()) return this.showSelBar();
        this.hideSelBar();
        const pageEl = e.target.closest?.('.page2d');
        if (pageEl) {
          const h = this.highlightAt(pageEl, e.clientX, e.clientY);
          if (h) this.editHighlight(h);
        }
      }, 0);
    });

    let ticking = false;
    this.wrap.addEventListener('scroll', () => {
      this.hideSelBar();
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; this.onScroll(); });
    });
    this.wrap.addEventListener('wheel', (e) => {
      if (e.ctrlKey) { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1.08 : 1 / 1.08); return; }
      if (this.view !== 'paged') return;
      // a mouse wheel flips pages; sideways trackpad swipes and zoomed-in tall pages scroll natively
      const tall = this.wrap.scrollHeight > this.wrap.clientHeight + 2;
      if (tall || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (performance.now() < (this.wheelLock || 0)) return;
      this.wheelAcc = (this.wheelAcc || 0) + e.deltaY;
      if (Math.abs(this.wheelAcc) > 40) {
        this.step(Math.sign(this.wheelAcc));
        this.wheelAcc = 0;
        this.wheelLock = performance.now() + 380;
      }
    }, { passive: false });
    $('view3d').addEventListener('click', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      this.step(e.clientX - r.left > r.width / 2 ? 1 : -1);
    });

    let resizeT;
    addEventListener('resize', () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => { if (this.isOpen && this.view === 'scroll' && this.fit) this.setScale(this.computeScale()); }, 150);
    });

    addEventListener('keydown', (e) => {
      if (!this.isOpen || modalOpen() || e.target.matches?.('input, textarea')) return;
      const k = e.key;
      const flipsDown = this.view === 'paged' && this.wrap.scrollHeight <= this.wrap.clientHeight + 2;   // whole page visible
      if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && this.view !== 'scroll') || (k === 'ArrowDown' && flipsDown)) { e.preventDefault(); this.step(1); }
      else if (k === 'ArrowLeft' || k === 'PageUp' || (k === 'ArrowUp' && flipsDown)) { e.preventDefault(); this.step(-1); }
      else if (k === 'Home') this.go(1);
      else if (k === 'End') this.go(this.numPages);
      else if (k === 'Escape') { if (!$('selBar').hidden) this.hideSelBar(); else this.close(); }
      else if (k === 'b') this.toggleBookmark();
      else if (k === 'n') { e.preventDefault(); this.pageNote(); }
      else if (k === 's') $('rSidebarBtn').click();
      else if (k === 'c') { this.tab = 'contents'; this.openSidebar(); this.renderSidebar(); }
      else if (k === '1') this.view !== 'scroll' && this.setMode('scroll');
      else if (k === '2') this.view !== 'paged' && this.setMode('paged');
      else if (k === '3' && !this.epub) this.setMode(this.mode3d ? this.last2d : '3d');
      else if (k === '+' || k === '=') this.zoom(1.15);
      else if (k === '-') this.zoom(1 / 1.15);
    });
  }
}

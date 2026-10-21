import { pdfjsLib, loadPdf, renderPageToCanvas } from './pdf.js';
import { Book3DView } from './book3d.js';
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
    this.mode3d = false;
    this.pages = [];
    this.visible = new Set();
    this.bind();
  }

  get isOpen() { return !this.el.hidden; }

  // ---------- open / close ----------
  async open(book) {
    const bytes = await db.getFile(book.id);
    if (!bytes) throw new Error('PDF data missing');
    this.book = book;
    book.bookmarks ??= [];
    book.highlights ??= [];
    book.notes ??= [];
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
    if (innerWidth < 760) $('sidebar').classList.add('closed');
    book.lastOpened = Date.now();

    this.buildPages();
    this.loadOutline().then(() => this.renderSidebar());
    if (book.mode3d) await this.setMode(true);
    else { this.setMode(false, true); this.scrollToPage(this.pageNum); }
    this.updatePageUI();
    this.renderSidebar();
  }

  async close() {
    if (!this.isOpen) return;
    this.hideSelBar();
    await this.saveNow();
    this.io?.disconnect();
    this.thumbIO?.disconnect();
    if (this.view3d) { this.view3d.dispose(); this.view3d = null; }
    this.mode3d = false;
    $('pages').replaceChildren();
    this.pages = [];
    this.visible.clear();
    this.el.hidden = true;
    this.pdf?.destroy();
    this.pdf = null;
    this.onClose(this.book.id);
  }

  save() { clearTimeout(this.saveT); this.saveT = setTimeout(() => this.saveNow(), 400); }
  async saveNow() {
    clearTimeout(this.saveT);
    if (!this.book) return;
    this.book.lastPage = this.pageNum;
    this.book.zoom = this.fit ? null : this.scale;
    this.book.mode3d = this.mode3d;
    await db.putBook(this.book);
  }

  // ---------- continuous pages ----------
  computeScale() {
    if (!this.fit) return this.scale;
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
    this.fit = false;
    this.setScale(Math.min(5, Math.max(0.3, this.scale * f)));
  }

  fitWidth() { this.fit = true; this.setScale(this.computeScale()); }

  scrollToPage(n) {
    const p = this.pages[n - 1];
    if (!p) return;
    this.wrap.scrollTop = p.el.offsetTop - 16;
    this.pageNum = n;
    this.updatePageUI();
  }

  onScroll() {
    if (this.mode3d || !this.pages.length) return;
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
    if (!this.pdf) return;
    n = Math.min(Math.max(1, n), this.pdf.numPages);
    if (this.mode3d) {
      this.pageNum = n;
      await this.view3d.show(n);
      sound.sfx('flip');
    } else this.scrollToPage(n);
    this.updatePageUI();
    this.save();
  }

  async step(dir) {
    if (this.mode3d) {
      const before = this.pageNum;
      this.pageNum = await this.view3d.flip(dir, () => sound.sfx('flip'));
      if (before !== this.pageNum) { this.updatePageUI(); this.save(); }
    } else this.go(this.pageNum + dir);
  }

  updatePageUI() {
    if (!this.pdf) return;
    const n = this.pageNum, total = this.pdf.numPages;
    $('rPage').value = n;
    $('rTotal').textContent = this.mode3d && n + 1 <= total ? `–${n + 1} / ${total}` : `/ ${total}`;
    $('rBookmark').classList.toggle('on', this.book.bookmarks.some((b) => b.page === n));
    $('progress').firstElementChild.style.width = `${(n / total) * 100}%`;
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

  showSelBar() {
    const s = this.readSelection();
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
    const h = { id: uid(), page: s.page, text: s.text, rects: s.rects, color, note: '', created: Date.now() };
    getSelection().removeAllRanges();
    this.hideSelBar();
    if (withNote) {
      const r = await editNote({ title: 'Note on highlight', quote: h.text, color });
      if (!r || r.action !== 'save') return;
      h.note = r.text; h.color = r.color;
    }
    this.book.highlights.push(h);
    sound.sfx('pop');
    this.drawHighlights(h.page);
    this.tab = withNote ? 'notes' : 'highlights';
    this.openSidebar();
    this.renderSidebar();
    this.save();
  }

  async editHighlight(h) {
    const r = await editNote({ title: `Highlight · page ${h.page}`, quote: h.text, text: h.note, color: h.color, canDelete: true });
    if (!r) return;
    if (r.action === 'delete') this.book.highlights = this.book.highlights.filter((x) => x !== h);
    else { h.note = r.text; h.color = r.color; }
    this.drawHighlights(h.page);
    this.renderSidebar();
    this.save();
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
      bm.push({ id: uid(), page: this.pageNum, label: chapter ? `${chapter}` : `Page ${this.pageNum}`, created: Date.now() });
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
    else if (r.text) this.book.notes.push({ id: uid(), page, text: r.text, created: Date.now() });
    this.tab = 'notes';
    this.openSidebar();
    this.renderSidebar();
    this.save();
  }

  // ---------- table of contents ----------
  async loadOutline() {
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
            if (it.page) { this.go(it.page); sound.sfx('click'); }
          };
          li.appendChild(row);
          if (it.items.length) li.appendChild(build(it.items));
          ul.appendChild(li);
        }
        return ul;
      };
      list.replaceChildren(build(this.outline));
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
        if (!act) return this.go(it.page);
        e.stopPropagation();
        if (it.kind === 'bm') {
          if (act === 'delete') b.bookmarks = b.bookmarks.filter((x) => x !== it.ref);
          if (act === 'rename') {
            const r = await editNote({ title: 'Rename bookmark', text: it.ref.label });
            if (r?.action === 'save' && r.text) it.ref.label = r.text;
          }
          this.updatePageUI();
        } else if (it.kind === 'hl') {
          if (act === 'delete') { b.highlights = b.highlights.filter((x) => x !== it.ref); this.drawHighlights(it.page); }
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
  async setMode(three, initial = false) {
    this.mode3d = three;
    $('rModeScroll').classList.toggle('on', !three);
    $('rMode3d').classList.toggle('on', three);
    $('zoomGroup').style.visibility = three ? 'hidden' : '';
    this.wrap.hidden = three;
    $('view3d').hidden = !three;
    this.hideSelBar();
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
        if (this.fit) this.setScale(this.computeScale());
        this.scrollToPage(this.pageNum);
      }
    }
    this.updatePageUI();
    if (!initial) this.save();
  }

  setTheme(dark) { this.view3d?.setDark(dark); }

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
    $('rModeScroll').onclick = () => this.mode3d && this.setMode(false);
    $('rMode3d').onclick = () => !this.mode3d && this.setMode(true);
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
      if (!this.isOpen || this.mode3d || $('selBar').contains(e.target) || !$('modal').hidden) return;
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
      if (e.ctrlKey) { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1.08 : 1 / 1.08); }
    }, { passive: false });
    $('view3d').addEventListener('click', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      this.step(e.clientX - r.left > r.width / 2 ? 1 : -1);
    });

    let resizeT;
    addEventListener('resize', () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => { if (this.isOpen && !this.mode3d && this.fit) this.setScale(this.computeScale()); }, 150);
    });

    addEventListener('keydown', (e) => {
      if (!this.isOpen || modalOpen() || e.target.matches?.('input, textarea')) return;
      const k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && this.mode3d)) { e.preventDefault(); this.step(1); }
      else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); this.step(-1); }
      else if (k === 'Home') this.go(1);
      else if (k === 'End') this.go(this.pdf.numPages);
      else if (k === 'Escape') { if (!$('selBar').hidden) this.hideSelBar(); else this.close(); }
      else if (k === 'b') this.toggleBookmark();
      else if (k === 'n') { e.preventDefault(); this.pageNote(); }
      else if (k === 's') $('rSidebarBtn').click();
      else if (k === 'c') { this.tab = 'contents'; this.openSidebar(); this.renderSidebar(); }
      else if (k === '3') this.setMode(!this.mode3d);
      else if (k === '+' || k === '=') this.zoom(1.15);
      else if (k === '-') this.zoom(1 / 1.15);
    });
  }
}

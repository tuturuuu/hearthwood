import { db } from './db.js';

// Backups are one JSON file. A full backup embeds every PDF (base64); a light one only carries
// progress, bookmarks, highlights and notes and is merged into books you already have.
const APP = 'hearthwood';
const SETTINGS = ['theme', 'music', 'character', 'view', 'worldTime', 'weather', 'pomodoro'];

const toBase64 = (bytes) => new Promise((resolve) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result.slice(r.result.indexOf(',') + 1));
  r.readAsDataURL(new Blob([bytes]));
});
const fromBase64 = async (b64) => new Uint8Array(await (await fetch(`data:application/octet-stream;base64,${b64}`)).arrayBuffer()).buffer;

export async function exportBackup({ includeFiles }) {
  const books = await db.allBooks();
  const out = [];
  for (const b of books) {
    const entry = { ...b };
    if (includeFiles) {
      const bytes = await db.getFile(b.id);
      if (bytes) entry.file = await toBase64(bytes);
    }
    out.push(entry);
  }
  const settings = {};
  for (const k of SETTINGS) { try { const v = localStorage.getItem(k); if (v != null) settings[k] = v; } catch {} }
  const data = { app: APP, version: 1, kind: includeFiles ? 'full' : 'notes', exported: new Date().toISOString(), settings, books: out };

  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hearthwood-${includeFiles ? 'backup' : 'notes'}-${data.exported.slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return { books: out.length, bytes: blob.size };
}

/** Returns { added, updated, skipped }. */
export async function importBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { throw new Error('That file is not a Hearthwood backup'); }
  if (data?.app !== APP || !Array.isArray(data.books)) throw new Error('That file is not a Hearthwood backup');

  const existing = await db.allBooks();
  const byId = new Map(existing.map((b) => [b.id, b]));
  const byFile = new Map(existing.map((b) => [`${b.fileName}|${b.size}`, b]));
  let added = 0, updated = 0, skipped = 0;

  for (const incoming of data.books) {
    const { file, ...meta } = incoming;
    const match = byId.get(meta.id) || byFile.get(`${meta.fileName}|${meta.size}`);
    if (match) {
      // keep whichever copy was read more recently, but never lose annotations from either side
      const newer = (meta.lastOpened || 0) > (match.lastOpened || 0) ? meta : match;
      const merged = { ...match, ...newer, id: match.id };
      for (const key of ['bookmarks', 'highlights', 'notes']) {
        const seen = new Map();
        for (const item of [...(match[key] || []), ...(meta[key] || [])]) seen.set(item.id, item);
        merged[key] = [...seen.values()];
      }
      await db.putBook(merged);
      updated++;
    } else if (file) {
      await db.putFile(meta.id, await fromBase64(file));
      await db.putBook(meta);
      added++;
    } else {
      skipped++;   // notes-only backup for a book that isn't on this device
    }
  }
  for (const [k, v] of Object.entries(data.settings || {})) { try { localStorage.setItem(k, v); } catch {} }
  return { added, updated, skipped };
}

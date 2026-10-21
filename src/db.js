// IndexedDB storage: book metadata (progress, bookmarks, highlights, notes) + raw PDF bytes.
const DB_NAME = 'shelfspace';
let dbPromise;

function openDB() {
  return (dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore('books', { keyPath: 'id' });
      d.createObjectStore('files');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

async function run(store, mode, fn) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const db = {
  allBooks: () => run('books', 'readonly', (s) => s.getAll()),
  getBook: (id) => run('books', 'readonly', (s) => s.get(id)),
  putBook: (book) => run('books', 'readwrite', (s) => s.put(book)),
  getFile: (id) => run('files', 'readonly', (s) => s.get(id)),
  putFile: (id, data) => run('files', 'readwrite', (s) => s.put(data, id)),
  async deleteBook(id) {
    await run('books', 'readwrite', (s) => s.delete(id));
    await run('files', 'readwrite', (s) => s.delete(id));
  },
};

import * as pdfjsLib from 'pdfjs';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

export { pdfjsLib };

// pdf.js transfers (detaches) the buffer it is given, so always hand it a copy.
export const loadPdf = (bytes) => pdfjsLib.getDocument({ data: new Uint8Array(bytes).slice() }).promise;

export async function renderPageToCanvas(pdf, n, targetHeight) {
  const page = await pdf.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: targetHeight / base.height });
  const c = document.createElement('canvas');
  c.width = Math.round(vp.width);
  c.height = Math.round(vp.height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return c;
}

export async function describePdf(bytes, fileName) {
  const pdf = await loadPdf(bytes);
  let title = fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
  let author = '';
  try {
    const { info } = await pdf.getMetadata();
    if (info?.Title && info.Title.trim().length > 2) title = info.Title.trim();
    if (info?.Author) author = info.Author.trim();
  } catch {}
  const page1 = await pdf.getPage(1);
  const vp = page1.getViewport({ scale: 1 });
  const cover = (await renderPageToCanvas(pdf, 1, 640)).toDataURL('image/jpeg', 0.82);
  const out = { title, author, pages: pdf.numPages, aspect: vp.width / vp.height, cover };
  pdf.destroy();
  return out;
}

// Small shared UI helpers: icons, toast + note/highlight editor modal.
import { createIcons, icons } from 'lucide';

const $ = (id) => document.getElementById(id);

/** Replace every pending <i data-lucide="name"> with its SVG. */
export const refreshIcons = () => createIcons({ icons, attrs: { 'stroke-width': 2.2 } });
export const icon = (name) => `<i data-lucide="${name}"></i>`;

let toastTimer;
export function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
}

export const modalOpen = () => !$('modal').hidden;

/**
 * Opens the editor. Resolves with {action:'save', text, color} | {action:'delete'} | null.
 */
export function editNote({ title, quote = '', text = '', color = null, canDelete = false }) {
  const modal = $('modal'), ta = $('mText'), colors = $('mColors');
  $('mTitle').textContent = title;
  $('mQuote').textContent = quote;
  $('mQuote').hidden = !quote;
  $('mDelete').hidden = !canDelete;
  colors.hidden = !color;
  let chosen = color;
  const paint = () => colors.querySelectorAll('.sw').forEach((b) => b.classList.toggle('sel', b.dataset.color === chosen));
  paint();
  ta.value = text;
  modal.hidden = false;
  setTimeout(() => ta.focus(), 0);

  return new Promise((resolve) => {
    const done = (v) => {
      modal.hidden = true;
      colors.onclick = $('mSave').onclick = $('mCancel').onclick = $('mDelete').onclick = modal.onclick = ta.onkeydown = null;
      resolve(v);
    };
    colors.onclick = (e) => { if (e.target.dataset.color) { chosen = e.target.dataset.color; paint(); } };
    $('mSave').onclick = () => done({ action: 'save', text: ta.value.trim(), color: chosen });
    $('mCancel').onclick = () => done(null);
    $('mDelete').onclick = () => done({ action: 'delete' });
    modal.onclick = (e) => { if (e.target === modal) done(null); };
    ta.onkeydown = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); done(null); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('mSave').click();
    };
  });
}

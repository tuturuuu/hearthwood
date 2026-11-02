// Installable app + offline copy. The service worker (sw.js) does the saving; this file registers it,
// shows the Install button when the browser offers one, and reports how the offline copy is doing.
import { toast, refreshIcons, icon } from './ui.js';

const $ = (id) => document.getElementById(id);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function setStatus(ok, text) {
  const el = $('wpOffline');
  if (!el) return;
  el.classList.toggle('ok', ok);
  el.innerHTML = `${icon(ok ? 'circle-check' : 'cloud-download')} <span>${text}</span>`;
  refreshIcons();
}

export function initPWA() {
  const hint = $('wpInstallHint'), btn = $('wpInstall');
  if (standalone()) {
    hint.hidden = false; hint.textContent = 'Running as an installed app.';
  } else if (isIOS) {
    hint.hidden = false; hint.textContent = 'To install on iPhone or iPad: tap Share, then “Add to Home Screen”.';
  }

  let prompt = null;
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    prompt = e;
    btn.hidden = false;
  });
  btn.onclick = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    prompt = null; btn.hidden = true;
    if (outcome === 'accepted') toast('Hearthwood installed');
  };
  addEventListener('appinstalled', () => { btn.hidden = true; });

  // During local development the dev server should always serve fresh files: skip the worker there,
  // unless asked for with ?sw (to test offline mode locally).
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (!('serviceWorker' in navigator) || (local && !new URLSearchParams(location.search).has('sw'))) {
    setStatus(false, local ? 'Offline copy is off on localhost (add ?sw to test)' : 'This browser can’t save an offline copy');
    return;
  }

  let announced = false;
  navigator.serviceWorker.addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.type === 'sw-progress') setStatus(false, `Saving for offline… ${Math.round((m.done / m.total) * 100)}%`);
    if (m.type === 'sw-ready') {
      setStatus(true, 'Works offline');
      // say so once, the first time the copy finishes
      let seen = null;
      try { seen = localStorage.getItem('offlineReady'); localStorage.setItem('offlineReady', m.version); } catch {}
      if (!announced && !seen) toast('Hearthwood is ready to use offline');
      announced = true;
    }
    if (m.type === 'sw-missing') setStatus(false, 'Saving for offline…');
  });

  setStatus(false, 'Saving for offline…');
  navigator.serviceWorker.register('sw.js').then(async (reg) => {
    await navigator.serviceWorker.ready;
    (navigator.serviceWorker.controller || reg.active)?.postMessage('status');
  }).catch((e) => { console.warn('Service worker failed', e); setStatus(false, 'Couldn’t save an offline copy'); });

  // ask the browser not to clear the saved site or the library when space runs low
  navigator.storage?.persist?.().catch(() => {});
}

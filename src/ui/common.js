// ORPHEUS UI — shared plumbing for overlay / dialogue / codex / navmap.
//  · tiny DOM builder, stylesheet auto-injection (so the UI works even if index.html forgets the <link>)
//  · modal stack: ONE capture-phase key listener routes keys to the top-most modal and swallows them so the
//    flight / walk handlers never see them; hands pointer-lock back on the last close
//  · number formatters (M = 1 light-second = 299,792.458 km)

export const KM_PER_M = 299792.458;

// ───────────────────────────── DOM ─────────────────────────────
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'data') Object.assign(el.dataset, v);
      else if (k.length > 2 && k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const CSS_URL = new URL('./ui.css', import.meta.url).href;
export function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('link[data-ux-css], link[href*="ui/ui.css"]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = CSS_URL;
  l.setAttribute('data-ux-css', '');
  document.head.appendChild(l);
}

// A UI panel keeps its input to itself: `wheel` must not reach the game's window listener (FOV zoom) — native scrolling
// inside the panel keeps working, only propagation stops — and buttons drop keyboard focus after a click so
// Enter / Space stay with the modal's own key handler.
export function isolateInput(el) {
  el.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
  el.addEventListener('click', (e) => { const b = e.target && e.target.closest && e.target.closest('button'); if (b) b.blur(); });
}

export function safe(fn, fallback = null) {
  try { const v = fn(); return v === undefined ? fallback : v; } catch (err) { return fallback; }
}

// ───────────────────────────── modal stack ─────────────────────────────
const stack = [];
let relock = null, lastRelock = -1e9;

function onKeyDown(e) {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;             // browser shortcuts stay alive
  if (/^F([2-9]|1\d)$/.test(e.code)) return;                  // F5 reload, F11 fullscreen, F12 devtools …
  e.stopImmediatePropagation();                               // game handlers (window, bubble) never see it
  e.preventDefault();
  try { top.onKey && top.onKey(e); } catch (err) { console.error('[ui] key handler failed', err); }
}

// a relock that was requested a moment ago may still be in flight when the next modal opens (back-to-back menus)
function onLockChange() { if (stack.length && document.pointerLockElement) { try { document.exitPointerLock(); } catch (err) { /* ignore */ } } }

/** Register a modal: { onKey(e) } — pointer lock is released on first open and re-requested after the last close. */
export function openModal(modal, ctx) {
  if (stack.includes(modal)) return;
  if (!stack.length) {
    const locked = !!document.pointerLockElement || performance.now() - lastRelock < 600;
    relock = locked ? () => { const i = ctx && ctx.input; if (i && typeof i.requestLock === 'function') return i.requestLock(); } : null;
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (err) { /* ignore */ } }
    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerlockchange', onLockChange);
  }
  stack.push(modal);
}

export function closeModal(modal) {
  const i = stack.indexOf(modal);
  if (i < 0) return;
  stack.splice(i, 1);
  if (!stack.length) {
    window.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('pointerlockchange', onLockChange);
    const r = relock; relock = null;
    if (r) { lastRelock = performance.now(); try { const p = r(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* needs a user gesture; the player can click */ } }
  }
}

/** True while any UI modal (nav computer, codex, dialogue) owns the keyboard. */
export function isModalOpen() { return stack.length > 0; }

// ───────────────────────────── formatters ─────────────────────────────
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };
export function fmtSci(v, d = 2) {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  let e = Math.floor(Math.log10(Math.abs(v)));
  let m = v / Math.pow(10, e);
  if (Math.abs(m).toFixed(d) === '10.' + '0'.repeat(d)) { m /= 10; e += 1; }
  return `${m.toFixed(d)}×10${String(e).replace(/[-0-9]/g, (c) => SUP[c])}`;
}

/** gravitational radii (1 M = 1 light-second) */
export function fmtM(m) {
  if (!Number.isFinite(m)) return '—';
  const a = Math.abs(m);
  const s = a >= 1000 ? Math.round(m).toLocaleString('en-US') : a >= 100 ? m.toFixed(1) : a >= 10 ? m.toFixed(2) : m.toFixed(3);
  return s + ' M';
}
export function fmtKm(m) {
  const km = m * KM_PER_M;
  if (!Number.isFinite(km)) return '—';
  if (Math.abs(km) >= 1e6) return fmtSci(km, 2) + ' km';
  return Math.round(km).toLocaleString('en-US') + ' km';
}
/** [primary, secondary] for a distance in M: "M" + "km" normally; km (or m) + scientific M when closer than 0.01 M (~3,000 km) */
export function fmtDist(m) {
  if (!Number.isFinite(m)) return ['—', ''];
  if (Math.abs(m) >= 0.01) return [fmtM(m), fmtKm(m)];
  const km = Math.abs(m) * KM_PER_M;
  const near = km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(2) : km < 100 ? km.toFixed(1) : Math.round(km)} km`;
  return [near, m === 0 ? '0 M' : fmtSci(m, 1) + ' M'];
}
/** light-lag in seconds → "46.0 s" / "13 m 20 s" / "2 h 05 m" */
export function fmtLag(s) {
  if (!Number.isFinite(s)) return '—';
  s = Math.abs(s);
  if (s < 1) return s.toFixed(2) + ' s';
  if (s < 60) return s.toFixed(1) + ' s';
  const t = Math.round(s), m = Math.floor(t / 60), r = t % 60;
  if (m < 60) return `${m} m ${String(r).padStart(2, '0')} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} m`;
}
export function fmtDil(v) { return Number.isFinite(v) ? v.toFixed(4) : '—'; }
export function fmtClock(s) {
  if (!Number.isFinite(s)) return '—';
  const sg = s < 0 ? '−' : '';
  s = Math.abs(s);
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  return `${sg}${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

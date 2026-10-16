// ORPHEUS UI — modal choice menu (conversations, terminals, airlock panels …).
//   const dlg = createDialogue(ctx?);                       // ctx is optional (UI ticks via ctx.audio.ui)
//   const i = await dlg.choose('LYRA', [{ label, sub?, disabled?, done? }, …]);   // index | null (Esc)
//   dlg.isOpen()
// Keys: 1–9 (0 = tenth) pick · ↑/↓ (W/S) move · Enter/Space pick · Esc cancel · mouse hover + click.
// Pointer lock is released while open (see common.js) and given back afterwards.
import { ensureStyles, h, openModal, closeModal, isolateInput } from './common.js';

export function createDialogue(ctx) {
  ensureStyles();
  const stale = document.getElementById('ux-dlg'); if (stale) stale.remove();

  const titleEl = h('span', { class: 'ux-dlg-title' });
  const list = h('div', { class: 'ux-dlg-list', role: 'listbox' });
  const cancel = h('button', { class: 'ux-btn ux-btn-sm', type: 'button', text: 'CANCEL  [ESC]', onclick: () => finish(null) });
  const kbd = (t) => h('kbd', { text: t });
  const box = h('div', { class: 'ux-dlg-box ux-panel' },
    h('div', { class: 'ux-ph' }, titleEl, h('b', { text: 'RESPOND' })),
    list,
    h('div', { class: 'ux-dlg-foot' },
      h('span', { class: 'keys' }, kbd('1'), '–', kbd('9'), ' select', h('i'), kbd('↑'), kbd('↓'), kbd('ENTER')),
      cancel));
  const root = h('div', { id: 'ux-dlg', class: 'ux-dlg' }, h('div', { class: 'ux-dlg-back' }), box);
  document.body.appendChild(root);
  isolateInput(root);

  let cur = null;          // { resolve, opts: [{label, sub, disabled, done}], rows: [HTMLElement], sel }
  let hideTimer = 0;
  const modal = { onKey };

  const sfx = (kind) => { try { ctx && ctx.audio && ctx.audio.ui && ctx.audio.ui(kind); } catch (err) { /* audio not ready */ } };
  const keyLabel = (i) => (i < 9 ? String(i + 1) : i === 9 ? '0' : '·');
  const usable = (o) => !!o && !o.disabled;

  function choose(title, options) {
    if (cur) finish(null, true);                                   // a newer menu supersedes an open one (modal stays open)
    const opts = (Array.isArray(options) ? options : []).map((o) =>
      o == null ? { label: '—', disabled: true }
        : typeof o === 'string' ? { label: o }
          : { label: String(o.label ?? ''), sub: o.sub ? String(o.sub) : '', disabled: !!o.disabled, done: !!o.done });
    if (!opts.length) return Promise.resolve(null);

    titleEl.textContent = title == null ? '' : String(title);
    list.replaceChildren();
    const rows = opts.map((o, i) => {
      const row = h('div', {
        class: 'ux-opt' + (o.disabled ? ' dis' : '') + (o.done ? ' done' : ''), role: 'option', 'aria-disabled': o.disabled ? 'true' : null,
        onmouseenter: () => { if (cur && usable(opts[i])) setSel(i, false); },
        onclick: () => pick(i),
      },
      h('span', { class: 'k', text: keyLabel(i) }),
      h('span', { class: 't' }, h('span', { class: 'l', text: o.label }), o.sub ? h('span', { class: 's', text: o.sub }) : null),
      o.done ? h('span', { class: 'm', text: '✓', title: 'already discussed' }) : null);
      list.appendChild(row);
      return row;
    });

    return new Promise((resolve) => {
      cur = { resolve, opts, rows, sel: -1 };
      // start on the first thing not yet done, else the first usable row
      let first = opts.findIndex((o) => usable(o) && !o.done);
      if (first < 0) first = opts.findIndex(usable);
      show();
      if (first >= 0) setSel(first, true);
      list.scrollTop = 0;
    });
  }

  function show() {
    clearTimeout(hideTimer);
    root.style.display = 'flex';
    void root.offsetWidth;
    root.classList.add('open');
    openModal(modal, ctx);
  }

  function finish(value, superseded) {
    const c = cur; if (!c) return;
    cur = null;
    if (!superseded) {
      root.classList.remove('open');
      hideTimer = setTimeout(() => { if (!cur) root.style.display = 'none'; }, 170);
      closeModal(modal);
    }
    c.resolve(value);
  }

  function setSel(i, scroll) {
    if (!cur || i === cur.sel) return;
    if (cur.sel >= 0) cur.rows[cur.sel].classList.remove('sel');
    cur.sel = i;
    const row = cur.rows[i];
    row.classList.add('sel');
    if (scroll) row.scrollIntoView({ block: 'nearest' });
  }

  function step(dir) {
    if (!cur) return;
    const n = cur.opts.length;
    let i = cur.sel;
    for (let k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      if (usable(cur.opts[i])) { setSel(i, true); sfx('click'); return; }
    }
  }

  function pick(i) {
    if (!cur) return;
    const o = cur.opts[i];
    if (!o) return;
    if (!usable(o)) {                                              // disabled row: refuse with a shake
      const row = cur.rows[i];
      row.classList.remove('nope'); void row.offsetWidth; row.classList.add('nope');
      sfx('deny');
      return;
    }
    sfx('confirm');
    finish(i);
  }

  function onKey(e) {
    if (!cur) return;
    const c = e.code;
    if (c === 'Escape') { if (!e.repeat) finish(null); return; }
    if (c === 'ArrowDown' || c === 'KeyS') { step(1); return; }
    if (c === 'ArrowUp' || c === 'KeyW') { step(-1); return; }
    if (e.repeat) return;
    const m = /^(?:Digit|Numpad)(\d)$/.exec(c);
    if (m) { const d = +m[1]; pick(d === 0 ? 9 : d - 1); return; }
    if (c === 'Enter' || c === 'NumpadEnter' || c === 'Space') { if (cur.sel >= 0) pick(cur.sel); return; }
    if (c === 'Home') { const i = cur.opts.findIndex(usable); if (i >= 0) setSel(i, true); return; }
    if (c === 'End') { for (let i = cur.opts.length - 1; i >= 0; i--) if (usable(cur.opts[i])) { setSel(i, true); break; } }
  }

  return { choose, isOpen: () => !!cur };
}

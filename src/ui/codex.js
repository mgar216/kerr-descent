// ORPHEUS UI — the CODEX (ship archive): persistent discoveries + a reader.
//   const codex = createCodex(ctx, { keys?: ['Backquote'], data? });
//   codex.unlock(id)        → true if newly unlocked (toast 'CODEX UPDATED · <title>' shown once, ever)
//   codex.isUnlocked(id)
//   codex.open(tab?)        tab = category ('Logs' …) or an entry id; codex.close(); codex.toggle(); codex.isOpen()
//   codex.unseen(cat?)      number of unlocked-but-unread entries (optionally per category)
//   codex.ready             Promise — resolves once CODEX data has loaded (or failed to)
// Entries come from src/story/codex.js (`CODEX = { id: { title, category, body, voice? } }`), imported lazily and
// tolerated if missing. Unlocked ids persist in localStorage 'orpheus.codex.v1'.
// opts.keys — KeyboardEvent.code values that close the codex while it is open (the key that opens it; default
//             ['Backquote'], the key core.js binds), Esc always closes;
// opts.data — supply the CODEX object directly (skips the dynamic import; `null` = no data).
import { ensureStyles, h, openModal, closeModal, isolateInput } from './common.js';

/** Entries known from the start (the home crew and the two vessels you can see). Everything in categories Erebus + Physics is
 *  also unlocked at runtime straight from the CODEX keys (see ruleDefaults below), whatever the author named them. */
export const DEFAULT_UNLOCKED = [
  'vessel.orpheus', 'vessel.halcyon',
  'person.lyra', 'person.commander', 'person.jonah', 'person.bell', 'person.varga', 'person.mira', 'person.elena',
];

const STORE_KEY = 'orpheus.codex.v1';
const CATEGORIES = ['Erebus', 'Worlds', 'Vessels', 'People', 'Physics', 'Logs'];
const PEOPLE_ID = /(^|[.\-_])(lyra|jonah|reyes|bell|varga|mira|elena)([.\-_]|$)/i;
const PEOPLE_TITLE = /\b(lyra|jonah|reyes|bell|varga|mira|elena)\b/i;
const HOME_VESSEL = /(^|[.\-_])(orpheus|halcyon)([.\-_]|$)/i;

const canonCat = (c) => {
  const s = String(c == null ? '' : c).trim();
  if (!s) return 'Logs';
  return CATEGORIES.find((k) => k.toLowerCase() === s.toLowerCase()) || (s[0].toUpperCase() + s.slice(1));
};
const prettyId = (id) => String(id).split('.').pop().replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
// body text: paragraphs split on blank lines; *emphasis* → <em>
const paragraph = (txt) => {
  const p = h('p');
  p.innerHTML = String(txt).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  return p;
};

export function createCodex(ctx, opts = {}) {
  ensureStyles();
  const stale = document.getElementById('ux-codex'); if (stale) stale.remove();
  const closeKeys = new Set(opts.keys || ['Backquote']);

  // ───────────── state ─────────────
  let entries = [], byId = new Map(), cats = [], loaded = false;
  const explicit = new Set(), seen = new Set();
  const staticDefaults = new Set(DEFAULT_UNLOCKED);
  let ruleDefaults = new Set();
  const pendingToasts = [];
  let curCat = null, curId = null, opened = false, playing = null, playTimer = 0, playToken = 0, hideTimer = 0, wantTab = null;
  const lastByCat = new Map();

  try {
    const j = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (j) {
      for (const id of (Array.isArray(j) ? j : j.ids) || []) explicit.add(String(id));
      for (const id of (!Array.isArray(j) && j.seen) || []) seen.add(String(id));
    }
  } catch (err) { /* storage unavailable or corrupt → start empty */ }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, ids: [...explicit], seen: [...seen] })); } catch (err) { /* ignore */ } };

  const isUnlocked = (id) => explicit.has(id) || staticDefaults.has(id) || ruleDefaults.has(id);
  const isNew = (id) => explicit.has(id) && !seen.has(id);
  const inCat = (c) => entries.filter((e) => e.category === c);

  // ───────────── data ─────────────
  function ingest(data) {
    entries = [];
    if (data && typeof data === 'object') {
      const it = Array.isArray(data) ? data.map((e) => [e && e.id, e]) : Object.entries(data);
      for (const [id, e] of it) {
        if (!id || !e || typeof e !== 'object') continue;
        entries.push({ id: String(id), title: String(e.title ?? e.name ?? prettyId(id)), category: canonCat(e.category ?? e.cat), body: String(e.body ?? e.text ?? ''), voice: e.voice || null, hint: e.hint ? String(e.hint) : '' });
      }
    }
    byId = new Map(entries.map((e) => [e.id, e]));
    const present = new Set(entries.map((e) => e.category));
    cats = [...CATEGORIES.filter((c) => present.has(c)), ...[...present].filter((c) => !CATEGORIES.includes(c))];
    ruleDefaults = new Set(entries.filter((e) =>
      e.category === 'Erebus' || e.category === 'Physics'
      || (e.category === 'People' && (PEOPLE_ID.test(e.id) || PEOPLE_TITLE.test(e.title)))
      || ((e.category === 'Vessels' || e.category === 'Worlds') && HOME_VESSEL.test(e.id))).map((e) => e.id));
    loaded = true;
    for (const id of pendingToasts.splice(0)) { const e = byId.get(id); if (e) toast(e); }
    if (opened) {
      if (wantTab != null) { const t = wantTab; wantTab = null; applyTab(t); }
      if (!curCat && cats.length) selectCat(cats[0]); else refresh();
    }
  }

  // ───────────── toast ─────────────
  let toastHost = null;
  function toast(e) {
    if (!toastHost) { toastHost = h('div', { id: 'ux-toasts', class: 'ux-toasts' }); document.body.appendChild(toastHost); }
    const el = h('div', { class: 'ux-ctoast' },
      h('span', { class: 'ic' }),
      h('span', { class: 'k', text: 'CODEX UPDATED' }),
      h('span', { class: 'd', text: '·' }),
      h('span', { class: 't', text: e.title }));
    toastHost.appendChild(el);
    while (toastHost.children.length > 3) toastHost.firstChild.remove();
    try { ctx && ctx.audio && ctx.audio.ui && ctx.audio.ui('select'); } catch (err) { /* audio not ready */ }
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 600); }, 4300);
  }

  function unlock(id) {
    id = id == null ? '' : String(id);
    if (!id || isUnlocked(id)) return false;
    if (loaded && !byId.has(id)) return false;        // not an archive entry
    explicit.add(id); save();
    if (loaded) toast(byId.get(id)); else pendingToasts.push(id);
    if (opened) { renderTabs(); renderList(); if (curId === id) renderReader(); }
    return true;
  }

  function unseen(cat) {
    let n = 0;
    for (const id of explicit) if (!seen.has(id) && byId.has(id) && (!cat || byId.get(id).category === canonCat(cat))) n++;
    return n;
  }

  // ───────────── DOM ─────────────
  const tabsEl = h('div', { class: 'ux-tabs' });
  const tabbarEl = h('div', { class: 'ux-tabbar' }, tabsEl);
  const countEl = h('span', { class: 'n', text: '0 / 0' });
  const listEl = h('div', { class: 'ux-cx-list' });
  const readEl = h('div', { class: 'ux-cx-read' });
  const kbd = (t) => h('kbd', { text: t });
  const root = h('div', { id: 'ux-codex', class: 'ux-modal ux-codex' },
    h('div', { class: 'ux-back' }),
    h('div', { class: 'ux-frame ux-panel' },
      h('div', { class: 'ux-head' },
        h('div', { class: 'ux-ttl' }, h('div', { class: 'k', text: 'ORPHEUS · SHIP ARCHIVE' }), h('div', { class: 'm', text: 'CODEX' })),
        h('div', { class: 'ux-stat' }, countEl, h('span', { text: 'DISCOVERED' })),
        h('button', { class: 'ux-btn ux-btn-sm', type: 'button', text: 'CLOSE  [ESC]', onclick: () => close() })),
      tabbarEl,
      h('div', { class: 'ux-cx-body' }, listEl, readEl),
      h('div', { class: 'ux-foot' },
        h('span', {}, kbd('↑'), kbd('↓'), ' entry'), h('span', {}, kbd('←'), kbd('→'), ' category'),
        h('span', {}, kbd('ENTER'), ' play voice'), h('span', {}, kbd('PGUP'), kbd('PGDN'), ' scroll'), h('span', {}, kbd('ESC'), kbd('`'), ' close'))));
  document.body.appendChild(root);
  isolateInput(root);
  const modal = { onKey };

  // ───────────── rendering ─────────────
  function renderTabs() {
    tabbarEl.style.display = cats.length ? '' : 'none';
    tabsEl.replaceChildren(...cats.map((c, i) => {
      const list = inCat(c), got = list.filter((e) => isUnlocked(e.id)).length, nw = list.filter((e) => isNew(e.id)).length;
      return h('button', { class: 'ux-tab' + (c === curCat ? ' on' : ''), type: 'button', title: `Key ${i + 1}`, onclick: () => selectCat(c) },
        h('span', { text: c.toUpperCase() }), h('em', { text: `${got}/${list.length}` }), nw ? h('i', { class: 'new', text: String(nw) }) : null);
    }));
    const total = entries.length, got = entries.filter((e) => isUnlocked(e.id)).length;
    countEl.textContent = `${got} / ${total}`;
  }

  function renderList() {
    const items = inCat(curCat);
    listEl.replaceChildren(...items.map((e, i) => {
      const un = isUnlocked(e.id);
      return h('div', { class: 'ux-ent' + (un ? '' : ' lock') + (e.id === curId ? ' sel' : ''), data: { id: e.id }, title: un ? e.title : null, onclick: () => selectEntry(e.id) },
        h('span', { class: 'n', text: String(i + 1).padStart(2, '0') }),
        h('span', { class: 'ti', text: un ? e.title : '— UNDISCOVERED —' }),
        un && e.voice ? h('span', { class: 'vc', title: 'voice recording' }) : null,
        isNew(e.id) ? h('span', { class: 'nw', text: 'NEW' }) : null);
    }));
    const sel = listEl.querySelector('.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  function renderReader() {
    const e = byId.get(curId);
    readEl.scrollTop = 0;
    if (!loaded) { readEl.replaceChildren(h('div', { class: 'ux-rd-empty' }, h('div', { class: 't', text: 'OPENING ARCHIVE...' }))); return; }
    if (!e) {
      readEl.replaceChildren(h('div', { class: 'ux-rd-empty' },
        h('div', { class: 't', text: entries.length ? 'SELECT AN ENTRY' : 'ARCHIVE UNAVAILABLE' }),
        h('div', { class: 's', text: entries.length ? '' : 'The ship archive could not be read. Discoveries are still being recorded.' })));
      return;
    }
    const list = inCat(e.category), idx = list.indexOf(e) + 1;
    if (!isUnlocked(e.id)) {
      readEl.replaceChildren(
        h('div', { class: 'ux-rd-meta' }, h('span', { class: 'cat', text: e.category.toUpperCase() }), h('span', { class: 'idx', text: `ENTRY ${String(idx).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}` })),
        h('div', { class: 'ux-rd-lock' }, h('div', { class: 'glyph' }), h('div', { class: 't', text: '— UNDISCOVERED —' }),
          h('div', { class: 's', text: e.hint || 'Nothing on record. Explore, scan, listen — the archive fills as you go.' })));
      return;
    }
    const isPlaying = playing === e.id;
    const play = e.voice && ctx && typeof ctx.say === 'function'
      ? h('button', { class: 'ux-btn ux-play' + (isPlaying ? ' on' : ''), type: 'button', onclick: () => playVoice(e) },
        h('span', { class: 'eq' }, h('i'), h('i'), h('i'), h('i')), h('span', { text: isPlaying ? 'PLAYING...' : '▶  PLAY' }))
      : null;
    readEl.replaceChildren(
      h('div', { class: 'ux-rd-meta' }, h('span', { class: 'cat', text: e.category.toUpperCase() }), h('span', { class: 'idx', text: `ENTRY ${String(idx).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}` }),
        isNew(e.id) ? h('span', { class: 'ux-chip new', text: 'NEW' }) : null),
      h('div', { class: 'ux-rd-head' }, h('h2', { class: 'ti', text: e.title }), play),
      h('div', { class: 'ux-rd-rule' }),
      h('div', { class: 'ux-rd-body' }, ...String(e.body).split(/\n{2,}/).map((t) => t.trim()).filter(Boolean).map(paragraph)));
  }

  function refresh() { renderTabs(); renderList(); renderReader(); }

  // ───────────── navigation ─────────────
  function pickDefault(cat) {
    const last = lastByCat.get(cat);
    if (last && byId.has(last)) return last;
    const list = inCat(cat);
    return (list.find((e) => isUnlocked(e.id)) || list[0] || {}).id || null;
  }
  function markSeen(id) { if (explicit.has(id) && !seen.has(id)) { seen.add(id); save(); } }

  // draws everything, then counts the shown entry as read (its NEW chip stays on screen until the next render)
  function showCurrent() {
    refresh();
    if (curId && isUnlocked(curId) && isNew(curId)) { markSeen(curId); renderTabs(); }
  }
  function selectCat(cat) {
    if (!cats.includes(cat)) return;
    if (curCat && curId) lastByCat.set(curCat, curId);
    curCat = cat;
    curId = pickDefault(cat);
    showCurrent();
  }
  function selectEntry(id) {
    const e = byId.get(id); if (!e) return;
    curCat = e.category; curId = id; lastByCat.set(curCat, id);
    showCurrent();
  }
  function applyTab(tab) {                                   // category name or entry id
    const t = String(tab);
    if (byId.has(t)) selectEntry(t);
    else { const c = cats.find((k) => k.toLowerCase() === t.toLowerCase()); if (c) selectCat(c); }
  }
  function moveEntry(d) {
    const list = inCat(curCat); if (!list.length) return;
    const i = Math.max(0, list.findIndex((e) => e.id === curId));
    selectEntry(list[Math.min(list.length - 1, Math.max(0, i + d))].id);
  }
  function moveCat(d) {
    if (!cats.length) return;
    const i = Math.max(0, cats.indexOf(curCat));
    selectCat(cats[(i + d + cats.length) % cats.length]);
  }

  // ───────────── voice ─────────────
  function stopPlaying() { clearTimeout(playTimer); if (playing) { playing = null; if (opened) renderReader(); } }
  function playVoice(e) {
    if (!e.voice || !ctx || typeof ctx.say !== 'function') return;
    if (playing === e.id) {                                 // second press = stop (if the voice module can) or restart
      if (ctx.voice && typeof ctx.voice.stop === 'function') { try { ctx.voice.stop(); } catch (err) { /* ignore */ } stopPlaying(); return; }
    }
    clearTimeout(playTimer);
    const token = ++playToken;
    playing = e.id; renderReader();
    const done = () => { if (token === playToken && playing === e.id) stopPlaying(); };
    let r;
    try { r = ctx.say(e.voice, { priority: 'high', onEnd: done }); } catch (err) { done(); return; }
    if (r && typeof r.then === 'function') r.then(done, done);   // voice.say() resolves when the line has finished
    playTimer = setTimeout(done, 60000);                         // safety net if no end event ever arrives (Web Speech fallback)
  }
  if (ctx && ctx.bus && typeof ctx.bus.on === 'function') {
    ctx.bus.on('voice-end', (p) => { const e = playing && byId.get(playing); if (e && p && p.id === e.voice) stopPlaying(); });
  }

  // ───────────── open / close ─────────────
  function open(tab) {
    if (!opened) {
      opened = true;
      clearTimeout(hideTimer);
      root.style.display = 'flex'; void root.offsetWidth; root.classList.add('open');
      openModal(modal, ctx);
    }
    if (tab != null) { if (loaded) applyTab(tab); else wantTab = tab; }
    if (loaded && !curCat && cats.length) selectCat(cats[0]);
    else showCurrent();
  }
  function close() {
    if (!opened) return;
    opened = false;
    root.classList.remove('open');
    hideTimer = setTimeout(() => { if (!opened) root.style.display = 'none'; }, 170);
    closeModal(modal);
    clearTimeout(playTimer);
  }
  const toggle = () => (opened ? close() : open());

  function onKey(e) {
    const c = e.code;
    if (c === 'Escape' || (closeKeys.has(c) && !e.repeat)) { if (!e.repeat) close(); return; }
    if (c === 'ArrowDown') { moveEntry(1); return; }
    if (c === 'ArrowUp') { moveEntry(-1); return; }
    if (c === 'ArrowRight' || c === 'KeyE') { if (!e.repeat) moveCat(1); return; }
    if (c === 'ArrowLeft' || c === 'KeyQ') { if (!e.repeat) moveCat(-1); return; }
    if (c === 'PageDown') { readEl.scrollBy({ top: readEl.clientHeight * 0.8, behavior: 'smooth' }); return; }
    if (c === 'PageUp') { readEl.scrollBy({ top: -readEl.clientHeight * 0.8, behavior: 'smooth' }); return; }
    if (e.repeat) return;
    if (c === 'Home') { const l = inCat(curCat); if (l.length) selectEntry(l[0].id); return; }
    if (c === 'End') { const l = inCat(curCat); if (l.length) selectEntry(l[l.length - 1].id); return; }
    if (c === 'Enter' || c === 'NumpadEnter' || c === 'Space' || c === 'KeyP') {
      const en = byId.get(curId); if (en && en.voice && isUnlocked(en.id)) playVoice(en); return;
    }
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(c);
    if (m && cats[+m[1] - 1]) selectCat(cats[+m[1] - 1]);
  }

  const ready = (async () => {
    let data = opts.data;
    if (data === undefined) {
      try { const mod = await import('../story/codex.js'); data = mod.CODEX || mod.default || null; }
      catch (err) { data = null; }                    // module missing (yet) → empty archive, the UI stays usable
    }
    ingest(data);
  })();

  return { unlock, isUnlocked, open, close, toggle, isOpen: () => opened, unseen, ready };
}

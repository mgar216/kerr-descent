// ORPHEUS UI — in-world overlay: interaction prompt, subtitles, crosshair, room-name toast, full-screen fade.
//   const ov = createOverlay();
//   ov.prompt('<kbd>E</kbd> Sit down')   // html | null
//   ov.subtitle('LYRA', 'Text…', 4200)   // speaker tag in the comms 'who' style; ms optional (estimated from length)
//   ov.toastRoom('GALLEY')               // top-centre room name
//   ov.crosshair(true)                   // small centre dot (grows a ring while a prompt is showing)
//   await ov.fade(true, 800)             // → black; fade(false) → clear. Resolves when finished (or superseded).
import { ensureStyles, h } from './common.js';

// Speaker tag. The label is shown as given (voice/cast.js already sends display labels such as 'HALCYON · BELL');
// raw cast codes (CAPCOM, FD, SURVEY_A …) get a friendly name. The colour class comes from the words in the label.
const FRIENDLY = { CAPCOM: 'CAPCOM', FD: 'DIRECTOR BELL', SCI: 'DR. VARGA', SURVEY_A: 'OKAFOR', SURVEY_B: 'LIND', SURVEY_C: 'WARD', PA: 'PA', CMDR: 'CMDR', MC: 'HALCYON', AI: 'LYRA', ME: 'CMDR' };
const CLASSES = [
  [/EURYDICE\s*SYS|HALCYON\s*PA|^SYSTEM|^SUIT|^PA$|^SYS$/, 'sys'], [/ELENA/, 'elena'], [/TOMAS/, 'tomas'],
  [/FIELD LOG|OKAFOR|LIND\b|WARD\b|SURVEY/, 'survey'], [/MIRA/, 'mira'], [/BELL|DIRECTOR|\bFD\b/, 'fd'], [/VARGA|\bSCI\b/, 'sci'],
  [/HALCYON|CAPCOM|JONAH|^MC$/, 'mc'], [/LYRA|^AI$/, 'lyra'], [/ORPHEUS|CMDR|COMMANDER|^ME$|^YOU$/, 'me'],
];
function speaker(who) {
  const key = String(who || '').trim().toUpperCase();
  if (!key) return { cls: 'none', label: '' };
  const label = FRIENDLY[key] || key.replace(/_/g, ' ');
  const hit = CLASSES.find(([re]) => re.test(key) || re.test(label));
  return { cls: hit ? hit[1] : 'x', label };
}
// audio-direction tags such as [calm] / [voice catching] are for the voice model only — never shown
const stripTags = (t) => String(t == null ? '' : t).replace(/\s*\[[a-z][a-z ,.'\-]*\]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

export function createOverlay() {
  ensureStyles();
  const stale = document.getElementById('ux-overlay'); if (stale) stale.remove();
  const staleFade = document.getElementById('ux-fade'); if (staleFade) staleFade.remove();

  const cross = h('div', { id: 'crosshair', class: 'ux-cross' });
  const roomK = h('div', { class: 'k' }), roomN = h('div', { class: 'n' });
  const room = h('div', { id: 'roomToast', class: 'ux-room' }, roomK, roomN, h('div', { class: 'ln' }));
  const promptEl = h('div', { id: 'prompt', class: 'ux-prompt' });
  const sub = h('div', { id: 'subtitle', class: 'ux-sub' });
  const root = h('div', { id: 'ux-overlay' }, cross, room, promptEl, sub);
  const fadeEl = h('div', { id: 'ux-fade', class: 'ux-fade' });
  document.body.append(root, fadeEl);

  // ── prompt ──
  let promptHtml = null;
  function prompt(html) {
    if (html == null || html === '' || html === false) {
      if (promptHtml !== null) { promptHtml = null; promptEl.classList.remove('on'); cross.classList.remove('hot'); }
      return;
    }
    if (html !== promptHtml) { promptHtml = html; promptEl.innerHTML = html; }
    promptEl.classList.add('on');
    cross.classList.add('hot');
  }

  // ── subtitle ──
  let subTimer = 0;
  function subtitle(who, text, ms) {
    clearTimeout(subTimer);
    const body = stripTags(text);
    if (!body) { sub.classList.remove('on'); return; }
    const sp = speaker(who);
    // ms: undefined → estimated from length · finite > 0 → that long · 0 / Infinity → stays until the next call
    const dur = ms == null ? Math.min(14000, Math.max(2600, 1800 + body.length * 55)) : Number.isFinite(ms) && ms > 0 ? ms : 0;
    sub.className = `ux-sub s-${sp.cls}${body.length > 230 ? ' long' : ''}${sub.classList.contains('on') ? ' on' : ''}`;
    sub.replaceChildren(h('div', { class: 'in' },
      sp.label ? h('span', { class: 'who', text: sp.label }) : null,
      h('span', { class: 'tx', text: body })));
    void sub.offsetWidth;
    sub.classList.add('on');
    if (dur > 0) subTimer = setTimeout(() => sub.classList.remove('on'), dur);
  }

  // ── room-name toast ──
  function toastRoom(name, kicker = 'ENTERING') {
    if (!name) return;
    roomK.textContent = '◇ ' + kicker;
    roomN.textContent = String(name);
    room.classList.remove('show');
    void room.offsetWidth;                                   // restart the CSS animation
    room.classList.add('show');
  }

  // ── crosshair ──
  function crosshair(on) { cross.classList.toggle('on', !!on); }

  // ── fade ──
  let fadeTimer = 0, fadeDone = null;
  function fade(toBlack, ms = 800) {
    if (fadeDone) { const r = fadeDone; fadeDone = null; clearTimeout(fadeTimer); r(); }   // superseded → release the awaiter
    ms = Math.max(0, Number(ms) || 0);
    fadeEl.style.transition = `opacity ${ms}ms ease-in-out`;
    void fadeEl.offsetWidth;                                  // commit the start value so a transition runs
    fadeEl.style.opacity = toBlack ? '1' : '0';
    return new Promise((resolve) => {
      fadeDone = resolve;
      fadeTimer = setTimeout(() => { fadeDone = null; resolve(); }, ms + 30);
    });
  }

  function destroy() { clearTimeout(subTimer); clearTimeout(fadeTimer); if (fadeDone) fadeDone(); root.remove(); fadeEl.remove(); }

  return { prompt, subtitle, toastRoom, crosshair, fade, destroy };
}

// ORPHEUS UI — NAVIGATION COMPUTER: full-screen log-radial system map + destination list.
//   const nav = createNavComputer(ctx, { keys?: ['KeyJ'] });
//   nav.open({ tab?: 'sys'|'anti', view?: 'top'|'side', select?: id }); nav.close(); nav.toggle(); nav.isOpen();
//
// Reads (all guarded — any of these may be null): ctx.ship {S, sheet, tau, universe, lock}, ctx.obs {r, region},
// ctx.K, ctx.kerr {rErgo, ksPoint}, ctx.worlds {destinations(), bodyState(id, t)}, ctx.navFeatures(),
// ctx.nav {setCourse, setTarget, clear, current}, ctx.hudPred(), ctx.codexUI {open, unseen}, ctx.audio.ui().
//
// Map projection: screen offset from Erebus = orthographic (x,y) [top] or (x,z) [side] scaled by
//   k(ρ)·base·zoom, ρ = |p| (3-D radius), k(ρ) = ln(1+ρ/ρ₀)/ln(1+ρmax/ρ₀)/ρ  → log-radial, direction preserved.
// 1 M = 1 light-second = 299,792.458 km.
import { ensureStyles, h, esc, safe, openModal, closeModal, isolateInput, clamp, fmtM, fmtKm, fmtDist, fmtLag, fmtDil, fmtClock } from './common.js';

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const LOG0 = 0.6;                         // log-scale softening, M
const SYS_RMAX = 1000, ANTI_RMAX = 360;   // outer radius of the map at zoom 1, M
const DISK_ROUT = 17;                     // accretion disk outer radius (matches the ray tracer), M
const GROUP_ORDER = ['STATIONS', 'WORLDS', 'ANTIVERSE', 'EREBUS'];
const MAJOR_RINGS = new Set([1, 3, 10, 30, 100, 300, 1000]);
const RINGS = [1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 300, 500, 1000];

// marker identity of the known bodies; unknown ids fall back to a neutral world
const LOOK = {
  halcyon: { kind: 'station', c: '#9fe8ff' },
  asphodel: { kind: 'world', c: '#7fe6d8', c2: '#bcc9cf', r: 5 },
  phlegethon: { kind: 'world', c: '#ff8a4d', c2: '#4a1a08', r: 4.6 },
  lethe: { kind: 'giant', c: '#b9b6ff', c2: '#5666d6', r: 7.5 },
  charon: { kind: 'moon', c: '#dbe6ee', c2: '#7d8a94', r: 3 },
  cocytus: { kind: 'world', c: '#c5e8ff', c2: '#5d8fd0', r: 4.8 },
  eurydice: { kind: 'derelict', c: '#ffb04d', r: 4 },
  elysium: { kind: 'crystal', c: '#a8f7ff', c2: '#a57cff', r: 5.5 },
};
const FEATURE_BLURB = {
  DSK: 'Disk rim — the outer edge of the accretion flow, 17 M out. Gas here orbits at a quarter of light speed.',
  PHS: 'Photon shell — light itself can orbit between 1.4 and 4.0 M. Every star appears more than once.',
  ISC: 'ISCO gate — innermost stable circular orbit. Below it nothing can orbit; it can only fall.',
  POL: 'Polar gate — the spin axis, the only road that threads the ring.',
  ERG: 'Ergosphere — space itself is dragged faster than light can move against it. Nothing can stand still.',
  EHZ: 'Event horizon — every future points inward. The uplink to Halcyon ends here.',
  IHZ: 'Inner (Cauchy) horizon — classical prediction stops. From here on we are the experiment.',
  RNG: 'Ring throat — the ring singularity at r = 0. The way through to the other sheet.',
  ANV: 'Antiverse — the r < 0 sheet beyond the ring. A universe where the hole has negative mass.',
};
const WORLD_BLURB = {
  halcyon: 'Research station · crew of ~180 · 33-minute orbit · mission control.',
  asphodel: 'Temperate ocean-archipelago · tidally locked to Erebus · 0.86 g · 0.8 atm.',
  phlegethon: 'Tidally heated iron world · lava rivers, ash haze · 1.2 g.',
  lethe: 'Ringed gas giant · pale blue-violet bands · not landable.',
  charon: 'Airless ice-rock moon of Lethe · 0.12 g · home of the Sentinel telescope.',
  cocytus: 'Frozen world · −190 °C · N₂ haze, cryo-geysers · 0.9 g.',
  eurydice: 'HX-01 · sister ship of ORPHEUS · lost eleven years ago · derelict.',
  elysium: 'Antiverse rogue world · phosphorescent crystal plains · thin cold air · 0.4 g.',
};

const num = (v) => (v == null || v === '' ? NaN : +v);
const vec3 = (p) => {
  if (!p) return null;
  const a = Array.isArray(p) || ArrayBuffer.isView(p) ? p : typeof p === 'object' && 'x' in p ? [p.x, p.y, p.z] : null;
  return a && Number.isFinite(a[0]) && Number.isFinite(a[1]) && Number.isFinite(a[2]) ? [+a[0], +a[1], +a[2]] : null;
};
const posOfState = (s) => (s ? vec3(s.pos) || vec3(s.position) || (s.X && s.X.length >= 4 ? vec3([s.X[1], s.X[2], s.X[3]]) : null) || vec3(s) : null);
const upper = (s) => String(s == null ? '' : s).toUpperCase();
const sentence = (s) => { const t = String(s == null ? '' : s).trim(); return t ? t[0].toUpperCase() + t.slice(1) : ''; };
const KIND_LABEL = { station: 'STATION', planet: 'WORLD', gasgiant: 'GAS GIANT', moon: 'MOON', ship: 'VESSEL', feature: 'WAYPOINT' };
const kindLabel = (k) => KIND_LABEL[k] || upper(k);

/** dτ/dt of a prograde circular equatorial Kerr orbit at BL radius r (valid outside the ISCO) */
function orbitDilation(r, a) {
  const x = 1 - 3 / r + (2 * a) / Math.pow(r, 1.5);
  return x > 0 ? Math.sqrt(x) / (1 + a / Math.pow(r, 1.5)) : NaN;
}

/** circle through p0 with the orbital plane inferred from a second sample (circular-orbit assumption) */
function orbitCircle(p0, p1, n = 128) {
  const r = Math.hypot(p0[0], p0[1], p0[2]);
  if (r < 1e-6 || Math.abs(Math.hypot(p1[0], p1[1], p1[2]) / r - 1) > 0.02) return null;
  let nx = p0[1] * p1[2] - p0[2] * p1[1], ny = p0[2] * p1[0] - p0[0] * p1[2], nz = p0[0] * p1[1] - p0[1] * p1[0];
  const nl = Math.hypot(nx, ny, nz);
  if (nl < 1e-12) return null;
  nx /= nl; ny /= nl; nz /= nl;
  const ux = p0[0] / r, uy = p0[1] / r, uz = p0[2] / r;
  const tx = ny * uz - nz * uy, ty = nz * ux - nx * uz, tz = nx * uy - ny * ux;
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, c = Math.cos(a), s = Math.sin(a); pts.push([r * (ux * c + tx * s), r * (uy * c + ty * s), r * (uz * c + tz * s)]); }
  return pts;
}

export function createNavComputer(ctx, opts = {}) {
  ensureStyles();
  const stale = document.getElementById('ux-nav'); if (stale) stale.remove();
  const closeKeys = new Set(opts.keys || ['KeyJ']);

  // ─────────────────────────── state ───────────────────────────
  const st = {
    open: false, tab: 'sys', sheet: 1, view: 'top', zoom: 1, panX: 0, panY: 0,
    rows: [], byId: new Map(), order: [], sel: null, site: new Map(), hover: null, hits: [], orbits: new Map(),
    cur: null, msgUntil: 0, dirty: true, lastData: 0, lastDraw: 0, raf: 0, drag: null, hideTimer: 0, ship: null,
    mx: -1, my: -1, W: 0, H: 0, stars: null, hoverStruct: null, structs: [],
  };
  const rowRefs = new Map();
  let listKey = '';

  const sfx = (kind) => { try { ctx && ctx.audio && ctx.audio.ui && ctx.audio.ui(kind); } catch (err) { /* audio not ready */ } };

  // ─────────────────────────── geometry & ship ───────────────────────────
  function geo() {
    const K = (ctx && ctx.K) || {};
    const a = Number.isFinite(K.a) ? K.a : 0.95, q = Math.sqrt(Math.max(0, 1 - a * a));
    const kerr = ctx && ctx.kerr;
    return {
      a, rp: K.rp || 1 + q, rm: Number.isFinite(K.rm) ? K.rm : 1 - q, isco: K.isco || 1.94,
      phPro: K.phPro || 2 * (1 + Math.cos((2 / 3) * Math.acos(-a))), phRet: K.phRet || 2 * (1 + Math.cos((2 / 3) * Math.acos(a))),
      rErgo: (th) => (kerr && typeof kerr.rErgo === 'function' ? kerr.rErgo(th) : 1 + Math.sqrt(Math.max(0, 1 - a * a * Math.cos(th) ** 2))),
      ks: (r, th, ph) => (kerr && typeof kerr.ksPoint === 'function' ? kerr.ksPoint(r, th, ph)
        : [(r * Math.cos(ph) - a * Math.sin(ph)) * Math.sin(th), (r * Math.sin(ph) + a * Math.cos(ph)) * Math.sin(th), r * Math.cos(th)]),
    };
  }

  function readShip() {
    const s = ctx && ctx.ship;
    if (!s || !s.S || s.S.length < 12) return null;
    const S = s.S;
    const u0 = S[4] || 1;
    return {
      pos: [S[1], S[2], S[3]], fwd: [S[9], S[10], S[11]], vel: [S[5] / u0, S[6] / u0, S[7] / u0],
      sheet: s.sheet < 0 ? -1 : 1, tau: s.tau, t: S[0], universe: s.universe | 0, lock: s.lock || null,
    };
  }

  function featurePos(id, G) {
    const sp = (r, th, ph) => G.ks(r, th * DEG, ph * DEG);
    switch (id) {
      case 'DSK': return sp(15, 80, 40);
      case 'PHS': return sp(3.0, 60, 120);
      case 'ISC': return sp(G.isco + 0.35, 78, 200);
      case 'POL': return sp(4.0, 12, 300);
      case 'ERG': return sp(G.rp + 0.02, 8, 330);
      case 'EHZ': return sp(G.rp - 0.15, 5, 330);
      case 'IHZ': return sp(Math.max(G.rm - 0.12, 0.05), 3, 330);
      case 'RNG': return [0, 0, -0.3];
      case 'ANV': return [0, 0, -15];
      default: return null;
    }
  }

  // ─────────────────────────── data ───────────────────────────
  const canNav = (r) => r.discovered && r.reachable;

  function rowFromDest(d) {
    const sheet = d.sheet != null ? (d.sheet < 0 ? -1 : 1) : (String(d.group).toUpperCase() === 'ANTIVERSE' ? -1 : 1);
    const group = upper(d.group || (d.kind === 'station' ? 'STATIONS' : sheet < 0 ? 'ANTIVERSE' : 'WORLDS'));
    const sites = (Array.isArray(d.sites) ? d.sites : []).filter(Boolean).map((s) => (typeof s === 'string' ? { id: s, name: s } : { id: s.id, name: s.name || s.id, desc: s.desc || '' }));
    const kind = d.kind || '';
    return {
      id: String(d.id), name: String(d.name || d.id), group, kind, feature: false, sheet,
      reachable: d.reachable !== false, why: sentence(d.why), dist: num(d.dist), lag: num(d.lag), dil: num(d.dilation != null ? d.dilation : d.dil),
      landable: !!d.landable, dockable: d.dockable != null ? !!d.dockable : (kind === 'station' || kind === 'ship' || kind === 'derelict'),
      sites, discovered: d.discovered !== false, desc: d.desc || d.blurb || WORLD_BLURB[d.id] || '', moonOf: d.parent || (d.id === 'charon' ? 'lethe' : null), pos: null,
    };
  }
  function rowFromFeature(f) {
    return {
      id: String(f.id), name: String(f.name || f.id), group: upper(f.group || 'EREBUS'), kind: 'feature', feature: true,
      sheet: f.sheet != null ? (f.sheet < 0 ? -1 : 1) : f.id === 'ANV' || f.kind === 'anti' ? -1 : 1,
      reachable: f.reachable !== false, why: sentence(f.why), done: !!f.done, dist: num(f.dist), lag: num(f.lag), dil: num(f.dilation != null ? f.dilation : f.dil),
      landable: false, dockable: false, sites: [], discovered: f.discovered !== false, desc: f.desc || FEATURE_BLURB[f.id] || '', moonOf: null, pos: vec3(f.pos),
    };
  }

  function currentNav() {
    let c = null;
    try { c = ctx && ctx.nav && typeof ctx.nav.current === 'function' ? ctx.nav.current() : null; } catch (err) { c = null; }
    if (!c) return null;
    if (typeof c === 'string') return { id: c, mode: 'course' };
    const t = c.id != null ? c.id : c.target && c.target.id != null ? c.target.id : c.target != null && typeof c.target !== 'object' ? c.target : c.dest;
    if (t == null) return null;
    // core's current() hands back the target object itself; whether it is a plain target or an autopilot course is ship.guide
    const m = String(c.mode || (ctx.ship && ctx.ship.guide ? 'course' : 'target')).toLowerCase();
    return { id: String(t), mode: m.includes('target') ? 'target' : 'course' };
  }

  function refreshData(force) {
    st.ship = readShip();
    const G = geo(), ship = st.ship, t = ship ? ship.t : 0;
    const rows = [], seenIds = new Set();
    const push = (r) => { if (!seenIds.has(r.id)) { seenIds.add(r.id); rows.push(r); } };
    const dests = safe(() => ctx.worlds && ctx.worlds.destinations && ctx.worlds.destinations(), []);
    for (const d of Array.isArray(dests) ? dests : []) if (d && d.id != null) push(rowFromDest(d));
    const feats = safe(() => ctx.navFeatures && ctx.navFeatures(), []);
    for (const f of Array.isArray(feats) ? feats : []) if (f && f.id != null) push(rowFromFeature(f));

    for (const r of rows) {
      if (!r.pos) {
        const bs = r.feature ? null : safe(() => ctx.worlds.bodyState(r.id, t));
        r.pos = r.feature ? featurePos(r.id, G) : posOfState(bs);
        if (bs && bs.sheet != null) r.sheet = bs.sheet < 0 ? -1 : 1;
      }
      if (!Number.isFinite(r.dist) && r.pos && ship && (r.sheet === ship.sheet || r.id === 'RNG')) r.dist = Math.hypot(r.pos[0] - ship.pos[0], r.pos[1] - ship.pos[1], r.pos[2] - ship.pos[2]);
      if (!Number.isFinite(r.lag) && Number.isFinite(r.dist)) r.lag = r.dist;                      // 1 M = 1 light-second
      if (!Number.isFinite(r.dil) && !r.feature && r.pos && r.sheet > 0) r.dil = orbitDilation(Math.hypot(r.pos[0], r.pos[1], r.pos[2]), G.a);
    }
    st.rows = rows;
    st.byId = new Map(rows.map((r) => [r.id, r]));
    st.cur = currentNav();

    // orbit circles from two samples of each circular body
    st.orbits.clear();
    for (const r of rows) {
      if (r.feature || r.moonOf || r.sheet < 0 || !r.pos || !r.discovered || r.kind === 'derelict') continue;
      const rad = Math.hypot(r.pos[0], r.pos[1], r.pos[2]);
      if (rad < 4) continue;
      const dt = 0.05 * (Math.pow(rad, 1.5) + G.a);
      const p1 = posOfState(safe(() => ctx.worlds.bodyState(r.id, t + dt)));
      const pts = p1 && orbitCircle(r.pos, p1);
      if (pts) st.orbits.set(r.id, pts);
    }

    // the ship crossed the ring → follow it to the other map
    const sheet = ship ? ship.sheet : 1;
    if (sheet !== st.sheet) { st.sheet = sheet; setTab(sheet < 0 ? 'anti' : 'sys', false); }   // follow the ship across the ring

    if (!st.sel || !st.byId.has(st.sel) || !visible(st.byId.get(st.sel))) {
      // never pre-select the body you are sitting next to (< 0.01 M ≈ 3,000 km): right after undocking, Enter would fly you back
      const away = (r) => !(r.dist < 0.01);
      const pick = (st.cur && st.byId.get(st.cur.id)) || rows.find((r) => visible(r) && canNav(r) && away(r)) || rows.find((r) => visible(r) && canNav(r)) || rows.find(visible);
      st.sel = pick ? pick.id : null;
    }
    renderList(force);
    renderHeader();
    if (st.msgUntil && performance.now() > st.msgUntil) { st.msgUntil = 0; msgEl.className = 'ux-nav-msg'; msgEl.textContent = ''; }
  }

  // an undiscovered antiverse entry stays secret until the ship is actually on that sheet
  function visible(r) { return !(!r.discovered && r.group === 'ANTIVERSE' && st.sheet > 0); }
  const onTab = (r) => (st.tab === 'anti' ? r.sheet < 0 || r.id === 'RNG' : r.sheet > 0 || r.id === 'RNG');

  // ─────────────────────────── DOM ───────────────────────────
  const kbd = (t) => h('kbd', { text: t });
  const tabSys = h('button', { class: 'ux-tab on', type: 'button', text: 'SYSTEM MAP', onclick: () => setTab('sys', true) });
  const tabAnti = h('button', { class: 'ux-tab', type: 'button', text: 'ANTIVERSE', onclick: () => setTab('anti', true) });
  const logBadge = h('i', { class: 'new', style: { display: 'none' } });
  const tabLog = h('button', { class: 'ux-tab ux-tab-log', type: 'button', title: 'Open the ship log (codex)', onclick: () => openLog() }, h('span', { text: 'SHIP LOG' }), logBadge);
  const statEl = h('div', { class: 'ux-stat ux-nav-stat' });
  const cv = h('canvas', { class: 'ux-map-cv' });
  const mapTitle = h('div', { class: 'ux-map-ttl' });
  const noteEl = h('div', { class: 'ux-map-note' });
  const readEl = h('div', { class: 'ux-map-read' });
  const legendEl = h('div', { class: 'ux-map-legend' });
  const btnTop = h('button', { class: 'ux-seg on', type: 'button', text: 'TOP', onclick: () => setView('top') });
  const btnSide = h('button', { class: 'ux-seg', type: 'button', text: 'SIDE', onclick: () => setView('side') });
  const tool = (txt, title, fn) => h('button', { class: 'ux-btn ux-btn-sm ux-tool', type: 'button', title, text: txt, onclick: fn });
  const mapTools = h('div', { class: 'ux-map-tools' },
    h('div', { class: 'ux-segs' }, btnTop, btnSide),
    tool('−', 'Zoom out  [-]', () => zoomBy(1 / 1.35)), tool('+', 'Zoom in  [+]', () => zoomBy(1.35)),
    tool('FIT', 'Fit the whole map  [0]', () => fit()), tool('SHIP', 'Centre on ORPHEUS  [G]', () => focusShip()), tool('FOCUS', 'Centre on the selection  [F]', () => focusSel()));
  const mapEl = h('div', { class: 'ux-map' }, cv, mapTitle, mapTools, noteEl, legendEl, readEl);
  const listEl = h('div', { class: 'ux-dlist' });
  const countEl = h('b', { text: '0 CONTACTS' });
  const msgEl = h('div', { class: 'ux-nav-msg' });
  const root = h('div', { id: 'ux-nav', class: 'ux-modal ux-nav' },
    h('div', { class: 'ux-back' }),
    h('div', { class: 'ux-frame ux-panel' },
      h('div', { class: 'ux-head' },
        h('div', { class: 'ux-ttl' }, h('div', { class: 'k', text: 'NAVIGATION COMPUTER' }), h('div', { class: 'm', text: 'ORPHEUS · HX-02' })),
        h('div', { class: 'ux-tabs' }, tabSys, tabAnti, tabLog),
        statEl,
        h('button', { class: 'ux-btn ux-btn-sm', type: 'button', text: 'CLOSE  [J]', onclick: () => close() })),
      h('div', { class: 'ux-nav-body' },
        mapEl,
        h('div', { class: 'ux-dests' },
          h('div', { class: 'ux-ph' }, h('span', { text: 'DESTINATIONS' }), countEl),
          listEl, msgEl)),
      h('div', { class: 'ux-foot' },
        h('span', {}, kbd('↑'), kbd('↓'), ' select'), h('span', {}, kbd('←'), kbd('→'), ' landing site'),
        h('span', {}, kbd('ENTER'), ' set course'), h('span', {}, kbd('T'), ' target only'), h('span', {}, kbd('X'), ' clear'),
        h('span', {}, kbd('V'), ' top / side'), h('span', {}, kbd('TAB'), ' system / antiverse'), h('span', {}, kbd('L'), ' ship log'),
        h('span', {}, kbd('J'), kbd('ESC'), ' close'))));
  document.body.appendChild(root);
  isolateInput(root);
  const modal = { onKey };

  // ─────────────────────────── list ───────────────────────────
  function renderList(force) {
    const vis = st.rows.filter(visible);
    const key = st.sheet + '|' + vis.map((r) => r.group + ':' + r.id).join('|');
    if (force || key !== listKey) {
      listKey = key;
      const keep = listEl.scrollTop;
      listEl.replaceChildren();
      rowRefs.clear();
      const gorder = st.sheet < 0 ? ['ANTIVERSE', 'EREBUS', 'STATIONS', 'WORLDS'] : GROUP_ORDER;       // the sheet you are on comes first
      const rank = (n) => { const i = gorder.indexOf(n); return i < 0 ? 99 : i; };
      const groups = [...new Set(vis.map((r) => r.group))].sort((a, b) => rank(a) - rank(b));
      st.order = [];
      for (const gname of groups) {
        const rs = vis.filter((r) => r.group === gname);
        listEl.appendChild(h('div', { class: 'ux-grp' }, h('span', { text: gname }), h('em', { text: String(rs.length) })));
        for (const r of rs) { const ref = buildRow(r); rowRefs.set(r.id, ref); listEl.appendChild(ref.el); st.order.push(r.id); }
      }
      if (!vis.length) listEl.appendChild(h('div', { class: 'ux-empty', text: 'NO CONTACTS · navigation data unavailable' }));
      listEl.scrollTop = keep;
    }
    for (const r of vis) patchRow(rowRefs.get(r.id), r);
    countEl.textContent = `${vis.filter((r) => r.discovered).length} CONTACTS`;
  }

  function buildRow(r) {
    const dot = h('i', { class: 'dot' }), name = h('span', { class: 'nm' }), dist = h('span', { class: 'ds' }), km = h('span', { class: 'km' });
    const meta = h('span', { class: 'meta' }), chip = h('span', { class: 'ux-chip' }), tag = h('span', { class: 'ux-chip mag', style: { display: 'none' } });
    const why = h('div', { class: 'why' }), desc = h('div', { class: 'desc' }), tags = h('div', { class: 'tags' }), sites = h('div', { class: 'sites' });
    const bCourse = h('button', { class: 'ux-btn ux-btn-sm pri', type: 'button', onclick: (e) => { e.stopPropagation(); course(r.id); } }, 'SET COURSE ', h('kbd', { text: '⏎' }));
    const bTarget = h('button', { class: 'ux-btn ux-btn-sm', type: 'button', onclick: (e) => { e.stopPropagation(); target(r.id); } }, 'TARGET ONLY ', h('kbd', { text: 'T' }));
    const bClear = h('button', { class: 'ux-btn ux-btn-sm bad', type: 'button', onclick: (e) => { e.stopPropagation(); clearNav(); } }, 'CLEAR ', h('kbd', { text: 'X' }));
    const acts = h('div', { class: 'acts' }, bCourse, bTarget, bClear);
    const el = h('div', { class: 'ux-dest', data: { id: r.id }, onclick: () => select(r.id, { scroll: false }), ondblclick: () => course(r.id),
      onmouseenter: () => { st.hover = r.id; st.dirty = true; }, onmouseleave: () => { if (st.hover === r.id) { st.hover = null; st.dirty = true; } } },
      h('div', { class: 'top' }, dot, name, tag, dist), h('div', { class: 'mid' }, meta, km, chip), why,
      h('div', { class: 'x' }, desc, tags, sites, acts));
    return { el, name, dist, km, meta, chip, tag, why, desc, tags, sites, bCourse, bTarget, bClear, cache: {} };
  }

  const setText = (ref, k, el, v) => { if (ref.cache[k] !== v) { ref.cache[k] = v; el.textContent = v; } };
  function patchRow(ref, r) {
    if (!ref) return;
    const sel = st.sel === r.id, nav = canNav(r), cur = st.cur && st.cur.id === r.id;
    ref.el.classList.toggle('sel', sel);
    ref.el.classList.toggle('unreach', r.discovered && !r.reachable);
    ref.el.classList.toggle('undisc', !r.discovered);
    ref.el.classList.toggle('cur', !!cur);
    ref.el.classList.toggle('off', !onTab(r));
    setText(ref, 'nm', ref.name, r.discovered ? r.name : '— UNCHARTED —');
    const dp = r.discovered ? fmtDist(r.dist) : ['—', ''];
    setText(ref, 'ds', ref.dist, dp[0]);
    setText(ref, 'km', ref.km, dp[1]);
    const meta = r.discovered ? [Number.isFinite(r.lag) ? `LAG ${fmtLag(r.lag)}` : null, Number.isFinite(r.dil) ? `dτ/dt ${fmtDil(r.dil)}` : null, r.done ? 'VISITED ✓' : null].filter(Boolean).join('  ·  ') : 'signal not yet identified';
    setText(ref, 'meta', ref.meta, meta);
    const chip = !r.discovered ? ['UNCHARTED', 'dim'] : r.reachable ? ['REACHABLE', 'ok'] : ['NO PATH', 'bad'];
    setText(ref, 'chip', ref.chip, chip[0]);
    ref.chip.className = 'ux-chip ' + chip[1];
    ref.tag.style.display = cur ? '' : 'none';
    setText(ref, 'tag', ref.tag, cur ? (st.cur.mode === 'target' ? 'TARGET' : 'COURSE') : '');
    setText(ref, 'why', ref.why, r.discovered && !r.reachable && r.why ? r.why : '');
    // expanded section
    setText(ref, 'desc', ref.desc, r.discovered ? r.desc : 'An unidentified contact. Keep exploring to chart it.');
    const tk = `${kindLabel(r.kind)}|${r.discovered ? 1 : 0}|${r.done ? 1 : 0}`;
    if (ref.cache.tk !== tk) {
      ref.cache.tk = tk;
      ref.tags.replaceChildren(...[
        r.discovered && r.kind ? h('span', { class: 'ux-chip', text: kindLabel(r.kind) }) : null,
        h('span', { class: 'ux-chip ' + (r.discovered ? 'ok' : 'dim'), text: r.discovered ? 'CHARTED' : 'UNCHARTED' }),
        r.done ? h('span', { class: 'ux-chip warn', text: 'VISITED' }) : null].filter(Boolean));
    }
    const sk = r.landable && r.discovered ? r.sites.map((s) => s.id).join(',') + '|' + (chosenSite(r) || '') : r.dockable && r.discovered ? 'dock' : r.discovered ? 'none:' + r.kind : '';
    if (ref.cache.sk !== sk) {
      ref.cache.sk = sk;
      ref.sites.replaceChildren();
      if (r.landable && r.discovered) {
        ref.sites.append(h('span', { class: 'lb', text: 'LANDING SITE' }));
        if (r.sites.length) for (const s of r.sites) ref.sites.append(h('button', { class: 'ux-chip site' + (s.id === chosenSite(r) ? ' on' : ''), type: 'button', title: s.desc || s.name, text: upper(s.name), onclick: (e) => { e.stopPropagation(); pickSite(r.id, s.id); } }));
        else ref.sites.append(h('span', { class: 'ux-chip dim', text: 'AUTO' }));
      } else if (r.dockable && r.discovered) ref.sites.append(h('span', { class: 'lb', text: 'DOCKING' }), h('span', { class: 'ux-chip ok', text: 'DOCKING PORT' }));
      else if (r.discovered && !r.feature) ref.sites.append(h('span', { class: 'lb', text: 'SURFACE' }), h('span', { class: 'ux-chip dim', text: 'NOT LANDABLE' }));
    }
    ref.bCourse.disabled = !nav; ref.bTarget.disabled = !nav;
    ref.bClear.disabled = !st.cur;
  }

  function renderHeader() {
    const s = st.ship, o = (ctx && ctx.obs) || {};
    const bits = [];
    if (s) {
      if (Number.isFinite(o.r)) bits.push(`<span>r <b>${fmtM(o.r)}</b></span>`);
      else bits.push(`<span>ρ <b>${fmtM(Math.hypot(s.pos[0], s.pos[1], s.pos[2]))}</b></span>`);
      bits.push(`<span>τ <b>${fmtClock(s.tau)}</b></span>`);
      if (s.sheet < 0) bits.push('<span class="warn"><b>r &lt; 0 SHEET</b></span>');
      else if (s.universe > 0) bits.push(`<span class="warn"><b>UNIVERSE ${s.universe + 1}</b></span>`);
      if (s.lock && s.lock.kind) bits.push(`<span class="ok"><b>${esc(upper(s.lock.kind))}${s.lock.body ? ' · ' + esc(upper(s.lock.body)) : ''}</b></span>`);
    } else bits.push('<span>NO SHIP DATA</span>');
    if (o.region) bits.push(`<span class="reg">${esc(upper(o.region))}</span>`);
    const html = bits.join('');
    if (statEl._h !== html) { statEl._h = html; statEl.innerHTML = html; }
    const n = safe(() => ctx.codexUI && ctx.codexUI.unseen && ctx.codexUI.unseen('Logs'), 0);
    logBadge.style.display = n > 0 ? '' : 'none';
    logBadge.textContent = String(n || '');
    tabLog.classList.toggle('dis', !(ctx && ctx.codexUI && ctx.codexUI.open));
    const sh = s ? s.sheet : 1;
    let note = '';
    if (st.tab === 'anti' && sh > 0) note = 'ORPHEUS IS NOT ON THIS SHEET — charted contacts only';
    else if (st.tab === 'sys' && sh < 0) note = 'ORPHEUS HAS LEFT THIS UNIVERSE — the system map is a record, not a view';
    else if (st.tab === 'sys' && s && s.universe > 0) note = 'UNIVERSE ' + (s.universe + 1) + ' — HALCYON IS NOT IN THIS EXTERIOR';
    if (noteEl._t !== note) { noteEl._t = note; noteEl.textContent = note; noteEl.classList.toggle('on', !!note); }
  }

  // ─────────────────────────── selection & actions ───────────────────────────
  const chosenSite = (r) => (st.site.get(r.id) && r.sites.some((s) => s.id === st.site.get(r.id)) ? st.site.get(r.id) : r.sites[0] ? r.sites[0].id : null);
  function pickSite(id, siteId) { st.site.set(id, siteId); sfx('click'); const r = st.byId.get(id); const ref = rowRefs.get(id); if (r && ref) { ref.cache.sk = null; patchRow(ref, r); } }

  function select(id, o = {}) {
    if (!st.byId.has(id)) return;
    const changed = st.sel !== id;
    const prev = st.sel;
    st.sel = id;
    for (const k of [prev, id]) { const r = st.byId.get(k), ref = rowRefs.get(k); if (r && ref) patchRow(ref, r); }
    if (changed) sfx('click');
    const ref = rowRefs.get(id);
    if (ref && o.scroll !== false) ref.el.scrollIntoView({ block: 'nearest' });
    if (o.focus) focusSel();
    st.dirty = true;
  }
  function move(dir) {
    if (!st.order.length) return;
    const i = st.order.indexOf(st.sel);
    select(st.order[clamp((i < 0 ? 0 : i) + dir, 0, st.order.length - 1)]);
  }
  function stepSite(dir) {
    const r = st.byId.get(st.sel);
    if (!r || !r.landable || r.sites.length < 2) return;
    const i = Math.max(0, r.sites.findIndex((s) => s.id === chosenSite(r)));
    pickSite(r.id, r.sites[(i + dir + r.sites.length) % r.sites.length].id);
  }

  function flash(text, kind) {
    msgEl.textContent = text;
    msgEl.className = 'ux-nav-msg on ' + (kind || '');
    st.msgUntil = performance.now() + 3400;
  }
  function needNav(name) { flash(`NAVIGATION SYSTEM OFFLINE · cannot ${name}`, 'bad'); sfx('deny'); }

  function course(id = st.sel) {
    const r = st.byId.get(id);
    if (!r) return;
    if (!canNav(r)) { flash(r.discovered ? `NO PATH · ${r.why || 'unreachable from here'}` : 'UNCHARTED CONTACT — cannot plot a course', 'bad'); sfx('deny'); return; }
    if (!ctx || !ctx.nav || typeof ctx.nav.setCourse !== 'function') { needNav('set a course'); return; }
    const site = r.landable ? chosenSite(r) : null;
    let ok;
    try { ok = ctx.nav.setCourse(r.id, site ? { site } : {}); } catch (err) { console.error('[navmap] setCourse failed', err); flash('COURSE REJECTED', 'bad'); sfx('deny'); return; }
    if (ok === false) {                                              // core refused (it also toasts, but the HUD is hidden behind this screen)
      const lk = ctx.ship && ctx.ship.lock && ctx.ship.lock.kind;
      flash(lk === 'landed' ? 'TAKE OFF FIRST — the ship is on the ground' : lk === 'docked' ? 'UNDOCK FIRST — the ship is docked' : 'COURSE NOT ACCEPTED', 'bad');
      sfx('deny');
      return;
    }
    sfx('confirm');
    close();
  }
  function target(id = st.sel) {
    const r = st.byId.get(id);
    if (!r) return;
    if (!canNav(r)) { flash(r.discovered ? `NO PATH · ${r.why || 'unreachable from here'}` : 'UNCHARTED CONTACT — cannot target', 'bad'); sfx('deny'); return; }
    if (!ctx || !ctx.nav || typeof ctx.nav.setTarget !== 'function') { needNav('set a target'); return; }
    let ok;
    try { ok = ctx.nav.setTarget(r.id); } catch (err) { console.error('[navmap] setTarget failed', err); flash('TARGET REJECTED', 'bad'); sfx('deny'); return; }
    if (ok === false) { flash('TARGET NOT ACCEPTED', 'bad'); sfx('deny'); return; }
    st.cur = currentNav() || { id: r.id, mode: 'target' };
    flash(`TARGET SET · ${upper(r.name)}`, 'ok'); sfx('confirm');
    renderList(); st.dirty = true;
  }
  function clearNav() {
    if (!ctx || !ctx.nav || typeof ctx.nav.clear !== 'function') { needNav('clear the course'); return; }
    try { ctx.nav.clear(); } catch (err) { console.error('[navmap] clear failed', err); return; }
    st.cur = currentNav();
    flash('COURSE CLEARED', ''); sfx('select');
    renderList(); st.dirty = true;
  }
  function openLog() {
    const cx = ctx && ctx.codexUI;
    if (!cx || typeof cx.open !== 'function') { flash('SHIP LOG UNAVAILABLE', 'bad'); sfx('deny'); return; }
    cx.open('Logs');
  }

  // ─────────────────────────── tabs / view / camera ───────────────────────────
  function setTab(tab, user) {
    if (tab !== 'sys' && tab !== 'anti') return;
    if (st.tab !== tab) { st.tab = tab; st.zoom = 1; st.panX = 0; st.panY = 0; }
    tabSys.classList.toggle('on', tab === 'sys');
    tabAnti.classList.toggle('on', tab === 'anti');
    renderLegend(); renderHeader();
    st.dirty = true;
    if (user) sfx('select');
  }
  function setView(v) {
    st.view = v;
    btnTop.classList.toggle('on', v === 'top'); btnSide.classList.toggle('on', v === 'side');
    renderLegend();
    st.dirty = true;
  }
  function zoomBy(f, mx, my) {
    const W = st.W, H = st.H;
    if (mx == null) { mx = W / 2; my = H / 2; }
    const z = clamp(st.zoom * f, 0.55, 40);
    const k = z / st.zoom;
    st.panX = mx - W / 2 - k * (mx - W / 2 - st.panX);
    st.panY = my - H / 2 - k * (my - H / 2 - st.panY);
    st.zoom = z; st.dirty = true;
  }
  function fit() { st.zoom = 1; st.panX = 0; st.panY = 0; st.dirty = true; }
  function focusAt(p) {
    if (!p) return;
    const V = makeView(), q = V.P(p[0], p[1], p[2]);
    st.panX -= q[0] - st.W / 2; st.panY -= q[1] - st.H / 2; st.dirty = true;
  }
  function focusSel() { const r = st.byId.get(st.sel); if (r) focusAt(r.moonOf ? (st.byId.get(r.moonOf) || r).pos : r.pos); }
  function focusShip() { if (st.ship) focusAt(st.ship.pos); }

  // ─────────────────────────── map rendering ───────────────────────────
  function makeView() {
    const W = st.W, H = st.H, anti = st.tab === 'anti';
    const rmax = anti ? ANTI_RMAX : SYS_RMAX, ln = Math.log(1 + rmax / LOG0);
    const base = Math.max(120, Math.min(W, H) / 2 - 44) * st.zoom;
    const cx = W / 2 + st.panX, cy = H / 2 + st.panY, top = st.view === 'top', k0 = 1 / (LOG0 * ln);
    return {
      W, H, anti, rmax, base, cx, cy, top,
      P(x, y, z) {
        const rho = Math.sqrt(x * x + y * y + z * z);
        const f = (rho > 1e-6 ? Math.log(1 + rho / LOG0) / ln / rho : k0) * base;
        return [cx + x * f, cy - (top ? y : z) * f];
      },
      R: (rho) => (Math.log(1 + rho / LOG0) / ln) * base,
      rho: (px) => LOG0 * (Math.exp(Math.min(px / base, 4) * ln) - 1),     // inverse of R
    };
  }

  function resize() {
    const W = mapEl.clientWidth | 0, H = mapEl.clientHeight | 0;
    if (W < 8 || H < 8) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (st.W !== W || st.H !== H || cv._dpr !== dpr) {
      st.W = W; st.H = H; cv._dpr = dpr;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    return true;
  }

  function stars() {
    if (st.stars) return st.stars;
    let s = 1337; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    st.stars = Array.from({ length: 170 }, () => [rnd(), rnd(), 0.25 + rnd() * 0.75, rnd()]);
    return st.stars;
  }

  // canvas text with a dark halo, and a greedy label placer that keeps clear of already-placed rectangles
  const LABEL_FONT = '600 11px Rajdhani, "Segoe UI", sans-serif';
  const dispFont = (px) => `600 ${px}px Orbitron, sans-serif`;
  function haloText(g, str, x, y, o = {}) {
    g.font = o.font || LABEL_FONT;
    if ('letterSpacing' in g) g.letterSpacing = o.ls || '0.08em';
    g.textAlign = o.align || 'left'; g.textBaseline = 'middle';
    g.lineWidth = 3.2; g.strokeStyle = 'rgba(1,8,14,.88)'; g.strokeText(str, x, y);
    g.fillStyle = o.color || 'rgba(214,246,255,.9)'; g.fillText(str, x, y);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
  }
  const overlaps = (placed, x0, y0, w, hh) => placed.some((p) => x0 < p[0] + p[2] && x0 + w > p[0] && y0 < p[1] + p[3] && y0 + hh > p[1]);
  function makeLabeler(g, W, H, placed) {
    return function placeLabel(str, x, y, o = {}) {
      g.font = o.font || LABEL_FONT;
      if ('letterSpacing' in g) g.letterSpacing = o.ls || '0.08em';
      const w = g.measureText(str).width + 4;
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      const d = o.d || 9, hh = 14;
      const slots = [[d, 0, 'left'], [d, -hh, 'left'], [d, hh, 'left'], [-d, 0, 'right'], [-d, -hh, 'right'], [-d, hh, 'right'], [0, -d - 6, 'center'], [0, d + 6, 'center']];
      for (const [dx, dy, al] of slots) {
        const x0 = al === 'left' ? x + dx : al === 'right' ? x + dx - w : x - w / 2, y0 = y + dy - hh / 2;
        if (x0 < 4 || x0 + w > W - 4 || y0 < 4 || y0 + hh > H - 4 || overlaps(placed, x0, y0, w, hh)) continue;
        placed.push([x0, y0, w, hh]);
        haloText(g, str, al === 'center' ? x : x + dx, y + dy, { ...o, align: al });
        return true;
      }
      if (o.force) { placed.push([x + d, y - hh / 2, w, hh]); haloText(g, str, x + d, y, { ...o, align: 'left' }); return true; }
      return false;
    };
  }

  function draw(now) {
    if (!resize()) return;
    const g = cv.getContext('2d'), dpr = cv._dpr, W = st.W, H = st.H;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const V = makeView();
    // the HTML furniture (title, tools, legend, readout) reserves its rectangles so labels never hide under it
    const placed = [[0, 0, 300, 66], [W - 430, 0, 430, 58], [0, H - 62, Math.min(W * 0.58, 600), 62], [W - 400, H - 28, 400, 28]];
    const D = { g, V, G: geo(), now, W, H, ship: st.ship, pulse: 0.5 + 0.5 * Math.sin(now / 420), placed, text: (s, x, y, o) => haloText(g, s, x, y, o), label: makeLabeler(g, W, H, placed) };
    st.hits = []; st.structs = [];
    drawBackdrop(D);
    drawRulers(D);
    if (V.anti) drawAntiverse(D); else drawErebus(D);
    drawOrbits(D);
    drawWaypoints(D);
    drawBodies(D);
    drawCourse(D);
    drawShip(D);
    drawRingLabels(D);
    drawTooltip(D);
    if (st.mx >= 0) {
      const rho = V.rho(Math.hypot(st.mx - V.cx, st.my - V.cy));
      readEl.textContent = rho < 100000 ? `CURSOR  ρ ${fmtM(rho)}  ·  ${fmtKm(rho)}  ·  lag ${fmtLag(rho)}` : '';
    } else readEl.textContent = '1 M = 1 light-second = 299,792 km · LOG-RADIAL SCALE';
  }

  function drawBackdrop({ g, V, W, H }) {
    const bg = g.createRadialGradient(V.cx, V.cy, 0, V.cx, V.cy, V.base * 1.25 + 40);
    bg.addColorStop(0, V.anti ? 'rgba(46,24,70,.55)' : 'rgba(12,40,60,.55)');
    bg.addColorStop(0.55, V.anti ? 'rgba(14,8,28,.35)' : 'rgba(4,16,28,.35)');
    bg.addColorStop(1, 'rgba(0,4,8,0)');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (const s of stars()) { const z = s[3] > 0.85 ? 1.6 : 1; g.fillStyle = `rgba(190,230,255,${0.1 + s[2] * 0.22})`; g.fillRect(s[0] * W, s[1] * H, z, z); }
  }

  // log-radius rings, polar spokes (top) or the equatorial plane / spin axis (side)
  function drawRulers({ g, V, W, H, text }) {
    const { cx, cy, R, top, anti } = V, ink = anti ? '190,150,255' : '134,236,255';
    for (const rho of RINGS) {
      if (rho > V.rmax * 1.001) break;
      const Rr = R(rho);
      if (Rr < 7) continue;
      g.beginPath(); g.arc(cx, cy, Rr, 0, TAU);
      g.strokeStyle = `rgba(${ink},${MAJOR_RINGS.has(rho) ? 0.13 : 0.055})`; g.lineWidth = 1; g.stroke();
    }
    if (top) {
      g.strokeStyle = `rgba(${ink},.045)`; g.lineWidth = 1; g.beginPath();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.moveTo(cx + Math.cos(a) * R(1.2), cy + Math.sin(a) * R(1.2)); g.lineTo(cx + Math.cos(a) * V.base * 1.02, cy + Math.sin(a) * V.base * 1.02); }
      g.stroke();
    } else {
      g.save(); g.setLineDash([2, 6]); g.strokeStyle = `rgba(${ink},.2)`; g.lineWidth = 1; g.beginPath();
      g.moveTo(0, cy); g.lineTo(W, cy); g.moveTo(cx, 0); g.lineTo(cx, H); g.stroke(); g.restore();
      text('EQUATORIAL PLANE', 12, clamp(cy - 10, 80, H - 70), { font: dispFont(9.5), ls: '0.2em', color: `rgba(${ink},.5)` });
      text('SPIN AXIS +z', clamp(cx + 8, 8, W - 120), 84, { font: dispFont(9.5), ls: '0.2em', color: `rgba(${ink},.5)` });
    }
  }

  // ring-radius labels run last so they never cover a body label; they keep to the lower-left diagonal
  function drawRingLabels({ g, V, placed, text }) {
    const ink = V.anti ? '190,150,255' : '134,236,255';
    let lastR = -99;
    g.font = '10px "Share Tech Mono", monospace';
    for (const rho of RINGS) {
      if (rho > V.rmax * 1.001) break;
      const Rr = V.R(rho);
      if (Rr < 18 || Rr - lastR < 17 || !(MAJOR_RINGS.has(rho) || st.zoom > 2.2)) continue;
      const str = (V.anti ? '−' : '') + rho + ' M', w = g.measureText(str).width + 6;
      const x = V.cx + Math.cos(2.36) * Rr, y = V.cy + Math.sin(2.36) * Rr;
      if (x - w < 4 || x > V.W - 4 || y < 10 || y > V.H - 10 || overlaps(placed, x - w, y - 7, w, 14)) continue;
      lastR = Rr;
      placed.push([x - w, y - 7, w, 14]);
      text(str, x - 3, y, { font: '10px "Share Tech Mono", monospace', ls: '0px', align: 'right', color: `rgba(${ink},.6)` });
    }
  }

  // Erebus and its structure (positive sheet). Every structure is also registered for hover tooltips (st.structs).
  function drawErebus(D) {
    const { g, V, G, now, text, label } = D, { cx, cy, R, P, top } = V;
    const car = (r) => Math.sqrt(r * r + G.a * G.a);              // KS Cartesian equatorial radius of BL radius r
    const merid = (rf) => {                                         // meridian-plane loop of the surface r = rf(θ)
      const pts = [];
      for (let i = 0; i <= 96; i++) {
        const t = (i / 96) * TAU, th = t <= Math.PI ? t : TAU - t, sg = t <= Math.PI ? 1 : -1, r = rf(th);
        pts.push(P(sg * car(r) * Math.sin(th), 0, r * Math.cos(th)));
      }
      return pts;
    };
    const eq = Math.PI / 2, rEq = G.rErgo(eq);
    const S = [
      { id: 'rim', name: 'DISK RIM', kind: 'equ', r: car(DISK_ROUT), col: 'rgba(255,176,110,.95)', ang: 3.95, minR: 52, info: ['Outer edge of the accretion disk', `r = ${DISK_ROUT} M · ${fmtKm(DISK_ROUT)}`] },
      { id: 'phs', name: 'PHOTON SHELL', kind: 'sph', r: car(G.phRet), r0: car(G.phPro), col: 'rgba(214,246,255,.9)', ang: 4.4, minR: 52, info: ['Light itself can orbit here', `r = ${G.phPro.toFixed(2)} – ${G.phRet.toFixed(2)} M`] },
      { id: 'isc', name: 'ISCO', kind: 'equ', r: car(G.isco), col: 'rgba(255,220,160,.95)', ang: 3.3, minR: 58, info: ['Innermost stable circular orbit', `r = ${G.isco.toFixed(3)} M · prograde`] },
      { id: 'erg', name: 'ERGOSPHERE', kind: 'surf', rf: (th) => G.rErgo(th), col: 'rgba(150,210,255,.95)', ang: 2.55, minR: 58, info: ['Space is dragged faster than light', `equatorial r = ${rEq.toFixed(3)} M`] },
      { id: 'ehz', name: 'EVENT HORIZON', kind: 'surf', rf: () => G.rp, col: 'rgba(255,160,140,.95)', ang: 1.85, minR: 58, info: ['The point of no return', `r₊ = ${G.rp.toFixed(3)} M · ${fmtKm(G.rp)}`] },
      { id: 'ihz', name: 'INNER HORIZON', kind: 'surf', rf: () => G.rm, col: 'rgba(120,210,255,.95)', ang: 1.25, minR: 70, info: ['Cauchy horizon — prediction ends', `r₋ = ${G.rm.toFixed(3)} M`] },
      { id: 'rng', name: 'RING SINGULARITY', kind: 'ring', r: G.a, col: 'rgba(255,255,255,.95)', ang: 0.7, minR: 70, info: ['Curvature singularity — the way through', `ring radius a = ${G.a.toFixed(2)} M`] },
    ];
    const by = Object.fromEntries(S.map((s) => [s.id, s]));
    for (const s of S) {
      s.R = s.kind === 'surf' ? R(car(s.rf(eq))) : R(s.kind === 'ring' ? s.r : s.r);
      if (!top && s.kind === 'surf') s.pts = merid(s.rf);
      st.structs.push({
        id: s.id, name: s.name, info: s.info,
        dist(x, y) {
          const d = Math.hypot(x - cx, y - cy);
          if (s.kind === 'sph') return Math.min(Math.abs(d - R(s.r)), Math.abs(d - R(s.r0)));
          if (top) return Math.abs(d - s.R);
          if (s.kind === 'surf') { let m = 1e9; for (const p of s.pts) m = Math.min(m, Math.hypot(p[0] - x, p[1] - y)); return m; }
          return Math.min(Math.hypot(x - (cx - s.R), y - cy), Math.hypot(x - (cx + s.R), y - cy));
        },
      });
    }
    const hot = (id) => st.hoverStruct === id;
    const trace = (s) => { g.beginPath(); if (top) g.arc(cx, cy, s.R, 0, TAU); else { s.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); } };
    const Ri = R(car(G.isco)), Ro = R(car(DISK_ROUT));

    // ergosphere tint, photon-shell band
    trace(by.erg); g.fillStyle = 'rgba(100,170,255,.07)'; g.fill();
    g.beginPath(); g.arc(cx, cy, R(by.phs.r), 0, TAU); g.arc(cx, cy, R(by.phs.r0), 0, TAU, true);
    g.fillStyle = 'rgba(134,236,255,.06)'; g.fill('evenodd');
    g.save(); g.setLineDash([1.5, 4]); g.strokeStyle = 'rgba(210,246,255,.55)'; g.lineWidth = 1;
    for (const rr of [by.phs.r, by.phs.r0]) { g.beginPath(); g.arc(cx, cy, R(rr), 0, TAU); g.stroke(); }
    g.restore();

    // accretion disk: warm annulus (top) / edge-on band (side)
    const stop = (rho) => clamp((R(rho) - Ri) / Math.max(Ro - Ri, 1), 0, 1);
    if (top) {
      const grd = g.createRadialGradient(cx, cy, Ri, cx, cy, Ro);
      grd.addColorStop(0, 'rgba(255,244,214,.95)'); grd.addColorStop(stop(3.2), 'rgba(255,196,96,.88)');
      grd.addColorStop(stop(6), 'rgba(255,140,56,.62)'); grd.addColorStop(stop(11), 'rgba(214,82,30,.34)'); grd.addColorStop(1, 'rgba(150,44,18,.12)');
      g.beginPath(); g.arc(cx, cy, Ro, 0, TAU); g.arc(cx, cy, Ri, 0, TAU, true); g.fillStyle = grd; g.fill('evenodd');
      // differential rotation: dashes circle prograde (counter-clockwise from +z), faster inside
      g.save(); g.lineCap = 'butt'; g.lineWidth = 1.3;
      for (const rho of [2.9, 4.6, 7.4, 12]) {
        const Rr = R(car(rho)), om = 5.5 / (Math.pow(rho, 1.5) + G.a);
        g.setLineDash([Rr * 0.16, Rr * 0.34]); g.lineDashOffset = (now / 1000) * om * Rr;
        g.strokeStyle = `rgba(255,238,205,${0.3 - rho * 0.012})`;
        g.beginPath(); g.arc(cx, cy, Rr, 0, TAU); g.stroke();
      }
      g.restore();
      for (const rr of [Ri, Ro]) { g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.strokeStyle = 'rgba(255,190,120,.4)'; g.lineWidth = 1; g.stroke(); }
    } else {
      for (const sg of [-1, 1]) {
        const x0 = cx + sg * Ri, x1 = cx + sg * Ro, grd = g.createLinearGradient(x0, 0, x1, 0);
        grd.addColorStop(0, 'rgba(255,244,214,.98)'); grd.addColorStop(stop(3.2), 'rgba(255,196,96,.9)'); grd.addColorStop(stop(6), 'rgba(255,140,56,.7)'); grd.addColorStop(stop(11), 'rgba(214,82,30,.4)'); grd.addColorStop(1, 'rgba(150,44,18,.15)');
        g.save(); g.shadowColor = 'rgba(255,150,60,.6)'; g.shadowBlur = 10; g.strokeStyle = grd; g.lineWidth = clamp(2 + st.zoom * 0.5, 2, 6); g.lineCap = 'butt';
        g.beginPath(); g.moveTo(x0, cy); g.lineTo(x1, cy); g.stroke(); g.restore();
      }
    }

    // ergosphere outline, horizon with glowing rim, inner horizon, ring singularity
    g.save(); g.setLineDash([5, 4]); trace(by.erg); g.strokeStyle = 'rgba(120,200,255,.8)'; g.lineWidth = 1.1; g.stroke(); g.restore();
    g.save(); g.shadowColor = 'rgba(255,90,60,.9)'; g.shadowBlur = 12;
    trace(by.ehz); g.fillStyle = '#000'; g.fill(); g.strokeStyle = 'rgba(255,96,64,.95)'; g.lineWidth = 1.5; g.stroke(); g.restore();
    trace(by.ihz); g.strokeStyle = 'rgba(90,200,255,.7)'; g.lineWidth = 1; g.stroke();
    if (top) { g.save(); g.setLineDash([1, 3]); g.beginPath(); g.arc(cx, cy, by.rng.R, 0, TAU); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.2; g.stroke(); g.restore(); }
    else { g.fillStyle = '#fff'; for (const sg of [-1, 1]) { g.beginPath(); g.arc(cx + sg * by.rng.R, cy, 2, 0, TAU); g.fill(); } }

    // hovered structure: bright outline
    const hs = S.find((s) => hot(s.id));
    if (hs) {
      g.save(); g.strokeStyle = '#fff'; g.shadowColor = hs.col; g.shadowBlur = 10; g.lineWidth = 2;
      if (hs.kind === 'sph') { for (const rr of [hs.r, hs.r0]) { g.beginPath(); g.arc(cx, cy, R(rr), 0, TAU); g.stroke(); } }
      else if (hs.kind === 'surf' || top) { trace(hs); g.stroke(); }
      else for (const sg of [-1, 1]) { g.beginPath(); g.arc(cx + sg * hs.R, cy, 5, 0, TAU); g.stroke(); }
      g.restore();
    }
    // names: only where the circles are big enough to carry them (zoom in for the rest) — hovering always names a structure
    for (const s of S) {
      const Rr = s.kind === 'sph' ? R(s.r) : s.R;
      if (Rr < s.minR && !hot(s.id)) continue;
      label(s.name, cx + Math.cos(s.ang) * Rr, cy + Math.sin(s.ang) * Rr, { font: dispFont(9), ls: '0.14em', color: s.col, d: 6 });
    }
  }

  // the r < 0 sheet: ring singularity, an outward-streaming push field (gravity repels here)
  function drawAntiverse(D) {
    const { g, V, G, now, text, label } = D, { cx, cy, R, top } = V;
    g.save(); g.lineCap = 'butt';
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU, ca = Math.cos(a), sa = Math.sin(a), r0 = R(1.8), r1 = V.base * 1.04;
      const gr = g.createLinearGradient(cx + ca * r0, cy + sa * r0, cx + ca * r1, cy + sa * r1);
      gr.addColorStop(0, 'rgba(214,176,255,.55)'); gr.addColorStop(1, 'rgba(214,176,255,0)');
      g.strokeStyle = gr; g.lineWidth = 1.2; g.setLineDash([2, 12]); g.lineDashOffset = -now / 45;
      g.beginPath(); g.moveTo(cx + ca * r0, cy + sa * r0); g.lineTo(cx + ca * r1, cy + sa * r1); g.stroke();
    }
    g.restore();
    const halo = g.createRadialGradient(cx, cy, 0, cx, cy, R(4));
    halo.addColorStop(0, 'rgba(255,230,255,.55)'); halo.addColorStop(0.35, 'rgba(190,130,255,.24)'); halo.addColorStop(1, 'rgba(120,60,200,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, R(4), 0, TAU); g.fill();
    g.save(); g.shadowColor = '#e6c8ff'; g.shadowBlur = 12; g.strokeStyle = 'rgba(255,240,255,.95)'; g.lineWidth = 1.6; g.fillStyle = '#fff';
    if (top) { g.beginPath(); g.arc(cx, cy, R(G.a), 0, TAU); g.stroke(); }
    else { for (const sg of [-1, 1]) { g.beginPath(); g.arc(cx + sg * R(G.a), cy, 2.6, 0, TAU); g.fill(); } g.setLineDash([2, 4]); g.beginPath(); g.moveTo(cx - R(G.a), cy); g.lineTo(cx + R(G.a), cy); g.stroke(); }
    g.restore();
    st.structs.push({
      id: 'rng', name: 'RING SINGULARITY', info: ['Curvature singularity at r = 0 — the throat', `ring radius a = ${G.a.toFixed(2)} M`],
      dist: (x, y) => (top ? Math.abs(Math.hypot(x - cx, y - cy) - R(G.a)) : Math.min(Math.hypot(x - (cx - R(G.a)), y - cy), Math.hypot(x - (cx + R(G.a)), y - cy))),
    });
    label('RING SINGULARITY · r = 0', cx + (top ? R(G.a) : 0), cy - (top ? 0 : 6), { font: dispFont(9), ls: '0.14em', color: 'rgba(240,220,255,.9)', d: 10 });
  }

  function drawOrbits({ g, V }) {
    for (const [id, pts] of st.orbits) {
      const r = st.byId.get(id);
      if (!r || !r.discovered || !onTab(r)) continue;
      const lk = LOOK[id] || {}, sel = st.sel === id;
      g.beginPath();
      pts.forEach((p, i) => { const q = V.P(p[0], p[1], p[2]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
      g.strokeStyle = sel ? 'rgba(255,255,255,.75)' : (lk.c || '#86ecff'); g.globalAlpha = sel ? 0.95 : 0.28; g.lineWidth = sel ? 1.6 : 1; g.stroke(); g.globalAlpha = 1;
    }
  }

  function drawWaypoints({ g, V, pulse, label }) {
    for (const r of st.rows) {
      if (!r.feature || !r.pos || !visible(r) || !onTab(r)) continue;
      const q = V.P(r.pos[0], r.pos[1], r.pos[2]), sel = st.sel === r.id, hov = st.hover === r.id, cur = st.cur && st.cur.id === r.id;
      const s = sel || hov ? 5.5 : 3.6;
      g.beginPath(); g.moveTo(q[0], q[1] - s); g.lineTo(q[0] + s, q[1]); g.lineTo(q[0], q[1] + s); g.lineTo(q[0] - s, q[1]); g.closePath();
      g.fillStyle = sel || cur ? '#ff6cf0' : r.reachable ? 'rgba(255,108,240,.55)' : 'rgba(150,150,170,.4)'; g.fill();
      if (sel) { g.beginPath(); g.arc(q[0], q[1], 9 + pulse * 3, 0, TAU); g.strokeStyle = `rgba(255,108,240,${0.7 - pulse * 0.4})`; g.lineWidth = 1.2; g.stroke(); }
      st.hits.push({ id: r.id, x: q[0], y: q[1], r: 9 });
      if (sel || hov || st.zoom > 3) label(upper(r.id), q[0], q[1], { font: dispFont(9.5), ls: '0.12em', color: sel ? '#ffd3fb' : 'rgba(255,190,248,.75)', d: 8 });
    }
  }

  function drawBodies(D) {
    const { g, V, now, pulse, placed, label, W, H } = D, { P } = V;
    const bodies = st.rows.filter((r) => !r.feature && r.pos && r.discovered && visible(r) && onTab(r) && !r.moonOf);
    bodies.sort((a, b) => Math.hypot(...b.pos) - Math.hypot(...a.pos));
    // Charon is ~0.47 M from Lethe — unresolvable at this scale, so it gets a docked inset (rect reserved before labels are placed)
    const charon = st.byId.get('charon'), lethe = bodies.find((r) => r.id === 'lethe');
    let inset = null;
    if (lethe && charon && charon.discovered && visible(charon) && onTab(charon)) {
      const lp = P(lethe.pos[0], lethe.pos[1], lethe.pos[2]);
      if (lp[0] > -60 && lp[0] < W + 60 && lp[1] > -60 && lp[1] < H + 60) {
        const w = 136, hh = 130, right = lp[0] > W / 2;
        inset = { x: right ? W - w - 14 : 14, y: clamp(lp[1] - hh / 2, 70, H - hh - 56), w, hh, right, lp, lethe };
        placed.push([inset.x - 4, inset.y - 4, w + 8, hh + 8]);
      }
    }
    for (const r of bodies) {
      const q = P(r.pos[0], r.pos[1], r.pos[2]), lk = LOOK[r.id] || { kind: 'world', c: '#9fe8ff', c2: '#35607a', r: 4.5 };
      const sel = st.sel === r.id, hov = st.hover === r.id, rr = (lk.r || 4.5) * (sel || hov ? 1.18 : 1);
      if (sel) { g.beginPath(); g.arc(q[0], q[1], rr + 7 + pulse * 3, 0, TAU); g.strokeStyle = `rgba(255,255,255,${0.75 - pulse * 0.45})`; g.lineWidth = 1.3; g.stroke(); }
      if (st.cur && st.cur.id === r.id) { g.beginPath(); g.arc(q[0], q[1], rr + 12, 0, TAU); g.save(); g.setLineDash([3, 3]); g.strokeStyle = '#ff6cf0'; g.lineWidth = 1.3; g.stroke(); g.restore(); }
      drawBody(g, lk, q[0], q[1], rr, now, r.reachable);
      st.hits.push({ id: r.id, x: q[0], y: q[1], r: rr + 6 });
      const dtxt = sel && Number.isFinite(r.dist) ? `${upper(r.name)}  ·  ${fmtDist(r.dist)[0]}` : upper(r.name);
      label(dtxt, q[0], q[1], { d: rr + 5, color: sel ? '#fff' : 'rgba(214,246,255,.92)', force: sel });
    }
    if (inset) drawInset(D, inset, charon);
  }

  function drawCourse({ g, V, now, ship }) {
    const tgt = st.cur && st.byId.get(st.cur.id);
    if (ship && tgt && tgt.pos && tgt.sheet === ship.sheet && onTab(tgt) && onTab({ sheet: ship.sheet, id: '' })) {
      g.save(); g.setLineDash([6, 5]); g.lineDashOffset = -now / 50; g.strokeStyle = 'rgba(255,108,240,.85)'; g.lineWidth = 1.5; g.beginPath();
      for (let i = 0; i <= 48; i++) { const f = i / 48, q = V.P(ship.pos[0] + (tgt.pos[0] - ship.pos[0]) * f, ship.pos[1] + (tgt.pos[1] - ship.pos[1]) * f, ship.pos[2] + (tgt.pos[2] - ship.pos[2]) * f); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
      g.stroke(); g.restore();
    }
    const predRaw = safe(() => ctx.hudPred && ctx.hudPred(), null);
    const pred = (Array.isArray(predRaw) ? predRaw : predRaw && Array.isArray(predRaw.pts) ? predRaw.pts : []).map(vec3).filter(Boolean);
    if (pred.length > 1 && ship && onTab({ sheet: ship.sheet, id: '' })) {
      g.save(); g.setLineDash([4, 3]); g.strokeStyle = 'rgba(214,255,58,.9)'; g.lineWidth = 1.5; g.beginPath();
      pred.forEach((p, i) => { const q = V.P(p[0], p[1], p[2]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
      g.stroke(); g.restore();
    }
  }

  function drawShip({ g, V, ship, pulse, label }) {
    if (!ship || !onTab({ sheet: ship.sheet, id: '' })) return;
    const q = V.P(ship.pos[0], ship.pos[1], ship.pos[2]);
    const eps = Math.max(0.25, Math.hypot(...ship.pos) * 0.04);
    const q1 = V.P(ship.pos[0] + ship.fwd[0] * eps, ship.pos[1] + ship.fwd[1] * eps, ship.pos[2] + ship.fwd[2] * eps);
    let dx = q1[0] - q[0], dy = q1[1] - q[1]; const dl = Math.hypot(dx, dy);
    g.save(); g.translate(q[0], q[1]);
    g.beginPath(); g.arc(0, 0, 11 + pulse * 2.5, 0, TAU); g.strokeStyle = `rgba(255,255,255,${0.35 - pulse * 0.2})`; g.lineWidth = 1; g.stroke();
    g.shadowColor = '#fff'; g.shadowBlur = 10; g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
    if (dl > 0.6) {
      dx /= dl; dy /= dl; g.rotate(Math.atan2(dy, dx));
      g.beginPath(); g.moveTo(9, 0); g.lineTo(-5.5, -5.2); g.lineTo(-2.4, 0); g.lineTo(-5.5, 5.2); g.closePath(); g.fill();
    } else {                                               // heading along the view axis: ⊙ toward the viewer, ⊗ away
      const toward = (V.top ? ship.fwd[2] : -ship.fwd[1]) > 0;
      g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.stroke();
      if (toward) { g.beginPath(); g.arc(0, 0, 1.8, 0, TAU); g.fill(); } else { g.beginPath(); g.moveTo(-3.2, -3.2); g.lineTo(3.2, 3.2); g.moveTo(3.2, -3.2); g.lineTo(-3.2, 3.2); g.stroke(); }
    }
    g.restore();
    st.hits.push({ id: '__ship', x: q[0], y: q[1], r: 12 });
    const rho = Number.isFinite(ctx.obs && ctx.obs.r) ? ctx.obs.r : Math.hypot(...ship.pos);
    label(`ORPHEUS  ·  r ${fmtM(rho)}`, q[0], q[1], { d: 15, color: '#fff', font: '700 11px Rajdhani, sans-serif', force: true });
  }

  // tooltip for a hovered body / waypoint, or for a hovered structure outline
  function drawTooltip({ g, W, H }) {
    const hv = st.hover && st.hover !== '__ship' && st.byId.get(st.hover);
    const hs = !hv && st.hoverStruct && st.structs.find((s) => s.id === st.hoverStruct);
    if (!(hv || hs) || st.mx < 0) return;
    const lines = hv
      ? [upper(hv.discovered ? hv.name : 'UNCHARTED'), hv.discovered && Number.isFinite(hv.dist) ? fmtDist(hv.dist).join('  ·  ') : '', hv.discovered && Number.isFinite(hv.lag) ? `light-lag ${fmtLag(hv.lag)}` : '']
      : [hs.name, ...hs.info];
    const rows = lines.filter(Boolean);
    g.font = '12px "Share Tech Mono", monospace';
    const w = Math.max(...rows.map((l) => g.measureText(l).width)) + 18, hh = rows.length * 16 + 12;
    let tx = st.mx + 16, ty = st.my + 14;
    if (tx + w > W - 6) tx = st.mx - w - 12;
    if (ty + hh > H - 6) ty = st.my - hh - 10;
    g.fillStyle = 'rgba(3,12,20,.94)'; g.fillRect(tx, ty, w, hh);
    g.strokeStyle = 'rgba(134,236,255,.5)'; g.lineWidth = 1; g.strokeRect(tx + 0.5, ty + 0.5, w - 1, hh - 1);
    g.fillStyle = '#86ecff'; g.fillRect(tx, ty, 14, 2);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    rows.forEach((l, i) => { g.fillStyle = i === 0 ? '#fff' : 'rgba(170,230,250,.85)'; g.fillText(l, tx + 9, ty + 17 + i * 16); });
  }

  function drawBody(g, lk, x, y, r, now, reachable) {
    g.save(); g.translate(x, y);
    g.globalAlpha = reachable ? 1 : 0.55;
    const halo = g.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 3.2);
    halo.addColorStop(0, lk.c + '55'); halo.addColorStop(1, lk.c + '00');
    switch (lk.kind) {
      case 'station': {
        g.strokeStyle = lk.c; g.lineWidth = 1.5; g.fillStyle = 'rgba(4,18,28,.95)';
        g.beginPath(); g.arc(0, 0, 3.8, 0, TAU); g.fill(); g.stroke();
        g.beginPath(); for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.moveTo(ax * 4.8, ay * 4.8); g.lineTo(ax * 9, ay * 9); }
        g.stroke(); g.fillStyle = lk.c; g.fillRect(-1, -1, 2, 2); break;
      }
      case 'derelict': {
        const pl = 0.5 + 0.5 * Math.sin(now / 520);
        g.beginPath(); g.arc(0, 0, r + 5 + pl * 8, 0, TAU); g.strokeStyle = `rgba(255,120,80,${0.5 - pl * 0.4})`; g.lineWidth = 1.2; g.stroke();
        g.fillStyle = lk.c; g.shadowColor = lk.c; g.shadowBlur = 8; g.rotate(-0.5);
        g.beginPath(); g.moveTo(8, 0); g.lineTo(-5, -3.4); g.lineTo(-3, 0); g.lineTo(-5, 3.4); g.closePath(); g.fill(); break;
      }
      case 'crystal': {
        g.fillStyle = halo; g.beginPath(); g.arc(0, 0, r * 3.2, 0, TAU); g.fill();
        const gr = g.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r); gr.addColorStop(0, '#fff'); gr.addColorStop(0.45, lk.c); gr.addColorStop(1, lk.c2);
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
        g.strokeStyle = lk.c; g.lineWidth = 1; g.beginPath();
        for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; g.moveTo(Math.cos(a) * (r + 1), Math.sin(a) * (r + 1)); g.lineTo(Math.cos(a) * (r + 6), Math.sin(a) * (r + 6)); }
        g.stroke(); break;
      }
      case 'giant': {
        g.fillStyle = halo; g.beginPath(); g.arc(0, 0, r * 3, 0, TAU); g.fill();
        g.save(); g.rotate(-0.35); g.strokeStyle = 'rgba(210,205,255,.55)'; g.lineWidth = 1.4;
        g.beginPath(); g.ellipse(0, 0, r * 2, r * 0.62, 0, Math.PI, TAU); g.stroke(); g.restore();
        const gr = g.createLinearGradient(0, -r, 0, r); gr.addColorStop(0, lk.c); gr.addColorStop(0.5, lk.c2); gr.addColorStop(1, lk.c);
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
        g.save(); g.rotate(-0.35); g.strokeStyle = 'rgba(220,215,255,.85)'; g.lineWidth = 1.6;
        g.beginPath(); g.ellipse(0, 0, r * 2, r * 0.62, 0, 0, Math.PI); g.stroke(); g.restore(); break;
      }
      default: {
        g.fillStyle = halo; g.beginPath(); g.arc(0, 0, r * 3.2, 0, TAU); g.fill();
        const gr = g.createRadialGradient(-r * 0.35, -r * 0.35, 0, 0, 0, r * 1.05); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, lk.c); gr.addColorStop(1, lk.c2 || '#35607a');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      }
    }
    g.restore();
  }

  // Lethe + Charon at their true relative scale (rings 1.3–2.0 R, Charon at 2.41 R = 140,000 km), docked at the map edge
  function drawInset(D, ins, charon) {
    const { g, now } = D, { x: bx, y: by, w, hh, right, lp, lethe } = ins;
    const ccx = bx + w / 2, ccy = by + 78;
    const ex = right ? bx : bx + w, ey = clamp(lp[1], by + 10, by + hh - 10);
    g.save(); g.strokeStyle = 'rgba(134,236,255,.4)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(lp[0], lp[1]); g.lineTo(ex, ey); g.stroke(); g.restore();
    g.fillStyle = 'rgba(3,12,22,.92)'; g.fillRect(bx, by, w, hh);
    g.strokeStyle = 'rgba(134,236,255,.4)'; g.lineWidth = 1; g.strokeRect(bx + 0.5, by + 0.5, w - 1, hh - 1);
    g.fillStyle = '#86ecff'; g.fillRect(bx, by, 16, 2); g.fillRect(bx + w - 16, by + hh - 2, 16, 2);
    g.font = dispFont(8.5); if ('letterSpacing' in g) g.letterSpacing = '0.16em'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(134,236,255,.75)'; g.fillText('LETHE · CHARON', bx + 9, by + 12);
    g.font = '10px "Share Tech Mono", monospace'; if ('letterSpacing' in g) g.letterSpacing = '0px';
    g.fillStyle = 'rgba(170,220,240,.62)'; g.fillText('140,000 km · 6.6 h', bx + 9, by + hh - 10);
    const R0 = 14;
    drawBody(g, LOOK.lethe, ccx, ccy, R0, now, true);
    g.save(); g.strokeStyle = 'rgba(210,205,255,.3)'; g.lineWidth = 1; g.beginPath(); g.arc(ccx, ccy, R0 * 2.41, 0, TAU); g.stroke(); g.restore();
    // phase from the real position offset (top-view azimuth); falls back to the 6.6 h period
    let ang = ((st.ship ? st.ship.t : 0) / 23760) * TAU;
    if (lethe.pos && charon.pos) ang = Math.atan2(charon.pos[1] - lethe.pos[1], charon.pos[0] - lethe.pos[0]);
    const cx2 = ccx + Math.cos(ang) * R0 * 2.41, cy2 = ccy - Math.sin(ang) * R0 * 2.41;
    const sel = st.sel === 'charon', hov = st.hover === 'charon';
    if (sel) { g.beginPath(); g.arc(cx2, cy2, 8 + (0.5 + 0.5 * Math.sin(now / 420)) * 2, 0, TAU); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.2; g.stroke(); }
    drawBody(g, LOOK.charon, cx2, cy2, sel || hov ? 4 : 3.2, now, charon.reachable);
    g.font = LABEL_FONT; g.textAlign = cx2 > ccx ? 'left' : 'right';
    g.fillStyle = sel ? '#fff' : 'rgba(214,246,255,.9)'; g.fillText('CHARON', cx2 + (cx2 > ccx ? 7 : -7), cy2 - 8);
    st.hits.push({ id: 'charon', x: cx2, y: cy2, r: 9 });
  }

  // ─────────────────────────── legend ───────────────────────────
  function renderLegend() {
    const items = st.tab === 'anti'
      ? [['lg-ring', 'RING SINGULARITY'], ['lg-push', 'GRAVITY PUSHES OUT'], ['lg-way', 'WAYPOINT'], ['lg-ship', 'ORPHEUS'], ['lg-pred', 'PREDICTED PATH'], ['lg-course', 'COURSE']]
      : [['lg-hz', 'EVENT HORIZON'], ['lg-ergo', 'ERGOSPHERE'], ['lg-disk', 'ACCRETION DISK'], ['lg-ph', 'PHOTON SHELL'], ['lg-way', 'WAYPOINT'], ['lg-ship', 'ORPHEUS'], ['lg-pred', 'PREDICTED PATH'], ['lg-course', 'COURSE']];
    legendEl.replaceChildren(...items.map(([c, t]) => h('span', { class: 'lg ' + c, text: t })));
    mapTitle.replaceChildren(
      h('div', { class: 'k', text: st.tab === 'anti' ? 'ANTIVERSE · r < 0 SHEET' : 'SYSTEM MAP · EREBUS' }),
      h('div', { class: 's', text: (st.tab === 'anti' ? 'RING-CENTRED · ' : 'LOG-RADIAL · ') + (st.view === 'top' ? 'EQUATORIAL (TOP) VIEW' : 'MERIDIONAL (SIDE) VIEW') }));
  }

  // ─────────────────────────── map input ───────────────────────────
  const localXY = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const hitAt = (x, y) => {
    let best = null, bd = 1e9;
    for (const hh of st.hits) { const d = Math.hypot(hh.x - x, hh.y - y); if (d <= hh.r && d < bd) { best = hh; bd = d; } }
    return best;
  };
  const hitStruct = (x, y) => {                                   // nearest Erebus structure outline within 6.5 px
    let best = null, bd = 6.5;
    for (const s of st.structs) { const d = s.dist(x, y); if (d < bd) { bd = d; best = s; } }
    return best;
  };
  cv.addEventListener('wheel', (e) => {
    e.preventDefault(); e.stopPropagation();
    const [x, y] = localXY(e);
    zoomBy(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016)), x, y);
  }, { passive: false });
  cv.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    const [x, y] = localXY(e);
    st.drag = { x, y, px: st.panX, py: st.panY, moved: false, id: e.pointerId };
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    cv.classList.add('grab');
  });
  cv.addEventListener('pointermove', (e) => {
    const [x, y] = localXY(e);
    st.mx = x; st.my = y;
    const d = st.drag;
    if (d && d.id === e.pointerId) {
      if (Math.hypot(x - d.x, y - d.y) > 4) d.moved = true;
      if (d.moved) { st.panX = d.px + (x - d.x); st.panY = d.py + (y - d.y); }
    }
    const hit = d && d.moved ? null : hitAt(x, y);
    const id = hit ? hit.id : null;
    if (id !== st.hover) { st.hover = id; cv.classList.toggle('pick', !!id && id !== '__ship'); }
    const hs = id || (d && d.moved) ? null : hitStruct(x, y);
    st.hoverStruct = hs ? hs.id : null;
    st.dirty = true;
  });
  const endDrag = (e) => {
    const d = st.drag; if (!d || d.id !== e.pointerId) return;
    st.drag = null; cv.classList.remove('grab');
    try { cv.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (!d.moved) { const hit = hitAt(...localXY(e)); if (hit && hit.id !== '__ship') select(hit.id); }
  };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('pointerleave', () => { st.mx = -1; st.my = -1; st.hover = null; st.hoverStruct = null; cv.classList.remove('pick'); st.dirty = true; });
  cv.addEventListener('dblclick', (e) => { const hit = hitAt(...localXY(e)); if (!hit) fit(); });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { st.dirty = true; }).observe(mapEl);

  // ─────────────────────────── keyboard ───────────────────────────
  function onKey(e) {
    const c = e.code;
    if (c === 'Escape' || (closeKeys.has(c) && !e.repeat)) { if (!e.repeat) close(); return; }
    switch (c) {
      case 'ArrowDown': move(1); return;
      case 'ArrowUp': move(-1); return;
      case 'PageDown': move(4); return;
      case 'PageUp': move(-4); return;
      case 'Equal': case 'NumpadAdd': zoomBy(1.18); return;
      case 'Minus': case 'NumpadSubtract': zoomBy(1 / 1.18); return;
      case 'ArrowRight': if (!e.repeat) stepSite(1); return;
      case 'ArrowLeft': if (!e.repeat) stepSite(-1); return;
    }
    if (e.repeat) return;
    switch (c) {
      case 'Enter': case 'NumpadEnter': course(); return;
      case 'KeyT': target(); return;
      case 'KeyX': case 'Delete': case 'Backspace': clearNav(); return;
      case 'KeyV': setView(st.view === 'top' ? 'side' : 'top'); sfx('click'); return;
      case 'Tab': setTab(st.tab === 'sys' ? 'anti' : 'sys', true); return;
      case 'KeyL': openLog(); return;
      case 'KeyF': focusSel(); return;
      case 'KeyG': focusShip(); return;
      case 'Digit0': case 'Numpad0': case 'Home': fit(); return;
      case 'Digit1': setTab('sys', true); return;
      case 'Digit2': setTab('anti', true); return;
    }
  }

  // ─────────────────────────── open / close / loop ───────────────────────────
  // a data or draw pass that throws (bad module data) is reported once and must never take the screen down with it
  let warned = false;
  const guarded = (fn, ...a) => { try { fn(...a); } catch (err) { if (!warned) { warned = true; console.error('[navmap]', err); } } };
  function loop(now) {
    if (!st.open) return;
    st.raf = requestAnimationFrame(loop);
    if (now - st.lastData >= 250) { st.lastData = now; guarded(refreshData); st.dirty = true; }
    if (st.dirty || now - st.lastDraw >= 120) { st.lastDraw = now; st.dirty = false; guarded(draw, now); }
  }

  function open(o = {}) {
    if (!st.open) {
      st.open = true;
      clearTimeout(st.hideTimer);
      root.style.display = 'flex'; void root.offsetWidth; root.classList.add('open');
      openModal(modal, ctx);
      const s = readShip();
      st.sheet = s ? s.sheet : 1;
      st.tab = '';                                          // force the tab switch below to reset the camera
      st.mx = -1; st.my = -1; st.hover = null; st.hoverStruct = null;
      setTab(st.sheet < 0 ? 'anti' : 'sys', false);
      renderLegend();
    }
    if (o.view) setView(o.view);
    if (o.tab) setTab(o.tab, true);
    guarded(refreshData, true);
    if (o.select) select(o.select);
    else { const ref = rowRefs.get(st.sel); if (ref) ref.el.scrollIntoView({ block: 'nearest' }); }   // show the pre-selected destination
    resize();
    st.lastData = performance.now(); st.dirty = true;
    cancelAnimationFrame(st.raf);
    st.raf = requestAnimationFrame(loop);
  }
  function close() {
    if (!st.open) return;
    st.open = false;
    cancelAnimationFrame(st.raf);
    root.classList.remove('open');
    st.hideTimer = setTimeout(() => { if (!st.open) root.style.display = 'none'; }, 170);
    closeModal(modal);
  }

  renderLegend();
  return { open, close, toggle: () => (st.open ? close() : open()), isOpen: () => st.open };
}

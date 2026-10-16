// ENGINEERING (z 31..38): the DRIVE CORE (torus + column), reaction chamber seen through the aft viewport, coolant plumbing, reactor console.
// Geometry lives in chunk files: eng_core.js (torus/column), eng_chamber.js (viewport + chamber), eng_pipes.js (plumbing), eng_gear.js (lockers etc.).
// Per-frame glow state is computed once here (D) from kit.state.thrust / boost / mode and shared with the chunks.
import * as S from './screens.js';
import { frame, defMats, modeK, smooth } from './bay_util.js';
import core from './eng_core.js';
import chamber from './eng_chamber.js';
import pipes from './eng_pipes.js';
import gear from './eng_gear.js';

export default function build(kit) {
  defMats(kit);
  const eur = kit.eur;
  const E = { cx: 0, cz: 34.5, cy: 0.1, R: 1.3, rr: 0.3, ZF: 31.075, ZA: 37.925, WX: 3.525 };   // torus centre/radii, inner wall faces
  const D = { lvl: 0, mk: 1, ms: 1, fail: 0, flick: 1 };
  kit.onUpdate((dt, t, s) => {
    D.lvl = smooth(D.lvl, Math.min(1.35, s.thrust + 0.35 * s.boost), dt, 2.4);
    D.mk = modeK(s, 'core'); D.ms = modeK(s, 'status'); D.flick = s.flicker;
    const b = Math.max(0, Math.sin(t * 2.1 + 1.3) * Math.sin(t * 5.3 + 0.4));
    D.fail = Math.min(1, (s.flicker < 0.3 ? 0.55 : 0) + b * b * b * 0.7);        // derelict: sparse residual bursts
  });
  const errs = [], safe = (name, fn) => { try { fn(); } catch (e) { errs.push(`${name}: ${e && e.message}`); console.error(`[engineering] ${name} failed`, e); } };
  safe('core', () => core(kit, E, D)); safe('chamber', () => chamber(kit, E, D)); safe('pipes', () => pipes(kit, E, D)); safe('gear', () => gear(kit, E, D)); safe('console', () => reactorConsole(kit, E, D));
  for (const [id, x, z] of [['eng.fs', 2.3, 33.0], ['eng.fp', -2.3, 33.0], ['eng.as', 2.3, 36.0], ['eng.ap', -2.3, 36.0]]) kit.light(id, [x, 1.1, z], { color: 0xffc18c, k: 0.7 });   // stock site sits inside the torus: add the ceiling-panel positions
  if (errs.length) throw new Error(errs.join(' | '));   // surfaces in ship.errors; geometry from the chunks that succeeded is kept
}

// ───────────────────────── reactor console (starboard wall) ─────────────────────────
function reactorConsole(kit, E, D) {
  const FLOOR = kit.L.FLOOR, eur = kit.eur, th = 0.5, sin = Math.sin(th), cos = Math.cos(th);
  const F = frame(kit, [E.WX - 0.005, FLOOR, 34.3], -Math.PI / 2);          // local +z = toward the room (−x), +x = aft, y = 0 at the deck
  const rotX = (f, rx) => { const q = f.Qo({ rx }); const e = new kit.THREE.Euler().setFromQuaternion(q, 'XYZ'); return [e.x, e.y, e.z]; };
  const mods = [
    { x: -1.2, w: 1.16, name: 'COOLANT', draw: mkCool(kit, D), tw: 'COOLANT LOOPS' },
    { x: 0, w: 1.16, name: 'REACTOR', draw: mkPower(kit, D), tw: 'TORUS FIELD' },
    { x: 1.2, w: 1.16, name: 'DRIVE', draw: drawThrust(kit, D), tw: 'DRIVE' },
  ];
  mods.forEach((m, i) => {
    const f = F.sub([m.x, 0, 0], 0), w = m.w;
    f.box('trim', [0, 0.05, 0.33], [w, 0.1, 0.66], { bev: 0.008 });
    f.box('white', [0, 0.46, 0.31], [w - 0.02, 0.72, 0.6], { bev: 0.012 });
    f.box('paintOrange', [0, 0.16, 0.612], [w - 0.06, 0.05, 0.006], { bev: 0 });
    f.box('plasticDark', [0, 0.855, 0.35], [w + 0.02, 0.04, 0.72], { bev: 0.008 });
    f.box('trim', [0, 0.885, 0.74], [w + 0.02, 0.025, 0.03], { bev: 0.004 });
    f.box('emitStrip', [0, 0.873, 0.727], [w - 0.12, 0.008, 0.008], { bev: 0 });
    f.sign(m.name, [0, 0.55, 0.6125], { w: 0.5, h: 0.09, style: 'door' });
    for (let k = 0; k < 6; k++) f.box('trim', [-0.45 + k * 0.03, 0.28, 0.6125], [0.016, 0.006, 0.004], { bev: 0 });
    // sloped screen panel + main screen
    f.box('plasticDark', [0, 1.01, 0.218], [w - 0.04, 0.04, 0.46], { bev: 0.006, rx: th });
    for (const sx of [-1, 1]) f.box('trim', [sx * (w / 2 - 0.02), 1.0, 0.218], [0.03, 0.2, 0.46], { bev: 0.006 });
    kit.screen({ id: 'eng.' + m.name.toLowerCase(), pos: f.P(0, 1.01 + 0.022 * cos, 0.218 + 0.022 * sin), rot: rotX(f, th - Math.PI / 2), size: [0.6, 0.34], res: [400, 226], range: 9, draw: m.draw });
    // back riser, upper screen (centre module only), hood
    f.box('white', [0, 1.55, 0.04], [w, 0.82, 0.08], { bev: 0.01 });
    f.box('trim', [0, 1.97, 0.12], [w + 0.04, 0.05, 0.26], { bev: 0.008 });
    f.box('emitStrip', [0, 1.94, 0.2], [w - 0.3, 0.012, 0.01], { bev: 0 });
    if (i === 1) kit.screen({ id: 'eng.field', pos: f.P(0, 1.56, 0.083), rot: [0, -Math.PI / 2, 0], size: [0.62, 0.36], res: [400, 232], range: 9, draw: mkField(kit, D) });
    else {
      f.box('plasticDark', [0, 1.52, 0.085], [0.78, 0.4, 0.012], { bev: 0.004 });
      for (let k = 0; k < 15; k++) { const hh = 0.03 + 0.24 * Math.abs(Math.sin(k * 1.7 + i * 2.3)); if (eur && k % 7 !== 3) continue; f.box(eur ? kit.led('Red', 'Rand') : k % 5 === 4 ? 'emitAmber' : 'emitCyan', [-0.35 + k * 0.05, 1.34 + hh / 2, 0.093], [0.028, eur ? 0.03 : hh, 0.006], { bev: 0 }); }
      f.sign(m.tw, [0, 1.84, 0.092], { w: 0.5, h: 0.08, style: i === 0 ? 'plate' : 'warn' });
    }
    // switch bank + dials on the desk
    for (let k = 0; k < 8; k++) { f.box('trim', [-0.47 + k * 0.062, 0.88, 0.56], [0.026, 0.012, 0.04], { bev: 0.003 }); f.box('steel', [-0.47 + k * 0.062, 0.9, 0.56], [0.008, 0.035, 0.008], { bev: 0, rx: (k % 3 - 1) * 0.5 }); f.box(kit.led(eur ? 'Red' : k % 4 === 0 ? 'Amber' : 'Green', k === 5 ? 'Blink' : ''), [-0.47 + k * 0.062, 0.874, 0.625], [0.014, 0.004, 0.014], { bev: 0 }); }
    for (let k = 0; k < 3; k++) { f.cyl('trim', [0.12 + k * 0.1, 0.89, 0.5], 0.028, 0.03, { seg: 10 }); f.box('paintOrange', [0.12 + k * 0.1, 0.907, 0.51], [0.006, 0.004, 0.02], { bev: 0 }); }
    if (i === 2) { f.cyl('abYellow', [-0.35, 0.885, 0.46], 0.055, 0.02, { seg: 14 }); f.cyl('abRed', [-0.35, 0.91, 0.46], 0.038, 0.03, { seg: 14 }); f.box('glassTint', [-0.35, 0.93, 0.46], [0.13, 0.06, 0.13], { bev: 0.004 }); f.sign('SCRAM', [-0.35, 0.72, 0.6125], { w: 0.16, h: 0.05, style: 'red' }); }
    if (i === 2 && !eur) {   // lived-in: a mission mug and a tablet left on the drive desk
      f.cyl('white', [0.47, 0.92, 0.5], 0.04, 0.09, { seg: 14 }); f.cyl('paintOrange', [0.47, 0.94, 0.5], 0.0415, 0.02, { seg: 14 }); f.cyl('abCrateTan', [0.47, 0.9675, 0.5], 0.034, 0.004, { seg: 14 }); f.torus('white', [0.515, 0.92, 0.5], 0.027, 0.007, { axis: 'x', tube: 4, seg: 10 });
      f.box('plasticDark', [0.18, 0.884, 0.62], [0.22, 0.012, 0.15], { bev: 0.004, ry: 0.35 }); f.box('emitCyan', [0.18, 0.891, 0.62], [0.19, 0.002, 0.12], { bev: 0, ry: 0.35 });
    }
  });
  F.col([0, 0.95, 0.35], [3.6, 1.9, 0.7]);
  kit.interact({ id: 'engineering.console', label: 'Reactor console', pos: F.P(0, 1.1, 0.6), radius: 2.3, hit: { c: F.P(0, 1.0, 0.35), s: [0.75, 2.0, 3.7] } });
  if (eur) kit.recorder(5, F.P(-1.5, 0.88 + 0.025, 0.42), -Math.PI / 2);
}

// ───────────────────────── screens ─────────────────────────
function mkPower(kit, D) {
  const hist = new Array(80).fill(0.1); let last = -1;
  return (g, w, h, t) => {
    const C = S.C, lvl = D.lvl;
    if (t - last > 0.22) { last = t; hist.shift(); hist.push(Math.min(1, 0.12 + 0.7 * lvl + 0.04 * Math.sin(t * 3.1) + 0.02 * Math.random())); }
    const r = S.base(g, w, h, t, { title: 'REACTOR OUTPUT', sub: 'UNIT 1 · D–He³' }), hot = lvl > 0.04;
    S.line(g, r.x, r.y + 4, r.w * 0.62, r.h * 0.62, (u) => hist[Math.round(u * (hist.length - 1))], hot ? C.amber : C.cy, 80);
    S.table(g, r.x + r.w * 0.66, r.y + 20, [['OUTPUT', (0.4 + 11.6 * lvl).toFixed(2) + ' TW', hot ? C.amber : C.ink], ['FIELD', (7.9 + 1.6 * lvl).toFixed(2) + ' T'], ['Q', (38 + 12 * lvl).toFixed(1)], ['FUEL', '91.4 %'], ['CORE', (1.9 + 3.4 * lvl).toFixed(1) + ' MK']], { size: 14, gap: 8, colW: 62 });
    S.mono(g, hot ? 'BURN ' + Math.round(Math.min(1, lvl) * 100) + '%' : 'IDLE · PLASMA STABLE', r.x, h - 16, 17, hot ? C.amber : C.green, 'left', 800);
    S.bars(g, r.x + r.w * 0.5, h - 40, r.w * 0.5, 24, [0.3, 0.45, 0.2 + lvl * 0.7, 0.5, 0.3 + lvl * 0.6, 0.4, 0.25 + lvl * 0.5, 0.35, 0.5, 0.3], hot ? C.amber : C.cy);
  };
}
function mkCool(kit, D) {
  return (g, w, h, t) => {
    const C = S.C, lvl = D.lvl, r = S.base(g, w, h, t, { title: 'COOLANT LOOPS', sub: 'A · B · C' }), names = ['LOOP A', 'LOOP B', 'LOOP C', 'RAD-1', 'RAD-2', 'HX-1'];
    names.forEach((n, i) => {
      const y = r.y + 8 + i * 25, temp = 290 + 60 * i * 0.3 + (70 + 90 * i * 0.15) * Math.min(1, lvl) + 3 * Math.sin(t * 0.9 + i);
      S.mono(g, n, r.x, y + 12, 14, C.cy); g.fillStyle = C.cyf; g.fillRect(r.x + 70, y, r.w * 0.5, 14); const f = Math.min(1, (temp - 280) / 220);
      g.fillStyle = f > 0.75 ? C.amber : C.cy; g.fillRect(r.x + 70, y, r.w * 0.5 * f, 14); S.mono(g, Math.round(temp) + ' K', r.x + 80 + r.w * 0.5, y + 12, 14, C.ink);
    });
    S.ring(g, w - 56, r.y + 62, 34, 0.55 + 0.3 * Math.min(1, lvl), lvl > 0.5 ? C.amber : C.cy, 6); S.mono(g, 'PRESS', w - 56, r.y + 66, 12, C.ink, 'center');
  };
}
function drawThrust(kit, D) {
  return (g, w, h, t) => {
    const C = S.C, s = kit.state, r = S.base(g, w, h, t, { title: 'DRIVE STATUS', sub: 'TORCH-1' }), th = Math.round(s.thrust * 100), hot = s.thrust > 0.02;
    S.mono(g, th + '%', r.x + 4, r.y + 62, 58, hot ? C.amber : C.cy, 'left', 800); S.mono(g, 'THRUST', r.x + 6, r.y + 82, 14, C.cyd);
    g.fillStyle = C.cyf; g.fillRect(r.x, r.y + 96, r.w, 18); g.fillStyle = hot ? C.amber : C.cy; g.fillRect(r.x, r.y + 96, r.w * s.thrust, 18);
    g.fillStyle = C.mag; g.fillRect(r.x + r.w * Math.min(1, s.boost) - 2, r.y + 92, 4, 26);
    S.mono(g, 'BOOST ' + Math.round(s.boost * 100) + '%', r.x, r.y + 138, 15, s.boost > 0.02 ? C.mag : C.cyd, 'left', 700);
    S.mono(g, s.landed ? 'GROUND CONTACT · DRIVE SAFE' : (hot ? 'DRIVE ACTIVE' : 'DRIVE STANDBY'), r.x, h - 16, 16, s.landed ? C.amber : hot ? C.amber : C.green, 'left', 800);
    S.ring(g, w - 52, r.y + 54, 34, Math.min(1, D.lvl), hot ? C.amber : C.cy, 6);
  };
}
function mkField(kit, D) {
  return (g, w, h, t) => {
    const C = S.C, lvl = D.lvl, r = S.base(g, w, h, t, { title: 'TORUS DIAGNOSTICS', sub: '16 COILS' });
    const vals = Array.from({ length: 16 }, (_, i) => 0.55 + 0.25 * Math.sin(t * 1.2 + i * 0.9) * (0.3 + lvl) + 0.2 * Math.min(1, lvl));
    S.bars(g, r.x, r.y + 8, r.w, r.h * 0.5, vals, lvl > 0.04 ? C.amber : C.cy);
    S.mono(g, 'COIL CURRENT  ' + (4.1 + 7 * lvl).toFixed(1) + ' kA', r.x, r.y + r.h * 0.5 + 34, 15, C.ink, 'left', 700);
    S.mono(g, 'SLIT TEMP  ' + Math.round(1900 + 3400 * Math.min(1, lvl)) + ' K', r.x, r.y + r.h * 0.5 + 56, 15, C.cy, 'left');
  };
}

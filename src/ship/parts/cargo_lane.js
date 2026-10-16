// CARGO BAY — ventral ramp lane edging (hazard bands, kick rails, chain barrier, lane lamps), ramp control console, floor paint.
import * as THREE from 'three';
import * as S from './screens.js';
import { frame, dynSink, basicMat, modeK, floorDecal, paint } from './bay_util.js';

const D2R = 180 / Math.PI;

export default function lane(kit, C) {
  const L = kit.L, FLOOR = L.FLOOR, CEIL = L.CEIL, eur = kit.eur, ZA = C.ZA, W = frame(kit, [0, 0, 0], 0);
  const R = kit.rand(0xca96);

  // ───────── hazard bands, kick rails, brackets ─────────
  for (const sx of [-1, 1]) {
    W.box('hazard', [sx * 1.46, FLOOR + 0.006, (25.2 + ZA) / 2], [0.32, 0.012, ZA - 25.2], { bev: 0 });
    W.box('trim', [sx * 1.325, FLOOR + 0.045, (25.55 + ZA - 0.1) / 2], [0.05, 0.09, ZA - 0.1 - 25.55], { bev: 0.006 });
    for (let z = 25.9; z < ZA - 0.2; z += 0.75) W.box('darkMetal', [sx * 1.375, FLOOR + 0.03, z], [0.05, 0.06, 0.07], { bev: 0.004 });
    W.box('trim', [sx * 1.625, FLOOR + 0.007, (25.2 + ZA) / 2], [0.02, 0.014, ZA - 25.2], { bev: 0 });
  }
  W.box('hazard', [0, FLOOR + 0.006, 25.05], [2.6, 0.012, 0.3], { bev: 0 });
  W.box('trim', [0, FLOOR + 0.007, 24.89], [2.6, 0.014, 0.02], { bev: 0 });

  // ───────── chain barrier posts (colliders), plastic chain, RAMP plates ─────────
  const postZ = [27.3, 28.4, 29.5, 30.6];
  for (const sx of [-1, 1]) {
    const x = sx * 1.5;
    postZ.forEach((z, i) => {
      W.box('steel', [x, FLOOR + 0.008, z], [0.16, 0.016, 0.16], { bev: 0.004 });
      for (const [dx, dz] of [[-0.055, -0.055], [0.055, -0.055], [-0.055, 0.055], [0.055, 0.055]]) W.cyl('steel', [x + dx, FLOOR + 0.018, z + dz], 0.011, 0.01, { seg: 6 });
      W.cyl('abYellow', [x, FLOOR + 0.46, z], 0.03, 0.9, { seg: 10 });
      W.cyl('rubber', [x, FLOOR + 0.64, z], 0.033, 0.11, { seg: 10 }); W.cyl('rubber', [x, FLOOR + 0.3, z], 0.033, 0.11, { seg: 10 });
      W.sph('abYellow', [x, FLOOR + 0.92, z], 0.043, { seg: 10 });
      kit.colCyl([x, FLOOR + 0.5, z], 0.06, 1.0);
      if (i < postZ.length - 1) {
        const z2 = postZ[i + 1], sag = eur && i === 1 ? 0.5 : 0.11;
        W.tube('abYellow', [[x, FLOOR + 0.82, z + 0.03], [x, FLOOR + 0.82 - sag * 0.6, z + (z2 - z) * 0.25], [x, FLOOR + 0.82 - sag, (z + z2) / 2], [x, FLOOR + 0.82 - sag * 0.6, z + (z2 - z) * 0.75], [x, FLOOR + 0.82, z2 - 0.03]], 0.011, { seg: 18, rseg: 6 });
      }
      if (i === 0 || i === 2) {
        W.box('darkMetal', [x + sx * 0.04, FLOOR + 0.6, z], [0.012, 0.11, 0.3], { bev: 0.003 });
        kit.sign('RAMP', [x + sx * 0.0466, FLOOR + 0.6, z], { w: 0.28, h: 0.09, style: 'warn', rot: [0, sx * Math.PI / 2, 0] });
      }
    });
  }
  // wall stencils above the lane: big RAMP marker + zone label on the aft bulkhead, chevron plate on the forward end
  W.st('ramp', [0, 0.42, ZA - 0.004], [1.3, 0.406], { ry: Math.PI });
  W.st('rampzone', [0, 0.14, ZA - 0.004], [1.3, 0.183], { ry: Math.PI });
  kit.sign('RAMP — KEEP CLEAR WHEN LOWERING', [0, -0.12, ZA - 0.012], { w: 1.2, h: 0.14, style: 'warn', rot: [0, Math.PI, 0] });
  for (const sx of [-1, 1]) {   // ceiling-edge hazard band over the lane
    W.box('hazard', [sx * 1.3, CEIL - 0.02, 27.95], [0.1, 0.04, 6.0], { bev: 0 });
  }

  // ───────── floor tie-down rings (recessed D-rings on the catwalks) ─────────
  for (const [x, z] of C.rings) {
    W.box('trim', [x, FLOOR + 0.004, z], [0.15, 0.008, 0.15], { bev: 0 });
    W.torus('steel', [x, FLOOR + 0.02, z], 0.04, 0.008, { axis: 'y', tube: 4, seg: 10, ry: 0 });
    W.box('steel', [x, FLOOR + 0.012, z - 0.045], [0.04, 0.014, 0.012], { bev: 0 });
  }

  // ───────── dynamic lane lamps + ceiling beacons (follow ramp state + light mode) ─────────
  const laneMat = basicMat(1, 0.5, 0.1);
  {
    const sk = dynSink(), F = frame(kit, [0, 0, 0], 0, sk);
    for (const sx of [-1, 1]) for (let z = 25.55; z < ZA - 0.2; z += 0.8) F.box('x', [sx * 1.69, FLOOR + 0.008, z], [0.06, 0.016, 0.12], { bev: 0 });
    for (const z of [25.5, 30.4]) F.sph('x', [0, CEIL - 0.05, z], 0.085, { seg: 12, th: Math.PI / 2, rx: Math.PI });
    kit.mesh(sk.build(), laneMat, { name: 'laneLamps' });
    for (const z of [25.5, 30.4]) { W.cyl('trim', [0, CEIL - 0.022, z], 0.1, 0.044, { seg: 14 }); W.box('hazard', [0, CEIL - 0.012, z], [0.32, 0.012, 0.32], { bev: 0 }); }
  }
  kit.onUpdate((dt, t, s) => {
    const moving = Math.abs(s.rampWant - s.rampOpen) > 0.015, open = s.rampOpen > 0.97 && s.rampWant > 0.5;
    let k = 0.45, r = 1, g = 0.5, b = 0.1;
    if (moving) k = Math.sin(t * 9) > 0 ? 3.2 : 0.3; else if (open) { r = 0.15; g = 1; b = 0.3; k = 1.7; }
    k *= modeK(s, 'status') * (eur ? s.flicker * 0.7 : 1);
    laneMat.color.setRGB(r * k, g * k, b * k);
  });

  rampConsole(kit, C, laneMat);
  floorPaint(kit, C);
}

// ───────────────────────── ramp control console ─────────────────────────
function rampConsole(kit, C, laneMat) {
  const L = kit.L, FLOOR = L.FLOOR, eur = kit.eur, st = kit.state;
  const F = frame(kit, [2.075, FLOOR, 25.6], -Math.PI / 2);   // local +z = toward the lane (operator side), +x = aft, y=0 floor
  const th = 0.559, sin = Math.sin(th), cos = Math.cos(th);
  F.box('trim', [0, 0.05, 0], [1.1, 0.1, 0.47], { bev: 0.008 });
  F.box('white', [0, 0.46, 0], [1.04, 0.72, 0.42], { bev: 0.01 });
  F.box('plasticDark', [0, 0.835, 0.025], [1.08, 0.03, 0.5], { bev: 0.006 });
  for (const x of [-0.26, 0.26]) F.box('trim', [x, 0.46, 0.214], [0.008, 0.66, 0.006], { bev: 0 });
  F.box('paintOrange', [0, 0.16, 0.214], [1.0, 0.05, 0.006], { bev: 0 });
  for (let i = 0; i < 6; i++) F.box('trim', [-0.43 + i * 0.03, 0.62, 0.214], [0.016, 0.006, 0.006], { bev: 0 });   // vent slats
  F.sign(eur ? 'CARGO RAMP · HYD' : 'CARGO RAMP · HYD', [0.0, 0.34, 0.216], { w: 0.5, h: 0.09, style: 'door' });
  F.sign('AUTHORISED CREW', [0.33, 0.62, 0.216], { w: 0.3, h: 0.07, style: 'warn' });
  // sloped panel
  F.box('plasticDark', [0, 0.97, -0.045], [1.04, 0.04, 0.4], { bev: 0.006, rx: th });
  F.box('trim', [0, 0.86, 0.135], [1.04, 0.025, 0.03], { bev: 0.004 });
  F.box('white', [0, 1.28, -0.2], [1.08, 0.46, 0.06], { bev: 0.01 });
  F.box('trim', [0, 1.52, -0.2], [1.1, 0.03, 0.08], { bev: 0.006 });
  for (const sx of [-1, 1]) F.box('trim', [sx * 0.535, 1.02, -0.045], [0.03, 0.13, 0.4], { bev: 0.006 });
  F.sign('RAMP CONTROL', [0, 1.3, -0.168], { w: 0.5, h: 0.09, style: 'door' });
  // main screen (tilted with the panel); position on the slope surface
  const sc = [0.0, 0.97 + 0.02 * cos + 0.03 * sin + 0.003, -0.045 + 0.02 * sin - 0.03 * cos];
  kit.screen({ id: 'cargo.ramp', pos: F.P(...sc), rot: rotXYZ(F, { rx: th - Math.PI / 2 }), size: [0.5, 0.3], res: [400, 240], range: 8, draw: (g, w, h, t) => drawRamp(g, w, h, t, kit) });
  // left LED column
  const surf = (x, zl, lift = 0.02) => [x, 0.97 + lift * cos - zl * sin, -0.045 + lift * sin + zl * cos];
  const labels = ['PUMP', 'LOCK', 'SEAL', 'CLEAR', 'HYD', 'PWR'];
  labels.forEach((lb, i) => {
    const p = surf(-0.435, 0.14 - i * 0.055, 0.024);
    F.box(kit.led(eur ? 'Red' : (i === 3 ? 'Amber' : 'Green'), i === 3 ? 'Blink' : ''), p, [0.022, 0.006, 0.022], { bev: 0, rx: th });
  });
  // right: two guarded buttons (LOWER amber, RAISE green) + e-stop
  [[0.4, 0.075, eur ? 'plasticDark' : 'emitAmber', true], [0.4, -0.085, eur ? 'plasticDark' : 'emitGreen', false]].forEach(([x, zl, m, guardDown]) => {
    const p = surf(x, zl, 0.012);
    F.cyl('trim', p, 0.05, 0.026, { rx: th, seg: 14 });
    F.cyl(m, surf(x, zl, 0.034), 0.036, 0.022, { rx: th, seg: 14 });
    const gp = surf(x, zl - 0.07, 0.03);
    if (guardDown) F.box('plasticDark', surf(x, zl, 0.056), [0.11, 0.012, 0.1], { bev: 0.003, rx: th });
    else F.box('plasticDark', [gp[0], gp[1] + 0.045, gp[2] - 0.02], [0.11, 0.012, 0.09], { bev: 0.003, rx: th - 1.25 });
    F.box('trim', surf(x + 0.07, zl, 0.018), [0.02, 0.012, 0.03], { bev: 0, rx: th });
  });
  F.cyl('abYellow', [0.45, 0.865, 0.2], 0.055, 0.03, { seg: 14 });
  F.cyl('abRed', [0.45, 0.895, 0.2], 0.04, 0.035, { seg: 14 });
  F.sph('abRed', [0.45, 0.915, 0.2], 0.04, { seg: 12, th: Math.PI / 2 });
  F.sign('E-STOP', [0.45, 0.72, 0.216], { w: 0.14, h: 0.05, style: 'red' });
  // switch bank on the ledge
  for (let i = 0; i < 5; i++) { F.box('trim', [-0.2 + i * 0.07, 0.862, 0.2], [0.026, 0.012, 0.03], { bev: 0.002 }); F.box('steel', [-0.2 + i * 0.07, 0.88, 0.2], [0.008, 0.03, 0.008], { bev: 0, rx: i % 2 ? 0.4 : -0.4 }); }
  // beacon (dynamic lens in laneMat colours) + status lamps on the hood
  F.cyl('trim', [-0.4, 1.56, -0.2], 0.06, 0.03, { seg: 14 });
  const sk = dynSink(); frame(kit, [0, 0, 0], 0, sk).sph('x', F.P(-0.4, 1.575, -0.2), 0.052, { seg: 14, th: Math.PI / 2 });
  kit.mesh(sk.build(), laneMat, { name: 'rampBeacon' });
  for (let i = 0; i < 3; i++) F.cyl(kit.led(eur ? 'Red' : ['Green', 'Amber', 'Cyan'][i], i === 1 ? 'Blink' : ''), [0.3 + i * 0.08, 1.4, -0.168], 0.02, 0.01, { axis: 'z', seg: 10 });
  // cable run from the hood to the wall
  F.tube('rubber', [[0.3, 1.5, -0.22], [0.3, 1.6, -0.3], [0.6, 1.6, -0.5], [1.1, 1.4, -0.52]], 0.018, { seg: 12, rseg: 5 });
  F.col([0, 0.7, 0], [1.1, 1.4, 0.5]);
  kit.interact({ id: 'cargo.ramp', label: 'Cargo ramp controls', pos: F.P(0, 1.05, 0.2), radius: 1.9, hit: { c: F.P(0, 0.75, 0), s: [0.5, 1.5, 1.1] } });
  if (eur) kit.recorder(6, F.P(-0.36, 0.875 + 0.0, 0.2), -Math.PI / 2);
}
const rotXYZ = (F, o) => { const e = new THREE.Euler().setFromQuaternion(F.Qo(o), 'XYZ'); return [e.x, e.y, e.z]; };

function drawRamp(g, w, h, t, kit) {
  const s = kit.state, L = kit.L, C = S.C, rw = s.rampWant, ro = s.rampOpen, moving = Math.abs(rw - ro) > 0.015;
  const r = S.base(g, w, h, t, { title: 'CARGO RAMP', sub: 'HYD-2 · ' + (s.landed ? 'LANDED' : 'AIRBORNE') });
  const state = moving ? (rw > ro ? 'LOWERING' : 'RAISING') : ro > 0.5 ? 'LOWERED' : 'STOWED';
  const col = moving ? C.amber : ro > 0.5 ? C.green : C.cy;
  S.mono(g, 'RAMP: ' + state, 16, r.y + 38, 34, col, 'left', 800);
  const ang = ro * L.RAMP.angle * D2R;
  S.mono(g, 'ANGLE ' + ang.toFixed(1) + '°', 16, r.y + 62, 16, C.ink, 'left');
  // ramp profile diagram
  const x0 = 18, y0 = r.y + 112, len = 150, a = ro * L.RAMP.angle;
  g.strokeStyle = C.cyd; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 - 6, y0); g.lineTo(x0 + len + 30, y0); g.stroke();
  g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.moveTo(x0, y0 - 10); g.lineTo(x0 + Math.cos(a) * len, y0 - 10 + Math.sin(a) * len * 1.0); g.stroke();
  g.fillStyle = C.cyd; g.fillRect(x0 - 8, y0 - 18, 10, 18);
  // pressure
  const press = moving ? 2150 + 160 * Math.sin(t * 7) : 2995 + 6 * Math.sin(t * 1.3);
  S.mono(g, 'HYD PRESSURE', w - 16, r.y + 34, 14, C.cyd, 'right');
  S.mono(g, Math.round(press) + ' psi', w - 16, r.y + 58, 26, moving ? C.amber : C.ink, 'right', 800);
  S.bars(g, w - 150, r.y + 70, 134, 20, [0.4, 0.55, 0.62, press / 3300, 0.7, 0.66, press / 3300, 0.72], moving ? C.amber : C.cy);
  const rows = [['GROUND CONTACT', s.landed && ro > 0.9 ? 'YES' : 'NO', s.landed && ro > 0.9 ? C.green : C.cyd], ['INTERLOCK', s.landed ? 'RELEASED' : 'AIRBORNE · INHIBIT', s.landed ? C.green : C.amber], ['LANE', 'CLEAR', C.green], ['LOCK PINS', ro < 0.02 ? 'ENGAGED' : 'RELEASED', C.ink]];
  S.table(g, w - 230 + 40, r.y + 118, rows, { size: 14, gap: 7, colW: 118 });
  g.fillStyle = C.cyf; g.fillRect(16, h - 30, w - 32, 1);
  S.mono(g, moving ? 'HYDRAULICS ACTIVE — STAND CLEAR' : s.landed ? (ro > 0.5 ? 'RAMP CLEAR TO TRAVERSE' : 'PRESS LOWER TO DEPLOY') : 'LANDING REQUIRED TO LOWER', 16, h - 12, 15, moving ? C.amber : s.landed ? C.green : C.amber, 'left');
}

// ───────────────────────── floor paint (aisles, ring IDs, cradle outline, text) ─────────────────────────
function floorPaint(kit, C) {
  const L = kit.L, FLOOR = L.FLOOR, eur = kit.eur, P = paint;
  floorDecal(kit, {
    x0: -3.6, x1: 3.6, z0: 24.0, z1: 31.0, y: FLOOR + 0.003, px: 224, name: 'cargoFloorPaint',
    draw(g, W, H, X, Z, px) {
      const seg = (x1, z1, x2, z2, w, col, dash) => { g.save(); g.strokeStyle = col; g.lineWidth = w * px; if (dash) g.setLineDash(dash.map((d) => d * px)); g.beginPath(); g.moveTo(X(x1), Z(z1)); g.lineTo(X(x2), Z(z2)); g.stroke(); g.restore(); };
      const ftxt = (s, x, z, size, col, o = {}) => { g.save(); g.translate(X(x), Z(z)); g.rotate(o.rot != null ? o.rot : Math.PI); P.txt(g, s, 0, 0, size * px, col, o); g.restore(); };   // readable from the entry door
      // aisle edge lines
      for (const sx of [-1, 1]) seg(sx * 1.75, 25.3, sx * 1.75, C.ZA, 0.035, 'rgba(233,230,220,0.75)', [0.28, 0.18]);
      const cl = C.cradle;
      // cradle footprint + ghost outline
      g.save(); g.globalAlpha = 0.9; seg(cl.x0 - 0.12, cl.z0 - 0.12, cl.x1 + 0.12, cl.z0 - 0.12, 0.05, P.YL); seg(cl.x1 + 0.12, cl.z0 - 0.12, cl.x1 + 0.12, cl.z1 + 0.12, 0.05, P.YL); seg(cl.x1 + 0.12, cl.z1 + 0.12, cl.x0 - 0.12, cl.z1 + 0.12, 0.05, P.YL); seg(cl.x0 - 0.12, cl.z1 + 0.12, cl.x0 - 0.12, cl.z0 - 0.12, 0.05, P.YL); g.restore();
      g.save(); g.translate(X(cl.cx), Z(cl.cz)); g.rotate(Math.PI);
      g.strokeStyle = 'rgba(233,230,220,0.82)'; g.fillStyle = 'rgba(233,230,220,0.82)'; g.lineWidth = 0.035 * px; g.setLineDash([0.22 * px, 0.12 * px]);
      if (!eur) {   // ROVER-1: body + 3 wheel pairs + mast
        const bw = 1.18, bl = 2.5, rr = 0.16 * px; const bx = -bw / 2 * px, bz = -bl / 2 * px;
        g.beginPath(); g.roundRect(bx, bz, bw * px, bl * px, rr); g.stroke();
        for (const wz of [-0.95, 0, 0.95]) for (const sxx of [-1, 1]) { g.beginPath(); g.roundRect((sxx * 0.68 - 0.13) * px, (wz - 0.27) * px, 0.26 * px, 0.54 * px, 0.05 * px); g.stroke(); }
        g.beginPath(); g.roundRect(-0.35 * px, -1.05 * px, 0.7 * px, 0.7 * px, 0.06 * px); g.stroke();
        g.setLineDash([]); g.lineWidth = 0.02 * px; g.beginPath(); g.moveTo(0.35 * px, 0.7 * px); g.lineTo(0.35 * px, 1.1 * px); g.stroke();
        g.restore();
        ftxt('ROVER-1', cl.cx, cl.cz - 0.62, 0.27, 'rgba(233,230,220,0.92)', { w: 800 }); ftxt('STOWAGE · HOLD-DOWN ×4', cl.cx, cl.cz - 0.3, 0.075, 'rgba(228,180,0,0.95)');
      } else {      // LANTERN: octagonal lander footprint, 4 landing legs
        g.lineWidth = 0.04 * px; g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8; g.lineTo(Math.cos(a) * 1.0 * px, Math.sin(a) * 1.4 * px); } g.closePath(); g.stroke();
        g.setLineDash([]); for (const [lx, lz] of [[-0.85, -1.55], [0.85, -1.55], [-0.85, 1.55], [0.85, 1.55]]) { g.beginPath(); g.arc(lx * px, lz * px, 0.17 * px, 0, 6.283); g.stroke(); }
        g.beginPath(); g.arc(0, 0, 0.4 * px, 0, 6.283); g.stroke();
        g.restore();
        ftxt('LANTERN', cl.cx, cl.cz - 0.9, 0.36, 'rgba(228,180,0,0.95)', { w: 800, ls: 10 }); ftxt('HX-01 SURFACE LANDER · CRADLE 1', cl.cx, cl.cz - 0.5, 0.08, 'rgba(233,230,220,0.9)');
      }
      // probe rack zone
      const rk = C.rack;
      seg(rk.fx - 0.06, rk.z0 - 0.1, rk.fx - 0.06, rk.z1 + 0.1, 0.04, P.YL, [0.35, 0.12]);
      ftxt('PROBE STOWAGE · P-1', rk.fx - 0.38, rk.cz, 0.095, 'rgba(233,230,220,0.9)', { rot: Math.PI / 2 + Math.PI });
      ftxt('KEEP CLEAR', rk.fx - 0.38, rk.cz + 1.1, 0.07, 'rgba(228,180,0,0.95)', { rot: Math.PI / 2 + Math.PI });
      // ramp zone text on the forward strip (readable from the door) + arrows
      ftxt('RAMP', 0, 24.62, 0.3, 'rgba(233,230,220,0.92)', { w: 800, ls: 16 });
      for (const ax of [-0.95, 0.95]) ftxt('▼', ax, 24.62, 0.22, 'rgba(228,180,0,0.95)', { rot: 0 });
      ftxt('FRAME 24', 2.4, 24.35, 0.08, 'rgba(233,230,220,0.7)'); ftxt('FRAME 24', -2.4, 24.35, 0.08, 'rgba(233,230,220,0.7)');
      // engineering door arrow + label
      ftxt('ENGINEERING', 2.4, 30.2, 0.1, 'rgba(233,230,220,0.9)', { w: 800 });
      g.save(); g.translate(X(2.4), Z(30.55)); g.fillStyle = 'rgba(228,180,0,0.95)'; g.beginPath(); g.moveTo(-0.2 * px, -0.08 * px); g.lineTo(0.2 * px, -0.08 * px); g.lineTo(0, 0.12 * px); g.closePath(); g.fill(); g.restore();
      // ring IDs
      let n = 1; for (const [x, z] of C.rings) { g.save(); g.translate(X(x), Z(z + 0.17)); g.rotate(Math.PI); P.txt(g, 'T' + String(n++).padStart(2, '0'), 0, 0, 0.055 * px, 'rgba(233,230,220,0.7)'); g.restore(); }
      // bay grid ticks
      for (const z of [25.2, 26.7, 28.2, 29.7]) for (const sx of [-1, 1]) seg(sx * 3.25, z, sx * 3.45, z, 0.02, 'rgba(233,230,220,0.5)');
      ftxt('C2-A', -3.3, 25.5, 0.1, 'rgba(228,180,0,0.8)'); ftxt('C2-B', 3.3, 25.5, 0.1, 'rgba(228,180,0,0.8)');
      void H; void W;
    },
  });
}

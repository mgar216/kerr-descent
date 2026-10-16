// AIRLOCK — cycle control panel next to the outer hatch (airlock.panel): AIRLOCK plate, live status screen (CYCLE / PRESSURE / O2), big buttons, gauges,
// rotating amber beacon, and the inner/outer door indicator lights. EURYDICE: panel still works — amber warning text, beacon spinning fast.
import * as THREE from 'three';
import { Frame, screenIn } from './crew_util.js';
import * as S from './screens.js';

export default function airpanel(kit) {
  const eur = kit.eur, art = kit.crewArt, PI = Math.PI;
  const Pn = new Frame(kit, [-3.925, -0.02, 14.85], PI / 2);                    // local +z → +x (out of the wall), local +x = viewer's right (world −z)

  // plate, hazard cap, bezel strips
  Pn.box('trim', [0, 0, 0.03], [0.72, 1.08, 0.06], { bev: 0.012 }); Pn.box('plasticDark', [0, 0, 0.063], [0.67, 1.03, 0.008], { bev: 0.003 });
  Pn.box('hazard', [0, 0.535, 0.032], [0.72, 0.03, 0.064], { bev: 0 }); Pn.box('hazard', [0, -0.535, 0.032], [0.72, 0.03, 0.064], { bev: 0 });
  for (const s of [-1, 1]) { Pn.box('trim', [0, 0.14 + s * 0.18, 0.073], [0.6, 0.02, 0.012], { bev: 0.003 }); Pn.box('trim', [s * 0.29, 0.14, 0.073], [0.02, 0.34, 0.012], { bev: 0.003 }); }
  kit.sign('AIRLOCK', Pn.P([0, 0.42, 0.0685]), { w: 0.6, h: 0.1, rot: [0, PI / 2, 0], style: 'warn' });

  // live status screen
  const amber = eur ? S.C.amber : S.C.cy;
  const draw = (g, W, H, t) => {
    const c = S.base(g, W, H, t, { title: 'AIRLOCK 01 · CYCLE', sub: eur ? 'HX-01 · EMERG' : 'HX-02', accent: amber });
    const P = eur ? 38.2 + Math.sin(t * 0.7) * 0.2 : 101.3 + Math.sin(t * 0.5) * 0.1, O2 = eur ? 11.2 : 20.9, cx = c.x + 76, cy = c.y + 92;
    S.ring(g, cx, cy, 56, P / 110, eur ? S.C.amber : S.C.cy, 10); S.mono(g, P.toFixed(1), cx, cy + 8, 30, eur ? S.C.amber : S.C.ink, 'center', 700); S.mono(g, 'kPa  CABIN', cx, cy + 30, 13, S.C.cyd, 'center'); S.mono(g, 'PRESSURE', cx, c.y + 14, 14, S.C.cyd, 'center');
    S.table(g, c.x + 160, c.y + 34, [['CYCLE', eur ? 'LOCKED' : 'STANDBY', eur ? S.C.amber : S.C.green], ['O2', O2.toFixed(1) + ' %', eur ? S.C.amber : S.C.ink], ['TEMP', eur ? '-41 °C' : '21 °C', eur ? S.C.red : S.C.ink], ['INNER', eur ? 'JAMMED' : 'OPEN', eur ? S.C.amber : S.C.green], ['OUTER', 'SEALED', S.C.ink]], { size: 18, gap: 11, colW: 92, color: S.C.cyd });
    g.fillStyle = eur ? 'rgba(255,176,77,0.16)' : 'rgba(134,236,255,0.10)'; g.fillRect(c.x, H - 54, c.w, 36);
    if (eur) { if (Math.floor(t * 1.6) % 2 === 0) S.mono(g, 'LOW PRESSURE — AUTH REQUIRED', W / 2, H - 29, 19, S.C.amber, 'center', 700); }
    else S.mono(g, Math.floor(t * 1.2) % 2 ? 'READY — PRESS CYCLE' : 'READY — PRESS CYCLE _', W / 2, H - 29, 19, S.C.cy, 'center', 700);
  };
  screenIn(kit, Pn.sub([0, 0.14, 0.0685]), [0, 0, 0], [0.56, 0.34], [512, 310], draw, { id: 'airlock.screen', alive: true, range: 12 });

  // big buttons with LED rings + labels, gauge cluster
  [[-0.2, 'paintCyan', 'ledGreen', 'CYCLE'], [0.0, 'paintOrange', 'ledAmber', 'HATCH'], [0.2, 'crewRedBtn', 'ledRed', 'ABORT']].forEach(([x, cap, led, label]) => {
    Pn.cyl('metal', [x, -0.17, 0.073], 0.058, 0.016, { axis: 'z', seg: 20 }); Pn.cyl(cap === 'crewRedBtn' ? 'ledRed' : cap, [x, -0.17, 0.086], 0.045, 0.03, { axis: 'z', seg: 20 });
    Pn.tor(led, [x, -0.17, 0.082], 0.052, 0.004, { axis: 'z', seg: 20 }); kit.sign(label, Pn.P([x, -0.265, 0.0685]), { w: 0.12, h: 0.032, rot: [0, PI / 2, 0] });
  });
  Pn.box('metal', [0, -0.34, 0.075], [0.64, 0.01, 0.012], { bev: 0.003 });
  art.put(Pn, 'gP', [-0.2, -0.43, 0.0695], 0.14, 0.14); art.put(Pn, 'gO', [0.0, -0.43, 0.0695], 0.14, 0.14); art.put(Pn, 'gT', [0.2, -0.43, 0.0695], 0.14, 0.14);
  Pn.box(kit.led(eur ? 'Amber' : 'Green', eur ? 'Blink' : ''), [-0.25, 0.37, 0.0715], [0.022, 0.022, 0.008], { bev: 0 }); Pn.box(kit.led('Red', eur ? 'Fast' : ''), [0.25, 0.37, 0.0715], [0.022, 0.022, 0.008], { bev: 0 });
  kit.interact({ id: 'airlock.panel', label: 'Airlock panel', pos: [-3.84, 0.05, 14.85], radius: 1.6, hit: { c: [-3.88, 0.0, 14.85], s: [0.16, 1.08, 0.74] } });

  // rotating amber beacon on the wall above the panel (follows the lighting mode via the shared emitAmber material)
  const Bc = new Frame(kit, [-3.925, 0.63, 14.85], PI / 2);
  Bc.cyl('trim', [0, 0, 0.015], 0.07, 0.03, { axis: 'z', seg: 18 }); Bc.cyl('metal', [0, 0, 0.045], 0.052, 0.03, { axis: 'z', seg: 18 });
  Bc.sph('crewAmberGlass', [0, 0, 0.06], 0.055, { seg: 16, ts: 0, tl: PI / 2, rot: [PI / 2, 0, 0] });
  const bp = Bc.P([0, 0, 0.068]), grp = kit.group('beacon', { pos: bp });
  kit.mesh(new THREE.SphereGeometry(0.013, 8, 6), 'ledAmber', { parent: grp, pos: [0, 0.02, 0], cast: false, receive: false });
  kit.mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 12, 1, true, 0, PI), 'metal', { parent: grp, pos: [0, -0.012, 0], rot: [0, 0, PI / 2], cast: false, receive: false });
  const glowMat = new THREE.MeshBasicMaterial({ map: kit.T.glowSprite(), color: new THREE.Color(2.4, 1.1, 0.25), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), glowMat); glow.position.set(0.012, 0.02, 0); glow.rotation.y = PI / 2; glow.renderOrder = 12; grp.add(glow);
  kit.onUpdate((dt, t, s) => {
    const fast = eur || s.mode === 'alert' || s.mode === 'emergency'; grp.rotation.x += dt * (fast ? 5.2 : 1.7);
    const k = s.mode === 'off' ? 0.12 : s.mode === 'normal' && !eur ? 0.45 : 1; glowMat.color.setRGB(2.4 * k, 1.1 * k, 0.25 * k);
  });

  // door indicators: inner (corridor wall, above the door) and outer (above the hatch)
  kit.box('plasticDark', [-1.262, 1.16, 16.0], [0.024, 0.1, 0.34], { bev: 0.004 });
  kit.cyl(kit.led(eur ? 'Amber' : 'Green', eur ? 'Blink' : ''), [-1.277, 1.16, 15.91], 0.022, 0.006, { axis: 'x', seg: 14 }); kit.cyl(kit.led('Red'), [-1.277, 1.16, 16.09], 0.022, 0.006, { axis: 'x', seg: 14 });
  kit.sign('INNER DOOR', [-1.277, 1.225, 16.0], { w: 0.22, h: 0.03, rot: [0, -PI / 2, 0] });
  kit.box('plasticDark', [-3.9, 1.12, 16.0], [0.03, 0.1, 0.34], { bev: 0.004 });
  kit.cyl(kit.led('Red', eur ? 'Blink' : ''), [-3.883, 1.12, 15.91], 0.022, 0.006, { axis: 'x', seg: 14 }); kit.cyl(kit.led('Green'), [-3.883, 1.12, 16.09], 0.022, 0.006, { axis: 'x', seg: 14 });
  kit.sign('OUTER HATCH', [-3.883, 1.185, 16.0], { w: 0.24, h: 0.03, rot: [0, PI / 2, 0] });
}

// Ventral cargo ramp: 2.6 × 7.2 m plate hinged at z = RAMP.zTop (axis X), belly-flush when closed; hydraulic rams from aft belly pylons to the
// ramp edges, wedge side skirts (dock well) that unfold with it, hull aperture, walkable lane floor that follows the plate.
// Maintains kit.state.rampOpen (0..1) → eased toward rampWant, only while landed with the legs down.
import * as THREE from 'three';
import { Part, telescope, sstep, clamp01 } from './gear_util.js';

const V3 = THREE.Vector3, M4 = THREE.Matrix4;

export default function ramp(kit) {
  const L = kit.L, RP = L.RAMP, st = kit.state, eur = kit.eur;
  const HZ = RP.zTop, LEN = RP.length, HY = RP.yTop, AN = RP.angle, W = RP.x1 - RP.x0, ZF = RP.zFoot, T = 0.28, zMid = HZ + LEN / 2;
  const ZE = HZ + LEN;
  kit.cutRect(1, 0, zMid, W / 2 + 0.04, LEN / 2 + 0.06, 0.06, -1.7, -1.3);       // aperture in the belly skin

  // ── static: aperture gasket + hazard edging, sills, ram pylons, lane fittings ──
  for (const sx of [-1, 1]) {
    kit.box('rubber', [sx * (W / 2 + 0.075), -1.525, zMid], [0.07, 0.04, LEN + 0.26], { bev: 0.01, ext: true });
    kit.box('hazard', [sx * (W / 2 + 0.2), -1.522, zMid], [0.14, 0.012, LEN - 0.2], { bev: 0.002, ext: true });
    kit.box('darkMetal', [sx * 1.47, -1.6, ZE + 0.3], [0.16, 0.22, 0.22], { bev: 0.02, ext: true });
    kit.cyl('steel', [sx * 1.47, -1.64, ZE + 0.3], 0.04, 0.26, { axis: 'x', seg: 10, ext: true });
    // lane edge fascia + guide strip on the cargo deck (interior side)
    kit.box('trim', [sx * (W / 2 + 0.04), -1.19, 28.1], [0.08, 0.02, 5.8], { bev: 0.004 });
    kit.box('emitStripO', [sx * (W / 2 + 0.003), -1.18, 28.1], [0.016, 0.006, 5.7], { bev: 0 });
  }
  kit.box('rubber', [0, -1.525, HZ - 0.1], [W + 0.3, 0.04, 0.07], { bev: 0.01, ext: true });
  kit.box('rubber', [0, -1.525, ZE + 0.1], [W + 0.3, 0.04, 0.07], { bev: 0.01, ext: true });
  kit.box('trim', [0, -1.4, ZE + 0.06], [W + 0.1, 0.24, 0.1], { bev: 0.01, ext: true });
  kit.box('trim', [0, -1.4, HZ - 0.1], [W + 0.1, 0.24, 0.08], { bev: 0.01, ext: true });
  kit.box('hazard', [0, -1.194, HZ - 0.09], [W - 0.02, 0.012, 0.16], { bev: 0 });
  if (eur) {   // derelict: a ram hose has split and frozen
    kit.tube('rubber', [[1.47, -1.7, ZE + 0.3], [1.5, -2.05, ZE + 0.42], [1.52, -2.7, ZE + 0.5], [1.5, -3.0, ZE + 0.52]], 0.022, { ext: true, rseg: 6 });
    for (const [dx, dl] of [[0, 0.3], [0.05, 0.2], [-0.04, 0.14]]) kit.cyl('paintWhite', [1.5 + dx, -3.1 - dl / 2, ZE + 0.52], 0.028, dl, { rt: 0.028, rb: 0.002, seg: 6, ext: true });
    kit.sphere('paintWhite', [1.38, -1.57, ZE - 0.1], 0.16, { sy: 0.3, seg: 10, ext: true });
  }
  kit.sign('CARGO RAMP · KEEP CLEAR WHEN LOWERING', [0, -1.196, HZ - 0.45], { w: 1.4, h: 0.1, rot: [-Math.PI / 2, 0, Math.PI], style: 'warn' });
  // ── moving plate (group at the hinge, rotates about X) ──
  const g = kit.group('gear.ramp', { pos: [0, HY, HZ] });
  const P = new Part(kit);
  const prof = [[0, 0], [LEN, 0], [LEN, -0.1], [LEN - 0.35, -T], [0, -T]];                 // side profile (z, y), top surface at y = 0
  P.extrude('hullW', prof, W - 0.04, { rot: [0, -Math.PI / 2, 0] });
  P.box('floor', [0, 0.007, LEN / 2], [W - 0.04, 0.014, LEN - 0.02], { bev: 0.002 });
  for (let z = 0.45; z < LEN - 0.3; z += 0.4) P.box('trim', [0, 0.022, z], [W - 0.4, 0.016, 0.05], { bev: 0.004 });
  for (const sx of [-1, 1]) {
    P.box('hazard', [sx * (W / 2 - 0.1), 0.017, LEN / 2], [0.16, 0.006, LEN - 0.3], { bev: 0 });
    P.box('emitStripO', [sx * (W / 2 - 0.23), 0.019, LEN / 2 - 0.2], [0.022, 0.006, LEN - 1.0], { bev: 0 });
    P.box('emitStripO', [sx * (W / 2 - 0.12), 0.02, LEN - 0.16], [0.1, 0.012, 0.1], { bev: 0.004 });
    P.box('trim', [sx * (W / 2 - 0.005), -0.12, LEN / 2 - 0.2], [0.04, 0.14, LEN - 0.7], { bev: 0.008 });
    P.box('trim', [sx * (W / 2 + 0.06), -0.2, 6.4], [0.14, 0.16, 0.3], { bev: 0.02 });                      // ram lug
    P.cyl('metal', [sx * (W / 2 + 0.08), -0.2, 6.4], 0.04, 0.24, { axis: 'x', seg: 10 });
    P.box('trim', [sx * 0.8, -T - 0.006, LEN / 2 - 0.3], [0.13, 0.012, LEN - 1.6], { bev: 0.003 });         // underside skid rails
  }
  P.box('hazard', [0, 0.017, LEN - 0.2], [W - 0.5, 0.006, 0.3], { bev: 0 });
  P.cyl('metal', [0, -0.045, 0.02], 0.06, W - 0.06, { axis: 'x', seg: 16 });                              // hinge barrel
  P.box('paintOrange', [0, -T - 0.004, 1.2], [W - 0.5, 0.01, 0.07], { bev: 0.002 });                       // underside stripes
  P.box('paintOrange', [0, -T - 0.004, 5.6], [W - 0.5, 0.01, 0.07], { bev: 0.002 });
  P.meshes(g, 'gear.ramp');

  // ── wedge skirts (dock-well walls): unit triangle (z,y) scaled by the ramp geometry ──
  const SK = new Part(kit);
  for (const sx of [-1, 1]) SK.extrude('hullW', [[0, 0], [1, 0], [1, -1]], 0.03, { pos: [sx * (W / 2 + 0.045), 0, 0], rot: [0, -Math.PI / 2, 0] });
  const skg = kit.group('gear.ramp.skirts', { pos: [0, HY, HZ] });
  const skirts = SK.meshes(skg, 'gear.skirt');

  // ── hydraulic rams: aft belly pylon → ramp lug ──
  const rams = telescope(kit, 2, 'gear.ram');
  const lug = [new V3(), new V3()], anc = [-1, 1].map((sx) => new V3(sx * 1.47, -1.64, ZE + 0.3)), m4 = new M4();

  // ── walkable lane + well walls ──
  const lane = kit.floor(RP.x0, HZ, RP.x1, ZF, HY, HY, 'z');
  for (const sx of [-1, 1]) kit.colBox([sx * 1.35, (HY + RP.groundY) / 2, (HZ + ZF) / 2], [0.1, HY - RP.groundY, ZF - HZ], { name: 'ramp.well' });

  function pose(open) {
    const a = AN * open;
    g.rotation.x = a;
    const sy = Math.max(1e-3, LEN * Math.sin(a)), sz = Math.max(1e-3, LEN * Math.cos(a));
    skg.scale.set(1, sy, sz); skg.visible = open > 0.003;
    for (const sk of skirts) sk.visible = open > 0.003;
    g.updateMatrix(); m4.compose(g.position, g.quaternion, g.scale);
    [-1, 1].forEach((sx, i) => { lug[i].set(sx * (W / 2 + 0.08), -0.2, 6.4).applyMatrix4(m4); rams.set(i, anc[i], lug[i], 0.085, 0.055); });
    rams.commit();
    lane.axis = open > 0.001 ? 'z' : null; lane.y0 = HY; lane.y1 = open > 0.001 ? Math.max(RP.groundY, HY - (ZF - HZ) * Math.tan(a)) : HY;
  }

  let raw = st.rampOpen || 0, last = -1, first = true;
  pose(sstep(0, 1, raw)); st.rampOpen = sstep(0, 1, raw);
  kit.onUpdate((dt, t, s) => {
    const can = s.landed && s.legDeploy > 0.95, want = can ? (s.rampWant ? 1 : 0) : 0;
    if (first) { first = false; if (can && want) raw = 1; }              // built landed with the ramp already requested → start open
    if (raw !== want) raw += Math.max(-dt * 0.3, Math.min(dt * 0.3, want - raw));
    s.rampOpen = sstep(0, 1, clamp01(raw));
    if (Math.abs(s.rampOpen - last) < 1e-5) return;
    last = s.rampOpen; pose(s.rampOpen);
  });
}

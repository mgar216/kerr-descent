// Airlock outer hatch (port flank, z = 16): 0.4 m tunnel, hazard-striped frame ring, hinged plug door (swings outward about its forward edge),
// pressure lights, interior frame; plus the docking collar (gear_collar) and boarding ladder (gear_ladder). Maintains kit.state.hatchOpen.
import * as THREE from 'three';
import { Part, sstep } from './gear_util.js';
import collar from './gear_collar.js';
import ladder from './gear_ladder.js';

const MAXA = 100 * Math.PI / 180;

function rrect(hw, hh, rc, ox = 0, n = 6) {          // rounded-rectangle outline (CCW), centred at (ox, 0)
  const pts = [];
  for (const [cx, cy, a0] of [[hw - rc, hh - rc, 0], [-(hw - rc), hh - rc, Math.PI / 2], [-(hw - rc), -(hh - rc), Math.PI], [hw - rc, -(hh - rc), 1.5 * Math.PI]])
    for (let i = 0; i <= n; i++) { const a = a0 + (Math.PI / 2) * i / n; pts.push([ox + cx + rc * Math.cos(a), cy + rc * Math.sin(a)]); }
  return pts;
}
const circle = (cx, cy, r, n = 28) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(i / n * Math.PI * 2), cy + r * Math.sin(i / n * Math.PI * 2)]);
function plate(outline, holes, depth) {              // extruded plate with holes; XY plane, thickness along Z (centred)
  const sh = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) sh.holes.push(new THREE.Path(h.slice().reverse().map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 12 }); g.translate(0, 0, -depth / 2); return g;
}
const YAW = [0, -Math.PI / 2, 0];                    // plate local X → ship +Z, local Z → ship −X

export default function hatch(kit) {
  const L = kit.L, st = kit.state, eur = kit.eur, H = L.HATCH;
  const C = { Z0: H.z, Y0: (H.y0 + H.y1) / 2 }, Z0 = C.Z0, Y0 = C.Y0, HX = -4.45, HZ = Z0 - 0.63;

  // ── tunnel (lining → door plane), walkable floor + side colliders, ceiling light ──
  const TX = (-4.075 + -4.45) / 2, TL = 0.375;
  kit.box('floor', [TX, H.y0 - 0.008, Z0], [TL, 0.016, 1.2], { bev: 0 });
  kit.box('trimDS', [TX, H.y1 + 0.008, Z0], [TL, 0.016, 1.2], { bev: 0 });
  for (const s of [-1, 1]) { kit.box('trimDS', [TX, Y0, Z0 + s * 0.608], [TL, H.y1 - H.y0, 0.016], { bev: 0 }); kit.colBox([TX, Y0, Z0 + s * 0.63], [TL + 0.06, H.y1 - H.y0, 0.06]); }
  kit.box('emitPanel', [TX, H.y1 - 0.004, Z0], [0.24, 0.008, 0.8], { bev: 0 });
  kit.floor(-4.95, Z0 - 0.7, -4.075, Z0 + 0.7, H.y0);
  // ── exterior frame ring (hazard) on a dark base ring, with amber light strips + pressure lights ──
  { const g = plate(rrect(0.75, 1.175, 0.38), [rrect(0.63, 1.055, 0.26)], 0.07); kit.add('hazard', g, { pos: [-4.485, Y0, Z0], rot: YAW, ext: true }); g.dispose();
    const g2 = plate(rrect(0.77, 1.19, 0.4), [rrect(0.62, 1.045, 0.25)], 0.05); kit.add('trim', g2, { pos: [-4.425, Y0, Z0], rot: YAW, ext: true }); g2.dispose(); }
  const amber = eur ? 'screenOff' : 'emitAmber';
  for (const s of [-1, 1]) {
    kit.box(amber, [-4.521, Y0, Z0 + s * 0.642], [0.008, 1.6, 0.02], { bev: 0, ext: true });
    kit.box(amber, [-4.521, Y0 + s * 1.067, Z0], [0.008, 0.02, 0.74], { bev: 0, ext: true });
  }
  [['Green', 'ledGreen', 0.62], ['Amber', 'ledAmber', 0.5], ['Red', 'ledRed', 0.38]].forEach(([name, led, dy], i) => {
    const mat = eur ? (i === 1 ? 'ledAmberBlink' : i === 2 ? 'ledRed' : 'screenOff') : (i === 0 ? led : 'screenOff');
    kit.box(mat, [-4.523, Y0 + dy, Z0 + 0.69], [0.012, 0.045, 0.045], { bev: 0.004, ext: true });
    kit.box(mat, [-3.92, Y0 + dy + 0.22, Z0 + 0.76], [0.012, 0.045, 0.045], { bev: 0.004 });
  });
  // hinge brackets (static) on the forward edge
  for (const dy of [-0.85, 0, 0.85]) { kit.cyl('steel', [HX - 0.02, Y0 + dy, HZ - 0.02], 0.03, 0.24, { seg: 10, ext: true }); kit.box('darkMetal', [HX - 0.035, Y0 + dy, HZ - 0.05], [0.1, 0.2, 0.07], { bev: 0.012, ext: true }); }
  // ── interior side: frame, hazard strips, status sign ──
  for (const s of [-1, 1]) {
    kit.box('trim', [-3.91, Y0 - 0.05, Z0 + s * 0.67], [0.04, 2.16, 0.12], { bev: 0.008 });
    kit.box('hazard', [-3.888, Y0 - 0.05, Z0 + s * 0.67], [0.006, 2.1, 0.07], { bev: 0 });
    kit.box('emitStrip', [-3.887, Y0 - 0.05, Z0 + s * 0.605], [0.006, 2.0, 0.012], { bev: 0 });
  }
  kit.box('trim', [-3.91, H.y1 + 0.06, Z0], [0.04, 0.12, 1.46], { bev: 0.008 });
  kit.box('hazard', [-3.888, H.y1 + 0.06, Z0], [0.006, 0.07, 1.3], { bev: 0 });
  kit.sign('AIRLOCK · OUTER HATCH', [-3.912, H.y1 + 0.18, Z0], { w: 0.8, h: 0.1, rot: [0, Math.PI / 2, 0], style: eur ? 'red' : 'warn' });

  // ── moving plug door: group on the forward hinge line ──
  const dg = kit.group('gear.hatch.door', { pos: [HX, Y0, HZ] });
  const D = new Part(kit), hole = circle(0.63, 0.35, 0.165);
  const layer = (mat, hw, hh, rc, depth, xr) => D.add(mat, plate(rrect(hw, hh, rc, 0.63), [hole], depth), { pos: [xr, 0, 0], rot: YAW });
  layer('hullW', 0.61, 1.035, 0.24, 0.04, -0.02); layer('trim', 0.595, 1.02, 0.23, 0.03, 0.015); layer('wall', 0.58, 1.005, 0.22, 0.025, 0.0425);
  D.torus('trim', [-0.045, 0.35, 0.63], 0.18, 0.026, { axis: 'x', seg: 28, tube: 8 }).torus('metal', [0.062, 0.35, 0.63], 0.175, 0.02, { axis: 'x', seg: 28, tube: 6 });
  D.cyl('glassInt', [0.0, 0.35, 0.63], 0.17, 0.012, { axis: 'x', seg: 28 });
  D.cyl('metal', [0.085, -0.05, 0.63], 0.055, 0.07, { axis: 'x', seg: 16 }).torus('metal', [0.09, -0.05, 0.63], 0.17, 0.018, { axis: 'x', seg: 28, tube: 8 });
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; D.between('metal', [0.088, -0.05, 0.63], [0.09, -0.05 + 0.17 * Math.cos(a), 0.63 + 0.17 * Math.sin(a)], 0.012, { seg: 6 }); }
  D.sphere('paintOrange', [0.09, -0.05 + 0.17, 0.63], 0.028, { seg: 10 });
  D.box('trim', [-0.047, -0.1, 1.13], [0.03, 0.34, 0.06], { bev: 0.008 }).box('paintOrange', [-0.06, -0.1, 1.13], [0.02, 0.28, 0.025], { bev: 0.005 });
  for (const dy of [-0.75, 0, 0.75]) D.cyl('metal', [0.0, dy, 1.245], 0.028, 0.1, { axis: 'z', seg: 10 });
  for (const s of [-1, 1]) { D.box('hazard', [0.058, s * 0.93, 0.63], [0.012, 0.07, 0.95], { bev: 0 }); D.box('hazard', [0.058, 0, 0.63 + s * 0.52], [0.012, 1.4, 0.07], { bev: 0 }); }
  D.box(eur ? 'screenOff' : 'emitStrip', [0.058, -0.1, 0.22], [0.008, 1.0, 0.016], { bev: 0 });
  D.meshes(dg, 'gear.hatch.door');

  // ── colliders: the closed door blocks (ignored when open), a barrier at the sill unless landed with the ladder down and the hatch open ──
  const doorCol = kit.colBox([HX, Y0, Z0], [0.1, H.y1 - H.y0, 1.2], { door: true, name: 'hatch.door' });
  const barrier = kit.colBox([-4.99, Y0, Z0], [0.06, H.y1 - H.y0, 1.6], { name: 'hatch.barrier' });

  const Cc = { Z0, Y0 };
  collar(kit, Cc);
  ladder(kit, Cc);

  let raw = st.hatchOpen || 0, first = true;
  const apply = (o) => { dg.rotation.y = -o * MAXA; doorCol.open = o; };
  apply(sstep(0, 1, raw));
  kit.onUpdate((dt, t, s) => {
    const want = s.hatchWant ? 1 : 0;
    if (first) { first = false; if (want) raw = 1; }
    if (raw !== want) raw += Math.max(-dt * 0.5, Math.min(dt * 0.5, want - raw));
    s.hatchOpen = sstep(0, 1, raw); apply(s.hatchOpen);
    barrier.off = !(s.landed && Cc.ladder && Cc.ladder.v > 0.995 && s.hatchOpen > 0.5);
  });
}

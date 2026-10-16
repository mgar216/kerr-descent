// CARGO BAY (z 24..31, x ±3.525 clear): survey-probe rack, rover/LANTERN cradle, ramp lane edging + control console, crates, tool wall, crane.
// Geometry lives in chunk files: cargo_lane.js (lane + console + floor paint), cargo_props.js (rack, cradle, crane), cargo_stow.js (crates, tools, walls).
import { defMats } from './bay_util.js';
import lane from './cargo_lane.js';
import props from './cargo_props.js';
import stow from './cargo_stow.js';

export default function build(kit) {
  defMats(kit);
  const eur = kit.eur;
  const C = {
    eur, WX: 3.525, ZF: 24.075, ZA: 30.925,                              // inner wall faces: side linings, forward bulkhead (aft face), aft bulkhead (fore face)
    cradle: eur ? { x0: -3.45, x1: -1.45, z0: 25.35, z1: 29.85, cx: -2.45, cz: 27.6 } : { x0: -3.4, x1: -1.7, z0: 25.55, z1: 29.65, cx: -2.55, cz: 27.6 },
    rack: { fx: 2.95, z0: 25.275, z1: 29.675, cz: 27.475 },
    rings: [[2.5, 26.8], [2.5, 28.0], [2.5, 29.2], [2.5, 30.4], [-1.95, 25.0], [1.95, 24.62]],
  };
  const errs = [], safe = (name, fn) => { try { fn(); } catch (e) { errs.push(`${name}: ${e && e.message}`); console.error(`[cargo] ${name} failed`, e); } };
  safe('lane', () => lane(kit, C)); safe('props', () => props(kit, C)); safe('stow', () => stow(kit, C));
  for (const [id, x, z] of [['cargo.s', 2.2, 26.4], ['cargo.p', -2.2, 29.2]]) kit.light(id, [x, 1.1, z], { color: 0xfff0dc, k: 0.6 });   // extra pool sites at the ceiling panels (the stock site sits on the centreline)
  if (errs.length) throw new Error(errs.join(' | '));   // surfaces in ship.errors; geometry from the chunks that succeeded is kept
}

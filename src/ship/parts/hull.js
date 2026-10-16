// Exterior hull skin: nose cone, main fuselage, shoulder ring + collars, window bezels, collision boxes. (Livery/greebles: hull_detail.js)
import * as THREE from 'three';
import { roundRectOutline, loftProfile } from './builder.js';
import hullDetail from './hull_detail.js';

export default function build(kit) {
  const L = kit.L;
  // ───────── skins ─────────
  kit.loft('hull', L.NOSE_STATIONS, { caps: [true, true], sub: 3, perim: 8 });
  kit.loft('hull', L.HULL_STATIONS, { caps: [false, true], sub: 2, perim: 24 });

  // dark composite underside (lower corners + belly) — two-tone livery; stripes sit on the transition
  kit.loft('hullUnder', L.HULL_STATIONS.map((s) => ({ ...s, w: s.w + 0.012, top: s.top + 0.012, bot: s.bot - 0.012, rc: s.rc + 0.012 })), { caps: [false, false], sub: 2, perim: 24, uvScale: 0.5, cols: [13, 31] });
  // shoulder ring: flat plate facing −z between the command-module section and the habitat section at z = 2.4
  {
    const C = L.COMMAND_REAR, H = L.HULL_STATIONS[0];
    const inner = roundRectOutline(C.w, C.top, C.bot, C.rc), outer = roundRectOutline(H.w, H.top, H.bot, H.rc), N = inner.length;
    const p = [], n = [], uv = [], idx = [];
    for (let j = 0; j < N; j++) {
      const a = outer[j], b = inner[j];
      p.push(a[0], a[1], 2.4, b[0], b[1], 2.4); n.push(0, 0, -1, 0, 0, -1); uv.push(a[0] * 0.25, a[1] * 0.25, b[0] * 0.25, b[1] * 0.25);
    }
    for (let j = 0; j < N; j++) { const k = (j + 1) % N, a = j * 2, b = j * 2 + 1, c = k * 2, d = k * 2 + 1; idx.push(a, c, b, b, c, d); }
    kit.arrays('hull', { p, n, uv, idx }, { ext: true });
  }

  // ───────── collars (structural bands at joints) ─────────
  const band = (z0, z1, grow, mat = 'carbon') => {
    const prof = (z) => { const q = loftProfile(L.HULL_STATIONS, z); return { z, w: q.w + grow, top: q.top + grow, bot: q.bot - grow, rc: q.rc + grow, cx: q.cx }; };
    kit.loft(mat, [prof(z0), prof(z0 + 0.04), prof(z1 - 0.04), prof(z1)], { caps: [false, false], sub: 1, uvScale: 0.5, perim: 24 });
  };
  band(2.4, 2.85, 0.05); band(2.52, 2.62, 0.09, 'darkMetal');            // fuselage front collar
  band(23.3, 23.75, 0.045); band(23.45, 23.55, 0.08, 'darkMetal');      // taper joint
  band(36.5, 36.9, 0.05); band(38.2, 38.55, 0.05); band(38.32, 38.42, 0.085, 'darkMetal');
  band(40.55, 41.0, 0.05);

  // ───────── window bezels (skin side of the cut-outs registered in structure.js) ─────────
  for (const w of L.WINDOWS) {
    const s = w.side, x = s * (L.skinX(w.z) + 0.005);
    if (w.kind === 'round') {
      kit.torus('darkMetal', [x, w.y, w.z], w.r + 0.045, 0.05, { axis: 'x', seg: 28, tube: 8, ext: true });
      kit.torus('carbon', [x, w.y, w.z], w.r + 0.115, 0.03, { axis: 'x', seg: 28, tube: 6, ext: true });
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; kit.cyl('metal', [x + s * 0.03, w.y + Math.sin(a) * (w.r + 0.115), w.z + Math.cos(a) * (w.r + 0.115)], 0.014, 0.025, { seg: 8, axis: 'x', ext: true }); }
    } else {
      const hw = w.w / 2, hh = w.h / 2;
      for (const sd of [-1, 1]) {
        kit.box('darkMetal', [x, w.y + sd * (hh + 0.04), w.z], [0.09, 0.1, w.w + 0.28], { bev: 0.015, ext: true });
        kit.box('darkMetal', [x, w.y, w.z + sd * (hw + 0.04)], [0.09, w.h, 0.1], { bev: 0.015, ext: true });
        kit.box('carbon', [x + s * 0.015, w.y + sd * (hh + 0.12), w.z], [0.07, 0.04, w.w + 0.36], { bev: 0.01, ext: true });
      }
      for (let k = 0; k < 7; k++) for (const sd of [-1, 1]) kit.cyl('metal', [x + s * 0.04, w.y + sd * (hh + 0.04), w.z - hw + 0.1 + k * (w.w - 0.2) / 6], 0.014, 0.025, { seg: 8, axis: 'x', ext: true });
    }
  }

  // ───────── collision boxes (EVA / landing) ─────────
  kit.hullColliders.push(
    { min: [-1.5, -1.8, -3.4], max: [1.5, -0.4, -1.0] },
    { min: [-4.4, -1.5, 2.4], max: [4.4, 1.6, 24.0] },
    { min: [-4.0, -1.5, 24.0], max: [4.0, 1.6, 38.4] },
    { min: [-2.4, -1.05, 38.4], max: [2.4, 1.3, 41.0] },
    { min: [-1.2, 1.6, 24.0], max: [1.2, 2.2, 31.0] },
  );

  hullDetail(kit);
}

// One folding radiator wing: root bracket + hinge barrel, boom, N hinged tapered panels (frame + coolant-channel membrane + ribs), hinge headers,
// coolant lines, brace strut. `W.dmg` (EURYDICE) bends panel 3 on its hinge, tears its corner, drops panel 4 and trails a cable.
// Wing space: u along the boom (outward/up), cc along the chord (aft), nn along the panel normal (up).
import * as THREE from 'three';
import { basis, boxM, cylAB } from './drive_util.js';

const V3 = THREE.Vector3, TILE = 2.4, C0 = 0.14, GAP = 0.1, lerp = (a, b, k) => a + (b - a) * k;
const mk = (o, d, c, n) => ({ o, d, c, n, nr: new V3().crossVectors(d, c), at: (u, cc, nn = 0) => new V3().copy(o).addScaledVector(d, u).addScaledVector(c, cc).addScaledVector(n, nn) });
const bend = (F, o, b) => { const cb = Math.cos(b), sb = Math.sin(b); return mk(o, F.d.clone().multiplyScalar(cb).addScaledVector(F.n, sb), F.c, F.n.clone().multiplyScalar(cb).addScaledVector(F.d, -sb)); };
const bx = (kit, mat, F, u, cc, nn, du, dc, dn, bev = 0.004) => boxM(kit, mat, basis(F.at(u, cc, nn), F.d, F.c, F.nr), du, dc, dn, bev);
// flat bar lying in the panel plane from (u0,c0) to (u1,c1); w = in-plane width, th = thickness along the normal
function edge(kit, mat, F, u0, c0, u1, c1, w, th) {
  const a = F.at(u0, c0), b = F.at(u1, c1), x = new V3().subVectors(b, a), len = x.length(); x.divideScalar(len);
  const y = new V3().crossVectors(F.nr, x);
  boxM(kit, mat, basis(a.add(b).multiplyScalar(0.5), x, y, F.nr), len, w, th, 0.003);
}

function membrane(kit, F, poly) {                         // double-sided radiator polygon; uv: chord → texture x, length → texture y
  const p = [], n = [], uv = [];
  for (const [u, cc] of poly) { const w = F.at(u, cc); p.push(w.x, w.y, w.z); n.push(F.nr.x, F.nr.y, F.nr.z); uv.push(cc / TILE, u / TILE); }
  const idx = [], A = new V3(), B = new V3(), C = new V3();
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(poly.map(([u, cc]) => new THREE.Vector2(u, cc)), [])) {
    A.fromArray(p, a * 3); B.fromArray(p, b * 3); C.fromArray(p, c * 3);
    if (B.sub(A).cross(C.sub(A)).dot(F.nr) >= 0) idx.push(a, b, c); else idx.push(a, c, b);
  }
  kit.arrays('radiator', { p, n, uv, idx }, { ext: true });
}

// one tapered panel in frame F: u∈[0,len], leading edge at cc=C0, trailing edge from C0+cIn (u=0) to C0+cOut (u=len); torn = jagged outer corner
function panel(kit, F, len, cIn, cOut, torn) {
  const ch = (u) => lerp(cIn, cOut, u / len), t1 = C0 + cIn, t2 = C0 + cOut;
  if (torn) {
    membrane(kit, F, [[0, C0], [len, C0], [len, C0 + cOut * 0.52], [len * 0.78, C0 + ch(len * 0.78) * 0.6], [len * 0.9, C0 + ch(len * 0.9) * 0.76], [len * 0.52, C0 + ch(len * 0.52) * 0.83], [len * 0.4, C0 + ch(len * 0.4)], [0, t1]]);
    edge(kit, 'carbon', F, 0, t1, len * 0.4, C0 + ch(len * 0.4), 0.05, 0.045);
    bx(kit, 'carbon', F, len * 0.97, C0 + cOut * 0.26, 0, 0.04, cOut * 0.52, 0.04);
  } else {
    membrane(kit, F, [[0, C0], [len, C0], [len, t2], [0, t1]]);
    edge(kit, 'carbon', F, 0, t1, len, t2, 0.05, 0.045); bx(kit, 'carbon', F, len - 0.02, C0 + cOut / 2, 0, 0.04, cOut, 0.04);
  }
  bx(kit, 'carbon', F, 0.025, C0 + cIn / 2, 0, 0.05, cIn, 0.045);                        // hinge-side edge
  bx(kit, 'carbon', F, len / 2, C0 + 0.025, 0, len, 0.05, 0.045);                        // leading edge strip
  bx(kit, 'carbon', F, len / 2, C0 + ch(len / 2) / 2, 0.012, 0.025, ch(len / 2) * (torn ? 0.8 : 1), 0.02, 0);   // transverse stiffener
  for (const f of [0.25, 0.5, 0.75]) if (!torn || f < 0.6) bx(kit, 'trim', F, len / 2, C0 + cOut * f, 0.012, len, 0.014, 0.018, 0);
}

export function buildWing(kit, W) {
  const { s, n, len, c0, c1, mount } = W, eur = kit.eur, phi = W.phi, psi = W.psi, P = new V3(...W.p);
  const d = new V3(s * Math.cos(phi) * Math.cos(psi), Math.sin(phi), Math.cos(phi) * Math.sin(psi));
  const c = new V3(0, 0, 1).addScaledVector(d, -d.z).normalize(), nUp = new V3().crossVectors(c, d); if (nUp.y < 0) nUp.negate();
  const F = mk(P, d, c, nUp), U0 = 0.42, pitch = len + GAP, uEnd = U0 + n * pitch - GAP + 0.12, dmg = !!W.dmg;
  const ch = (u) => lerp(c0, c1, Math.min(1, Math.max(0, (u - U0) / (uEnd - 0.12 - U0))));      // chord at boom station u
  const u3 = U0 + 2 * pitch, bendB = -0.62;                // damaged wing: panel 3 folds down by 36° on its hinge

  // ───────── root: bracket, hinge barrel (ship-Z axis), gussets ─────────
  if (mount === 'flank') { kit.box('darkMetal', [P.x - s * 0.12, P.y - 0.02, P.z + 0.1], [0.28, 0.66, 1.15], { ext: true, bev: 0.025 }); kit.box('carbon', [P.x - s * 0.2, P.y - 0.02, P.z + 0.1], [0.12, 0.76, 1.25], { ext: true, bev: 0.02 }); }
  else { kit.box('darkMetal', [P.x, P.y - 0.15, P.z + 0.1], [0.62, 0.12, 1.1], { ext: true, bev: 0.02 }); kit.box('carbon', [P.x, P.y - 0.22, P.z + 0.1], [0.74, 0.06, 1.24], { ext: true, bev: 0.01 }); }
  kit.cyl('driveSteel', [P.x, P.y, P.z + 0.1], 0.115, 0.95, { axis: 'z', seg: 18, ext: true });
  for (const dz of [-0.3, 0.3]) kit.cyl('paintOrange', [P.x, P.y, P.z + 0.1 + dz], 0.122, 0.07, { axis: 'z', seg: 18, ext: true });
  for (const dz of [-0.5, 0.5]) kit.cyl('darkMetal', [P.x, P.y, P.z + 0.1 + dz], 0.15, 0.06, { axis: 'z', seg: 18, ext: true });

  // ───────── boom (leading spar) with accent bands; supply + return coolant lines ─────────
  const uB = dmg ? u3 : uEnd;
  bx(kit, 'darkMetal', F, uB / 2, 0.06, 0, uB, 0.1, 0.1, 0.012);
  for (let u = 0.9; u < uB - 0.2; u += 0.8) bx(kit, 'paintOrange', F, u, 0.06, 0, 0.07, 0.115, 0.115, 0.01);
  cylAB(kit, 'driveCopper', F.at(0.2, -0.045, 0.02), F.at(uB, -0.045, 0.02), 0.027, { seg: 8 });
  if (!dmg) cylAB(kit, 'driveCopper', F.at(0.2, C0 + ch(0.2) + 0.1, 0), F.at(uEnd - 0.1, C0 + ch(uEnd - 0.1) + 0.1, 0), 0.026, { seg: 8 });
  for (let u = 0.5; u < uB; u += 0.75) bx(kit, 'darkMetal', F, u, -0.045, 0.02, 0.05, 0.075, 0.075, 0.008);

  // ───────── panels + hinge headers ─────────
  for (let i = 0; i < n; i++) {
    const u = U0 + i * pitch, bent = dmg && i >= 2, gone = dmg && i >= 3;
    const Fi = bent ? bend(F, F.at(u3, 0, 0), bendB) : mk(F.at(u, 0, 0), d, c, nUp), uh = u - GAP / 2;
    if (!gone) panel(kit, Fi, len, ch(u), ch(u + len), dmg && i === 2);
    if (i > 0 && !(dmg && i > 3)) {                         // hinge header + knuckles + status LED
      const Fh = bent && i === 2 ? bend(F, F.at(u3, 0, 0), 0) : F, hu = i === 2 && bent ? u3 - GAP / 2 : uh, hc = ch(u);
      cylAB(kit, 'driveSteel', Fh.at(hu, C0 - 0.06), Fh.at(hu, C0 + hc + 0.06), 0.032, { seg: 10 });
      cylAB(kit, 'darkMetal', Fh.at(hu, C0 - 0.1), Fh.at(hu, C0 + 0.06), 0.052, { seg: 10 }); cylAB(kit, 'darkMetal', Fh.at(hu, C0 + hc - 0.06), Fh.at(hu, C0 + hc + 0.1), 0.052, { seg: 10 });
      if (!dmg || i < 3) bx(kit, eur ? 'screenOff' : kit.led('Cyan'), Fh, hu, C0 + hc + 0.1, 0.04, 0.028, 0.028, 0.012, 0);
    }
  }
  // tip weight with orange patch (intact wings)
  if (!dmg) { cylAB(kit, 'darkMetal', F.at(uEnd - 0.12, 0.06), F.at(uEnd + 0.1, 0.06), 0.065, { seg: 10 }); cylAB(kit, 'paintOrange', F.at(uEnd - 0.02, 0.06), F.at(uEnd + 0.04, 0.06), 0.07, { seg: 10 }); }

  // ───────── brace strut (barrel + rod) + coolant feed loop ─────────
  const anchor = mount === 'flank' ? new V3(P.x - s * 0.1, P.y - 0.78, P.z + 0.35) : new V3(P.x - s * 0.9, P.y - 0.1, P.z + 0.45), top = F.at(1.5, 0.06, -0.05), mid = anchor.clone().lerp(top, 0.52);
  cylAB(kit, 'darkMetal', anchor, mid, 0.06, { seg: 12 }); cylAB(kit, 'driveSteel', mid, top, 0.028, { seg: 8 });
  kit.sphere('driveSteel', [anchor.x, anchor.y, anchor.z], 0.07, { seg: 10, ext: true }); kit.sphere('driveSteel', [top.x, top.y, top.z], 0.06, { seg: 10, ext: true });
  const f0 = mount === 'flank' ? new V3(P.x - s * 0.22, P.y - 0.62, P.z - 0.1) : new V3(P.x, P.y - 0.2, P.z - 0.1);
  kit.tube('driveCopper', [[f0.x, f0.y, f0.z], [f0.x + s * 0.2, f0.y + 0.12, f0.z - 0.25], [P.x + s * 0.1, P.y - 0.12, P.z - 0.4], [P.x + s * 0.12, P.y + 0.02, P.z - 0.1]], 0.035, { seg: 16, rseg: 6, ext: true });

  // ───────── damage: splintered boom end, trailing cables, crumpled fragments ─────────
  if (dmg) {
    const Fb = bend(F, F.at(u3, 0, 0), bendB), tip = Fb.at(1.0, 0.06);
    bx(kit, 'darkMetal', Fb, 0.5, 0.06, 0, 1.0, 0.1, 0.1, 0.012);                              // bent boom segment (follows panel 3)
    bx(kit, 'darkMetal', Fb, 1.04, 0.1, 0.03, 0.2, 0.06, 0.07, 0.01); bx(kit, 'darkMetal', Fb, 1.08, 0.02, -0.03, 0.16, 0.05, 0.05, 0.008);   // jagged break
    const cab = (dx, dy, dz, r, mat) => kit.tube(mat, [[tip.x, tip.y, tip.z], [tip.x + dx * 0.3, tip.y + dy * 0.3 - 0.1, tip.z + dz * 0.4], [tip.x + dx * 0.7, tip.y + dy * 0.6 - 0.4, tip.z + dz * 0.9 + 0.3], [tip.x + dx, tip.y + dy - 0.5, tip.z + dz + 0.9]], r, { seg: 20, rseg: 5, ext: true });
    cab(0.5 * s, -0.5, 1.5, 0.028, 'rubber'); cab(0.2 * s, -0.9, 1.1, 0.02, 'driveCopper'); cab(0.9 * s, -0.2, 1.9, 0.018, 'paintOrange');
    for (const [uu, cc, ry] of [[0.2, 0.2, 0.5], [0.45, 0.35, -0.7], [0.1, 0.6, 1.1]]) {          // crumpled leading-edge fragments of panel 4
      const dd = Fb.d.clone().applyAxisAngle(Fb.nr, ry), cc2 = c.clone().applyAxisAngle(Fb.nr, ry);
      boxM(kit, 'carbon', basis(Fb.at(1.05 + uu, cc, 0.05 - uu * 0.2), dd, cc2, new V3().crossVectors(dd, cc2)), 0.2, 0.04, 0.03, 0.003);
    }
  }

  // ───────── collision AABB (wing + root) ─────────
  const pts = [P, F.at(uEnd, 0), F.at(uEnd, C0 + c1), F.at(U0, C0 + c0)], mn = new V3(1e9, 1e9, 1e9), mx = new V3(-1e9, -1e9, -1e9);
  if (dmg) { const Fb = bend(F, F.at(u3, 0, 0), bendB); pts.push(Fb.at(1.0, C0 + ch(u3)), Fb.at(1.0, 0)); }
  for (const q of pts) { mn.min(q); mx.max(q); }
  kit.hullColliders.push({ min: [mn.x - 0.15, mn.y - 0.15, mn.z - 0.15], max: [mx.x + 0.15, mx.y + 0.15, mx.z + 0.15] });
}

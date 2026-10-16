// HALCYON interior — construction kit: finish presets, wall/opening/floor/ceiling builders that emit merged geometry
// AND the matching colliders/floors, plus a small prop library (consoles, monitors, seating, plants, banners, signs).
// Everything is axis-aligned in SHIP SPACE metres (+X starboard, +Y up, −Z forward). Floor level of the main deck y = −1.2.
export const FY = -1.2;
const DIR = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] };

export function createPlan(THREE, G, T) {
  const { Vector3, Quaternion, Matrix4, Euler } = THREE;
  const B = {};
  const bk = (n) => B[n] || (B[n] = new G.Bucket(n));
  const colliders = [], floors = [], ceilings = [], fixtures = [], rooms = [];
  const W3 = [1, 1, 1];

  // ───────────── finishes: bucket (material) + tint + texture tile (m) ─────────────
  const FIN = {
    conc: { b: 'panel', col: [0.93, 0.9, 0.84], tile: [4, 4] },
    tube: { b: 'panel', col: [0.5, 0.55, 0.62], tile: [4, 4] },
    ops: { b: 'soft', col: [0.5, 0.56, 0.68], tile: [4, 4] },
    opsDark: { b: 'soft', col: [0.28, 0.32, 0.4], tile: [4, 4] },
    lounge: { b: 'wood', col: [1, 0.92, 0.82], tile: [2, 2] },
    plaster: { b: 'panel', col: [1.0, 0.9, 0.78], tile: [4, 4] },
    lab: { b: 'panel', col: [1.0, 1.02, 1.05], tile: [4, 4] },
    corr: { b: 'panel', col: [0.78, 0.8, 0.84], tile: [4, 4] },
    slate: { b: 'solid', col: [0.045, 0.05, 0.06], tile: [4, 4] },
    trim: { b: 'solid', col: [0.045, 0.05, 0.058], tile: [1, 1] },
    metal: { b: 'metal', col: [0.16, 0.18, 0.21], tile: [1, 1] },
    orange: { b: 'solid', col: [1.0, 0.2, 0.025], tile: [1, 1] },
    deckDark: { b: 'deck', col: [0.7, 0.72, 0.78], tile: [4, 4] },
    deck: { b: 'deck', col: [1, 1, 1], tile: [4, 4] },
    deckOps: { b: 'deck', col: [0.55, 0.62, 0.78], tile: [4, 4] },
    planks: { b: 'planks', col: [1, 1, 1], tile: [4, 4] },
    ceil: { b: 'ceil', col: [1, 1, 1], tile: [4, 4] },
    ceilDark: { b: 'ceil', col: [0.28, 0.3, 0.36], tile: [4, 4] },
    ceilWood: { b: 'wood', col: [0.95, 0.85, 0.72], tile: [2, 2] },
  };

  // ───────────── primitives ─────────────
  const fbox = (fin, x0, y0, z0, x1, y1, z1, faces, extra = {}) => {
    const f = typeof fin === 'string' ? FIN[fin] : fin;
    bk(f.b).box(x0, y0, z0, x1, y1, z1, { col: extra.col || f.col, tile: extra.tile || f.tile, faces, uvOff: extra.uvOff });
  };
  const col = (x0, y0, z0, x1, y1, z1, o = {}) => colliders.push({ min: [Math.min(x0, x1), y0, Math.min(z0, z1)], max: [Math.max(x0, x1), y1, Math.max(z0, z1)], wall: !!o.wall });
  const floorRect = (x0, z0, x1, z1, y) => floors.push({ min: [Math.min(x0, x1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(z0, z1)], y });

  /** floor slab: visual (+risers) and walkable rect */
  const floor = (fin, x0, z0, x1, z1, y, o = {}) => {
    fbox(fin, Math.min(x0, x1), (o.bottom ?? y - 0.5), Math.min(z0, z1), Math.max(x0, x1), y, Math.max(z0, z1), o.faces || 'pxnxpynypznz'.replace('ny', ''), o);
    if (!o.noWalk) floorRect(x0, z0, x1, z1, y);
  };
  const ceilRect = (fin, x0, z0, x1, z1, y, o = {}) => {
    fbox(fin, x0, y, z0, x1, y + 0.4, z1, 'ny', o);
    ceilings.push({ min: [Math.min(x0, x1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(z0, z1)], y });
  };
  const glowBox = (x0, y0, z0, x1, y1, z1, c, faces) => bk('glow').box(x0, y0, z0, x1, y1, z1, { col: c, faces: faces || 'pxnxpynypznz' });
  const lightPanel = (x0, z0, x1, z1, y, c = [3.4, 3.2, 2.9]) => glowBox(x0, y - 0.05, z0, x1, y, z1, c, 'ny');

  // ───────────── walls with openings ─────────────
  // wall thin in X ([xa,xb]) running along Z (z0..z1): ops are z-intervals. neg/pos = finish for the −X / +X face.
  // wall thin in Z ([za,zb]) running along X (x0..x1): ops are x-intervals. neg/pos = finish for the −Z / +Z face.
  function wallRun(alongZ, ta, tb, l0, l1, y0, y1, o = {}) {
    const ops = (o.ops || []).slice().sort((p, q) => p.a - q.a);
    const fn = o.neg || 'trim', fp = o.pos || 'trim', trim = o.trim || 'trim';
    const piece = (a, b, ya, yb) => {
      if (b - a < 1e-3 || yb - ya < 1e-3) return;
      const [X0, X1, Z0, Z1] = alongZ ? [ta, tb, a, b] : [a, b, ta, tb];
      fbox(fn, X0, ya, Z0, X1, yb, Z1, alongZ ? 'nx' : 'nz');
      fbox(fp, X0, ya, Z0, X1, yb, Z1, alongZ ? 'px' : 'pz');
      fbox(trim, X0, ya, Z0, X1, yb, Z1, alongZ ? 'pznzpyny' : 'pxnxpyny');
      if (!o.noCol) col(X0, ya, Z0, X1, yb, Z1, { wall: yb - ya > 1.5 });
    };
    let cur = l0;
    for (const op of ops) {
      piece(cur, op.a, y0, y1);
      if (op.top < y1) piece(op.a, op.b, op.top, y1);
      if (op.bottom != null && op.bottom > y0) piece(op.a, op.b, y0, op.bottom);
      cur = op.b;
      if (op.frame !== false) openingFrame(alongZ, ta, tb, op, y0, op.top, op.strip);
    }
    piece(cur, l1, y0, y1);
  }
  const wallAlongZ = (xa, xb, z0, z1, y0, y1, o) => wallRun(true, xa, xb, z0, z1, y0, y1, o);
  const wallAlongX = (za, zb, x0, x1, y0, y1, o) => wallRun(false, za, zb, x0, x1, y0, y1, o);

  // door/arch frame: dark jambs + header with an emissive strip on both faces
  function openingFrame(alongZ, ta, tb, op, y0, ytop, strip) {
    const j = 0.14, pad = 0.05, a = op.a, b = op.b;
    const mk = (l0, l1, ya, yb, faces) => {
      const [X0, X1, Z0, Z1] = alongZ ? [ta - pad, tb + pad, l0, l1] : [l0, l1, ta - pad, tb + pad];
      fbox('trim', X0, ya, Z0, X1, yb, Z1, faces);
    };
    const yb = op.bottom != null ? op.bottom : y0;
    mk(a - j, a, yb, ytop, 'pxnxpznz'); mk(b, b + j, yb, ytop, 'pxnxpznz');
    mk(a - j, b + j, ytop - 0.12, ytop + 0.1, 'pxnxpznzny');
    if (strip) {
      if (alongZ) { glowBox(ta - pad - 0.012, ytop - 0.1, a, ta - pad, ytop - 0.06, b, strip, 'nx'); glowBox(tb + pad, ytop - 0.1, a, tb + pad + 0.012, ytop - 0.06, b, strip, 'px'); }
      else { glowBox(a, ytop - 0.1, ta - pad - 0.012, b, ytop - 0.06, ta - pad, strip, 'nz'); glowBox(a, ytop - 0.1, tb + pad, b, ytop - 0.06, tb + pad + 0.012, strip, 'pz'); }
    }
  }

  // ───────────── local-frame helpers for props ─────────────
  function frameOf(ox, oz, facing) {
    const f = DIR[facing], r = [-f[1], f[0]];
    const wp = (u, w) => [ox + u * r[0] + w * f[0], oz + u * r[1] + w * f[1]];
    return { f, r, wp, yaw: Math.atan2(f[0], f[1]) };
  }
  /** axis-aligned box described in the prop's local frame (u = right, w = forward) */
  const lbox = (bucket, F, u0, u1, y0, y1, w0, w1, o = {}) => {
    const a = F.wp(u0, w0), b = F.wp(u1, w1);
    bk(bucket).box(Math.min(a[0], b[0]), y0, Math.min(a[1], b[1]), Math.max(a[0], b[0]), y1, Math.max(a[1], b[1]), { tile: 2, ...o });
  };
  const lcol = (F, u0, u1, y0, y1, w0, w1) => { const a = F.wp(u0, w0), b = F.wp(u1, w1); col(a[0], y0, a[1], b[0], y1, b[1]); };
  const tmpM = new Matrix4(), tmpQ = new Quaternion(), tmpE = new Euler(), tmpP = new Vector3(), tmpS = new Vector3();
  const compose = (x, y, z, rx, ry, rz, sx, sy, sz, order = 'YXZ') => tmpM.compose(tmpP.set(x, y, z), tmpQ.setFromEuler(tmpE.set(rx, ry, rz, order)), tmpS.set(sx, sy, sz));
  const planeGeo = new THREE.PlaneGeometry(1, 1);

  /** tilted monitor: bezel + screen (atlas cell) at local (u, y, w) facing −w (toward the operator) */
  function monitor(F, u, y, w, mw, mh, tilt, cell, o = {}) {
    const p = F.wp(u, w);
    const bez = o.bezel || [0.035, 0.04, 0.05];
    bk('solid').addGeo(G.unitBox(), compose(p[0], y, p[1], tilt, F.yaw, 0, mw, mh, 0.04).clone(), { col: bez });
    const c = T.screenCells[cell % 16];
    const off = new Vector3(0, 0, -0.0225).applyQuaternion(tmpQ.setFromEuler(tmpE.set(tilt, F.yaw, 0, 'YXZ')));
    const sm = compose(p[0] + off.x, y + off.y, p[1] + off.z, tilt, F.yaw + Math.PI, 0, mw * 0.93, mh * 0.88, 1);
    bk('screen').addGeo(planeGeo, sm.clone(), { col: o.tint || W3, su: c[2] - c[0], sv: c[3] - c[1], ou: c[0], ov: c[1] });
    bk('solid').addGeo(G.unitBox(), compose(p[0], y - mh / 2 - 0.07, p[1] + F.f[1] * 0.0, 0, F.yaw, 0, 0.06, 0.14, 0.06).clone(), { col: bez });
  }

  /** operator console: desk + 2–3 tilted monitors, chair clearance. Operator sits behind (−w), faces +w. */
  function consoleDesk(ox, oz, fy, facing, o = {}) {
    const F = frameOf(ox, oz, facing);
    const w = o.w ?? 3.2, d = o.d ?? 1.2, body = o.body || [0.1, 0.13, 0.18];
    lbox('solid', F, -w / 2, w / 2, fy, fy + 0.74, -d / 2, d / 2, { col: body });
    lbox('solid', F, -w / 2 - 0.04, w / 2 + 0.04, fy + 0.74, fy + 0.79, -d / 2 - 0.1, d / 2 + 0.03, { col: [0.2, 0.23, 0.28], tile: 1 });
    lbox('glow', F, -w / 2 + 0.12, w / 2 - 0.12, fy + 0.5, fy + 0.54, -d / 2 - 0.01, -d / 2 + 0.02, { col: o.strip || [0.15, 0.85, 1.3] });
    for (let k = 0; k < 6; k++) lbox('glow', F, -w / 2 + 0.3 + k * ((w - 0.6) / 5.5), -w / 2 + 0.36 + k * ((w - 0.6) / 5.5), fy + 0.795, fy + 0.805, -d / 2 + 0.06, -d / 2 + 0.2, { col: [k % 3 === 0 ? 1.8 : 0.3, k % 3 === 1 ? 1.6 : 0.5, 0.3], tile: 1 });
    const n = o.monitors ?? 3, cells = o.cells || [0, 1, 2];
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 0 : -w / 2 + 0.55 + k * ((w - 1.1) / (n - 1));
      monitor(F, u, fy + 1.12, d / 2 - 0.2, 0.74, 0.43, 0.2, cells[(k + (o.seed || 0)) % cells.length]);
    }
    lcol(F, -w / 2, w / 2, fy, fy + 0.8, -d / 2, d / 2);
    return F;
  }

  /** wall-mounted flat screen (atlas cell or a live texture mesh handled by caller) */
  function wallScreen(cellIdx, cx, cy, cz, facing, w, h) {
    const F = frameOf(cx, cz, facing), c = T.screenCells[cellIdx % 16];
    lbox('solid', F, -w / 2 - 0.06, w / 2 + 0.06, cy - h / 2 - 0.06, cy + h / 2 + 0.06, 0, 0.07, { col: [0.03, 0.035, 0.04], tile: 1 });
    const P = (u, y) => { const p = F.wp(u, 0.075); return [p[0], y, p[1]]; };
    const u0 = w / 2 * 0.96, y0 = cy - h / 2 * 0.94, y1 = cy + h / 2 * 0.94;       // viewer looks back along −f, so his left is +u
    bk('screen').quad(P(u0, y0), P(-u0, y0), P(-u0, y1), P(u0, y1), [[c[0], c[1]], [c[2], c[1]], [c[2], c[3]], [c[0], c[3]]], W3);
  }

  /** sofa along local +w (back at −w... faces +w) */
  function sofa(ox, oz, fy, facing, o = {}) {
    const F = frameOf(ox, oz, facing), w = o.w ?? 2.4, d = 0.9, c = o.col || [0.07, 0.2, 0.25], c2 = o.col2 || [0.09, 0.26, 0.32];
    lbox('fabric', F, -w / 2, w / 2, fy, fy + 0.4, -d / 2, d / 2, { col: c });
    lbox('fabric', F, -w / 2, w / 2, fy + 0.4, fy + 0.95, -d / 2, -d / 2 + 0.22, { col: c });
    lbox('fabric', F, -w / 2, -w / 2 + 0.2, fy + 0.4, fy + 0.66, -d / 2, d / 2, { col: c });
    lbox('fabric', F, w / 2 - 0.2, w / 2, fy + 0.4, fy + 0.66, -d / 2, d / 2, { col: c });
    const n = Math.max(1, Math.round(w / 0.8));
    for (let k = 0; k < n; k++) lbox('fabric', F, -w / 2 + 0.2 + (k * (w - 0.4)) / n + 0.02, -w / 2 + 0.2 + ((k + 1) * (w - 0.4)) / n - 0.02, fy + 0.4, fy + 0.52, -d / 2 + 0.22, d / 2 - 0.03, { col: c2 });
    lbox('metal', F, -w / 2 + 0.05, -w / 2 + 0.12, fy, fy + 0.07, -d / 2 + 0.05, d / 2 - 0.05, { col: [0.5, 0.45, 0.38] }); lbox('metal', F, w / 2 - 0.12, w / 2 - 0.05, fy, fy + 0.07, -d / 2 + 0.05, d / 2 - 0.05, { col: [0.5, 0.45, 0.38] });
    lcol(F, -w / 2, w / 2, fy, fy + 0.95, -d / 2, d / 2);
  }
  function table(cx, cz, fy, w, d, h = 0.45, o = {}) {
    const F = frameOf(cx, cz, '+x');
    lbox('wood', F, -d / 2, d / 2, fy + h - 0.05, fy + h, -w / 2, w / 2, { col: o.col || [0.9, 0.8, 0.66], tile: 2 });
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lbox('metal', F, a * (d / 2 - 0.08) - 0.025, a * (d / 2 - 0.08) + 0.025, fy, fy + h - 0.05, b * (w / 2 - 0.08) - 0.025, b * (w / 2 - 0.08) + 0.025, { col: [0.45, 0.4, 0.34] });
    col(cx - d / 2, fy, cz - w / 2, cx + d / 2, fy + h, cz + w / 2);
  }
  function bench(ox, oz, fy, facing, len, o = {}) {
    const F = frameOf(ox, oz, facing);
    lbox('wood', F, -len / 2, len / 2, fy + 0.42, fy + 0.48, -0.25, 0.25, { col: o.col || [0.85, 0.7, 0.52] });
    for (const u of [-len / 2 + 0.2, len / 2 - 0.2]) lbox('metal', F, u - 0.03, u + 0.03, fy, fy + 0.42, -0.2, 0.2, { col: [0.2, 0.22, 0.25] });
    lcol(F, -len / 2, len / 2, fy, fy + 0.5, -0.28, 0.28);
  }
  /** potted plant: pot + leaf blades */
  const leafGeo = new THREE.SphereGeometry(1, 6, 5);
  const _ly = new Vector3(0, 1, 0), _ld = new Vector3(), _lq = new Quaternion(), _ls = new Quaternion(), _lm = new Matrix4();
  function plant(x, z, fy, h = 1.4, o = {}) {
    const rr = G.rng(Math.floor(x * 31 + z * 17 + 7));
    const potR = o.pot ?? 0.3, potH = o.potH ?? 0.5;
    bk('solid').cyl([x, fy, z], [x, fy + potH, z], potR * 0.78, potR, 14, { col: o.potCol || [0.55, 0.28, 0.16], tile: 2 });
    bk('solid').cyl([x, fy + potH - 0.02, z], [x, fy + potH, z], potR * 0.98, potR * 0.98, 14, { col: [0.1, 0.07, 0.05] });
    const n = o.leaves ?? 13;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rr() * 0.6, lean = 0.3 + rr() * 0.75, len = h * (0.55 + rr() * 0.45);
      const g = [0.05 + rr() * 0.06, 0.26 + rr() * 0.22, 0.06 + rr() * 0.06];
      _ld.set(Math.cos(a) * Math.sin(lean), Math.cos(lean), Math.sin(a) * Math.sin(lean));
      _lq.setFromUnitVectors(_ly, _ld);
      _ls.setFromAxisAngle(_ld, a + 1.2); _lq.premultiply(_ls);
      const cx = x + _ld.x * len * 0.5, cy = fy + potH + _ld.y * len * 0.5, cz = z + _ld.z * len * 0.5;
      _lm.compose(tmpP.set(cx, cy, cz), _lq, tmpS.set(0.08 + rr() * 0.05, len * 0.5, 0.014));
      bk('leaf').addGeo(leafGeo, _lm.clone(), { col: g });
    }
    if (o.col !== false) col(x - potR, fy, z - potR, x + potR, fy + potH + 0.4, z + potR);
  }
  /** floor lamp / standing light: emits glow + registers a fixture */
  function lamp(x, z, fy, o = {}) {
    const h = o.h ?? 1.6, c = o.col || [2.6, 1.7, 0.8];
    bk('metal').cyl([x, fy, z], [x, fy + h - 0.2, z], 0.025, 0.025, 8, { col: [0.5, 0.42, 0.3] });
    bk('metal').cyl([x, fy, z], [x, fy + 0.03, z], 0.18, 0.18, 14, { col: [0.5, 0.42, 0.3] });
    bk('glow').cyl([x, fy + h - 0.34, z], [x, fy + h, z], 0.12, 0.2, 14, { col: c });
    col(x - 0.18, fy, z - 0.18, x + 0.18, fy + h, z + 0.18);
  }

  // ───────────── banners (cloth quads w/ gentle wave) ─────────────
  function banner(cx, ytop, cz, facing, cell, o = {}) {
    const F = frameOf(cx, cz, facing), w = o.w ?? 1.7, h = o.h ?? 5, c = T.bannerCells[cell];
    const geo = new THREE.PlaneGeometry(w, h, 6, 14);
    const pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); pa.setZ(i, Math.sin(y * 1.9 + cx * 0.7 + cz) * 0.045 * (1 - (y + h / 2) / h * 0.5) + Math.cos(x * 3.1 + y) * 0.015); }
    geo.computeVertexNormals();
    const p = F.wp(0, 0);
    bk('banner').addGeo(geo, compose(p[0], ytop - h / 2, p[1], 0, F.yaw, 0, 1, 1, 1).clone(), { su: c[2] - c[0], sv: c[3] - c[1], ou: c[0], ov: c[1] });
    lbox('metal', F, -w / 2 - 0.05, w / 2 + 0.05, ytop - 0.03, ytop + 0.05, -0.05, 0.05, { col: [0.2, 0.2, 0.22] });
    for (const u of [-w / 2 + 0.2, w / 2 - 0.2]) lbox('metal', F, u - 0.012, u + 0.012, ytop + 0.05, ytop + 0.6, -0.012, 0.012, { col: [0.18, 0.18, 0.2] });
  }
  /** wayfinding sign (atlas cell, aspect 8:1) facing `facing`, centre (cx, cy, cz) */
  function sign(id, cx, cy, cz, facing, w = 3) {
    const F = frameOf(cx, cz, facing), c = T.signCells[id]; if (!c) return;
    const h = w / 8, P = (u, y) => { const p = F.wp(u, 0.02); return [p[0], y, p[1]]; };
    bk('sign').quad(P(w / 2, cy - h / 2), P(-w / 2, cy - h / 2), P(-w / 2, cy + h / 2), P(w / 2, cy + h / 2), [[c[0], c[1]], [c[2], c[1]], [c[2], c[3]], [c[0], c[3]]], W3);
  }

  // ───────────── lights ─────────────
  /** a light fixture candidate for the proximity-driven light pool */
  const fixture = (x, y, z, rgb, intensity, dist, room) => fixtures.push({ pos: new Vector3(x, y, z), rgb, intensity, dist, room });

  return {
    B, bk, FIN, FY, colliders, floors, ceilings, fixtures, rooms,
    fbox, col, floorRect, floor, ceilRect, glowBox, lightPanel, wallAlongZ, wallAlongX, openingFrame,
    frameOf, lbox, lcol, compose, monitor, consoleDesk, wallScreen, sofa, table, bench, plant, lamp, banner, sign, fixture,
  };
}

// Small self-contained walk world: yaw-rotatable box colliders, cylinder colliders, flat/ramp floors. No dependency on WALK's helper.
const STEP = 0.45;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class WalkWorld {
  constructor() { this.colliders = []; this.floors = []; this.stepSound = 'metal'; }

  // Box collider (centre/size, optional yaw rotation about Y). opts: { yaw, door, name }
  box(cx, cy, cz, w, h, d, opts = {}) {
    const yaw = opts.yaw || 0;
    const c = { kind: 'box', cx, cz, hx: w / 2, hz: d / 2, y0: cy - h / 2, y1: cy + h / 2, c: Math.cos(yaw), s: Math.sin(yaw), yaw, door: !!opts.door, open: 0, name: opts.name || '', off: false };
    this.colliders.push(c); return c;
  }
  // Vertical cylinder collider
  cyl(cx, cy, cz, r, h, opts = {}) {
    const c = { kind: 'cyl', cx, cz, r, y0: cy - h / 2, y1: cy + h / 2, door: !!opts.door, open: 0, name: opts.name || '', off: false };
    this.colliders.push(c); return c;
  }
  // Flat floor (y) or ramp: y varies linearly along `axis` ('x'|'z') from y0 at min to y1 at max. opts: { step:'grate'|'metal'|…, enabled }
  floor(x0, z0, x1, z1, y0, y1 = y0, axis = null, opts = {}) {
    const f = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0, y1, axis: y0 === y1 ? null : axis, step: opts.step || null, enabled: opts.enabled !== false, name: opts.name || '' };
    this.floors.push(f); return f;
  }
  yAt(f, x, z) {
    if (!f.axis) return f.y0;
    const t = f.axis === 'z' ? (z - f.z0) / Math.max(f.z1 - f.z0, 1e-6) : (x - f.x0) / Math.max(f.x1 - f.x0, 1e-6);
    return f.y0 + (f.y1 - f.y0) * clamp(t, 0, 1);
  }
  _floor(x, z, yFeet) {
    let best = null, bf = null;
    for (const f of this.floors) {
      if (!f.enabled || x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue;
      const y = this.yAt(f, x, z);
      if (y <= yFeet + STEP && (best === null || y > best)) { best = y; bf = f; }
    }
    return bf ? { y: best, f: bf } : null;
  }
  floorAt(x, z, yFeet) { const r = this._floor(x, z, yFeet); return r ? r.y : null; }
  footstepAt(x, z, yFeet) { const r = this._floor(x, z, yFeet); return (r && r.f.step) || this.stepSound; }

  // push a feet-position vector out of colliders (xz only). p: {x,y,z} mutated.
  collide(p, radius, height) {
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const c of this.colliders) {
        if (c.off || (c.door && c.open > 0.5)) continue;
        if (p.y + height <= c.y0 + 0.02 || p.y >= c.y1 - 0.12) continue;
        if (c.kind === 'cyl') {
          const dx = p.x - c.cx, dz = p.z - c.cz, d = Math.hypot(dx, dz), R = c.r + radius;
          if (d < R) { const k = d > 1e-6 ? (R - d) / d : 0; if (d > 1e-6) { p.x += dx * k; p.z += dz * k; } else p.x += R; moved = true; }
          continue;
        }
        const dx = p.x - c.cx, dz = p.z - c.cz;
        const lx = c.c * dx - c.s * dz, lz = c.s * dx + c.c * dz;
        const qx = clamp(lx, -c.hx, c.hx), qz = clamp(lz, -c.hz, c.hz);
        const ex = lx - qx, ez = lz - qz, d2 = ex * ex + ez * ez;
        if (d2 >= radius * radius) continue;
        let nx, nz, push;
        if (d2 > 1e-10) { const d = Math.sqrt(d2); nx = ex / d; nz = ez / d; push = radius - d; }
        else {
          const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz);
          if (px < pz) { nx = lx >= 0 ? 1 : -1; nz = 0; push = px + radius; } else { nx = 0; nz = lz >= 0 ? 1 : -1; push = pz + radius; }
        }
        p.x += (nx * c.c + nz * c.s) * push; p.z += (-nx * c.s + nz * c.c) * push; moved = true;
      }
      if (!moved) break;
    }
  }
}

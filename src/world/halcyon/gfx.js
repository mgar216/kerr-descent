// HALCYON — shared procedural-graphics helpers (geometry buckets that merge into one mesh per material,
// surfaces of revolution, canvas helpers). No DOM/THREE import at module level: everything hangs off the THREE
// namespace the caller passes in (getGfx(THREE)), so the station modules work with whatever three instance the
// game uses.
const CACHE = new WeakMap();

export function getGfx(THREE) {
  let G = CACHE.get(THREE);
  if (!G) { G = makeGfx(THREE); CACHE.set(THREE, G); }
  return G;
}

function makeGfx(THREE) {
  const { Vector3, Matrix4, Matrix3, Quaternion } = THREE;
  const G = { THREE, TAU: Math.PI * 2 };
  const WHITE = [1, 1, 1];
  const _nm = new Matrix3();
  const _m = new Matrix4();
  const _q = new Quaternion();
  const _v = new Vector3();
  const _v2 = new Vector3();
  const Z_AXIS = new Vector3(0, 0, 1);
  const Y_AXIS = new Vector3(0, 1, 0);

  // ───────────── random + canvas helpers ─────────────
  G.rng = (seed = 1) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  G.cv = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return { c, g: c.getContext('2d'), w, h };
  };
  G.tex = (cv, o = {}) => {
    const t = new THREE.CanvasTexture(cv.c || cv);
    t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    const wrap = o.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.wrapS = o.wrapS ?? wrap; t.wrapT = o.wrapT ?? wrap;
    t.anisotropy = o.aniso ?? 8;
    t.needsUpdate = true;
    return t;
  };
  G.rrect = (g, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  };
  // text with manual letter spacing (works everywhere); align 'left' | 'center' | 'right'
  G.spaced = (g, str, x, y, spacing = 0, align = 'left') => {
    const chars = [...String(str)];
    const widths = chars.map((ch) => g.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    const prevAlign = g.textAlign; g.textAlign = 'left';
    chars.forEach((ch, i) => { g.fillText(ch, cx, y); cx += widths[i] + spacing; });
    g.textAlign = prevAlign;
    return total;
  };
  /** run a canvas-drawing function now and again once the web fonts (Orbitron/Rajdhani/Share Tech Mono) are ready */
  G.fontsThen = (fn) => {
    fn();
    try {
      if (document.fonts && document.fonts.load) {
        Promise.all([document.fonts.load('700 48px Orbitron'), document.fonts.load('600 32px Rajdhani'), document.fonts.load('16px "Share Tech Mono"')]).then(() => fn()).catch(() => {});
      }
    } catch (e) { /* no font API */ }
  };
  G.glowTex = (size = 128) => {
    const cv = G.cv(size, size), g = cv.g, h = size / 2;
    const gr = g.createRadialGradient(h, h, 0, h, h, h);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,0.85)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return G.tex(cv, { clamp: true });
  };

  // ───────────── geometry templates (shared, never mutated) ─────────────
  const tpl = {};
  G.unitBox = () => tpl.box || (tpl.box = new THREE.BoxGeometry(1, 1, 1));
  G.unitCyl = (segs = 16, open = false) => {
    const k = 'cyl' + segs + (open ? 'o' : '');
    return tpl[k] || (tpl[k] = new THREE.CylinderGeometry(1, 1, 1, segs, 1, open));
  };
  G.unitSphere = (ws = 24, hs = 16) => {
    const k = 'sph' + ws + 'x' + hs;
    return tpl[k] || (tpl[k] = new THREE.SphereGeometry(1, ws, hs));
  };
  G.compose = (px, py, pz, quat, sx = 1, sy = sx, sz = sx) => new Matrix4().compose(new Vector3(px, py, pz), quat || _q.identity(), new Vector3(sx, sy, sz));

  // ───────────── Bucket: accumulates triangles for one material, then builds ONE merged Mesh ─────────────
  class Bucket {
    constructor(name = 'bucket') { this.name = name; this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; this.vc = 0; }
    get empty() { return this.vc === 0; }

    _vert(x, y, z, nx, ny, nz, u, v, col) {
      this.p.push(x, y, z); this.n.push(nx, ny, nz); this.u.push(u, v); this.c.push(col[0], col[1], col[2]);
      return this.vc++;
    }

    /** arbitrary quad, corners CCW seen from the front; uvs = [[u,v]×4] (default 0..1) */
    quad(a, b, c, d, uvs, col = WHITE) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      uvs = uvs || [[0, 0], [1, 0], [1, 1], [0, 1]];
      const i0 = this._vert(a[0], a[1], a[2], nx, ny, nz, uvs[0][0], uvs[0][1], col);
      const i1 = this._vert(b[0], b[1], b[2], nx, ny, nz, uvs[1][0], uvs[1][1], col);
      const i2 = this._vert(c[0], c[1], c[2], nx, ny, nz, uvs[2][0], uvs[2][1], col);
      const i3 = this._vert(d[0], d[1], d[2], nx, ny, nz, uvs[3][0], uvs[3][1], col);
      this.i.push(i0, i1, i2, i0, i2, i3);
      return this;
    }

    /**
     * Axis-aligned box with WORLD-aligned metric UVs (seamless across neighbouring boxes).
     * o: { col, tile:[tu,tv]|n, faces:'pxnxpynypznz' substring list or array (default all), cols:{px:[r,g,b],…}, uvOff:[ou,ov] }
     */
    box(x0, y0, z0, x1, y1, z1, o = {}) {
      if (x1 < x0) [x0, x1] = [x1, x0];
      if (y1 < y0) [y0, y1] = [y1, y0];
      if (z1 < z0) [z0, z1] = [z1, z0];
      const t = o.tile == null ? [4, 4] : typeof o.tile === 'number' ? [o.tile, o.tile] : o.tile;
      const tu = t[0], tv = t[1];
      const ou = o.uvOff ? o.uvOff[0] : 0, ov = o.uvOff ? o.uvOff[1] : 0;
      const faces = o.faces == null ? ['px', 'nx', 'py', 'ny', 'pz', 'nz'] : typeof o.faces === 'string' ? o.faces.match(/[pn][xyz]/g) || [] : o.faces;
      const base = o.col || WHITE;
      for (const f of faces) {
        const col = (o.cols && o.cols[f]) || base;
        let P, nx = 0, ny = 0, nz = 0, U, V;
        switch (f) {
          case 'px': P = [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]]; nx = 1; U = (q) => -q[2]; V = (q) => q[1]; break;
          case 'nx': P = [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]; nx = -1; U = (q) => q[2]; V = (q) => q[1]; break;
          case 'py': P = [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]]; ny = 1; U = (q) => q[0]; V = (q) => -q[2]; break;
          case 'ny': P = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]; ny = -1; U = (q) => q[0]; V = (q) => q[2]; break;
          case 'pz': P = [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]; nz = 1; U = (q) => q[0]; V = (q) => q[1]; break;
          case 'nz': P = [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]; nz = -1; U = (q) => -q[0]; V = (q) => q[1]; break;
          default: continue;
        }
        const ids = P.map((q) => this._vert(q[0], q[1], q[2], nx, ny, nz, U(q) / tu + ou, V(q) / tv + ov, col));
        this.i.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
      }
      return this;
    }

    /** add any THREE.BufferGeometry (position/normal/uv, indexed or not) with a Matrix4. o: { col, su, sv, ou, ov } */
    addGeo(geo, m, o = {}) {
      const pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv;
      const n = pa.count, col = o.col || WHITE;
      const su = o.su ?? 1, sv = o.sv ?? 1, ou = o.ou ?? 0, ov = o.ov ?? 0;
      const base = this.vc;
      const e = m ? m.elements : null;
      const nm = m ? _nm.getNormalMatrix(m).elements : null;
      for (let i = 0; i < n; i++) {
        let x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
        let nx = na ? na.getX(i) : 0, ny = na ? na.getY(i) : 1, nz = na ? na.getZ(i) : 0;
        if (e) {
          const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14];
          const NX = nm[0] * nx + nm[3] * ny + nm[6] * nz, NY = nm[1] * nx + nm[4] * ny + nm[7] * nz, NZ = nm[2] * nx + nm[5] * ny + nm[8] * nz;
          const l = Math.hypot(NX, NY, NZ) || 1;
          x = X; y = Y; z = Z; nx = NX / l; ny = NY / l; nz = NZ / l;
        }
        this._vert(x, y, z, nx, ny, nz, (ua ? ua.getX(i) : 0) * su + ou, (ua ? ua.getY(i) : 0) * sv + ov, col);
      }
      if (geo.index) { const ia = geo.index; for (let i = 0; i < ia.count; i++) this.i.push(base + ia.getX(i)); }
      else for (let i = 0; i < n; i++) this.i.push(base + i);
      return this;
    }

    /** box between two points a→b (square/rect section w×h, long axis = a→b); `up` hints the h direction */
    strut(a, b, w, h = w, o = {}) {
      _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const L = _v.length(); if (L < 1e-6) return this;
      _v.multiplyScalar(1 / L);
      _q.setFromUnitVectors(Z_AXIS, _v);
      if (o.roll) { const rq = new Quaternion().setFromAxisAngle(_v, o.roll); _q.premultiply(rq); }
      _m.compose(_v2.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q, new Vector3(w, h, L));
      return this.addGeo(G.unitBox(), _m, o);
    }

    /** cylinder/frustum between points: radii ra (at a) → rb (at b) */
    cyl(a, b, ra, rb = ra, segs = 12, o = {}) {
      _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const L = _v.length(); if (L < 1e-6) return this;
      _v.multiplyScalar(1 / L);
      _q.setFromUnitVectors(Y_AXIS, _v);
      _m.compose(_v2.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q, new Vector3(1, L, 1));
      // template radius 1 → build a tapered clone cheaply by choosing radiusTop/Bottom per call
      const g = o.open ? new THREE.CylinderGeometry(rb, ra, 1, segs, 1, true) : new THREE.CylinderGeometry(rb, ra, 1, segs, 1, false);
      const su = o.su ?? (Math.PI * 2 * Math.max(ra, rb) / (o.tile || 8)), sv = o.sv ?? (L / (o.tile || 8));
      this.addGeo(g, _m, { col: o.col, su, sv });
      g.dispose();
      return this;
    }

    sphere(c, r, o = {}) {
      const sx = o.sx ?? 1, sy = o.sy ?? 1, sz = o.sz ?? 1;
      _m.compose(_v.set(c[0], c[1], c[2]), o.quat || _q.identity(), _v2.set(r * sx, r * sy, r * sz));
      return this.addGeo(G.unitSphere(o.ws || 24, o.hs || 16), _m, o);
    }

    /**
     * Surface of revolution about the +Z axis: the profile segment (r0,z0)→(r1,z1) is swept around Z.
     * Outward normal = (dz, −dr) — traverse a silhouette nose→tail (increasing z) and normals point outwards.
     * o: { segs, a0, a1, xf:Matrix4, col, tile:[tu,tv]|n, uRep, v0, v1, vz:true (v = z/tile), flipU, vOff }
     */
    revolve(r0, z0, r1, z1, o = {}) {
      const dr = r1 - r0, dz = z1 - z0, len = Math.hypot(dr, dz);
      if (len < 1e-6) return this;
      const segs = o.segs || 32;
      const a0 = o.a0 ?? 0, a1 = o.a1 ?? G.TAU;
      const nr = dz / len, nzp = -dr / len;
      const col = o.col || WHITE;
      const t = o.tile == null ? [16, 16] : typeof o.tile === 'number' ? [o.tile, o.tile] : o.tile;
      const span = Math.abs(a1 - a0);
      const rAvg = Math.max((r0 + r1) / 2, 0.001);
      let uRep = o.uRep;
      if (uRep == null) uRep = Math.max(1, Math.round(span * rAvg / t[0]));
      let vA, vB;
      if (o.v0 != null) { vA = o.v0; vB = o.v1; }
      else if (o.vz) { vA = z0 / t[1]; vB = z1 / t[1]; }
      else { vA = (o.vOff || 0); vB = vA + len / t[1]; }
      const e = o.xf ? o.xf.elements : null;
      const base = this.vc;
      for (let i = 0; i <= segs; i++) {
        const f = i / segs, th = a0 + (a1 - a0) * f, c = Math.cos(th), s = Math.sin(th);
        const u = (o.flipU ? 1 - f : f) * uRep;
        for (let k = 0; k < 2; k++) {
          const r = k ? r1 : r0, z = k ? z1 : z0;
          let x = r * c, y = r * s, zz = z, nx = nr * c, ny = nr * s, nz = nzp;
          if (e) {
            const X = e[0] * x + e[4] * y + e[8] * zz + e[12], Y = e[1] * x + e[5] * y + e[9] * zz + e[13], Z = e[2] * x + e[6] * y + e[10] * zz + e[14];
            const NX = e[0] * nx + e[4] * ny + e[8] * nz, NY = e[1] * nx + e[5] * ny + e[9] * nz, NZ = e[2] * nx + e[6] * ny + e[10] * nz;
            x = X; y = Y; zz = Z; nx = NX; ny = NY; nz = NZ;
          }
          this._vert(x, y, zz, nx, ny, nz, u, k ? vB : vA, col);
        }
      }
      for (let i = 0; i < segs; i++) {
        const a = base + i * 2, b = a + 1, c2 = a + 2, d = a + 3;
        this.i.push(a, c2, d, a, d, b);
      }
      return this;
    }

    /**
     * Decal patch on a cylinder wall about Z: u runs along z (z0→z1), v runs along the angle (th0→th1).
     * flipU / flipV mirror the mapping so text can be oriented per viewer. o: { nt, col, xf, flipU, flipV }
     */
    cylPatch(r, z0, z1, th0, th1, o = {}) {
      const nt = o.nt || Math.max(2, Math.ceil(Math.abs(th1 - th0) / 0.08));
      const col = o.col || WHITE, e = o.xf ? o.xf.elements : null;
      const base = this.vc;
      for (let j = 0; j <= nt; j++) {
        const f = j / nt, th = th0 + (th1 - th0) * f, c = Math.cos(th), s = Math.sin(th);
        for (let k = 0; k < 2; k++) {
          let x = r * c, y = r * s, z = k ? z1 : z0, nx = c, ny = s, nz = 0;
          if (e) {
            const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14];
            const NX = e[0] * nx + e[4] * ny, NY = e[1] * nx + e[5] * ny, NZ = e[2] * nx + e[6] * ny;
            x = X; y = Y; z = Z; nx = NX; ny = NY; nz = NZ;
          }
          const u = o.flipU ? (k ? 0 : 1) : (k ? 1 : 0), v = o.flipV ? 1 - f : f;
          this._vert(x, y, z, nx, ny, nz, u, v, col);
        }
      }
      for (let j = 0; j < nt; j++) { const a = base + j * 2; this.i.push(a, a + 2, a + 3, a, a + 3, a + 1); }
      return this;
    }

    /** sweep a polyline of [r, z, ?opts] points. Per-segment options come from the START point's 3rd entry. */
    lathe(pts, o = {}) {
      for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i], Bp = pts[i + 1];
        this.revolve(A[0], A[1], Bp[0], Bp[1], A[2] ? { ...o, ...A[2] } : o);
      }
      return this;
    }

    /** build the merged mesh (null when empty) */
    build(material) {
      if (!this.vc) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.setIndex(new THREE.BufferAttribute(this.vc > 65535 ? new Uint32Array(this.i) : new Uint16Array(this.i), 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      const mesh = new THREE.Mesh(g, material);
      mesh.name = this.name;
      this.p = this.n = this.u = this.c = this.i = null; // free JS arrays
      return mesh;
    }
  }
  G.Bucket = Bucket;

  return G;
}

// ORPHEUS · surface POI kit — shared helpers + the `env` object handed to every POI builder (poi_<biome>.js).
// Used by surface.js (real terrain) and dev/surface_poi.html (stand-alone prop harness).
//
//   export function buildPois(env) → { group, interactables, colliders, lights?, update?(dt, t, camPos), dispose?() }
//
// All coordinates are SHIP SPACE metres (see sites.js). Builders put absolute positions into `group` (never offset the group itself).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ───────────────────────────── small utilities ─────────────────────────────
export function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hashStr(s) { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();

/** apply position / euler rotation / scale to a geometry (in place) and return it — convenient for building mergeable parts. */
export function xf(geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
  _e.set(rot[0], rot[1], rot[2], 'YXZ'); _q.setFromEuler(_e);
  const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
  _m4.compose(_v1.set(pos[0], pos[1], pos[2]), _q, _v2.set(s[0], s[1], s[2]));
  geo.applyMatrix4(_m4);
  return geo;
}

/** merge geometries that were all made from THREE primitives (position/normal/uv). Non-indexed fallback for mixed sets. */
export function mergeGeos(geos) {
  const g = geos.filter(Boolean);
  if (!g.length) return new THREE.BufferGeometry();
  const idx = g.every((x) => x.index);
  const list = idx ? g : g.map((x) => (x.index ? x.toNonIndexed() : x));
  for (const x of list) { for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') x.deleteAttribute(k); if (!x.attributes.uv) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); }
  return mergeGeometries(list, false) || new THREE.BufferGeometry();
}

// ───────────────────────────── canvas texture helpers ─────────────────────────────
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/** CanvasTexture from a draw callback `draw(g, w, h)`. opts: { srgb=true, repeat:[x,y], wrap=true, aniso=8 } */
export function canvasTexture(w, h, draw, opts = {}) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.wrap !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  t.anisotropy = opts.aniso ?? 8;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

/** speckle / grime / streak overlay for use inside draw callbacks. opts: { amount, color:'rgba(..)', size:[min,max], streaks, streakColor, seed } */
export function grime(g, w, h, opts = {}) {
  const r = mulberry32(opts.seed ?? 7), n = Math.floor((opts.amount ?? 0.5) * w * h / 90), sz = opts.size || [0.6, 2.4];
  g.save();
  g.fillStyle = opts.color || 'rgba(20,18,16,0.20)';
  for (let i = 0; i < n; i++) { const s = sz[0] + r() * (sz[1] - sz[0]); g.fillRect(r() * w, r() * h, s, s); }
  const ns = Math.floor(opts.streaks ?? 0);
  for (let i = 0; i < ns; i++) {
    const x = r() * w, y0 = r() * h * 0.5, len = h * (0.15 + r() * 0.5), wd = 1 + r() * 4;
    const gr = g.createLinearGradient(0, y0, 0, y0 + len);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.2, opts.streakColor || 'rgba(30,24,18,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x, y0, wd, len);
  }
  g.restore();
}

/** painted survey-hab panel texture: seams, rivets, grime. opts: { base, trim, w, h, cols, rows, rivets, seed, grimeAmt } */
export function panelTexture(opts = {}) {
  const W = opts.w || 512, H = opts.h || 512, cols = opts.cols || 4, rows = opts.rows || 4, r = mulberry32(opts.seed ?? 3);
  return canvasTexture(W, H, (g, w, h) => {
    g.fillStyle = opts.base || '#d9dcdc'; g.fillRect(0, 0, w, h);
    const cw = w / cols, ch = h / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const sh = (r() - 0.5) * 14; g.fillStyle = `rgba(${sh > 0 ? 255 : 0},${sh > 0 ? 255 : 0},${sh > 0 ? 255 : 0},${Math.abs(sh) / 255})`;
      g.fillRect(i * cw, j * ch, cw, ch);
    }
    g.strokeStyle = 'rgba(40,44,48,0.55)'; g.lineWidth = 2;
    for (let i = 0; i <= cols; i++) { g.beginPath(); g.moveTo(i * cw, 0); g.lineTo(i * cw, h); g.stroke(); }
    for (let j = 0; j <= rows; j++) { g.beginPath(); g.moveTo(0, j * ch); g.lineTo(w, j * ch); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
    for (let i = 0; i <= cols; i++) { g.beginPath(); g.moveTo(i * cw + 2, 0); g.lineTo(i * cw + 2, h); g.stroke(); }
    if (opts.rivets !== false) {
      g.fillStyle = 'rgba(60,64,68,0.8)';
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) for (const [ox, oy] of [[6, 6], [cw - 6, 6], [6, ch - 6], [cw - 6, ch - 6]]) { g.beginPath(); g.arc(i * cw + ox, j * ch + oy, 1.8, 0, 7); g.fill(); }
    }
    grime(g, w, h, { amount: opts.grimeAmt ?? 0.6, streaks: 14, seed: (opts.seed ?? 3) + 5 });
  }, { repeat: opts.repeat });
}

/** hazard / accent stripe texture. opts: { a, b, n, w, h, angle } */
export function stripeTexture(opts = {}) {
  const W = opts.w || 256, H = opts.h || 64, n = opts.n || 8;
  return canvasTexture(W, H, (g, w, h) => {
    g.fillStyle = opts.b || '#16181b'; g.fillRect(0, 0, w, h);
    g.fillStyle = opts.a || '#f0b400';
    const sw = w / n;
    for (let i = -2; i < n * 2; i++) { g.beginPath(); g.moveTo(i * sw, h); g.lineTo(i * sw + sw / 2, h); g.lineTo(i * sw + sw / 2 + h, 0); g.lineTo(i * sw + h, 0); g.closePath(); g.fill(); }
  });
}

/** plate/label texture: lines of text on a coloured plate. opts: { w,h,bg,fg,border,font,align,pad,sub } */
export function labelTexture(lines, opts = {}) {
  const arr = Array.isArray(lines) ? lines : [lines];
  const W = opts.w || 512, H = opts.h || 256;
  return canvasTexture(W, H, (g, w, h) => {
    g.fillStyle = opts.bg || '#17191d'; g.fillRect(0, 0, w, h);
    if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = opts.borderW || 6; g.strokeRect(g.lineWidth / 2 + 4, g.lineWidth / 2 + 4, w - g.lineWidth - 8, h - g.lineWidth - 8); }
    g.fillStyle = opts.fg || '#e8eef2'; g.textBaseline = 'middle'; g.textAlign = opts.align || 'center';
    const fs = opts.size || Math.min(64, (h - 40) / Math.max(arr.length, 1) * 0.82);
    g.font = opts.font || `600 ${fs}px Rajdhani, "Segoe UI", Arial, sans-serif`;
    const x = opts.align === 'left' ? (opts.pad ?? 28) : opts.align === 'right' ? w - (opts.pad ?? 28) : w / 2;
    arr.forEach((ln, i) => g.fillText(ln, x, h / 2 + (i - (arr.length - 1) / 2) * fs * 1.18));
  }, { wrap: false, ...opts });
}

// ───────────────────────────── the kit ─────────────────────────────
function makeKit(env) {
  const { ctx } = env;
  const kit = {
    THREE, mulberry32, hashStr, xf, mergeGeos, canvasTexture, grime, panelTexture, stripeTexture, labelTexture,

    /** seeded random for this site/poi: kit.rng('hab') → () => [0,1) */
    rng: (name = '') => mulberry32(hashStr(`${env.bodyId}/${env.siteId}/${name}`) ^ (env.site.seed | 0)),

    /** MeshStandardMaterial with the atmosphere fog patch + sky reflection. Same options as THREE.MeshStandardMaterial plus { env:false } to skip envMap. */
    std(o = {}) {
      const { env: useEnv, ...rest } = o;
      const m = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.7, metalness: 0.0, ...rest });
      if (useEnv !== false && env.envMap) { m.envMap = env.envMap; m.envMapIntensity = rest.envMapIntensity ?? 0.7; }
      return env.fog(m);
    },
    /** HDR emissive unlit material (colour × intensity may exceed 1 → blooms). Light fixtures 3–12, screens 0.8–2.5. */
    glow(color = 0xffa040, intensity = 4, o = {}) {
      const c = new THREE.Color(color).multiplyScalar(intensity);
      return new THREE.MeshBasicMaterial({ color: c, toneMapped: false, fog: false, ...o });
    },
    /** emissive screen from a canvas texture (e.g. kit.labelTexture / your own canvasTexture) */
    screen(tex, intensity = 1.4, o = {}) {
      return new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(intensity, intensity, intensity), toneMapped: false, fog: false, ...o });
    },
    /** translucent glass / ice-like pane */
    glass(o = {}) {
      return env.fog(new THREE.MeshStandardMaterial({ color: 0x9fc8d8, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.32, depthWrite: false, envMap: env.envMap || null, envMapIntensity: 1.2, side: THREE.DoubleSide, ...o }));
    },
    /** non-shadowing point light. budget: ≤ 2 per POI. */
    pointLight(color = 0xff9a50, intensity = 10, distance = 16, pos = [0, 0, 0]) {
      const l = new THREE.PointLight(color, intensity, distance, 2); l.position.set(pos[0], pos[1], pos[2]); l.castShadow = false;
      return l;
    },

    /** drop an object on the terrain: position.y = groundY + lift; optional yaw and slope alignment. */
    onGround(obj, x, z, { yaw = 0, lift = 0, align = false } = {}) {
      obj.position.set(x, env.groundY(x, z) + lift, z); obj.rotation.set(0, yaw, 0);
      if (align) { const n = env.groundNormal(x, z, _v1); _q.setFromUnitVectors(_v2.set(0, 1, 0), n); obj.quaternion.premultiply(_q); }
      return obj;
    },
    /** lowest and average ground y under a footprint (rect centred x,z half extents hx,hz rotated by yaw) — to size foundations/stilts */
    footprint(x, z, hx, hz, yaw = 0) {
      const c = Math.cos(yaw), s = Math.sin(yaw); let lo = Infinity, hi = -Infinity, sum = 0, n = 0;
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const lx = a * hx, lz = b * hz, wx = x + lx * c + lz * s, wz = z - lx * s + lz * c, y = env.groundY(wx, wz);
        lo = Math.min(lo, y); hi = Math.max(hi, y); sum += y; n++;
      }
      return { lo, hi, avg: sum / n };
    },

    /** pulsing beacon (emissive bulb + point light). returns { group, light, update(t) }. opts: { color, intensity, range, period, duty, size, lightI } */
    beacon(pos, o = {}) {
      const color = o.color ?? 0xff8a2a, g = new THREE.Group(); g.position.set(pos[0], pos[1], pos[2]);
      const bulbMat = kit.glow(color, 9, { toneMapped: false });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(o.size ?? 0.07, 12, 8), bulbMat); g.add(bulb);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry((o.size ?? 0.07) * 0.9, (o.size ?? 0.07) * 1.2, (o.size ?? 0.07) * 1.4, 12), kit.std({ color: 0x23272b, roughness: 0.5, metalness: 0.6 }));
      cap.position.y = -(o.size ?? 0.07) * 1.3; g.add(cap);
      const light = kit.pointLight(color, o.lightI ?? 10, o.range ?? 16, [0, 0.05, 0]); g.add(light);
      const period = o.period ?? 2.4, duty = o.duty ?? 0.14, base = o.lightI ?? 10, phase = (o.phase ?? Math.random()) * period;
      const api = {
        group: g, light, bulb,
        update(t) { const p = ((t + phase) % period) / period; const k = p < duty ? Math.sin(p / duty * Math.PI) : 0.04; light.intensity = base * k; bulbMat.color.setRGB(...new THREE.Color(color).multiplyScalar(0.8 + 9 * k).toArray()); },
      };
      return api;
    },

    /** rugged field recorder (the "log" prop): case on a tripod with blinking REC LED + readout. opts: { title, sub, accent, scale } → Group */
    recorder(o = {}) {
      const accent = o.accent || '#ff9b3a', g = new THREE.Group(), s = o.scale ?? 1;
      const case_ = kit.std({ color: 0x2b2f34, roughness: 0.55, metalness: 0.35 }), rubber = kit.std({ color: 0x14161a, roughness: 0.9 }), orange = kit.std({ color: new THREE.Color(accent), roughness: 0.5 });
      const body = new THREE.Mesh(mergeGeos([
        xf(new THREE.BoxGeometry(0.36, 0.2, 0.26), [0, 0.0, 0]),
        xf(new THREE.BoxGeometry(0.08, 0.22, 0.28), [-0.2, 0, 0]), xf(new THREE.BoxGeometry(0.08, 0.22, 0.28), [0.2, 0, 0]),
      ]), case_); body.castShadow = true; g.add(body);
      const guards = new THREE.Mesh(mergeGeos([xf(new THREE.BoxGeometry(0.1, 0.04, 0.3), [-0.2, 0.12, 0]), xf(new THREE.BoxGeometry(0.1, 0.04, 0.3), [0.2, 0.12, 0]), xf(new THREE.BoxGeometry(0.1, 0.04, 0.3), [-0.2, -0.12, 0]), xf(new THREE.BoxGeometry(0.1, 0.04, 0.3), [0.2, -0.12, 0])]), rubber); g.add(guards);
      const tex = labelTexture([o.title || 'FIELD LOG', o.sub || ''], { w: 256, h: 96, bg: '#0b1519', fg: accent, size: 30, border: accent, borderW: 3 });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.082), kit.screen(tex, 1.5)); scr.position.set(0, 0.015, 0.131); g.add(scr);
      const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), kit.std({ color: 0x0c0d0f, roughness: 0.8 })); grille.position.set(0, -0.06, 0.131); g.add(grille);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 14, Math.PI), rubber); handle.rotation.set(0, 0, 0); handle.position.set(0, 0.1, 0); g.add(handle);
      const ledMat = kit.glow(0xff2a1a, 8); const led = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), ledMat); led.position.set(0.12, 0.075, 0.133); g.add(led);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.42, 5), kit.std({ color: 0x9aa0a6, metalness: 0.8, roughness: 0.3 })); ant.position.set(-0.19, 0.31, -0.05); g.add(ant);
      // tripod
      const legM = kit.std({ color: 0x6d747b, metalness: 0.7, roughness: 0.4 });
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.4; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.62, 6), legM); leg.position.set(Math.sin(a) * 0.17, -0.31, Math.cos(a) * 0.17); leg.rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3); g.add(leg); }
      g.position.y = 0.0; g.scale.setScalar(s);
      g.userData.led = ledMat; g.userData.ledUpdate = (t) => { const k = (Math.sin(t * 4.2) > 0.2) ? 8 : 0.6; ledMat.color.setRGB(k, k * 0.14, k * 0.1); };
      return g;
    },

    /** interactable spec. use() → recorder click (logs), ctx.say(lineId), codex unlocks, bus 'interact'. pos: THREE.Vector3 (ship space) */
    interactable(spec) {
      const { id, label, pos, radius = 2.4, object, lineId, codex = [], log = false, extra, enabled } = spec;
      const lineToPlay = lineId || id;
      const codexIds = [...new Set([...(env.siteCodexId ? [env.siteCodexId] : []), ...(log && lineId ? [env.logCodexId ? env.logCodexId(lineId) : lineId] : []), ...codex])];
      return {
        id, label, pos: pos.clone ? pos.clone() : new THREE.Vector3(pos[0], pos[1], pos[2]), radius, object, enabled,
        use() {
          if (log) env.recorderClick();
          if (lineId !== null) ctx.say?.(lineToPlay);
          for (const c of codexIds) ctx.codex?.unlock?.(c);
          const seen = env.interactSeen;                    // WALK emits 'interact' itself before calling use(); don't double-emit
          if (!(seen && seen.id === id && performance.now() - seen.t < 400)) ctx.bus?.emit?.('interact', { id });
          extra?.();
        },
      };
    },

    /** colliders (ship space). AABB: {min:[x,y,z],max:[x,y,z]}; cylinder: {x,z,r,y0,y1}. */
    box(min, max) { return { min: [...min], max: [...max] }; },
    cyl(x, z, r, y0, y1) { return { x, z, r, y0, y1 }; },
    /** world AABB of an object as a collider (call after positioning). shrink: metres to inset on each side. */
    objectBox(obj, shrink = 0) {
      obj.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(obj);
      return { min: [b.min.x + shrink, b.min.y, b.min.z + shrink], max: [b.max.x - shrink, b.max.y, b.max.z - shrink] };
    },

    /** shadow flags in bulk */
    shadows(obj, cast = true, receive = true) { obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } }); return obj; },
  };
  return kit;
}

/**
 * Build the env handed to POI builders. `o` fields:
 *  ctx, bodyId, siteId, site (SITES def), body (catalog-like), groundY(x,z), groundNormal(x,z,out), seaLevelY|null, features, sunDir (live THREE.Vector3),
 *  fog(material), envMap, shipPad {x,z,r}, palette
 */
export function createPoiEnv(o) {
  const env = {
    THREE, ctx: o.ctx, bodyId: o.bodyId, siteId: o.siteId, biome: o.site.biome, body: o.body, site: o.site,
    slots: o.site.slots, features: o.features || {}, sunDir: o.sunDir, seaLevelY: o.seaLevelY ?? null,
    groundY: o.groundY, groundNormal: o.groundNormal, shipPad: o.shipPad || { x: 0, z: 18, r: 34 },
    fog: o.fog || ((m) => m), envMap: o.envMap || null,
    palette: o.palette || {},
    siteCodexId: `site.${o.bodyId}.${o.siteId}`,
    logCodexId: (lineId) => lineId,                       // codex entry id for a log line (log.<body>.<n>)
    recorderClick() { const a = o.ctx.audio; try { if (a?.ready) { a.oneShotNoise('bandpass', 2600, 4, 0.12, 0.002, 0.05, 0, 0.1); a.tone(1900, 0.03, 'square', 0.025); a.tone(1250, 0.05, 'square', 0.02, a.sfx, 0.07); } } catch { /* audio optional */ } },
    rng: null, kit: null, interactSeen: { id: null, t: 0 },
  };
  env.kit = makeKit(env); env.rng = env.kit.rng;
  return env;
}

/** generic disposal for a built group (skips resources flagged userData.shared) */
export function disposeTree(root) {
  const seen = new Set();
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (seen.has(m) || m.userData?.shared) continue; seen.add(m);
      for (const k of Object.keys(m)) { const v = m[k]; if (v && v.isTexture && !v.userData?.shared && v !== m.envMap) v.dispose(); }
      m.dispose();
    }
  });
}

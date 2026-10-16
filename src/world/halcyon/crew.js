// HALCYON — crew: tasteful low-poly skinned humanoids (smooth heads, glossy visor band, no facial detail) with
// breathing / weight-shift idles, head tracking toward the player, and talking gestures. One SkinnedMesh (+ visor mesh)
// per person. Used for the four named crew and the background ops staff.
const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'armL', 'foreL', 'armR', 'foreR', 'thighL', 'shinL', 'thighR', 'shinR'];

export const CREW = {
  jonah: { id: 'jonah', name: 'Jonah Reyes', role: 'CAPCOM', height: 1.78, build: 1.02, skin: 0x8b5a3c, hair: { style: 'short', color: 0x16110e },
    outfit: { top: 0x2d4a78, collar: 0x9fc6ea, pants: 0x1d232c, shoes: 0x15171b, sleeve: 0x2d4a78 }, access: ['headset'], pose: 'sit' },
  fd: { id: 'fd', name: 'Director Arthur Bell', role: 'Flight Director', height: 1.84, build: 1.07, skin: 0xd8ac90, hair: { style: 'recede', color: 0xcfd2d8 },
    outfit: { top: 0x2a2f39, collar: 0xe9ebef, pants: 0x1b1e25, shoes: 0x0f1013, sleeve: 0x2a2f39 }, access: ['tie', 'badge', 'jacketTail'], pose: 'rail' },
  sci: { id: 'sci', name: 'Dr. Ilse Varga', role: 'Science Lead', height: 1.69, build: 0.93, skin: 0xe4bba2, hair: { style: 'bun', color: 0xb59a68 },
    outfit: { top: 0x3b7490, collar: 0xf2f4f6, pants: 0x2a2f37, shoes: 0x1d2025, sleeve: 0xf0f2f4 }, access: ['labcoat', 'tablet', 'glasses'], pose: 'tablet' },
  mira: { id: 'mira', name: 'Mira', role: 'Your daughter', height: 1.64, build: 0.9, skin: 0xc48a67, hair: { style: 'ponytail', color: 0x1e140f },
    outfit: { top: 0xc4621a, collar: 0x30363f, pants: 0x2a303a, shoes: 0xd9d9d2, sleeve: 0xb9591a }, access: ['bigjacket', 'patch'], pose: 'cross' },
};

export function createCrewKit(THREE, G) {
  const { Vector3, Matrix4, Quaternion, Euler, Color, Group, Mesh } = THREE;
  const tmpC = new Color();
  const rgb = (hex) => { tmpC.setHex(hex); return [tmpC.r, tmpC.g, tmpC.b]; };
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const damp = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));

  const caps = {};
  const capsule = (r, len) => { const k = r + '|' + len; return caps[k] || (caps[k] = new THREE.CapsuleGeometry(r, len, 5, 14)); };
  const sph = (ws = 20, hs = 14) => G.unitSphere(ws, hs);

  /** build one person. spec: see CREW. Returns the controller. */
  function build(spec) {
    const s = spec.height / 1.74, w = spec.build || 1;
    const B = new G.Bucket('crew_' + spec.id);
    const parts = [];
    const o = spec.outfit, skin = rgb(spec.skin), hair = rgb(spec.hair.color);
    const part = (bone, geo, x, y, z, sx, sy, sz, color, rx = 0, ry = 0, rz = 0) => {
      const m = new Matrix4().compose(new Vector3(x * s, y * s, z * s), new Quaternion().setFromEuler(new Euler(rx, ry, rz)), new Vector3(sx * s, sy * s, sz * s));
      const start = B.vc; B.addGeo(geo, m, { col: color });
      parts.push([start, B.vc, BONES.indexOf(bone)]);
    };
    const top = rgb(o.top), collar = rgb(o.collar), pants = rgb(o.pants), shoes = rgb(o.shoes), sleeve = rgb(o.sleeve);
    const has = (a) => spec.access.includes(a);
    const coat = has('labcoat'), big = has('bigjacket');
    const bodyCol = coat ? rgb(0xf0f2f4) : top;
    const armCol = coat ? rgb(0xf0f2f4) : big ? rgb(o.sleeve) : sleeve;
    const bw = big ? 1.1 : 1;
    // pelvis / torso
    part('hips', capsule(0.115, 0.06), 0, 0.96, 0, 1.38 * w, 0.82, 0.98, pants);
    part('spine', capsule(0.14, 0.12), 0, 1.12, 0, 1.22 * w * bw, 1, 0.82 * bw, bodyCol);
    part('chest', capsule(0.155, 0.12), 0, 1.31, 0, 1.3 * w * bw, 1, 0.84 * bw, bodyCol);
    part('chest', sph(), 0, 1.495, -0.004, 0.1 * w, 0.032, 0.075, collar);                   // collar / neckline
    part('neck', capsule(0.044, 0.07), 0, 1.54, 0, 1, 1, 1, skin);
    // head
    part('head', sph(24, 16), 0, 1.64, 0, 0.0985, 0.121, 0.109, skin);
    part('head', sph(12, 8), 0, 1.6, 0.102, 0.021, 0.019, 0.021, skin);                      // soft nose bump (silhouette only)
    // hair
    const hs = spec.hair.style, hc = hair;
    const hairGeo = (phiS, phiL, thS, thL) => new THREE.SphereGeometry(1, 24, 12, phiS, phiL, thS, thL);
    const hr = [0.1035, 0.1265, 0.1145];
    const pi = Math.PI;
    if (hs === 'short' || hs === 'bun' || hs === 'ponytail') {
      part('head', hairGeo(pi / 2 - 1.3, 2.6, 0, 1.12), 0, 1.642, 0, hr[0], hr[1], hr[2], hc);
      part('head', hairGeo(pi / 2 + 1.3, TAU() - 2.6, 0, hs === 'short' ? 1.8 : 2.15), 0, 1.642, 0, hr[0], hr[1], hr[2], hc);
    }
    if (hs === 'recede') {
      part('head', hairGeo(pi / 2 + 0.9, TAU() - 1.8, 0.55, 1.35), 0, 1.642, 0, hr[0] * 1.0, hr[1], hr[2], hc);
      part('head', hairGeo(0, TAU(), 0, 0.62), 0, 1.66, -0.01, hr[0] * 0.99, hr[1] * 0.99, hr[2] * 0.99, hc);
    }
    if (hs === 'bun') part('head', sph(14, 10), 0, 1.74, -0.085, 0.052, 0.05, 0.05, hc);
    if (hs === 'ponytail') {
      part('head', sph(12, 8), 0, 1.69, -0.105, 0.036, 0.036, 0.036, rgb(0xd8a23a));      // hair tie
      part('head', capsule(0.034, 0.2), 0, 1.54, -0.13, 1, 1, 0.9, hc, 0.22, 0, 0);
    }
    // arms (L at +x, R at −x; the figure faces +Z)
    for (const [sd, up, fo] of [[1, 'armL', 'foreL'], [-1, 'armR', 'foreR']]) {
      const ax = 0.19 * w * bw * sd;
      part(up, sph(), ax, 1.4, 0, 0.06 * bw, 0.06 * bw, 0.06 * bw, armCol);
      part(up, capsule(0.046, 0.22), ax, 1.25, 0, 1 * bw, 1, 1 * bw, armCol);
      part(fo, capsule(0.04, 0.2), ax, 0.97, 0, 1 * bw, 1, 1 * bw, big ? rgb(o.sleeve) : coat ? rgb(0xf0f2f4) : sleeve);
      part(fo, sph(), ax, 0.8, 0.004, 0.046, 0.058, 0.034, skin);                         // hand
    }
    // legs
    for (const [sd, th, sn] of [[1, 'thighL', 'shinL'], [-1, 'thighR', 'shinR']]) {
      const lx = 0.09 * w * sd;
      part(th, capsule(0.07, 0.3), lx, 0.67, 0, 1, 1, 1.02, pants);
      part(sn, capsule(0.052, 0.28), lx, 0.25, 0, 1, 1, 1, pants);
      part(sn, sph(), lx, 0.045, 0.045, 0.05, 0.04, 0.12, shoes);                         // shoe
    }
    // accessories
    if (coat) {                                                                            // long lab coat
      part('hips', new THREE.CylinderGeometry(0.19, 0.285, 0.5, 22, 1, true), 0, 0.72, 0, w, 1, 0.8, rgb(0xf0f2f4));
      part('spine', sph(), 0, 1.15, 0.12, 0.012, 0.3, 0.01, rgb(0xcfd4da));              // coat opening seam
    }
    if (has('jacketTail')) part('hips', new THREE.CylinderGeometry(0.17, 0.215, 0.26, 20, 1, true), 0, 0.88, 0, w, 1, 0.82, top);
    if (big) part('hips', new THREE.CylinderGeometry(0.185, 0.235, 0.3, 22, 1, true), 0, 0.84, 0, w * 1.1, 1, 0.9, top);
    if (has('tie')) part('chest', new THREE.BoxGeometry(1, 1, 1), 0, 1.3, 0.128, 0.035, 0.2, 0.012, rgb(0x7a1f27));
    if (has('badge')) part('chest', new THREE.BoxGeometry(1, 1, 1), -0.07, 1.26, 0.134, 0.045, 0.06, 0.008, rgb(0xe8681c));
    if (has('patch')) part('armL', sph(14, 8), 0.2 * w * bw, 1.37, 0, 0.012, 0.045, 0.045, rgb(0xe0b04a));
    if (has('headset')) {
      part('head', new THREE.TorusGeometry(0.108, 0.0075, 6, 24, pi), 0, 1.655, 0, 1, 1.05, 1, rgb(0x1a1d22), 0, pi / 2, pi / 2);
      for (const sd of [-1, 1]) part('head', new THREE.CylinderGeometry(0.034, 0.034, 0.026, 14), 0.103 * sd, 1.63, 0, 1, 1, 1, rgb(0x20242a), 0, 0, pi / 2);
      part('head', capsule(0.006, 0.09), 0.095, 1.575, 0.058, 1, 1, 1, rgb(0x1a1d22), 0.9, 0, -0.6);
      part('head', sph(8, 6), 0.077, 1.545, 0.092, 0.011, 0.011, 0.011, rgb(0x2a2f36));
    }
    if (has('glasses')) {
      for (const sd of [-1, 1]) part('head', new THREE.TorusGeometry(0.026, 0.0035, 6, 18), 0.042 * sd, 1.646, 0.099, 1, 1, 1, rgb(0x2a2d33), 0, 0, 0);
      part('head', new THREE.BoxGeometry(1, 1, 1), 0, 1.65, 0.103, 0.03, 0.004, 0.004, rgb(0x2a2d33));
    }

    // merge → SkinnedMesh
    const n = B.vc;
    const skinIdx = new Uint16Array(n * 4), skinW = new Float32Array(n * 4);
    for (const [a, b, bone] of parts) for (let v = a; v < b; v++) { skinIdx[v * 4] = bone; skinW[v * 4] = 1; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIdx, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinW, 4));
    geo.setIndex(B.i);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.03, emissive: 0x0c0d10, emissiveIntensity: 1 });
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.frustumCulled = false; mesh.name = 'crew_' + spec.id;
    const bone = {}, list = [];
    const mk = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x * s, y * s, z * s); b.rotation.order = 'YXZ'; (parent || mesh).add(b); bone[name] = b; list.push(b); return b; };
    mk('hips', null, 0, 0.93, 0); mk('spine', bone.hips, 0, 0.1, 0); mk('chest', bone.spine, 0, 0.22, 0); mk('neck', bone.chest, 0, 0.22, 0); mk('head', bone.neck, 0, 0.08, 0);
    mk('armL', bone.chest, 0.19 * w * bw, 0.16, 0); mk('foreL', bone.armL, 0, -0.29, 0); mk('armR', bone.chest, -0.19 * w * bw, 0.16, 0); mk('foreR', bone.armR, 0, -0.29, 0);
    mk('thighL', bone.hips, 0.09 * w, -0.04, 0); mk('shinL', bone.thighL, 0, -0.44, 0); mk('thighR', bone.hips, -0.09 * w, -0.04, 0); mk('shinR', bone.thighR, 0, -0.44, 0);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(list));

    // visor: a glossy band across the face (head-bone child, local to the head joint)
    const visorGeo = new THREE.SphereGeometry(1, 28, 10, pi / 2 - 0.95, 1.9, 1.15, 0.78);
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x06090d, roughness: 0.12, metalness: 0.65, emissive: 0x0b2030, emissiveIntensity: 0.4 });
    const visor = new Mesh(visorGeo, visorMat);
    visor.scale.set(0.1005 * s, 0.1235 * s, 0.1115 * s); visor.position.set(0, (1.64 - 1.55) * s, 0.0);
    bone.head.add(visor);

    const group = new Group(); group.name = 'crew_' + spec.id;
    group.add(mesh);
    const ctl = new Crew(spec, group, mesh, bone, visor, s);
    return ctl;
  }
  const TAU = () => Math.PI * 2;

  // ───────────── swivel chair (rotates with the person) ─────────────
  function chairMesh(color = [0.07, 0.08, 0.1]) {
    const B = new G.Bucket('chair');
    const c = color, hi = [0.2, 0.22, 0.26];
    B.cyl([0, 0.04, 0], [0, 0.4, 0], 0.03, 0.03, 8, { col: hi });
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; B.strut([0, 0.05, 0], [Math.cos(a) * 0.3, 0.035, Math.sin(a) * 0.3], 0.04, 0.025, { col: hi }); B.sphere([Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3], 0.03, { col: [0.02, 0.02, 0.02], ws: 8, hs: 6 }); }
    B.box(-0.25, 0.4, -0.24, 0.25, 0.47, 0.24, { col: c, tile: 1 });
    B.box(-0.22, 0.47, -0.27, 0.22, 0.95, -0.2, { col: c, tile: 1 });
    B.box(-0.27, 0.56, -0.18, -0.23, 0.61, 0.12, { col: hi, tile: 1 }); B.box(0.23, 0.56, -0.18, 0.27, 0.61, 0.12, { col: hi, tile: 1 });
    return B;
  }

  // ───────────── controller ─────────────
  class Crew {
    constructor(spec, group, mesh, bone, visor, s) {
      this.spec = spec; this.id = spec.id; this.group = group; this.mesh = mesh; this.bone = bone; this.visor = visor; this.s = s;
      this.base = {}; this.cur = { hy: 0, hp: 0, cy: 0 };
      this.talk = 0; this.talking = false; this.ph = (spec.id.length * 1.7 + spec.id.charCodeAt(0) * 0.13) % 6.28;
      this.rootYaw = 0; this.baseYaw = 0; this.lookAt = null; this.swivel = false;
      this.hipsY = 0.93 * s;
      this.tabletMesh = null; this.chair = null;
      this.applyPose(spec.pose);
    }
    /** place: feet position + facing yaw (three.js convention: yaw>0 turns left, 0 faces −Z... for the model, +Z is its front) */
    place(x, y, z, yaw) {
      this.group.position.set(x, y, z);
      this.baseYaw = this.rootYaw = yaw;
      this.group.rotation.y = yaw;
    }
    setSeat(chairBucket, seatY = 0.47) {
      this.seatY = seatY;
      const m = chairBucket.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.5 }));
      m.scale.setScalar(1); this.group.add(m); this.chair = m; this.swivel = true;
      this.applyPose(this.pose);
    }
    applyPose(p) {
      const b = this.bone, s = this.s, B = this.base;
      const set = (name, x = 0, y = 0, z = 0) => { b[name].rotation.set(x, y, z, 'YXZ'); B[name] = [x, y, z]; };
      this.pose = p;
      for (const n of Object.keys(b)) set(n);
      B.hipsPos = [0, 0.93 * s, 0];
      if (p === 'stand') {
        set('armL', 0.04, 0, 0.1); set('armR', 0.04, 0, -0.1); set('foreL', -0.2, 0, 0); set('foreR', -0.2, 0, 0);
      } else if (p === 'rail') {          // hands resting on the director's rail
        set('armL', -0.55, 0.12, 0.12); set('armR', -0.55, -0.12, -0.12); set('foreL', -0.95, 0, 0); set('foreR', -0.95, 0, 0);
        set('spine', 0.06, 0, 0); set('chest', 0.04, 0, 0); set('head', -0.02, 0, 0);
      } else if (p === 'cross') {         // arms folded
        set('armL', -0.5, 0.05, 0.14); set('armR', -0.5, -0.05, -0.14); set('foreL', -1.85, -0.95, 0); set('foreR', -1.85, 0.95, 0);
        set('spine', 0.02, 0, 0); set('head', 0.03, 0, 0);
      } else if (p === 'tablet') {        // holds a tablet against the hip
        set('armR', -0.42, -0.1, -0.1); set('foreR', -1.55, 0.5, 0); set('armL', -0.18, 0.05, 0.14); set('foreL', -0.5, -0.2, 0);
        set('head', 0.12, 0, 0);
        const T = new Mesh(new THREE.BoxGeometry(0.2, 0.014, 0.28), [new THREE.MeshStandardMaterial({ color: 0x20252b, roughness: 0.4, metalness: 0.5 }), new THREE.MeshStandardMaterial({ color: 0x20252b }), new THREE.MeshBasicMaterial({ color: new Color(0.5, 1.6, 2.2), toneMapped: false }), new THREE.MeshStandardMaterial({ color: 0x20252b }), new THREE.MeshStandardMaterial({ color: 0x20252b }), new THREE.MeshStandardMaterial({ color: 0x20252b })]);
        T.position.set(-0.01 * s, -0.27 * s, 0.09 * s); T.rotation.set(0.55, 0, 0.1); T.scale.setScalar(s);
        b.foreR.add(T); this.tabletMesh = T;
      } else if (p === 'sit') {           // seated at a console
        const seatY = this.seatY ?? 0.47;
        B.hipsPos = [0, seatY + 0.04, 0];
        set('thighL', -1.5, 0.06, 0.03); set('thighR', -1.5, -0.06, -0.03); set('shinL', 1.55, 0, 0); set('shinR', 1.55, 0, 0);
        set('armL', -0.62, 0.1, 0.1); set('armR', -0.62, -0.1, -0.1); set('foreL', -1.15, 0, 0); set('foreR', -1.15, 0, 0);
        set('spine', 0.08, 0, 0); set('chest', 0.05, 0, 0); set('head', -0.08, 0, 0);
      }
      b.hips.position.set(B.hipsPos[0], B.hipsPos[1], B.hipsPos[2]);
    }
    /** player eye (world Vector3) → head tracking within `range` m; idle: look at this.lookAt (world Vector3) */
    update(dt, t, eye, opts = {}) {
      const b = this.bone, B = this.base, ph = this.ph, sit = this.pose === 'sit';
      const range = opts.range || 4;
      const set = (n, ax, ay, az) => b[n].rotation.set(ax, ay, az, 'YXZ');
      // targets
      this.group.updateWorldMatrix(true, false);
      const headW = b.head.getWorldPosition(this._hw || (this._hw = new Vector3()));
      const dEye = eye ? headW.distanceTo(eye) : 1e9;
      const near = dEye < range;
      const focus = (this.talking || near) ? eye : this.lookAt;
      // swivel the chair/torso toward the player
      let yawTarget = this.baseYaw;
      if (this.swivel && (near || this.talking) && eye) {
        const dx = eye.x - this.group.position.x, dz = eye.z - this.group.position.z;
        const want = Math.atan2(dx, dz);                   // model front (+Z) toward the eye
        let d = want - this.baseYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        yawTarget = this.baseYaw + clamp(d, -1.25, 1.25);
      } else if (!sit && (near || this.talking) && eye) {
        const dx = eye.x - this.group.position.x, dz = eye.z - this.group.position.z;
        const want = Math.atan2(dx, dz);                   // model front is +Z: yaw about Y with atan2(x, z)
        let d = want - this.baseYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        yawTarget = this.baseYaw + clamp(d, -0.7, 0.7) * 0.55;
      }
      this.rootYaw = damp(this.rootYaw, yawTarget, 3.2, dt);
      this.group.rotation.y = this.rootYaw;
      // look direction in the model frame (front = +Z, left = +X; positive yaw turns the face toward +X)
      let ty = 0, tp = 0;
      if (focus) {
        const hl = this.group.worldToLocal((this._hl || (this._hl = new Vector3())).copy(headW));
        const v = this.group.worldToLocal((this._lv || (this._lv = new Vector3())).copy(focus)).sub(hl);
        ty = Math.atan2(v.x, v.z); tp = Math.atan2(v.y, Math.hypot(v.x, v.z));
        if (Math.abs(ty) > 2.0) { ty = 0; tp = 0; }
      }
      ty = clamp(ty, -1.35, 1.35); tp = clamp(-tp, -0.45, 0.5);
      this.cur.hy = damp(this.cur.hy, ty, 5, dt); this.cur.hp = damp(this.cur.hp, tp, 5, dt);
      this.talk = damp(this.talk, this.talking ? 1 : 0, 4, dt);
      const T = this.talk, br = Math.sin(t * 1.55 + ph), sw = Math.sin(t * 0.37 + ph) * 0.6 + Math.sin(t * 0.83 + ph * 2) * 0.25;
      // posture: base + breathing + weight shift + talk gestures
      const hy = this.cur.hy, hp = this.cur.hp;
      set('spine', B.spine[0] + 0.01 * br, hy * 0.18, B.spine[2] + (sit ? 0 : sw * 0.012));
      set('chest', B.chest[0] + 0.014 * br, hy * 0.22, B.chest[2]);
      b.chest.scale.set(1 + 0.006 * br, 1 + 0.012 * br, 1 + 0.01 * br);
      set('neck', B.neck[0] + hp * 0.3, hy * 0.2, 0);
      set('head', B.head[0] + hp * 0.7 + T * 0.05 * Math.sin(t * 4.3 + ph), hy * 0.6 + T * 0.05 * Math.sin(t * 2.7 + ph), T * 0.03 * Math.sin(t * 3.1));
      const g = (k, a) => k * Math.sin(t * a + ph);
      set('armL', B.armL[0] + g(0.012, 1.1) - T * (0.18 + g(0.14, 3.3)), B.armL[1] + T * 0.1, B.armL[2] + g(0.01, 0.9));
      set('armR', B.armR[0] + g(0.012, 1.3) - T * (0.12 + g(0.12, 2.9)), B.armR[1] - T * 0.08, B.armR[2] + g(0.01, 1.0));
      set('foreL', B.foreL[0] - T * (0.25 + g(0.22, 3.9)) + g(0.02, 1.6), B.foreL[1], B.foreL[2]);
      set('foreR', B.foreR[0] - T * (0.18 + g(0.18, 3.1)) + g(0.02, 1.4), B.foreR[1], B.foreR[2]);
      if (!sit) {
        b.hips.position.set(B.hipsPos[0] + sw * 0.016 * this.s, B.hipsPos[1] - Math.abs(sw) * 0.004, 0);
        set('hips', 0, 0, sw * 0.03);
        set('thighL', B.thighL[0], 0, -sw * 0.035 + 0.02); set('thighR', B.thighR[0], 0, -sw * 0.035 - 0.02);
        set('shinL', Math.max(0, sw) * 0.05, 0, 0); set('shinR', Math.max(0, -sw) * 0.05, 0, 0);
      } else {
        set('hips', 0, 0, 0);
      }
    }
    chestWorld(out) { return this.group.localToWorld(out.set(0, 1.25 * this.s, 0.05)); }
  }

  return { build, chairMesh, CREW };
}

// ═══════════════════════════════════════════════════════════════════════════
//  SHIP KIT — shared infrastructure for every part builder (see parts/*.js).
//  Everything static is merged per material into a handful of meshes; dynamic parts are standalone meshes/groups.
//
//  Conventions: ship space, metres; +X starboard, +Y up, −Z forward. Origin = pilot eye. Deck y = −1.2.
//  A part module exports `default function build(kit)` and only uses the API below (+ kit.L = layout constants).
//
//  Placement opts (all builders): { pos:[x,y,z]?, rot:[rx,ry,rz]?, quat?, scale?, ext?:bool }
//    ext:true  → exterior group (castShadow + receiveShadow). default: interior group (receiveShadow only).
//
//  kit.add(mat, geometry, opts)             merge any THREE.BufferGeometry (indexed or not) into material `mat`
//  kit.box(mat, [cx,cy,cz], [w,h,d], {bev=0.012, yaw?, rot?, ext?, col?:true|{…}, uv?:'own'})  chamfered box; col:true → collider
//  kit.cyl(mat, [cx,cy,cz], r, h, {rb?, seg=20, axis='y'|'x'|'z', open?, rot?, ext?, col?:true})     cylinder/cone (axis = its long axis)
//  kit.sphere(mat, [x,y,z], r, {seg=20, sy?, sx?, sz? (axis scales), phi?, theta? (partial) , ext?})
//  kit.torus(mat, [x,y,z], R, r, {seg=24, tube=10, axis='y'|'x'|'z', arc?, ext?})
//  kit.plane(mat, [x,y,z], w, h, {rot, ext})                          single quad facing +Z (rotate with rot)
//  kit.lathe(mat, profile[[r,y],…], {pos, rot, seg=24, ext})           surface of revolution about local Y
//  kit.tube(mat, points[[x,y,z],…], radius, {seg=…, rseg=8, closed?, ext})   pipe along a smooth path
//  kit.beam(mat, a[x,y,z], b[x,y,z], w, h, {ext, bev})                box from a to b (w across, h up-ish)
//  kit.extrude(mat, pts2D, depth, {bevel?, pos, rot, ext})             prism from a polygon in local XY, thickness along local Z
//  kit.loft(mat, stations, opts)                                       hull loft (see builder.loftGeometry)
//  kit.mesh(geo, mat, {pos, rot, parent, name, cast?, receive?}) → standalone THREE.Mesh (animate it yourself)
//  kit.group(name, {pos, rot, parent}) → THREE.Group added to kit.root (or parent)
//  kit.hit([cx,cy,cz],[w,h,d],{yaw}) → invisible raycast-proxy Mesh (use for interactable.object)
//
//  Space/gameplay registration:
//    kit.colBox([cx,cy,cz],[w,h,d],{yaw?, door?, name?})     wall/prop collider (feet-pushing)
//    kit.colCyl([cx,cy,cz], r, h)
//    kit.floor(x0,z0,x1,z1,y0,y1=y0,axis=null,{step:'metal'|'grate'…})   walkable floor / ramp (y linear along axis)
//    kit.interact({id,label,pos:[x,y,z],radius=1.4,hit?:{c,s,yaw},object?,enabled?})  fixed-ID interactable (use() emits bus 'interact')
//    kit.screen({id,pos,rot,size:[w,h],res:[W,H],draw(g,W,H,t,s),parent?,bezel?}) canvas screen
//    kit.sign(text,[x,y,z],{w,h,rot,style:'plate'|'warn'|'door'}) label plate (atlased, one draw call)
//    kit.decal(texture,[x,y,z],[w,h],{rot, opacity}) → Mesh with polygon offset (transparent)
//    kit.light(id,[x,y,z],{color,k})   extra light-pool site;   kit.led(color,pattern) → emissive material name
//    kit.onUpdate((dt,t,s)=>…)         per-frame callback; s = kit.state {thrust,boost,landed,mode,t,dt,cam,player,pulse,flicker}
//    kit.recorder(n,[x,y,z],yaw)       EURYDICE log recorder device `eur.log.n` (call only when kit.eur)
//
//  Dynamics: kit.state = { t, dt, thrust 0..1, boost 0..1, landed, mode 'normal'|'alert'|'emergency'|'off', cam (viewer, ship space), player,
//    pulse (0..1 alarm pulse), flicker (1 = steady; derelict flicker), rampWant/rampOpen, hatchWant/hatchOpen, legDeploy }.  Read it inside kit.onUpdate callbacks.
//    kit.floor(...) returns the live floor record {x0,z0,x1,z1,y0,y1,axis,enabled} — mutate y0/y1/axis/enabled for dynamic floors (ramps).
//    kit.colBox(...) / kit.world.box(...) return the collider record — set .off = true to disable it.
//  Interactables: pos = visible centre of the object (chest height is fine), radius ≈ 1.2–1.8 m, label readable ("Coffee machine").
//    Use `hit:{c,s,yaw}` to create an invisible ray-pick proxy box for `object`. Exact IDs from DESIGN §5.
//
//  Materials: kit.mat(name) (shared, lazily built). See DEFS below for names. Emissive names are MeshBasic (values >1 bloom).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { MeshBuilder, bevelBoxArrays, placement, loftGeometry, extrudePoly } from './builder.js';
import { WalkWorld } from './walk.js';
import * as T from './textures.js';
import * as L from './layout.js';

const V3 = THREE.Vector3;

// ───────────── material definitions ─────────────
// std: MeshStandardMaterial; tex = texture-set getter; uv 'world' box-projects (tile = metres per texture repeat)
const D = {
  // exterior
  hull:      { tex: T.hullPanels, uv: 'own', rough: 1, metal: 1, ns: 1.0, cuts: true },
  hullW:     { tex: T.hullPanels, uv: 'world', tile: 4, rough: 1, metal: 1, ns: 1.0 },
  carbon:    { tex: T.carbonTrim, uv: 'world', tile: 2, rough: 1, metal: 1 },
  hullUnder: { tex: T.carbonTrim, uv: 'own', rough: 1, metal: 1, cuts: true },
  metal:     { tex: T.brushedMetal, uv: 'world', tile: 1, rough: 1, metal: 1, color: 0xc4c9d2 },
  darkMetal: { color: 0x2b2f36, rough: 0.5, metal: 0.85 },
  bronze:    { color: 0x6a5238, rough: 0.42, metal: 0.92 },
  nozzle:    { tex: T.carbonTrim, uv: 'world', tile: 1.5, rough: 1, metal: 1, color: 0xb08a68 },
  paintOrange: { color: 0xe8742a, rough: 0.48, metal: 0.1 },
  paintCyan: { color: 0x18b8d8, rough: 0.45, metal: 0.1 },
  paintWhite:{ color: 0xe9ebee, rough: 0.4, metal: 0.1 },
  hazard:    { tex: T.hazard, uv: 'world', tile: 0.5, rough: 0.6, metal: 0.05 },
  radiator:  { tex: T.radiator, uv: 'own', rough: 0.55, metal: 0.4, emissive: 0xffffff, emissiveI: 0.0, doubleSide: true },
  // interior
  wall:      { tex: T.wallPanels, uv: 'world', tile: 2, rough: 1, metal: 1 },
  wallDark:  { tex: T.carbonTrim, uv: 'world', tile: 2, rough: 1, metal: 1, color: 0xb8bcc4 },
  floor:     { tex: T.deckPlate, uv: 'world', tile: 1, rough: 1, metal: 1 },
  grate:     { tex: T.grating, uv: 'world', tile: 1, rough: 0.5, metal: 0.8, alphaTest: 0.5, doubleSide: true },
  ceil:      { tex: T.ceilingPanels, uv: 'world', tile: 2, rough: 1, metal: 1 },
  trim:      { color: 0x20262e, rough: 0.45, metal: 0.7 },
  trimDS:    { color: 0x1c2128, rough: 0.6, metal: 0.6, doubleSide: true },
  steel:     { tex: T.brushedMetal, uv: 'world', tile: 1, rough: 1, metal: 1, color: 0xdde2ea },
  rubber:    { color: 0x16181b, rough: 0.92, metal: 0 },
  fabric:    { tex: T.fabric, uv: 'world', tile: 0.5, rough: 1, metal: 0, color: 0x6a7a96 },
  fabricOrange: { tex: T.fabric, uv: 'world', tile: 0.5, rough: 1, metal: 0, color: 0xd86a24 },
  fabricGrey:{ tex: T.fabric, uv: 'world', tile: 0.5, rough: 1, metal: 0, color: 0x9a9fa8 },
  leather:   { color: 0x3a2a22, rough: 0.55, metal: 0 },
  wood:      { tex: T.wood, uv: 'world', tile: 1, rough: 1, metal: 0 },
  plastic:   { color: 0xd8dbdf, rough: 0.42, metal: 0.05 },
  plasticDark:{ color: 0x23262b, rough: 0.5, metal: 0.1 },
  white:     { color: 0xeceef1, rough: 0.35, metal: 0.1 },
  ceramic:   { color: 0xf4f5f7, rough: 0.12, metal: 0 },
  brass:     { color: 0xb8964a, rough: 0.35, metal: 0.9 },
  screenOff: { color: 0x04070a, rough: 0.14, metal: 0.25 },
  leaf:      { color: 0x3d8a3a, rough: 0.7, metal: 0, doubleSide: true },
  leafDark:  { color: 0x2c6a2e, rough: 0.7, metal: 0, doubleSide: true },
  soil:      { color: 0x3a2a1e, rough: 0.95, metal: 0 },
  pot:       { color: 0xb86a45, rough: 0.8, metal: 0 },
  blanket:   { tex: T.fabric, uv: 'world', tile: 0.4, rough: 1, metal: 0, color: 0xc2552a },
  skin:      { color: 0xe6dfd8, rough: 0.5, metal: 0 },
  suitWhite: { color: 0xe4e6ea, rough: 0.6, metal: 0.05 },
  glassInt:  { color: 0x6f93b0, rough: 0.05, metal: 0, transparent: true, opacity: 0.1, depthWrite: false, noShadow: true },
  glass:     { color: 0x6f93b0, rough: 0.04, metal: 0.1, transparent: true, opacity: 0.07, depthWrite: false, noShadow: true },
  glassTint: { color: 0x3a6f8f, rough: 0.05, metal: 0.1, transparent: true, opacity: 0.3, depthWrite: false, noShadow: true },
  glassDome: { color: 0x5d7a95, rough: 0.04, metal: 0.1, transparent: true, opacity: 0.05, depthWrite: false, doubleSide: true, noShadow: true },
  glassMed:  { color: 0xcfe9ff, rough: 0.03, metal: 0, transparent: true, opacity: 0.22, depthWrite: false, noShadow: true },
  liquid:    { color: 0x3fb0c8, rough: 0.2, metal: 0, transparent: true, opacity: 0.55, depthWrite: false, noShadow: true },
};
// emissive (MeshBasic, HDR colours). group: 'main' (room lights) | 'accent' (strips) | 'status' (indicators) | 'none'
const E = {
  emitPanel:   { c: [0.95, 1.0, 1.15], i: 3.2, g: 'main' },
  emitWarm:    { c: [1.0, 0.78, 0.5], i: 3.0, g: 'main' },
  emitStrip:   { c: [0.15, 0.9, 1.0], i: 2.4, g: 'accent' },
  emitStripO:  { c: [1.0, 0.45, 0.1], i: 2.4, g: 'accent' },
  emitWhite:   { c: [1, 1, 1], i: 4.0, g: 'main' },
  emitCyan:    { c: [0.15, 0.9, 1.0], i: 2.0, g: 'status' },
  emitAmber:   { c: [1.0, 0.55, 0.12], i: 2.2, g: 'status' },
  emitRed:     { c: [1.0, 0.12, 0.1], i: 2.2, g: 'status' },
  emitGreen:   { c: [0.2, 1.0, 0.35], i: 2.0, g: 'status' },
  emitBlue:    { c: [0.2, 0.4, 1.0], i: 2.0, g: 'status' },
  emitCore:    { c: [0.4, 0.9, 1.0], i: 2.5, g: 'none' },     // LYRA / drive glows — driven by their own part
  emitHot:     { c: [1.0, 0.5, 0.15], i: 3.0, g: 'none' },
  navRed:      { c: [1.0, 0.05, 0.03], i: 5, g: 'none' },
  navGreen:    { c: [0.05, 1.0, 0.2], i: 5, g: 'none' },
  strobe:      { c: [1.0, 1.0, 1.0], i: 8, g: 'none' },
  flood:       { c: [1.0, 0.95, 0.85], i: 7, g: 'none' },
};
// blinking LEDs: led<Color><Pattern>; patterns: '' steady, Blink (1 Hz), Fast (3 Hz), Rand (flicker)
const LED_COL = { Green: [0.2, 1.0, 0.35], Amber: [1.0, 0.55, 0.12], Red: [1.0, 0.12, 0.1], Cyan: [0.15, 0.9, 1.0], White: [1, 1, 1], Blue: [0.25, 0.45, 1.0] };
const LED_PAT = ['', 'Blink', 'Fast', 'Rand'];

function applyPatches(mat, { frost = 0, cuts = null }) {
  const NC = cuts ? cuts.length : 0;
  mat.customProgramCacheKey = () => `shipfx|f${frost > 0 ? 1 : 0}|c${NC}`;
  mat.onBeforeCompile = (shader) => {
    let vs = shader.vertexShader, fs = shader.fragmentShader;
    vs = vs.replace('#include <common>', '#include <common>\nvarying vec3 vLoc; varying vec3 vLn;');
    vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position; vLn = normal;');
    let fh = '#include <common>\nvarying vec3 vLoc; varying vec3 vLn;\n';
    let cutTest = '';
    if (NC > 0) {
      shader.uniforms.uCutA = { value: cuts.map((c) => new THREE.Vector4(...c.A)) };
      shader.uniforms.uCutB = { value: cuts.map((c) => new THREE.Vector4(...c.B)) };
      shader.uniforms.uCutC = { value: cuts.map((c) => new THREE.Vector4(...c.C)) };
      fh += `#define NCUT ${NC}\nuniform vec4 uCutA[NCUT]; uniform vec4 uCutB[NCUT]; uniform vec4 uCutC[NCUT];
bool shipCut(vec3 p){
  for (int i = 0; i < NCUT; i++){
    vec4 A = uCutA[i]; vec4 B = uCutB[i]; vec4 C = uCutC[i];
    int ax = int(A.y + 0.5);
    float al = ax == 0 ? p.x : (ax == 1 ? p.y : p.z);
    if (al < C.x || al > C.y) continue;
    vec2 q = ax == 0 ? vec2(p.z, p.y) : (ax == 1 ? vec2(p.x, p.z) : vec2(p.x, p.y));
    vec2 d = q - A.zw;
    if (A.x < 0.5) { if (dot(d, d) < B.x * B.x) return true; }
    else { vec2 hb = abs(d) - (B.xy - vec2(B.z)); float sd = length(max(hb, 0.0)) + min(max(hb.x, hb.y), 0.0) - B.z; if (sd < 0.0) return true; }
  }
  return false;
}\n`;
      cutTest = 'if (shipCut(vLoc)) discard;\n';
    }
    if (frost > 0) {
      shader.uniforms.uFrost = { value: frost };
      fh += `uniform float uFrost;
float frH(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float frN(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0 - 2.0*f);
  return mix(mix(mix(frH(i), frH(i + vec3(1,0,0)), f.x), mix(frH(i + vec3(0,1,0)), frH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(frH(i + vec3(0,0,1)), frH(i + vec3(1,0,1)), f.x), mix(frH(i + vec3(0,1,1)), frH(i + vec3(1,1,1)), f.x), f.y), f.z); }
float frostMask(vec3 p, vec3 n){ float a = frN(p*1.7)*0.55 + frN(p*5.3)*0.3 + frN(p*17.0)*0.15; float up = 0.5 + 0.5*n.y;
  return clamp(smoothstep(0.40, 0.68, a + up*0.14) * uFrost, 0.0, 1.0); }\n`;
    }
    fs = fs.replace('#include <common>', fh);
    if (NC > 0) fs = fs.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + cutTest);
    if (frost > 0) {
      fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\nfloat frM = frostMask(vLoc, normalize(vLn)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.86, 0.96), frM * 0.85);');
      fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.28, frM);');
    }
    shader.vertexShader = vs; shader.fragmentShader = fs;
  };
}

export function createKit(ctx, variant = 'orpheus') {
  const kit = { THREE, ctx, variant, eur: variant === 'eurydice', L, T };
  const eur = kit.eur;
  const maxAniso = (ctx && ctx.renderer && ctx.renderer.capabilities && ctx.renderer.capabilities.getMaxAnisotropy()) || 8;
  const root = kit.root = new THREE.Group(); root.name = `ship.${variant}`;
  kit.rand = T.mulberry;
  kit.world = new WalkWorld();
  kit.interactables = []; kit.screens = []; kit.doors = []; kit.lightSites = L.LIGHT_SITES.map((s) => ({ ...s, pos: new V3(...s.pos), color: new THREE.Color(s.color) }));
  kit.updaters = []; kit.hullColliders = []; kit.cuts = [];
  kit.state = { t: 0, dt: 0, thrust: 0, boost: 0, landed: false, mode: eur ? 'emergency' : 'normal', cam: new V3(), player: null, pulse: 0, flicker: 1, rampWant: 0, rampOpen: 0, hatchWant: 0, hatchOpen: 0, legDeploy: 0 };
  kit.emitters = { main: [], accent: [], status: [], none: [] };
  kit.leds = [];                                   // {mat, pattern, base:Color}
  kit.signs = []; kit.decals = [];
  const builders = new Map();                      // `${mat}|${ext?1:0}` → MeshBuilder
  const mats = new Map();

  // ───────── materials ─────────
  function buildMat(name) {
    if (E[name]) {
      const e = E[name], m = new THREE.MeshBasicMaterial({ color: new THREE.Color(e.c[0] * e.i, e.c[1] * e.i, e.c[2] * e.i), toneMapped: false });
      m.userData = { base: new THREE.Color(e.c[0], e.c[1], e.c[2]), intensity: e.i, group: e.g, emissive: true };
      kit.emitters[e.g].push(m); return m;
    }
    const lm = /^led(Green|Amber|Red|Cyan|White|Blue)(Blink|Fast|Rand)?$/.exec(name);
    if (lm) {
      const c = LED_COL[lm[1]], m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0] * 2.4, c[1] * 2.4, c[2] * 2.4), toneMapped: false });
      m.userData = { base: new THREE.Color(c[0], c[1], c[2]), intensity: 2.4, group: 'status', emissive: true, led: lm[2] || '' };
      kit.leds.push(m); kit.emitters.status.push(m); return m;
    }
    const d = D[name]; if (!d) throw new Error(`ship kit: unknown material "${name}"`);
    const p = { color: d.color != null ? d.color : 0xffffff, roughness: d.rough != null ? d.rough : 0.6, metalness: d.metal != null ? d.metal : 0.1 };
    if (d.transparent) { p.transparent = true; p.opacity = d.opacity; p.depthWrite = false; }
    if (d.doubleSide) p.side = THREE.DoubleSide;
    const m = new THREE.MeshStandardMaterial(p);
    if (d.alphaTest) m.alphaTest = d.alphaTest;
    if (d.tex) {
      const t = d.tex();
      m.map = t.map; m.map.anisotropy = Math.min(maxAniso, 8);
      if (t.normalMap) { m.normalMap = t.normalMap; m.normalScale = new THREE.Vector2(d.ns || 1, d.ns || 1); }
      if (t.ormMap) { m.roughnessMap = t.ormMap; m.metalnessMap = t.ormMap; m.roughness = d.rough != null ? d.rough : 1; m.metalness = d.metal != null ? d.metal : 1; }
      if (t.emissiveMap) { m.emissiveMap = t.emissiveMap; m.emissive = new THREE.Color(1, 1, 1); m.emissiveIntensity = d.emissiveI || 0; }
    }
    m.userData = { def: d, name, uv: d.uv || 'own', tile: d.tile || 1, glass: !!d.transparent };
    if (d.transparent) m.userData.glassMat = true;
    m.name = name;
    return m;
  }
  kit.mat = (name) => { let m = mats.get(name); if (!m) { m = buildMat(name); m.name = name; mats.set(name, m); } return m; };
  kit.hasMat = (name) => !!(D[name] || E[name] || /^led(Green|Amber|Red|Cyan|White|Blue)(Blink|Fast|Rand)?$/.test(name));
  kit.defMat = (name, def) => { D[name] = def; mats.delete(name); };
  kit.led = (color = 'Green', pattern = '') => `led${color}${pattern}`;
  kit.allMats = () => mats;

  // ───────── static geometry accumulation ─────────
  function builderFor(matName, ext) {
    const key = `${matName}|${ext ? 1 : 0}`;
    let b = builders.get(key);
    if (!b) {
      const m = kit.mat(matName), world = m.userData.uv === 'world';
      b = new MeshBuilder(world ? 'world' : 'own', world ? 1 / (m.userData.tile || 1) : 1); b.matName = matName; b.ext = !!ext;
      builders.set(key, b);
    }
    return b;
  }
  const _m = new THREE.Matrix4();
  kit.add = (matName, geo, o = {}) => { builderFor(matName, o.ext).addGeometry(geo, placement(o, _m)); };
  kit.arrays = (matName, a, o = {}) => { builderFor(matName, o.ext).addArrays(a.p, a.n, a.uv || null, a.idx, placement(o, _m)); };

  const autoBev = (w, h, d) => Math.min(0.012, Math.min(w, h, d) * 0.28);
  kit.box = (matName, c, s, o = {}) => {
    const [w, h, d] = s, bev = o.bev != null ? o.bev : autoBev(w, h, d);
    const a = bevelBoxArrays(w, h, d, bev);
    const place = { pos: c, rot: o.rot || (o.yaw ? [0, o.yaw, 0] : null), ext: o.ext };
    kit.arrays(matName, a, place);
    if (o.col) kit.colBox(c, s, { yaw: o.yaw || 0, ...(typeof o.col === 'object' ? o.col : {}) });
  };
  kit.cyl = (matName, c, r, h, o = {}) => {
    const g = new THREE.CylinderGeometry(o.rt != null ? o.rt : r, o.rb != null ? o.rb : r, h, o.seg || 20, 1, !!o.open);
    const rot = o.axis === 'x' ? [0, 0, Math.PI / 2] : o.axis === 'z' ? [Math.PI / 2, 0, 0] : (o.rot || [0, 0, 0]);
    kit.add(matName, g, { pos: c, rot, ext: o.ext }); g.dispose();
    if (o.col && (!o.axis || o.axis === 'y')) kit.colCyl(c, Math.max(r, o.rb || 0), h);
  };
  kit.sphere = (matName, c, r, o = {}) => {
    const g = new THREE.SphereGeometry(r, o.seg || 20, Math.max(6, (o.seg || 20) >> 1), o.phiStart || 0, o.phi || Math.PI * 2, o.thetaStart || 0, o.theta || Math.PI);
    kit.add(matName, g, { pos: c, scale: [o.sx || 1, o.sy || 1, o.sz || 1], rot: o.rot, ext: o.ext }); g.dispose();
  };
  kit.torus = (matName, c, R, r, o = {}) => {
    const g = new THREE.TorusGeometry(R, r, o.tube || 10, o.seg || 28, o.arc || Math.PI * 2);
    const rot = o.axis === 'x' ? [0, Math.PI / 2, 0] : o.axis === 'z' ? [0, 0, 0] : [Math.PI / 2, 0, 0];
    kit.add(matName, g, { pos: c, rot: o.rot || rot, ext: o.ext }); g.dispose();
  };
  kit.plane = (matName, c, w, h, o = {}) => { const g = new THREE.PlaneGeometry(w, h); kit.add(matName, g, { pos: c, rot: o.rot, ext: o.ext }); g.dispose(); };
  kit.lathe = (matName, prof, o = {}) => {
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), o.seg || 24);
    kit.add(matName, g, { pos: o.pos, rot: o.rot, ext: o.ext, scale: o.scale }); g.dispose();
  };
  kit.tube = (matName, pts, r, o = {}) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p)), !!o.closed, 'catmullrom', 0.1);
    const g = new THREE.TubeGeometry(curve, o.seg || Math.max(8, pts.length * 6), r, o.rseg || 8, !!o.closed);
    kit.add(matName, g, { ext: o.ext }); g.dispose();
  };
  const _a = new V3(), _b = new V3(), _mid = new V3(), _q = new THREE.Quaternion(), _up = new V3(0, 1, 0), _z = new V3(0, 0, 1);
  kit.beam = (matName, a, b, w, h, o = {}) => {
    _a.set(...a); _b.set(...b);
    const len = _a.distanceTo(_b); _mid.copy(_a).add(_b).multiplyScalar(0.5);
    const dir = _b.clone().sub(_a).normalize();
    const m4 = new THREE.Matrix4().lookAt(new V3(), dir, Math.abs(dir.y) > 0.98 ? new V3(1, 0, 0) : _up);
    const q = new THREE.Quaternion().setFromRotationMatrix(m4);
    kit.arrays(matName, bevelBoxArrays(w, h, len, o.bev != null ? o.bev : autoBev(w, h, len)), { pos: [_mid.x, _mid.y, _mid.z], quat: q, ext: o.ext });
  };
  kit.extrude = (matName, pts, depth, o = {}) => { const g = extrudePoly(pts, depth, o.bevel || 0); kit.add(matName, g, { pos: o.pos, rot: o.rot, ext: o.ext }); g.dispose(); };
  kit.loft = (matName, stations, o = {}) => { const g = loftGeometry(stations, o); kit.add(matName, g, { ext: o.ext !== false, pos: o.pos }); g.dispose(); };

  // ───────── standalone objects ─────────
  const decorate = (mesh, o) => {
    const m = mesh.material, glass = m.userData && m.userData.glass;
    mesh.castShadow = o.cast != null ? o.cast : (!!o.ext && !glass && !m.userData.emissive);
    mesh.receiveShadow = o.receive != null ? o.receive : !m.userData.emissive;
    if (glass) mesh.renderOrder = 10;
    return mesh;
  };
  kit.mesh = (geo, matName, o = {}) => {
    const mesh = new THREE.Mesh(geo, typeof matName === 'string' ? kit.mat(matName) : matName);
    if (o.pos) mesh.position.set(...o.pos); if (o.rot) mesh.rotation.set(...o.rot); if (o.scale != null) typeof o.scale === 'number' ? mesh.scale.setScalar(o.scale) : mesh.scale.set(...o.scale);
    if (o.name) mesh.name = o.name; decorate(mesh, o);
    (o.parent || root).add(mesh); return mesh;
  };
  kit.group = (name, o = {}) => { const g = new THREE.Group(); g.name = name; if (o.pos) g.position.set(...o.pos); if (o.rot) g.rotation.set(...o.rot); (o.parent || root).add(g); return g; };
  const hitMat = new THREE.MeshBasicMaterial({ visible: false }); hitMat.name = 'hit';
  kit.hit = (c, s, o = {}) => { const m = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), hitMat); m.position.set(...c); if (o.yaw) m.rotation.y = o.yaw; m.name = 'hit'; root.add(m); return m; };

  // ───────── space / gameplay registration ─────────
  kit.colBox = (c, s, o = {}) => kit.world.box(c[0], c[1], c[2], s[0], s[1], s[2], o);
  kit.colCyl = (c, r, h, o = {}) => kit.world.cyl(c[0], c[1], c[2], r, h, o);
  kit.floor = (x0, z0, x1, z1, y0, y1, axis, o) => kit.world.floor(x0, z0, x1, z1, y0, y1 == null ? y0 : y1, axis || null, o);
  kit.interact = (d) => {
    const it = {
      id: d.id, label: d.label, pos: new V3(...d.pos), radius: d.radius != null ? d.radius : 1.4,
      object: d.object || (d.hit ? kit.hit(d.hit.c, d.hit.s, { yaw: d.hit.yaw }) : undefined),
      enabled: d.enabled, use: d.use || (() => ctx.bus.emit('interact', { id: d.id })),
    };
    if (d.use) { const inner = d.use; it.use = () => { inner(); ctx.bus.emit('interact', { id: d.id }); }; }
    kit.interactables.push(it); return it;
  };
  kit.light = (id, pos, o = {}) => kit.lightSites.push({ id, pos: new V3(...pos), color: new THREE.Color(o.color != null ? o.color : 0xffffff), k: o.k != null ? o.k : 1, room: o.room });
  kit.onUpdate = (fn) => { kit.updaters.push(fn); return fn; };
  kit.cut = (c) => kit.cuts.push(c);               // raw hull cut: {A:[type(0 circle,1 rrect),axis(0 x,1 y,2 z),c1,c2],B:[r|hw,hh,rc,0],C:[min,max,0,0]}
  kit.cutRound = (axis, c1, c2, r, min, max) => kit.cut({ A: [0, axis, c1, c2], B: [r, 0, 0, 0], C: [min, max, 0, 0] });
  kit.cutRect = (axis, c1, c2, hw, hh, rc, min, max) => kit.cut({ A: [1, axis, c1, c2], B: [hw, hh, rc, 0], C: [min, max, 0, 0] });

  // ───────── screens ─────────
  const deadDraw = (g, W, H, t, s) => {
    g.fillStyle = '#020405'; g.fillRect(0, 0, W, H);
    const k = Math.sin(t * 7.3 + s.seed * 12.9) * Math.sin(t * 2.1 + s.seed * 3.1);
    if (s.flick && k > 0.55) { // random static burst
      const id = g.createImageData(W >> 2, H >> 2); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 90 * (k - 0.4); id.data[i] = v * 0.7; id.data[i + 1] = v * 0.9; id.data[i + 2] = v; id.data[i + 3] = 255; }
      const c = document.createElement('canvas'); c.width = W >> 2; c.height = H >> 2; c.getContext('2d').putImageData(id, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, W, H);
    }
    if (s.flick && Math.sin(t * 1.3 + s.seed) > 0.2) {
      g.fillStyle = 'rgba(255,140,40,0.75)'; g.font = `600 ${Math.round(H * 0.11)}px ${T.FONTS.ui}`; g.textAlign = 'center';
      g.fillText('NO SIGNAL', W / 2, H * 0.5); g.font = `500 ${Math.round(H * 0.07)}px ${T.FONTS.ui}`; g.fillStyle = 'rgba(255,140,40,0.5)'; g.fillText('SYS FAULT 0x' + (0xa000 + ((s.seed * 997) | 0)).toString(16).toUpperCase(), W / 2, H * 0.63);
    }
    g.fillStyle = 'rgba(255,255,255,0.02)'; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  };
  let screenSeed = 1;
  kit.screen = (o) => {
    const [W, H] = o.res || [256, 160], [sw, sh] = o.size || [0.4, 0.25];
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false });
    mat.userData = { emissive: true, screen: true, group: 'screen' };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
    if (o.pos) mesh.position.set(...o.pos); if (o.rot) mesh.rotation.set(...o.rot); mesh.name = `screen${o.id != null ? o.id : ''}`;
    (o.parent || root).add(mesh);
    const ctx2d = cv.getContext('2d');
    const s = { id: o.id != null ? o.id : `s${kit.screens.length}`, canvas: cv, ctx2d, tex, mat, mesh, seed: screenSeed++ * 0.37, flick: eur && (o.flick != null ? o.flick : (screenSeed % 3 !== 0)) };
    s.live = !!o.draw;                                  // core-driven screens (ids 0,1,2) pass no draw
    if (o.draw) {
      s.drawLive = o.draw;
      s.draw = (g, w, h, t) => (eur && !o.alive ? deadDraw(g, w, h, t, s) : o.draw(g, w, h, t, s));
    } else if (eur && o.core) { s.draw = (g, w, h, t) => deadDraw(g, w, h, t, s); }
    s.range = o.range || 14; s.interval = o.interval || 0.12; s._t = -1;
    if (s.draw) { s.draw(ctx2d, W, H, 0); tex.needsUpdate = true; } else { ctx2d.fillStyle = '#02080d'; ctx2d.fillRect(0, 0, W, H); tex.needsUpdate = true; }
    if (o.bezel !== false && o.size) {
      const ex = 0.02; const bz = o.bezelSize || [sw + ex, sh + ex, 0.012];
      const q = new THREE.Quaternion().setFromEuler(mesh.rotation);
      const off = new V3(0, 0, -0.0085).applyQuaternion(q);
      kit.arrays('trim', bevelBoxArrays(bz[0], bz[1], bz[2], 0.004), { pos: [mesh.position.x + off.x, mesh.position.y + off.y, mesh.position.z + off.z], quat: q });
    }
    kit.screens.push(s); return s;
  };

  // ───────── signs / decals ─────────
  kit.sign = (text, pos, o = {}) => { kit.signs.push({ text, pos, ...o }); };
  kit.decal = (texture, pos, size, o = {}) => {
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false, opacity: o.opacity != null ? o.opacity : 1, color: o.color != null ? o.color : 0xffffff, side: o.side || THREE.FrontSide });
    mat.userData = { emissive: !!o.glow, decal: true };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat);
    m.position.set(...pos); if (o.rot) m.rotation.set(...o.rot); m.renderOrder = 5; m.name = o.name || 'decal';
    (o.parent || root).add(m); kit.decals.push(m); return m;
  };

  // EURYDICE log recorder: small field recorder with a blinking amber LED
  kit.recorder = (n, pos, yaw = 0) => {
    const [x, y, z] = pos, ca = Math.cos(yaw), sa = Math.sin(yaw);
    const loc = (dx, dy, dz) => [x + dx * ca + dz * sa, y + dy, z - dx * sa + dz * ca];
    kit.box('plasticDark', loc(0, 0.0, 0), [0.16, 0.05, 0.11], { yaw, bev: 0.008 });
    kit.box('trim', loc(0, 0.03, 0), [0.15, 0.012, 0.1], { yaw, bev: 0.004 });
    kit.box('screenOff', loc(-0.03, 0.037, 0.0), [0.06, 0.003, 0.05], { yaw, bev: 0.001 });
    kit.cyl('metal', loc(0.045, 0.037, -0.02), 0.014, 0.008, { seg: 12 });
    kit.box(kit.led('Amber', 'Blink'), loc(0.05, 0.038, 0.03), [0.012, 0.004, 0.012], { yaw, bev: 0 });
    kit.box('paintOrange', loc(0, 0.0, -0.057), [0.12, 0.02, 0.006], { yaw, bev: 0.002 });
    return kit.interact({ id: `eur.log.${n}`, label: `Recorder — log ${n}`, pos, radius: 1.5, hit: { c: [x, y + 0.01, z], s: [0.26, 0.14, 0.2], yaw } });
  };

  // ───────── finalize: merged meshes + sign atlas + hull cuts ─────────
  kit.finalize = () => {
    // sign atlas
    if (kit.signs.length) {
      const AW = 2048; let x = 0, y = 0, rowH = 0, maxY = 0;
      const place = kit.signs.map((s) => { const w = Math.min(512, Math.max(64, Math.round((s.w || 0.4) * 640))), h = Math.min(256, Math.max(24, Math.round((s.h || 0.1) * 640))); if (x + w > AW) { x = 0; y += rowH + 2; rowH = 0; } const r = { s, x, y, w, h }; x += w + 2; rowH = Math.max(rowH, h); maxY = y + rowH; return r; });
      let AH = 256; while (AH < maxY && AH < 4096) AH *= 2;
      const cvA = T.cvs(AW, AH), g = cvA.getContext('2d');
      const drawAll = () => {
        g.clearRect(0, 0, AW, AH);
        for (const r of place) { g.save(); g.translate(r.x, r.y); const st = r.s.style || 'plate'; T.drawPlate(g, r.w, r.h, r.s.text, st === 'warn' ? { fg: '#1b1205', bg: '#e9b500', border: '#16120a' } : st === 'door' ? { fg: '#e9fbff', bg: '#101c28', border: '#18b8d8', accent: '#e8742a' } : st === 'red' ? { fg: '#ffd9d6', bg: '#3a0d0d', border: '#ff4a40' } : {}); g.restore(); }
        signTex.needsUpdate = true;
      };
      const signTex = new THREE.CanvasTexture(cvA); signTex.colorSpace = THREE.SRGBColorSpace; signTex.anisotropy = 8; signTex.flipY = true;
      drawAll(); T.onFontsReady(drawAll);
      const sm = new THREE.MeshBasicMaterial({ map: signTex, color: new THREE.Color(0.9, 0.9, 0.9), toneMapped: false, transparent: false });
      sm.userData = { emissive: true, group: 'status', base: new THREE.Color(1, 1, 1), intensity: 0.9, sign: true }; kit.emitters.status.push(sm); mats.set('__sign', sm);
      const b = new MeshBuilder('own', 1); const mm = new THREE.Matrix4();
      for (const r of place) {
        const s = r.s, w = s.w || 0.4, h = s.h || 0.1;
        const pos = [-w / 2, -h / 2, 0, w / 2, -h / 2, 0, w / 2, h / 2, 0, -w / 2, h / 2, 0], nrm = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
        const u0 = r.x / AW, u1 = (r.x + r.w) / AW, v0 = 1 - (r.y + r.h) / AH, v1 = 1 - r.y / AH;
        b.addArrays(pos, nrm, [u0, v0, u1, v0, u1, v1, u0, v1], [0, 1, 2, 0, 2, 3], placement({ pos: s.pos, rot: s.rot }, mm));
      }
      const mesh = new THREE.Mesh(b.build(), sm); mesh.name = 'signs'; root.add(mesh);
    }
    // cut-enabled hull skins (windows / hatch / dome / ramp aperture are discarded in the shader; same cuts in the shadow depth pass)
    kit.hullDepth = null;
    for (const nm of ['hull', 'hullUnder']) {
      const hm = mats.get(nm); if (!hm) continue;
      applyPatches(hm, { frost: eur ? (nm === 'hull' ? 0.75 : 0.5) : 0, cuts: kit.cuts.length ? kit.cuts : null });
      if (!kit.hullDepth) { kit.hullDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); applyPatches(kit.hullDepth, { frost: 0, cuts: kit.cuts.length ? kit.cuts : null }); }
    }
    if (eur) for (const [name, m] of mats) { if (m.isMeshStandardMaterial && name !== 'hull' && name !== 'hullUnder' && !m.userData.glass) applyPatches(m, { frost: name.startsWith('glass') ? 0 : 0.42 }); }
    const stats = { meshes: 0, tris: 0 };
    // ── consolidate plain-colour materials into a few vertex-coloured "solid" meshes (cuts draw calls by ~half) ──
    const BUCKETS = [['matte', 0.85, 0.0], ['satin', 0.55, 0.1], ['gloss', 0.2, 0.05], ['metal', 0.5, 0.85], ['polish', 0.28, 0.92]];
    const bucketOf = (m) => { let bi = 0, bd = 1e9; BUCKETS.forEach((q, i) => { const d = (m.roughness - q[1]) ** 2 + ((m.metalness - q[2]) * 0.8) ** 2; if (d < bd) { bd = d; bi = i; } }); return BUCKETS[bi]; };
    const isSimple = (m) => m.isMeshStandardMaterial && !m.map && !m.normalMap && !m.roughnessMap && !m.metalnessMap && !m.emissiveMap && !m.alphaMap && !m.transparent && !m.alphaTest
      && !m.userData.emissive && !m.userData.screen && !m.userData.glass && !m.userData.noBucket && m.emissive.getHex() === 0;
    const solids = new Map();
    for (const [, bd] of builders) {
      if (bd.empty) continue; const m = mats.get(bd.matName);
      if (!isSimple(m)) continue;
      const bk = bucketOf(m), ds = m.side === THREE.DoubleSide, key = `${bk[0]}|${ds ? 1 : 0}|${bd.ext ? 1 : 0}`;
      let g = solids.get(key); if (!g) { g = { bk, ds, ext: bd.ext, pos: [], nor: [], col: [], idx: [], vc: 0 }; solids.set(key, g); }
      const c = m.color, base = g.vc;
      for (let i = 0; i < bd.pos.length; i++) g.pos.push(bd.pos[i]); for (let i = 0; i < bd.nor.length; i++) g.nor.push(bd.nor[i]);
      for (let i = 0; i < bd.vc; i++) g.col.push(c.r, c.g, c.b);
      for (let i = 0; i < bd.idx.length; i++) g.idx.push(bd.idx[i] + base);
      g.vc += bd.vc; bd.consumed = true;
    }
    for (const [, g] of solids) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
      geo.setIndex(g.vc > 65535 ? new THREE.Uint32BufferAttribute(g.idx, 1) : new THREE.Uint16BufferAttribute(g.idx, 1)); geo.computeBoundingSphere(); geo.computeBoundingBox();
      const sm = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: g.bk[1], metalness: g.bk[2], side: g.ds ? THREE.DoubleSide : THREE.FrontSide });
      sm.name = `solid.${g.bk[0]}${g.ds ? '.ds' : ''}`; sm.userData = { name: sm.name, solid: true, def: {} };
      if (eur) applyPatches(sm, { frost: 0.42 });
      kit.solidMats = kit.solidMats || []; kit.solidMats.push(sm);
      const mesh = new THREE.Mesh(geo, sm); mesh.name = sm.name + (g.ext ? '.ext' : '');
      mesh.castShadow = !!g.ext; mesh.receiveShadow = true;
      root.add(mesh); stats.meshes++; stats.tris += g.idx.length / 3;
    }
    // ── textured / emissive / transparent materials: one mesh per material (+ exterior copy that casts shadows) ──
    for (const [, bd] of builders) {
      if (bd.empty || bd.consumed) continue;
      const m = mats.get(bd.matName), em = m.userData.emissive, glass = m.userData.glass;
      const mesh = new THREE.Mesh(bd.build(), m); mesh.name = `${bd.matName}${bd.ext ? '.ext' : ''}`;
      mesh.castShadow = bd.ext && !em && !glass; mesh.receiveShadow = !em;
      if (glass) mesh.renderOrder = 10;
      if ((bd.matName === 'hull' || bd.matName === 'hullUnder') && kit.hullDepth) mesh.customDepthMaterial = kit.hullDepth;
      root.add(mesh); stats.meshes++; stats.tris += bd.idx.length / 3;
    }
    kit.stats = stats;
    return root;
  };
  return kit;
}

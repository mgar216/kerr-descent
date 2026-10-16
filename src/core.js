import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';

// ═══════════════════════════════════════════════════════════════════════════
//  ORPHEUS — a first-person descent into a Kerr black hole.
//  Units: geometric, G = c = M = 1. One M of time = 1 s (M ≈ 2.03×10⁵ M☉).
//  Spacetime: ingoing Kerr–Schild Cartesian coordinates (horizon penetrating),
//  extended through the ring disk to the r < 0 sheet.
// ═══════════════════════════════════════════════════════════════════════════
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const DEG = Math.PI / 180;
const KM_PER_M = 299792.458;                  // 1 M = 1 light-second
const G_PER_ACC = 299792458 / 9.80665;        // geometric acceleration (c/M) → g
const MSUN = 1 / 4.925490947e-6;              // solar masses per M (M = 1 s)
const URLP = new URLSearchParams(location.search);
const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '∞');
function fmtSci(v, d = 2) {
  if (!Number.isFinite(v)) return '∞';
  if (v === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e >= -2 && e < 5) return v.toFixed(Math.max(0, d - e));
  const m = v / Math.pow(10, e);
  return `${m.toFixed(d)}×10${String(e).replace(/-/g, '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c])}`;
}
function fmtClock(s) {
  if (!Number.isFinite(s)) return '∞';
  const sg = s < 0 ? '-' : '';
  s = Math.abs(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${sg}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${x.toFixed(1).padStart(4, '0')}`;
}
function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ─────────────────────────────── Kerr geometry ───────────────────────────────
const K = { a: 0.95, rp: 0, rm: 0, isco: 0, phPro: 0, phRet: 0 };
function iscoPro(a) {
  const z1 = 1 + Math.cbrt(1 - a * a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
  const z2 = Math.sqrt(3 * a * a + z1 * z1);
  return 3 + z2 - Math.sqrt((3 - z1) * (3 + z1 + 2 * z2));
}
function setSpin(a) {
  K.a = a;
  const q = Math.sqrt(Math.max(0, 1 - a * a));
  K.rp = 1 + q; K.rm = 1 - q; K.isco = iscoPro(a);
  K.phPro = 2 * (1 + Math.cos((2 / 3) * Math.acos(-a)));
  K.phRet = 2 * (1 + Math.cos((2 / 3) * Math.acos(a)));
}
const rErgo = (th) => 1 + Math.sqrt(Math.max(0, 1 - K.a * K.a * Math.cos(th) ** 2));
function ksR(x, y, z, s) {
  const a2 = K.a * K.a, z2 = z * z, b = x * x + y * y + z2 - a2, D = Math.sqrt(b * b + 4 * a2 * z2);
  const r2 = b >= 0 ? 0.5 * (b + D) : D - b > 0 ? (2 * a2 * z2) / (D - b) : 0;
  return s * Math.max(Math.sqrt(r2), 1e-12);
}
const MP = { r: 0, f: 0, k1: 0, k2: 0, k3: 0, D: 0 };
function mparts(x, y, z, s) {
  const a = K.a, a2 = a * a, z2 = z * z, b = x * x + y * y + z2 - a2, D = Math.sqrt(b * b + 4 * a2 * z2);
  const r2 = b >= 0 ? 0.5 * (b + D) : D - b > 0 ? (2 * a2 * z2) / (D - b) : 0;
  const r = s * Math.max(Math.sqrt(r2), 1e-12), rr = r * r, ra2 = rr + a2;
  MP.r = r; MP.D = Math.max(D, 1e-14); MP.f = (2 * r * rr) / (rr * rr + a2 * z2);
  MP.k1 = (r * x + a * y) / ra2; MP.k2 = (r * y - a * x) / ra2; MP.k3 = z / r;
  return MP;
}
// g(v,w) = η(v,w) + f (k·v)(k·w), k_μ = (1, k1, k2, k3)
function gdotP(p, v, vo, w, wo) {
  const kv = v[vo] + p.k1 * v[vo + 1] + p.k2 * v[vo + 2] + p.k3 * v[vo + 3];
  const kw = w[wo] + p.k1 * w[wo + 1] + p.k2 * w[wo + 2] + p.k3 * w[wo + 3];
  return -v[vo] * w[wo] + v[vo + 1] * w[wo + 1] + v[vo + 2] * w[wo + 2] + v[vo + 3] * w[wo + 3] + p.f * kv * kw;
}
function gdot(X, s, v, w) { return gdotP(mparts(X[1], X[2], X[3], s), v, 0, w, 0); }
function lowerInto(X, s, v, out) {
  const p = mparts(X[1], X[2], X[3], s);
  const c = p.f * (v[0] + p.k1 * v[1] + p.k2 * v[2] + p.k3 * v[3]);
  out[0] = -v[0] + c; out[1] = v[1] + c * p.k1; out[2] = v[2] + c * p.k2; out[3] = v[3] + c * p.k3;
  return out;
}
function metricInto(x, y, z, s, g) {
  const p = mparts(x, y, z, s), f = p.f, k1 = p.k1, k2 = p.k2, k3 = p.k3;
  g[0] = -1 + f; g[1] = g[4] = f * k1; g[2] = g[8] = f * k2; g[3] = g[12] = f * k3;
  g[5] = 1 + f * k1 * k1; g[6] = g[9] = f * k1 * k2; g[7] = g[13] = f * k1 * k3;
  g[10] = 1 + f * k2 * k2; g[11] = g[14] = f * k2 * k3; g[15] = 1 + f * k3 * k3;
}
const GAM = new Float64Array(64), GL = new Float64Array(64), DG = new Float64Array(48), GA = new Float64Array(16), GB = new Float64Array(16);
// Γ^μ_{αβ} at GAM[μ*16+α*4+β] (finite-differenced metric, analytic inverse)
function christoffel(x, y, z, s) {
  const h = 1e-6 * Math.max(1, Math.abs(x) + Math.abs(y) + Math.abs(z));
  for (let i = 0; i < 3; i++) {
    metricInto(i === 0 ? x + h : x, i === 1 ? y + h : y, i === 2 ? z + h : z, s, GA);
    metricInto(i === 0 ? x - h : x, i === 1 ? y - h : y, i === 2 ? z - h : z, s, GB);
    const o = i * 16, ih = 1 / (2 * h);
    for (let j = 0; j < 16; j++) DG[o + j] = (GA[j] - GB[j]) * ih;
  }
  for (let m = 0; m < 4; m++) for (let al = 0; al < 4; al++) for (let be = al; be < 4; be++) {
    const d1 = al ? DG[(al - 1) * 16 + m * 4 + be] : 0;
    const d2 = be ? DG[(be - 1) * 16 + m * 4 + al] : 0;
    const d3 = m ? DG[(m - 1) * 16 + al * 4 + be] : 0;
    const v = 0.5 * (d1 + d2 - d3);
    GL[m * 16 + al * 4 + be] = v; GL[m * 16 + be * 4 + al] = v;
  }
  const p = mparts(x, y, z, s), f = p.f, c1 = p.k1, c2 = p.k2, c3 = p.k3;
  for (let al = 0; al < 4; al++) for (let be = al; be < 4; be++) {
    const idx = al * 4 + be;
    const g0 = GL[idx], g1 = GL[16 + idx], g2 = GL[32 + idx], g3 = GL[48 + idx];
    const kg = -g0 + c1 * g1 + c2 * g2 + c3 * g3; // k^ν Γ_ν
    const v0 = -g0 + f * kg, v1 = g1 - f * c1 * kg, v2 = g2 - f * c2 * kg, v3 = g3 - f * c3 * kg;
    GAM[idx] = v0; GAM[be * 4 + al] = v0;
    GAM[16 + idx] = v1; GAM[16 + be * 4 + al] = v1;
    GAM[32 + idx] = v2; GAM[32 + be * 4 + al] = v2;
    GAM[48 + idx] = v3; GAM[48 + be * 4 + al] = v3;
  }
}
function gamUV(U, uo, V, vo, out) {
  for (let m = 0; m < 4; m++) {
    const b = m * 16;
    let acc = 0;
    for (let al = 0; al < 4; al++) {
      const ua = U[uo + al];
      if (ua === 0) continue;
      const o = b + al * 4;
      acc += ua * (GAM[o] * V[vo] + GAM[o + 1] * V[vo + 1] + GAM[o + 2] * V[vo + 2] + GAM[o + 3] * V[vo + 3]);
    }
    out[m] = acc;
  }
}
// Ship state S[20] = [X(4) | U(4) | F(4) | R(4) | Up(4)]  — tetrad Fermi–Walker transported
const T4 = new Float64Array(4), A4 = new Float64Array(4);
function rhs(S, sheet, acc, dS) {
  christoffel(S[1], S[2], S[3], sheet);
  for (let m = 0; m < 4; m++) A4[m] = acc[0] * S[8 + m] + acc[1] * S[12 + m] + acc[2] * S[16 + m];
  gamUV(S, 4, S, 4, T4);
  for (let m = 0; m < 4; m++) { dS[m] = S[4 + m]; dS[4 + m] = -T4[m] + A4[m]; }
  for (let i = 0; i < 3; i++) {
    const o = 8 + 4 * i;
    gamUV(S, 4, S, o, T4);
    for (let m = 0; m < 4; m++) dS[o + m] = -T4[m] + acc[i] * S[4 + m];
  }
}
const RK1 = new Float64Array(20), RK2 = new Float64Array(20), RK3 = new Float64Array(20), RK4b = new Float64Array(20), RKT = new Float64Array(20);
function rk4(S, sheet, acc, dt) {
  rhs(S, sheet, acc, RK1);
  for (let i = 0; i < 20; i++) RKT[i] = S[i] + 0.5 * dt * RK1[i];
  rhs(RKT, sheet, acc, RK2);
  for (let i = 0; i < 20; i++) RKT[i] = S[i] + 0.5 * dt * RK2[i];
  rhs(RKT, sheet, acc, RK3);
  for (let i = 0; i < 20; i++) RKT[i] = S[i] + dt * RK3[i];
  rhs(RKT, sheet, acc, RK4b);
  for (let i = 0; i < 20; i++) S[i] += (dt / 6) * (RK1[i] + 2 * RK2[i] + 2 * RK3[i] + RK4b[i]);
}
function orthonormalize(S, sheet) {
  const p = mparts(S[1], S[2], S[3], sheet);
  const uu = gdotP(p, S, 4, S, 4);
  if (!(uu < 0)) return false;
  const nu = 1 / Math.sqrt(-uu);
  for (let m = 4; m < 8; m++) S[m] *= nu;
  for (let i = 0; i < 3; i++) {
    const o = 8 + 4 * i;
    const eu = gdotP(p, S, o, S, 4);
    for (let m = 0; m < 4; m++) S[o + m] += eu * S[4 + m];
    for (let j = 0; j < i; j++) {
      const oj = 8 + 4 * j, ee = gdotP(p, S, o, S, oj);
      for (let m = 0; m < 4; m++) S[o + m] -= ee * S[oj + m];
    }
    const n2 = gdotP(p, S, o, S, o);
    if (!(n2 > 0)) return false;
    const n = 1 / Math.sqrt(n2);
    for (let m = 0; m < 4; m++) S[o + m] *= n;
  }
  return true;
}
// local observers (4-velocity, contravariant)
function eulerianInto(x, y, z, s, out) {
  const p = mparts(x, y, z, s), al = 1 / Math.sqrt(Math.max(1 + p.f, 1e-9));
  out[0] = al * (1 + p.f); out[1] = -al * p.f * p.k1; out[2] = -al * p.f * p.k2; out[3] = -al * p.f * p.k3;
  return out;
}
function staticInto(x, y, z, s, out) {
  const p = mparts(x, y, z, s);
  out[0] = 1 / Math.sqrt(Math.max(1 - p.f, 1e-9)); out[1] = out[2] = out[3] = 0;
  return out;
}
function zamoInto(x, y, z, s, out) { // u_μ ∝ −∇t_BL, t_BL = t_KS − L(r)
  const p = mparts(x, y, z, s), a2 = K.a * K.a, r = p.r, D = p.D;
  const Dl = r * r - 2 * r + a2;
  if (s < 0 || Dl <= 1e-9) return false;
  const Lp = (2 * r) / Dl;
  const w0 = 1, w1 = (-Lp * (r * x)) / D, w2 = (-Lp * (r * y)) / D, w3 = (-Lp * (z * (r * r + a2))) / (r * D);
  const kw = -w0 + p.k1 * w1 + p.k2 * w2 + p.k3 * w3;
  const u0 = -w0 + p.f * kw, u1 = w1 - p.f * p.k1 * kw, u2 = w2 - p.f * p.k2 * kw, u3 = w3 - p.f * p.k3 * kw;
  const nn = u0 * w0 + u1 * w1 + u2 * w2 + u3 * w3;
  if (!(nn < 0)) return false;
  const c = -1 / Math.sqrt(-nn);
  out[0] = u0 * c; out[1] = u1 * c; out[2] = u2 * c; out[3] = u3 * c;
  return true;
}
// reference observer for speed readouts: ZAMO outside r₊, Kerr–Schild Eulerian inside, static on the r<0 sheet
function refObserverInto(x, y, z, s, out) {
  if (s < 0) { staticInto(x, y, z, s, out); return 'STATIC'; }
  const r = ksR(x, y, z, s);
  if (r > K.rp + 0.004 && zamoInto(x, y, z, s, out)) return 'ZAMO';
  eulerianInto(x, y, z, s, out);
  return 'KS';
}
// guidance reference: ZAMO blended into infall near the horizon
const GZ = new Float64Array(4), GN = new Float64Array(4);
function guideRefInto(X, s, fall, out) {
  if (s < 0) { staticInto(X[1], X[2], X[3], s, out); return; }
  eulerianInto(X[1], X[2], X[3], s, GN);
  const r = ksR(X[1], X[2], X[3], s);
  if (fall || r <= K.rp + 0.02 || !zamoInto(X[1], X[2], X[3], s, GZ)) { out.set(GN); return; }
  const w = clamp((r - K.rp - 0.02) / 0.3, 0, 1);
  for (let m = 0; m < 4; m++) out[m] = w * GZ[m] + (1 - w) * GN[m];
  const nn = gdot(X, s, out, out);
  for (let m = 0; m < 4; m++) out[m] /= Math.sqrt(-nn);
}
function Lfun(r) { const dr = K.rp - K.rm; return (2 / dr) * (K.rp * Math.log(r - K.rp) - K.rm * Math.log(r - K.rm)); }
function tauMaxToInner(r) { // upper bound on proper time from r to r₋ inside the black hole
  const half = (K.rp - K.rm) / 2, psi = Math.acos(clamp(1 - (r - K.rm) / half, -1, 1));
  let sum = 0;
  const N = 40;
  for (let i = 0; i < N; i++) { const ps = ((i + 0.5) / N) * psi, rr = K.rm + half * (1 - Math.cos(ps)); sum += (rr * rr + K.a * K.a) / rr; }
  return (sum * psi) / N;
}
function ksPoint(r, th, ph) {
  const a = K.a;
  return [(r * Math.cos(ph) - a * Math.sin(ph)) * Math.sin(th), (r * Math.sin(ph) + a * Math.cos(ph)) * Math.sin(th), r * Math.cos(th)];
}

// ─────────────────────────────── spectra (LUTs) ───────────────────────────────
function cmf(l) { // CIE 1931 2° fit (Wyman, Sloan & Shirley 2013)
  const g = (x, mu, s1, s2) => { const t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };
  return [
    1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2),
    0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1),
    1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8),
  ];
}
function planck(lnm, T) { const l = lnm * 1e-9, x = 1.438776877e-2 / (l * T); return x > 700 ? 0 : 3.741771852e-16 / (Math.pow(l, 5) * (Math.exp(x) - 1)); }
function blackbodyRGB(T) { // linear sRGB, normalised so a 6500 K blackbody has luminance 1
  let X = 0, Y = 0, Z = 0;
  for (let l = 380; l <= 780; l += 5) { const B = planck(l, T), c = cmf(l); X += B * c[0]; Y += B * c[1]; Z += B * c[2]; }
  return [X, Y, Z];
}
let BB_YREF = 1;
function buildBBLUT() {
  BB_YREF = blackbodyRGB(6500)[1];
  const N = 256, data = new Uint16Array(N * 4);
  const out = [];
  for (let i = 0; i < N; i++) {
    const T = Math.pow(10, 2 + (4 * i) / (N - 1));
    const [X, Y, Z] = blackbodyRGB(T).map((v) => v / BB_YREF);
    const R = Math.max(3.2406 * X - 1.5372 * Y - 0.4986 * Z, 0), G = Math.max(-0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0), B = Math.max(0.0557 * X - 0.204 * Y + 1.057 * Z, 0);
    const m = Math.max(R, G, B, 1e-300);
    out.push([R / m, G / m, B / m, Math.log10(m)]);
    data[i * 4] = THREE.DataUtils.toHalfFloat(R / m); data[i * 4 + 1] = THREE.DataUtils.toHalfFloat(G / m);
    data[i * 4 + 2] = THREE.DataUtils.toHalfFloat(B / m); data[i * 4 + 3] = THREE.DataUtils.toHalfFloat(Math.max(Math.log10(m), -60000));
  }
  const tex = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  tex.userData.table = out;
  return tex;
}
function bbColorCPU(table, T) { // for star colours / UI
  const u = clamp((Math.log10(Math.max(T, 100)) - 2) / 4, 0, 1) * 255, i = Math.floor(u), f = u - i, a = table[i], b = table[Math.min(255, i + 1)];
  const l = Math.pow(10, lerp(a[3], b[3], f));
  return [lerp(a[0], b[0], f) * l, lerp(a[1], b[1], f) * l, lerp(a[2], b[2], f) * l];
}
const DISK_ROUT = 17;
function buildNTLUT() { // Novikov–Thorne / Page–Thorne temperature profile, normalised to peak = 1
  const a = Math.max(K.a, 1e-4), x0 = Math.sqrt(K.isco), ac = Math.acos(a);
  const x1 = 2 * Math.cos((ac - Math.PI) / 3), x2 = 2 * Math.cos((ac + Math.PI) / 3), x3 = -2 * Math.cos(ac / 3);
  const F = (r) => {
    const x = Math.sqrt(r);
    const t = (xi, xj, xk) => ((3 * (xi - a) ** 2) / (xi * (xi - xj) * (xi - xk))) * Math.log((x - xi) / (x0 - xi));
    const br = x - x0 - 1.5 * a * Math.log(x / x0) - t(x1, x2, x3) - t(x2, x1, x3) - t(x3, x1, x2);
    return Math.max(br, 0) / (x ** 4 * (x ** 3 - 3 * x + 2 * a));
  };
  const N = 256, vals = [];
  let mx = 0;
  for (let i = 0; i < N; i++) {
    const r = Math.exp(Math.log(K.isco) + (Math.log(DISK_ROUT) - Math.log(K.isco)) * (i / (N - 1)));
    const v = Math.pow(Math.max(F(r * (1 + 1e-9)), 0), 0.25);
    vals.push(v); mx = Math.max(mx, v);
  }
  const data = new Uint16Array(N * 4);
  for (let i = 0; i < N; i++) { const v = THREE.DataUtils.toHalfFloat(vals[i] / mx); data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 15360; }
  const tex = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  return tex;
}

// ─────────────────────────────── shaders ───────────────────────────────
const FS_TRI_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const GLSL_NOISE = /* glsl */ `
float hash13(vec3 p3){ p3 = fract(p3*0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y)*p3.z); }
float vnoise(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0 - 2.0*f);
  float n000 = hash13(i), n100 = hash13(i + vec3(1,0,0)), n010 = hash13(i + vec3(0,1,0)), n110 = hash13(i + vec3(1,1,0));
  float n001 = hash13(i + vec3(0,0,1)), n101 = hash13(i + vec3(1,0,1)), n011 = hash13(i + vec3(0,1,1)), n111 = hash13(i + vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
}
float fbm(vec3 p, int oct){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 7; i++){ if (i >= oct) break; s += a*vnoise(p); n += a; p = p*2.07 + vec3(17.1, 3.7, 9.3); a *= 0.5; }
  return s/n;
}`;

// The ray tracer: backward null geodesics in Kerr–Schild Cartesian coordinates, RK4 on (x, p_i), p_0 conserved.
const BH_FRAG = /* glsl */ `
precision highp float;
precision highp int;
#define PI 3.141592653589793
#define MAX_STEPS 640
uniform vec3 uCamPos; uniform float uSheet; uniform float uCamT;
uniform vec4 uU; uniform vec4 uEf; uniform vec4 uEr; uniform vec4 uEu;
uniform float uTanHalf; uniform float uAspect;
uniform float uA; uniform float uRin; uniform float uRout; uniform float uResc;
uniform int uSteps;
uniform float uDisk; uniform float uDiskT; uniform float uBeam; uniform float uGrid; uniform float uSkyGain; uniform float uSkyGainB;
uniform float uCmb; uniform float uWall; uniform float uPix; uniform float uHot; uniform float uStepK;
uniform samplerCube uSkyA; uniform samplerCube uSkyB;
uniform sampler2D uBB; uniform sampler2D uNT;
varying vec2 vUv;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
${GLSL_NOISE}
float ksR(vec3 x, float sh){
  float a2 = uA*uA; float z2 = x.z*x.z; float b = dot(x,x) - a2; float D = sqrt(b*b + 4.0*a2*z2);
  float r2 = b >= 0.0 ? 0.5*(b + D) : 2.0*a2*z2/max(D - b, 1e-30);
  return sh*max(sqrt(r2), 1e-6);
}
void deriv(vec3 x, vec3 p, float p0, float sh, out vec3 dx, out vec3 dp, out float dt){
  float a = uA, a2 = a*a, z2 = x.z*x.z;
  float b = dot(x,x) - a2; float D = sqrt(b*b + 4.0*a2*z2);
  float r2 = b >= 0.0 ? 0.5*(b + D) : 2.0*a2*z2/max(D - b, 1e-30);
  float r = sh*max(sqrt(r2), 1e-6); r2 = r*r;
  float ra2 = r2 + a2; float den = r2*r2 + a2*z2; float f = 2.0*r*r2/den;
  vec3 k = vec3((r*x.x + a*x.y)/ra2, (r*x.y - a*x.x)/ra2, x.z/r);
  float kp = -p0 + dot(k, p);
  dx = p - f*kp*k;
  dt = -p0 + f*kp;
  vec3 gr = vec3(r*x.x, r*x.y, x.z*ra2/r)/max(D, 1e-9);
  float den2 = den*den;
  float dfdr = 2.0*r2*(3.0*a2*z2 - r2*r2)/den2;
  float dfdz = -4.0*r*r2*a2*x.z/den2;
  vec3 gf = gr*dfdr; gf.z += dfdz;
  float Aq = (p.x*x.x + p.y*x.y - 2.0*r*(p.x*k.x + p.y*k.y))/ra2 - p.z*k.z/r;
  vec3 Bq = vec3((r*p.x - a*p.y)/ra2, (r*p.y + a*p.x)/ra2, p.z/r);
  dp = 0.5*kp*kp*gf + f*kp*(gr*Aq + Bq);
}
vec3 bb(float T){ // blackbody: observed linear-sRGB radiance of a blackbody at T (6500 K → luminance 1)
  float lt = log2(max(T, 1.0))*0.30103;
  float u = (lt - 2.0)*0.25;
  vec4 c = texture2D(uBB, vec2(clamp(u, 0.0, 1.0)*(255.0/256.0) + 0.5/256.0, 0.5));
  float l = c.a + max(lt - 6.0, 0.0);
  return c.rgb*exp2(min(l, 30.0)*3.3219281);
}
float ntT(float r){
  float u = (log(r) - log(uRin))/(log(uRout) - log(uRin));
  return texture2D(uNT, vec2(clamp(u, 0.0, 1.0)*(255.0/256.0) + 0.5/256.0, 0.5)).r;
}
float diskPattern(float lr, float ph, float seed, int oct){
  vec3 q = vec3(cos(ph)*1.7, sin(ph)*1.7, lr*6.5) + seed*vec3(5.31, 2.17, 7.43);
  float n = fbm(q, oct);
  float n2 = fbm(q*vec3(2.3, 2.3, 3.6) + 11.0, max(oct - 1, 1));
  float rings = 0.55 + 0.45*sin(lr*46.0 + n*7.0 + seed*1.7);
  return clamp(smoothstep(0.28, 0.78, n)*(0.55 + 0.45*rings) + 0.3*smoothstep(0.45, 0.9, n2), 0.0, 1.25);
}
float diskDensity(float r, float ph, float te, int oct){
  float Om = 1.0/(pow(r, 1.5) + uA);
  float P = 24.0; float c = te/P;
  float f1 = fract(c), f2 = fract(c + 0.5);
  float lr = log(r);
  float d1 = diskPattern(lr, ph - Om*f1*P, floor(c), oct);
  float d2 = diskPattern(lr, ph - Om*f2*P, floor(c + 0.5) + 0.5, oct);
  return mix(d2, d1, 1.0 - abs(2.0*f1 - 1.0));
}
float hotSpots(float r, float ph, float te){
  float s = 0.0;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float rs = uRin*(1.3 + 0.55*fi) + 1.2*fi;
    float Om = 1.0/(pow(rs, 1.5) + uA);
    float dph = mod(ph - Om*te - fi*2.1 + PI, 2.0*PI) - PI;
    float w = 0.16*rs; float dr = r - rs; float da = rs*dph;
    s += exp(-(dr*dr + da*da*0.3)/(w*w));
  }
  return s;
}
vec4 diskShade(vec3 xc, vec3 pc, float p0, float r, float te, float foot, float cosI){
  float a = uA;
  float Om = 1.0/(pow(r, 1.5) + a);
  float gtt = -1.0 + 2.0/r, gtp = -2.0*a/r, gpp = r*r + a*a + 2.0*a*a/r;
  float ut2 = -(gtt + 2.0*Om*gtp + Om*Om*gpp);
  if (ut2 <= 0.0) return vec4(0.0);
  float ut = inversesqrt(ut2);
  float pu = ut*(p0 + Om*(xc.x*pc.y - xc.y*pc.x));   // p'_μ u^μ_disk
  float g = 1.0/max(pu, 1e-3);                       // ν_obs / ν_emit
  float ph = atan(xc.y, xc.x) - atan(a, r);
  int oct = int(clamp(log2(0.7/max(foot, 1e-4)), 2.0, 6.0));
  float dens = diskDensity(r, ph, te, oct);
  float hs = hotSpots(r, ph, te)*uHot;
  float prof = ntT(r);
  float edge = smoothstep(uRout, uRout*0.7, r);
  float T = uDiskT*prof*(0.8 + 0.32*dens + 0.45*hs);
  vec3 em = bb(T*mix(1.0, g, uBeam));
  float tau = (0.3 + 2.4*dens + 2.0*hs)*edge/max(cosI, 0.06);
  float al = (1.0 - exp(-tau))*smoothstep(0.0, 0.1, prof);
  return vec4(em*al*uDisk, al);
}
float gridAt(vec3 x, float r){
  float th = acos(clamp(x.z/r, -1.0, 1.0));
  float ph = atan(x.y, x.x) - atan(uA, r);
  vec2 g = vec2(th, ph)/(PI/12.0);
  vec2 d = abs(fract(g + 0.5) - 0.5);
  float l = min(d.x, d.y*max(sin(th), 0.25));
  return 1.0 - smoothstep(0.015, 0.06, l);
}
vec3 skyShift(vec4 s, float g){
  float Y = dot(s.rgb, LUMA);
  if (Y <= 1e-9) return vec3(0.0);
  float T = exp2(clamp(s.a/Y, 2.4, 5.0)*3.3219281);
  vec3 b0 = bb(T), b1 = bb(T*g);
  float Y0 = max(dot(b0, LUMA), 1e-30), Y1 = dot(b1, LUMA);
  vec3 tint = clamp((b1/max(Y1, 1e-30))/max(b0/Y0, vec3(0.03)), 0.0, 25.0);
  return s.rgb*tint*min(Y1/Y0, 1.0e4);
}
void main(){
  vec2 ndc = vUv*2.0 - 1.0;
  vec3 nd = normalize(vec3(ndc.x*uTanHalf*uAspect, ndc.y*uTanHalf, 1.0));
  vec4 pu = -uU + nd.z*uEf + nd.x*uEr + nd.y*uEu;          // past-directed null vector p'^μ (p'·u = 1)
  vec3 x = uCamPos; float sh = uSheet;
  float rc = ksR(x, sh); float rc2 = rc*rc; float ra2c = rc2 + uA*uA;
  float fc = 2.0*rc*rc2/(rc2*rc2 + uA*uA*x.z*x.z);
  vec3 kc = vec3((rc*x.x + uA*x.y)/ra2c, (rc*x.y - uA*x.x)/ra2c, x.z/rc);
  float kpu = pu.x + dot(kc, pu.yzw);
  float p0 = -pu.x + fc*kpu;                                 // conserved p'_t
  vec3 p = pu.yzw + fc*kpu*kc;
  float t = uCamT;
  vec3 col = vec3(0.0); float alpha = 0.0;
  int status = 0; float path = 0.0; float dist = 0.0; float hitD = 65000.0;
  float rprev = rc; float Dprev = sh > 0.0 ? rc*rc - 2.0*rc + uA*uA : 1.0;
  float minRing = 1e9;
  for (int i = 0; i < MAX_STEPS; i++){
    if (i >= uSteps) break;
    vec3 k1x, k1p, k2x, k2p, k3x, k3p, k4x, k4p; float k1t, k2t, k3t, k4t;
    deriv(x, p, p0, sh, k1x, k1p, k1t);
    float rr = abs(rprev);
    float sc = length(x.xy);
    float dRing = length(vec2(sc - uA, x.z));
    if (i > 2) minRing = min(minRing, dRing);
    float h = min(0.12*rr, 0.05*rr*rr + 0.03);
    h = min(h, 0.2*dRing + 0.004);
    h = max(h*uStepK, 0.002);
    float dl = h/max(length(k1x), length(p));
    deriv(x + 0.5*dl*k1x, p + 0.5*dl*k1p, p0, sh, k2x, k2p, k2t);
    deriv(x + 0.5*dl*k2x, p + 0.5*dl*k2p, p0, sh, k3x, k3p, k3t);
    deriv(x + dl*k3x, p + dl*k3p, p0, sh, k4x, k4p, k4t);
    vec3 xn = x + (dl/6.0)*(k1x + 2.0*k2x + 2.0*k3x + k4x);
    vec3 pn = p + (dl/6.0)*(k1p + 2.0*k2p + 2.0*k3p + k4p);
    float tn = t + (dl/6.0)*(k1t + 2.0*k2t + 2.0*k3t + k4t);
    if (x.z*xn.z < 0.0){
      float fr = x.z/(x.z - xn.z);
      vec3 xc = mix(x, xn, fr);
      float sc2 = dot(xc.xy, xc.xy);
      if (sc2 < uA*uA){
        sh = -sh;                                            // through the ring: r → −r
      } else if (sh > 0.0 && uDisk > 0.0){
        float rcr = sqrt(sc2 - uA*uA);
        if (rcr > uRin && rcr < uRout){
          vec4 dc = diskShade(xc, mix(p, pn, fr), p0, rcr, mix(t, tn, fr), uPix*(path + fr*h) + 0.002, abs(k1x.z)/max(length(k1x), 1e-9));
          col += (1.0 - alpha)*dc.rgb; alpha += (1.0 - alpha)*dc.a;
          if (alpha > 0.5 && hitD > 64999.0) hitD = dist + fr*length(xn - x);
        }
      }
    }
    vec3 xo = x;
    x = xn; p = pn; t = tn; path += h; dist += length(x - xo);
    float rn = ksR(x, sh);
    if (alpha > 0.995){ status = 4; break; }
    if (dot(x, x) > uResc*uResc && dot(x, p) > 0.0){ status = 1; break; }
    if (length(vec2(length(x.xy) - uA, x.z)) < 0.006){ status = 3; break; }
    if (sh > 0.0){
      float Dl = rn*rn - 2.0*rn + uA*uA;
      if (uGrid > 0.0 && Dprev*Dl < 0.0){                     // ray crosses a horizon: draw its grid
        vec3 xg = mix(xo, x, Dprev/(Dprev - Dl)); float rg = ksR(xg, 1.0);
        float gl = gridAt(xg, rg)*uGrid*0.6;
        col += (1.0 - alpha)*(rg > 1.0 ? vec3(1.0, 0.32, 0.06) : vec3(0.1, 0.7, 1.0))*gl; alpha += (1.0 - alpha)*gl*0.25;
      }
      if (abs(Dl) < 0.03){                                   // asymptotic approach to a horizon → no light from there
        float ra2n = rn*rn + uA*uA;
        vec3 kk = vec3((rn*x.x + uA*x.y)/ra2n, (rn*x.y - uA*x.x)/ra2n, x.z/rn);
        float P = -p0*ra2n - uA*(x.x*p.y - x.y*p.x);
        if (Dl*dot(kk, p)/P > 1.0){ status = 2; break; }
      }
      Dprev = Dl;
    } else Dprev = 1.0;
    rprev = rn;
  }
  vec3 dir = normalize(p);
  vec4 sa = textureCube(uSkyA, dir);
  vec4 sb = textureCube(uSkyB, dir);
  vec3 bg = vec3(0.0);
  if (status == 1){
    float g = 1.0/max(p0, 1e-6);
    bg = (sh > 0.0 ? skyShift(sa, g)*uSkyGain : skyShift(sb, g)*uSkyGainB) + bb(2.725*g)*uCmb;
  } else if (status == 3){
    bg = vec3(1.4, 1.0, 2.6)*(18.0 + 10.0*sin(uWall*41.0 + x.z*120.0));
  } else if (status == 2 && uGrid > 0.0){
    float rg = ksR(x, sh);
    bg = (rg > 1.0 ? vec3(1.0, 0.32, 0.06) : vec3(0.1, 0.7, 1.0))*gridAt(x, rg)*uGrid;
  }
  col += (1.0 - alpha)*bg;
  col += (1.0 - alpha)*vec3(1.1, 0.8, 2.4)*(3.0*exp(-minRing/0.012) + 0.6*exp(-minRing/0.06))*(0.85 + 0.15*sin(uWall*23.0));
  col = min(col, vec3(3.0e4));
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  if (status != 1) hitD = min(hitD, dist);
  gl_FragColor = vec4(col, hitD);
}`;

const UPSAMPLE_FRAG = /* glsl */ `
uniform sampler2D tBH; uniform vec2 uTexel; uniform float uSharp; uniform float uGain;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tBH, vUv).rgb;
  vec3 a = texture2D(tBH, vUv + vec2(uTexel.x, 0.0)).rgb, b = texture2D(tBH, vUv - vec2(uTexel.x, 0.0)).rgb;
  vec3 d = texture2D(tBH, vUv + vec2(0.0, uTexel.y)).rgb, e = texture2D(tBH, vUv - vec2(0.0, uTexel.y)).rgb;
  vec3 mn = min(c, min(min(a, b), min(d, e))), mx = max(c, max(max(a, b), max(d, e)));
  vec3 s = c + uSharp*(c - 0.25*(a + b + d + e));
  gl_FragColor = vec4(clamp(s, mn, mx)*uGain, 1.0);
}`;

const METER_FRAG = /* glsl */ `
uniform sampler2D tSrc; varying vec2 vUv;
void main(){
  vec2 base = floor(vUv*16.0)/16.0;
  float acc = 0.0, w = 0.0; vec3 cs = vec3(0.0);
  for (int i = 0; i < 8; i++) for (int j = 0; j < 8; j++){
    vec2 uv = base + (vec2(float(i), float(j)) + 0.5)/128.0;
    vec3 c = texture2D(tSrc, uv).rgb;
    float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec2 dd = (uv - 0.5)*vec2(1.6, 1.0); float cw = exp(-dot(dd, dd)*7.0) + 0.04;
    acc += cw*log(L + 1e-5); cs += cw*c; w += cw;
  }
  gl_FragColor = vec4(acc/w, cs/w);
}`;

const LENS_FRAG = /* glsl */ `
uniform sampler2D tDiffuse; uniform sampler2D tDirt;
uniform float uExposure; uniform float uTime; uniform float uCA; uniform float uVig; uniform float uGrain;
uniform float uFlash; uniform vec3 uFlashCol; uniform float uGlitch; uniform float uDirtAmt; uniform vec2 uRes; uniform float uSat;
varying vec2 vUv;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec2 uv = vUv;
  if (uGlitch > 0.001){
    float band = floor(uv.y*46.0 + floor(uTime*24.0)*7.0);
    float r = h12(vec2(band, floor(uTime*24.0)));
    if (r < uGlitch*0.55) uv.x += (h12(vec2(band, 3.1)) - 0.5)*0.09*uGlitch;
  }
  vec2 dc = uv - 0.5;
  float ca = uCA*dot(dc, dc) + uGlitch*0.012;
  vec3 c = vec3(texture2D(tDiffuse, uv - dc*ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv + dc*ca).b);
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 12; i++){
    float a = float(i)*0.5235988 + 0.3;
    vec2 o = vec2(cos(a), sin(a))*(0.05 + 0.045*float(i - (i/3)*3));
    glow += texture2D(tDiffuse, uv + o).rgb;
  }
  float dirt = texture2D(tDirt, vUv).r;
  c += glow*(1.0/12.0)*dirt*uDirtAmt;
  c *= uExposure;
  float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(L), c, uSat);
  // hue-preserving extended-Reinhard on luminance, blended with ACES for contrast; very bright → white
  float Lh = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-6);
  float Lt = Lh*(1.0 + Lh/36.0)/(1.0 + Lh);
  vec3 hp = c*(Lt/Lh);
  hp = mix(hp, vec3(Lt), smoothstep(1.5, 12.0, Lh)*0.7);
  c = mix(aces(c), min(hp, vec3(1.0)), 0.5);
  c = pow(c, vec3(1.0, 1.0, 0.98)) * vec3(1.0, 1.0, 1.02);
  float v = smoothstep(1.05, 0.25, length(dc*vec2(1.0, 0.82)));
  c *= mix(1.0, v, uVig);
  c = mix(c, uFlashCol, clamp(uFlash, 0.0, 1.0));
  c += (h12(uv*uRes + fract(uTime)*311.0) - 0.5)*uGrain;
  gl_FragColor = vec4(max(c, 0.0), 1.0);
}`;

// ── sky generation (rendered once into an HDR cubemap; alpha = Y·log10 T for Doppler re-coloring) ──
const SKY_VERT = /* glsl */ `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`;
const SKY_FRAG = /* glsl */ `
precision highp float;
uniform float uPal; uniform float uSeed; uniform vec3 uGN; uniform vec3 uGC; uniform vec3 uM31; uniform sampler2D uBB;
varying vec3 vDir;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
${GLSL_NOISE}
vec3 bbc(float T){ float u = (log2(T)*0.30103 - 2.0)*0.25; vec4 c = texture2D(uBB, vec2(clamp(u,0.0,1.0)*(255.0/256.0) + 0.5/256.0, 0.5)); return c.rgb/max(dot(c.rgb, LUMA), 1e-6); }
vec3 col = vec3(0.0); float acc = 0.0;
void add(vec3 c, float T){ col += c; acc += dot(c, LUMA)*log2(T)*0.30103; }
void spiral(vec3 d, vec3 C, float size, float incl, float rot, float bright, vec3 tint){
  float cz = dot(d, C); if (cz <= 0.0) return;
  vec3 ax1 = normalize(cross(C, abs(C.y) < 0.9 ? vec3(0,1,0) : vec3(1,0,0))); vec3 ax2 = cross(C, ax1);
  vec2 q = vec2(dot(d, ax1), dot(d, ax2))/cz/size;
  q = mat2(cos(rot), -sin(rot), sin(rot), cos(rot))*q; q.y /= incl;
  float rr = length(q); if (rr > 3.0) return;
  float th = atan(q.y, q.x);
  float arms = pow(0.5 + 0.5*cos(2.0*(th - 2.6*log(rr + 0.06))), 2.5);
  float n = fbm(vec3(q*7.0, uSeed), 5);
  float diskI = exp(-rr*2.6)*(0.3 + 1.6*arms*smoothstep(0.25, 0.75, n));
  float dust = smoothstep(0.5, 0.75, fbm(vec3(q*11.0, 3.0 + uSeed), 4))*arms*exp(-rr*1.5);
  float core = exp(-rr*rr*55.0);
  add(bbc(4300.0)*core*2.2*bright, 4300.0);
  add(mix(bbc(5200.0), bbc(11000.0)*tint, smoothstep(0.05, 0.6, rr))*diskI*(1.0 - 0.7*dust)*bright*0.55, 8000.0);
  add(vec3(1.0, 0.25, 0.4)*diskI*arms*smoothstep(0.62, 0.9, n)*bright*0.35, 3200.0);
}
void galaxies(vec3 d){
  vec3 p = d*16.0;
  vec3 c = floor(p);
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++){
    vec3 cell = c + vec3(float(i), float(j), float(k));
    float h = hash13(cell + uSeed*7.0);
    if (h > 0.22) continue;
    vec3 gp = normalize(cell + vec3(hash13(cell + 1.3), hash13(cell + 2.7), hash13(cell + 4.1)));
    vec3 o = d - gp;
    float sz = 0.0018 + 0.004*hash13(cell + 9.1);
    vec3 ax = normalize(cross(gp, vec3(hash13(cell + 5.5) - 0.5, 0.7, hash13(cell + 6.6) - 0.5)));
    float e = dot(o, ax); vec3 o2 = o - e*ax;
    float q = (e*e*3.0 + dot(o2, o2))/(sz*sz);
    add(bbc(5500.0 + 4000.0*hash13(cell + 8.8))*exp(-q)*0.05, 6000.0);
  }
}
void main(){
  vec3 d = normalize(vDir);
  if (uPal < 0.5){
    vec3 N = uGN, C = uGC, E = normalize(cross(N, C));
    float b = asin(clamp(dot(d, N), -1.0, 1.0));
    float l = atan(dot(d, E), dot(d, C));
    float bulge = exp(-(l*l)/(2.0*0.45*0.45));
    float band = exp(-abs(b)/(0.055 + 0.085*bulge));
    float clouds = fbm(d*7.0 + uSeed, 6);
    float fine = fbm(d*26.0 + 3.0 + uSeed, 5);
    float dust = smoothstep(0.40, 0.72, fbm(d*9.0 + 7.0 + uSeed, 6))*exp(-abs(b)/(0.03 + 0.03*bulge));
    float dust2 = smoothstep(0.52, 0.8, fine)*exp(-abs(b)/0.025);
    float I = band*(0.25 + 1.1*clouds*clouds)*(1.0 - 0.88*dust)*(1.0 - 0.55*dust2);
    float core = exp(-(l*l + 5.0*b*b)/(2.0*0.17*0.17));
    add(mix(bbc(9000.0), bbc(4600.0), bulge)*I*0.10, mix(9000.0, 4600.0, bulge));
    add(bbc(4200.0)*core*0.30*(1.0 - 0.8*dust), 4200.0);
    add(bbc(6500.0)*exp(-abs(b)/0.5)*0.004, 6500.0);
    float neb = smoothstep(0.6, 0.86, fbm(d*13.0 + 21.0 + uSeed, 6))*exp(-abs(b)/0.11);
    float which = smoothstep(0.42, 0.62, fbm(d*3.5 + 40.0, 3));
    add(vec3(1.0, 0.16, 0.26)*neb*(1.0 - which)*0.07, 3000.0);
    add(vec3(0.2, 0.8, 0.85)*neb*which*0.035, 9000.0);
    spiral(d, uM31, 0.035, 0.35, 0.6, 0.55, vec3(0.9, 0.95, 1.2));
    galaxies(d);
  } else if (uPal < 1.5){
    // the r < 0 universe: a sky of colossal nebulae and a nearby giant spiral
    float n1 = fbm(d*2.2 + uSeed, 7), n2 = fbm(d*4.5 + 13.0 + uSeed, 6), n3 = fbm(d*11.0 + 5.0, 5);
    float veil = smoothstep(0.35, 0.85, n1);
    add(vec3(0.85, 0.15, 0.75)*veil*veil*0.16*(0.4 + n3), 5200.0);
    add(vec3(0.1, 0.75, 0.85)*smoothstep(0.45, 0.85, n2)*0.12*(0.3 + n3), 12000.0);
    add(vec3(1.0, 0.65, 0.2)*smoothstep(0.62, 0.9, n3)*veil*0.12, 3600.0);
    float dust = smoothstep(0.5, 0.75, fbm(d*6.0 + 2.0, 6));
    col *= 1.0 - 0.7*dust; acc *= 1.0 - 0.7*dust;
    spiral(d, normalize(vec3(0.3, -0.55, -0.78)), 0.30, 0.55, 1.2, 1.6, vec3(0.8, 0.9, 1.4));
    spiral(d, normalize(vec3(-0.8, 0.35, 0.5)), 0.08, 0.8, 0.2, 0.8, vec3(1.3, 0.9, 0.8));
    galaxies(d);
  } else {
    // a new universe beyond the white hole: the heart of a dense ancient galaxy
    float n1 = fbm(d*3.0 + uSeed, 7), n2 = fbm(d*9.0 + uSeed*3.0, 6);
    float glow = 0.5 + 0.5*dot(d, normalize(vec3(0.2, 0.9, 0.3)));
    add(bbc(3900.0)*(0.05 + 0.25*glow*glow*glow)*(0.6 + 0.8*n1), 3900.0);
    float dust = smoothstep(0.45, 0.8, n2)*0.8;
    col *= 1.0 - dust; acc *= 1.0 - dust;
    add(vec3(1.0, 0.3, 0.15)*smoothstep(0.6, 0.85, fbm(d*7.0 + 50.0, 5))*0.08, 3000.0);
    galaxies(d);
  }
  gl_FragColor = vec4(col, acc);
}`;
const STAR_VERT = /* glsl */ `
attribute float aSize; attribute vec3 aCol; attribute float aLT; uniform float uScale;
varying vec3 vCol; varying float vLT;
void main(){ vCol = aCol; vLT = aLT; gl_PointSize = aSize*uScale; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`;
const STAR_FRAG = /* glsl */ `
varying vec3 vCol; varying float vLT;
void main(){
  vec2 q = gl_PointCoord*2.0 - 1.0; float d2 = dot(q, q); if (d2 > 1.0) discard;
  vec3 c = vCol*exp(-d2*4.5);
  gl_FragColor = vec4(c, dot(c, vec3(0.2126, 0.7152, 0.0722))*vLT);
}`;

// ─────────────────────────────── renderer & passes ───────────────────────────────
window.__orpheusBooted = true;
function fatal(msg) { const el = $('fatal'); el.textContent = msg; el.classList.remove('hidden'); throw new Error(msg); }
const QUALITY = {
  low: { dpr: 1.0, scale: 0.42, steps: 230, sky: 1024, stars: 70000, stepK: 1.4 },
  medium: { dpr: 1.0, scale: 0.6, steps: 320, sky: 1024, stars: 100000, stepK: 1.15 },
  high: { dpr: 1.25, scale: 0.8, steps: 420, sky: 2048, stars: 140000, stepK: 1.0 },
  ultra: { dpr: 1.5, scale: 1.0, steps: 600, sky: 2048, stars: 170000, stepK: 0.8 },
};
const settings = {
  quality: URLP.get('quality') || 'high', spin: parseFloat(URLP.get('spin') || '0.95'), voice: URLP.get('voice') !== '0', music: true,
  beaming: 1, invertY: false, sens: 1, autoRes: URLP.get('autores') !== '0', grid: false, cockpit: true, hud: true, ticks: true, mute: URLP.get('mute') === '1', slowmo: URLP.get('slowmo') !== '0',
  cmdrVoice: URLP.get('cmdr') === 'B' ? 'B' : 'A', fov: 75,
};
const canvas = $('gl');
const hudc = $('hudc');
const hctx = hudc.getContext('2d');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false, logarithmicDepthBuffer: true, preserveDrawingBuffer: URLP.has('shot') });
} catch (e) { fatal('WebGL2 is not available in this browser.\n' + e.message); }
if (!renderer.capabilities.isWebGL2) fatal('This simulator needs WebGL2.');
if (!renderer.getContext().getExtension('EXT_color_buffer_float')) fatal('This GPU/browser lacks EXT_color_buffer_float (HDR render targets).');
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // r186 dropped PCFSoftShadowMap
if (!URLP.get('quality')) { // pick a sensible default tier from the GPU string
  const glc = renderer.getContext(), dbg = glc.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? String(glc.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  settings.quality = /swiftshader|llvmpipe|software|basic render/i.test(gpu) ? 'low' : /intel|mali|adreno|powervr|vivante/i.test(gpu) || /Mobi|Android/i.test(navigator.userAgent) ? 'medium' : 'high';
}
let Q = QUALITY[settings.quality] || QUALITY.high;
let dpr = Math.min(window.devicePixelRatio || 1, Q.dpr);
renderer.setPixelRatio(dpr);
renderer.setSize(innerWidth, innerHeight, false);

const fsGeo = new THREE.BufferGeometry();
fsGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
fsGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
function fsMesh(mat) { const m = new THREE.Mesh(fsGeo, mat); m.frustumCulled = false; return m; }

const bbTex = buildBBLUT();
let ntTex = null;
const blankCube = new THREE.WebGLCubeRenderTarget(4, { type: THREE.HalfFloatType });
const bhRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
const bhUniforms = {
  uCamPos: { value: new THREE.Vector3() }, uSheet: { value: 1 }, uCamT: { value: 0 },
  uU: { value: new THREE.Vector4() }, uEf: { value: new THREE.Vector4() }, uEr: { value: new THREE.Vector4() }, uEu: { value: new THREE.Vector4() },
  uTanHalf: { value: 0.7 }, uAspect: { value: 1.6 }, uA: { value: 0.95 }, uRin: { value: 2 }, uRout: { value: DISK_ROUT }, uResc: { value: 80 },
  uSteps: { value: 400 }, uDisk: { value: 1 }, uDiskT: { value: 7200 }, uBeam: { value: 1 }, uGrid: { value: 0 }, uSkyGain: { value: 1 }, uSkyGainB: { value: 1 },
  uCmb: { value: 1 }, uWall: { value: 0 }, uPix: { value: 0.001 }, uHot: { value: 1 }, uStepK: { value: 1 },
  uSkyA: { value: blankCube.texture }, uSkyB: { value: blankCube.texture }, uBB: { value: bbTex }, uNT: { value: null },
};
const bhMat = new THREE.ShaderMaterial({ vertexShader: FS_TRI_VERT, fragmentShader: BH_FRAG, uniforms: bhUniforms, depthTest: false, depthWrite: false });
const bhScene = new THREE.Scene();
bhScene.add(fsMesh(bhMat));

// layers: ray-traced background (pre-exposed) → far bodies (worlds module) → near scene (ship space, metres)
const bgScene = new THREE.Scene();
const mainScene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.02, 2.0e5);
const upMat = new THREE.ShaderMaterial({ vertexShader: FS_TRI_VERT, fragmentShader: UPSAMPLE_FRAG, uniforms: { tBH: { value: bhRT.texture }, uTexel: { value: new THREE.Vector2() }, uSharp: { value: 0.35 }, uGain: { value: 1 } }, depthTest: false, depthWrite: false });
const bgMesh = fsMesh(upMat);
bgScene.add(bgMesh);
const farCam = { quaternion: new THREE.Quaternion(), position: new THREE.Vector3(), fov: 70, aspect: 1, exposure: 1, bhTex: bhRT.texture, bhSize: [4, 4] };
class FarPass extends Pass {
  constructor() { super(); this.needsSwap = false; }
  render(r, writeBuffer, readBuffer) {
    if (!ctx.worlds || !ctx.worlds.renderFar) return;
    const ac = r.autoClear; r.autoClear = false;
    r.setRenderTarget(this.renderToScreen ? null : readBuffer);
    try { ctx.worlds.renderFar(r, farCam); } catch (e) { reportModuleError('worlds.renderFar', e); }
    r.autoClear = ac;
  }
}

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(bgScene, fsCam));
composer.addPass(new FarPass());
const nearPass = new RenderPass(mainScene, camera);
nearPass.clear = false; nearPass.clearDepth = true;
composer.addPass(nearPass);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.045, 0.5, 0.0);
composer.addPass(bloomPass);
const dirtTex = makeDirtTexture();
const lensPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, tDirt: { value: dirtTex }, uExposure: { value: 1 }, uTime: { value: 0 }, uCA: { value: 0.012 }, uVig: { value: 0.75 }, uGrain: { value: 0.022 },
    uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 1, 1) }, uGlitch: { value: 0 }, uDirtAmt: { value: 0.22 }, uRes: { value: new THREE.Vector2(1, 1) }, uSat: { value: 1.08 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`,
  fragmentShader: LENS_FRAG,
});
composer.addPass(lensPass);
composer.addPass(new OutputPass());

// auto exposure meter (async readback, no stalls)
const meterRT = new THREE.WebGLRenderTarget(16, 16, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
const meterMat = new THREE.ShaderMaterial({ vertexShader: FS_TRI_VERT, fragmentShader: METER_FRAG, uniforms: { tSrc: { value: bhRT.texture } }, depthTest: false, depthWrite: false });
const meterScene = new THREE.Scene();
meterScene.add(fsMesh(meterMat));
const meterBuf = new Float32Array(16 * 16 * 4);
const view = { exposure: URLP.has('exp') ? parseFloat(URLP.get('exp')) : 2, meterLog: Math.log(0.05), meterCol: [0.05, 0.05, 0.05], meterBusy: false, meterFrame: 0, fixedExposure: URLP.has('exp') };
function runMeter() {
  if (view.meterBusy) return;
  renderer.setRenderTarget(meterRT);
  renderer.render(meterScene, fsCam);
  renderer.setRenderTarget(null);
  view.meterBusy = true;
  const done = () => {
    let L = 0, r = 0, g = 0, b = 0;
    for (let i = 0; i < 256; i++) { L += meterBuf[i * 4]; r += meterBuf[i * 4 + 1]; g += meterBuf[i * 4 + 2]; b += meterBuf[i * 4 + 3]; }
    if (Number.isFinite(L)) { view.meterLog = L / 256; view.meterCol = [r / 256, g / 256, b / 256]; }
    view.meterBusy = false;
  };
  if (renderer.readRenderTargetPixelsAsync) renderer.readRenderTargetPixelsAsync(meterRT, 0, 0, 16, 16, meterBuf).then(done, () => { view.meterBusy = false; });
  else { renderer.readRenderTargetPixels(meterRT, 0, 0, 16, 16, meterBuf); done(); }
}

function makeDirtTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d'), R = rng(7);
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 90; i++) {
    const x = R() * 1024, y = R() * 1024, r = 20 + R() * 150;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.05 + R() * 0.16;
    gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.6, `rgba(255,255,255,${a * 0.4})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 26; i++) { // smears
    g.strokeStyle = `rgba(255,255,255,${0.04 + R() * 0.06})`; g.lineWidth = 6 + R() * 26; g.lineCap = 'round';
    const x = R() * 1024, y = R() * 1024, a = R() * Math.PI;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 120, y + Math.sin(a) * 120 + 40, x + Math.cos(a) * 260, y + Math.sin(a) * 260); g.stroke();
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + R() * 0.5})`; g.fillRect(R() * 1024, R() * 1024, 1 + R() * 2.2, 1 + R() * 2.2); }
  for (let i = 0; i < 18; i++) { // scratches
    g.strokeStyle = `rgba(255,255,255,${0.12 + R() * 0.2})`; g.lineWidth = 0.8;
    const x = R() * 1024, y = R() * 1024, a = R() * Math.PI, l = 40 + R() * 240;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
  return t;
}

// ─────────────────────────────── sky generation ───────────────────────────────
function starGeometry(palette, seed, count) {
  const R = rng(seed * 7919 + palette * 104729 + 1);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count), lt = new Float32Array(count);
  const GN = new THREE.Vector3(0.28, 0.86, 0.43).normalize();
  const GC = new THREE.Vector3(0.82, -0.12, -0.56); GC.addScaledVector(GN, -GC.dot(GN)).normalize();
  const GE = new THREE.Vector3().crossVectors(GN, GC);
  const classes = palette === 2
    ? [[0.45, 3700], [0.35, 4600], [0.12, 5600], [0.06, 7500], [0.02, 15000]]
    : palette === 1 ? [[0.2, 3400], [0.2, 4800], [0.15, 6000], [0.2, 9000], [0.25, 18000]]
      : [[0.25, 3300], [0.3, 4500], [0.18, 5700], [0.12, 6800], [0.1, 9200], [0.05, 17000]];
  const clusters = [];
  for (let i = 0; i < (palette === 1 ? 14 : 8); i++) {
    const v = new THREE.Vector3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).normalize();
    clusters.push({ v, r: 0.004 + R() * 0.02, hot: R() < 0.5 });
  }
  const tmp = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    let v;
    const u = R();
    if (palette === 0 && u < 0.5) { // galactic plane population
      const b = (R() < 0.5 ? -1 : 1) * -Math.log(1 - R()) * (R() < 0.6 ? 0.05 : 0.16);
      const l = R() < 0.55 ? (R() - 0.5) * 2 * Math.PI : ((R() + R() + R() - 1.5) * 1.1);
      tmp.copy(GC).multiplyScalar(Math.cos(l) * Math.cos(b)).addScaledVector(GE, Math.sin(l) * Math.cos(b)).addScaledVector(GN, Math.sin(b));
      v = tmp.clone();
    } else if (u < 0.6 && clusters.length) { // star clusters
      const c = clusters[Math.floor(R() * clusters.length)];
      const g = Math.sqrt(-2 * Math.log(1 - R())) * c.r;
      const a = R() * Math.PI * 2;
      const t1 = new THREE.Vector3().crossVectors(c.v, Math.abs(c.v.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
      const t2 = new THREE.Vector3().crossVectors(c.v, t1);
      v = c.v.clone().addScaledVector(t1, Math.cos(a) * g).addScaledVector(t2, Math.sin(a) * g).normalize();
    } else {
      const z = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      v = new THREE.Vector3(s * Math.cos(a), s * Math.sin(a), z);
    }
    pos[i * 3] = v.x * 40; pos[i * 3 + 1] = v.y * 40; pos[i * 3 + 2] = v.z * 40;
    // apparent magnitude: counts grow ×2.4 per magnitude
    const mMin = -1.2, mMax = 9.5, k = 0.38;
    const m = Math.log10(Math.pow(10, k * mMin) + R() * (Math.pow(10, k * mMax) - Math.pow(10, k * mMin))) / k;
    let pick = R(), T = 5000;
    for (const [w, t] of classes) { if (pick < w) { T = t; break; } pick -= w; }
    if (m < 2 && R() < 0.5) T = R() < 0.5 ? 18000 + R() * 12000 : 3500;
    T *= 0.88 + R() * 0.24;
    const flux = Math.pow(10, -0.4 * (m - 1)) * (palette === 2 ? 0.9 : 1);
    const sz = 1.15 + 1.5 * clamp((6 - m) / 7, 0, 1);
    const c = bbColorCPU(bbTex.userData.table, T);
    const Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const I = (flux * 0.55) / (sz * sz * 0.3) / Y;
    col[i * 3] = c[0] * I; col[i * 3 + 1] = c[1] * I; col[i * 3 + 2] = c[2] * I;
    size[i] = sz; lt[i] = Math.log10(T);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aLT', new THREE.BufferAttribute(lt, 1));
  return { g, GN, GC };
}
function makeSky(size, palette, seed, starCount) {
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const scene = new THREE.Scene();
  const st = starGeometry(palette, seed, starCount);
  const m31 = st.GC.clone().multiplyScalar(-0.45).addScaledVector(st.GN, 0.62).add(new THREE.Vector3(0.3, -0.1, 0.4)).normalize();
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: { uPal: { value: palette }, uSeed: { value: seed * 1.37 }, uGN: { value: st.GN }, uGC: { value: st.GC }, uM31: { value: m31 }, uBB: { value: bbTex } },
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(50, 128, 96), skyMat);
  sphere.renderOrder = 0;
  scene.add(sphere);
  const starMat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: { uScale: { value: size / 1024 } },
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, transparent: true, depthTest: false, depthWrite: false,
  });
  const pts = new THREE.Points(st.g, starMat);
  pts.frustumCulled = false; pts.renderOrder = 1;
  scene.add(pts);
  const cc = new THREE.CubeCamera(0.1, 200, rt);
  cc.update(renderer, scene);
  sphere.geometry.dispose(); skyMat.dispose(); st.g.dispose(); starMat.dispose();
  return rt;
}
const skies = { home: null, anti: null, cur: null, universe: 0 };

// ─────────────────────────────── cockpit ───────────────────────────────
const cockpit = new THREE.Group();
const cockpitLights = {};
const screens = [];
function buildCockpit() {
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.62, metalness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0a0d11, roughness: 0.82, metalness: 0.35 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x20262e, roughness: 0.5, metalness: 0.6 });
  const accent = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.18, 1.0, 1.6) });
  const amber = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.55, 0.12) });
  cockpitLights.accent = accent; cockpitLights.amber = amber;
  const beam = (a, b, w, h, mat, parent = cockpit) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, A.distanceTo(B)), mat);
    m.position.copy(A).add(B).multiplyScalar(0.5); m.lookAt(B); parent.add(m); return m;
  };
  const curve = (pts, w, h, mat) => { for (let i = 0; i < pts.length - 1; i++) beam(pts[i], pts[i + 1], w, h, mat); };
  // canopy frame
  for (const sx of [-1, 1]) {
    beam([sx * 1.02, -0.42, -0.95], [sx * 0.6, 0.72, -0.64], 0.085, 0.06, frameMat);
    beam([sx * 1.0, -0.4, -0.92], [sx * 0.585, 0.7, -0.62], 0.012, 0.064, accent).position.x += sx * 0.03;
    beam([sx * 0.6, 0.72, -0.64], [sx * 0.78, 0.86, 0.35], 0.07, 0.05, frameMat);
    beam([sx * 1.02, -0.42, -0.95], [sx * 1.25, -0.2, 0.3], 0.09, 0.07, frameMat);
  }
  curve([[-0.6, 0.72, -0.64], [-0.2, 0.765, -0.66], [0.2, 0.765, -0.66], [0.6, 0.72, -0.64]], 0.08, 0.06, frameMat);
  curve([[-1.12, -0.42, -0.93], [-0.4, -0.43, -1.0], [0.4, -0.43, -1.0], [1.12, -0.42, -0.93]], 0.07, 0.05, trimMat);
  // dashboard (curved, slanted)
  const W = 2.5, segX = 24, segY = 6;
  const dg = new THREE.PlaneGeometry(W, 0.72, segX, segY);
  const pa = dg.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), v = pa.getY(i) / 0.72 + 0.5; // v: 0 bottom → 1 top
    const bend = 0.18 * (x / (W / 2)) ** 2;
    pa.setXYZ(i, x, lerp(-1.02, -0.44, v), lerp(-0.42, -0.98, v) + bend);
  }
  dg.computeVertexNormals();
  const dash = new THREE.Mesh(dg, darkMat);
  cockpit.add(dash);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.035, 0.26), trimMat);
  hood.position.set(0, -0.405, -0.86); hood.rotation.x = 0.12; cockpit.add(hood);
  beam([-0.74, -0.425, -0.75], [0.74, -0.425, -0.75], 0.006, 0.006, accent);
  // instrument screens (live canvas textures)
  const slope = Math.atan2(0.58, 0.56);
  [[-0.5, 0], [0, 1], [0.5, 2]].forEach(([x, id]) => {
    const cv = document.createElement('canvas'); cv.width = 384; cv.height = 240;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.225), mat);
    const yv = 0.42;
    m.position.set(x, lerp(-1.02, -0.44, yv) + 0.008, lerp(-0.42, -0.98, yv) + 0.18 * (x / (W / 2)) ** 2 + 0.012);
    m.rotation.x = -(Math.PI / 2 - slope);
    m.rotation.y = -x * 0.28;
    cockpit.add(m);
    const bez = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.25, 0.01), trimMat);
    bez.position.copy(m.position).addScaledVector(new THREE.Vector3(0, Math.cos(slope), Math.sin(slope)).normalize(), -0.006);
    bez.rotation.copy(m.rotation); cockpit.add(bez);
    screens.push({ cv, ctx: cv.getContext('2d'), tex, mat, id });
  });
  // status LEDs
  const ledGeo = new THREE.BoxGeometry(0.018, 0.008, 0.012);
  const leds = new THREE.InstancedMesh(ledGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), 40);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 40; i++) {
    const row = Math.floor(i / 20), x = -0.62 + (i % 20) * 0.065, yv = 0.12 + row * 0.07;
    dummy.position.set(x, lerp(-1.02, -0.44, yv) + 0.006, lerp(-0.42, -0.98, yv) + 0.18 * (x / (W / 2)) ** 2 + 0.006);
    dummy.rotation.x = -(Math.PI / 2 - slope); dummy.updateMatrix(); leds.setMatrixAt(i, dummy.matrix);
    leds.setColorAt(i, new THREE.Color(0.2, 0.2, 0.2));
  }
  cockpit.add(leds); cockpitLights.leds = leds;
  // side consoles
  for (const sx of [-1, 1]) {
    const con = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.9), darkMat);
    con.position.set(sx * 0.98, -0.82, -0.25); con.rotation.z = sx * 0.25; cockpit.add(con);
    beam([sx * 0.8, -0.73, -0.68], [sx * 0.8, -0.73, 0.15], 0.008, 0.008, sx < 0 ? amber : accent);
  }
  // lighting (legacy cockpit only): instrument glow + warning strobe; the env key/fill lights are global
  cockpitLights.inst = new THREE.PointLight(0x5fdcff, 0.6, 2.2, 2); cockpitLights.inst.position.set(0, -0.55, -0.55); mainScene.add(cockpitLights.inst);
  cockpitLights.warn = new THREE.PointLight(0xff2a3a, 0.0, 3, 2); cockpitLights.warn.position.set(0, 0.6, -0.2); mainScene.add(cockpitLights.warn);
  mainScene.add(cockpit);
}

// ─────────────────────────────── navball ───────────────────────────────
const navball = {};
function iconTexture(draw) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.translate(64, 64); g.lineCap = 'round'; draw(g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildNavball() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
  const g = c.getContext('2d');
  let gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#06223a'); gr.addColorStop(1, '#1d7fb6');
  g.fillStyle = gr; g.fillRect(0, 0, 2048, 512);
  gr = g.createLinearGradient(0, 512, 0, 1024); gr.addColorStop(0, '#a4501a'); gr.addColorStop(1, '#1e0a02');
  g.fillStyle = gr; g.fillRect(0, 512, 2048, 512);
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = 'bold 26px Rajdhani, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let lat = -80; lat <= 80; lat += 10) {
    const y = ((90 - lat) / 180) * 1024; g.lineWidth = lat === 0 ? 7 : lat % 30 === 0 ? 3 : 1.5;
    if (lat === 0) g.strokeStyle = '#fff'; else g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.beginPath(); g.moveTo(0, y); g.lineTo(2048, y); g.stroke();
    if (lat % 30 === 0 && lat !== 0) for (let k = 0; k < 8; k++) g.fillText(String(Math.abs(lat)), ((k + 0.5) / 8) * 2048, y - 16);
  }
  for (let h = 0; h < 360; h += 15) {
    const x = (((h / 360 + 0.25) % 1) * 2048); g.lineWidth = h % 90 === 0 ? 4 : h % 45 === 0 ? 2.5 : 1.2; g.strokeStyle = 'rgba(255,255,255,0.4)';
    g.beginPath(); g.moveTo(x, 40); g.lineTo(x, 984); g.stroke();
    const lab = h === 0 ? 'N' : h === 90 ? 'E' : h === 180 ? 'S' : h === 270 ? 'W' : h % 45 === 0 ? String(h) : '';
    if (lab) for (const y of [470, 554]) { g.font = `bold ${lab.length === 1 ? 40 : 28}px Rajdhani, sans-serif`; g.fillStyle = h === 90 ? '#9effc8' : '#fff'; g.fillText(lab, x, y); }
  }
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = 'bold 30px Orbitron, sans-serif';
  for (let k = 0; k < 4; k++) { g.fillText('OUT', ((k + 0.25) / 4) * 2048, 300); g.fillText('BLACK HOLE', ((k + 0.25) / 4) * 2048, 740); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  navball.scene = new THREE.Scene();
  navball.cam = new THREE.OrthographicCamera(-1.08, 1.08, 1.08, -1.08, 0.1, 10); navball.cam.position.set(0, 0, 3); navball.cam.lookAt(0, 0, 0);
  navball.ball = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.32, metalness: 0.05, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.38 }));
  navball.ball.matrixAutoUpdate = false;
  navball.scene.add(navball.ball);
  navball.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const dl = new THREE.DirectionalLight(0xffffff, 1.7); dl.position.set(-1.2, 1.6, 2.2); navball.scene.add(dl);
  const mk = (draw, s = 0.26) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(draw), depthTest: true, transparent: true })); sp.scale.set(s, s, 1); navball.ball.add(sp); return sp; };
  navball.pro = mk((g) => { g.strokeStyle = '#d6ff3a'; g.lineWidth = 9; g.beginPath(); g.arc(0, 0, 26, 0, 7); g.stroke(); g.beginPath(); g.moveTo(0, -26); g.lineTo(0, -52); g.moveTo(-26, 0); g.lineTo(-54, 0); g.moveTo(26, 0); g.lineTo(54, 0); g.stroke(); });
  navball.retro = mk((g) => { g.strokeStyle = '#d6ff3a'; g.lineWidth = 9; g.beginPath(); g.arc(0, 0, 26, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-18, -18); g.lineTo(18, 18); g.moveTo(18, -18); g.lineTo(-18, 18); g.moveTo(0, 26); g.lineTo(0, 52); g.stroke(); });
  navball.tgt = mk((g) => { g.strokeStyle = '#ff6cf0'; g.lineWidth = 9; g.beginPath(); g.moveTo(0, -40); g.lineTo(40, 0); g.lineTo(0, 40); g.lineTo(-40, 0); g.closePath(); g.stroke(); g.fillStyle = '#ff6cf0'; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill(); });
  navball.cue = mk((g) => { g.strokeStyle = '#45b8ff'; g.lineWidth = 8; g.beginPath(); g.arc(0, 0, 34, 0, 7); g.stroke(); g.beginPath(); g.moveTo(0, -20); g.lineTo(0, 20); g.moveTo(-20, 0); g.lineTo(20, 0); g.stroke(); }, 0.22);
}

// ─────────────────────────────── audio (all synthesized) ───────────────────────────────
class AudioEngine {
  constructor() { this.ctx = null; this.ready = false; this.lastRcs = [0, 0, 0]; this.alarmOn = 0; this.alarmPhase = 0; this.creakT = 0; this.beacon = { ident: '', next: 0, on: false, dev: 0, vdev: 0, phase: 0 }; this.tickAcc = 0; this.mcTickAcc = 0; }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC({ latencyHint: 'interactive' }));
    const G = (v, dst) => { const g = c.createGain(); g.gain.value = v; if (dst) g.connect(dst); return g; };
    this.G = G;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 10; this.comp.ratio.value = 3.5; this.comp.attack.value = 0.004; this.comp.release.value = 0.25;
    this.master = G(settings.mute ? 0 : 0.85); this.master.connect(this.comp); this.comp.connect(c.destination);
    this.sfx = G(1, this.master); this.radio = G(0.9, this.master); this.musicBus = G(0.0, this.master);
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(3.2, 2.4);
    this.verbIn = G(1); this.verbIn.connect(this.verb); this.verb.connect(G(0.42, this.master));
    this.analyser = c.createAnalyser(); this.analyser.fftSize = 1024; this.radio.connect(this.analyser);
    this.white = this.noise('white', 4); this.pink = this.noise('pink', 6); this.brown = this.noise('brown', 6);
    this.buildEngine(); this.buildAmbience(); this.buildStrain(); this.buildRadio(); this.buildBeacon(); this.buildMusic();
    this.ready = true;
  }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }
  setMute(m) { if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05); }
  impulse(dur, decay) {
    const c = this.ctx, n = Math.floor(c.sampleRate * dur), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < n; i++) { const t = i / n; lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = lp * Math.pow(1 - t, decay) * (i < 90 ? i / 90 : 1); } }
    return b;
  }
  noise(kind, sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') d[i] = w;
        else if (kind === 'pink') { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
        else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      }
      const fade = 2048; for (let i = 0; i < fade; i++) { const t = i / fade; d[i] *= t; d[n - 1 - i] *= t; } // seamless-ish loop
    }
    return b;
  }
  src(buf, rate = 1) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.loopStart = Math.random() * 0.5; s.start(0, Math.random() * buf.duration); return s; }
  bq(type, f, q = 0.7, gain = 0) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain; return b; }
  osc(type, f) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; }
  buildEngine() {
    const c = this.ctx, G = this.G;
    this.eng = {};
    const e = this.eng;
    e.out = G(1, this.sfx); const send = G(0.25, this.verbIn); e.out.connect(send);
    const pan = c.createStereoPanner(); pan.pan.value = 0; pan.connect(e.out);
    // deep rumble felt through the hull
    e.lp1 = this.bq('lowpass', 90, 0.8); e.lp2 = this.bq('lowpass', 140, 0.5); e.rumble = G(0, pan);
    this.src(this.brown).connect(e.lp1); e.lp1.connect(e.lp2); e.lp2.connect(e.rumble);
    e.sub = G(0, pan); e.subO = this.osc('sine', 33); e.subO.connect(e.sub); e.subO2 = this.osc('triangle', 49.5); e.subO2.connect(G(0.4, e.sub));
    e.lfo = this.osc('sine', 6.3); e.lfoG = G(0); e.lfo.connect(e.lfoG); e.lfoG.connect(e.rumble.gain);
    // plasma roar
    e.bp = this.bq('bandpass', 700, 0.55); e.roar = G(0, pan); this.src(this.pink).connect(e.bp); e.bp.connect(e.roar);
    e.hs = this.bq('highpass', 2600, 0.5); e.hiss = G(0, pan); this.src(this.white).connect(e.hs); e.hs.connect(e.hiss);
    // turbopump whine
    e.w1 = this.osc('sawtooth', 210); e.w2 = this.osc('sawtooth', 211.6); e.wlp = this.bq('lowpass', 1400, 2.2); e.whine = G(0, pan);
    e.w1.connect(e.wlp); e.w2.connect(e.wlp); e.wlp.connect(e.whine);
    this.thrLast = 0;
  }
  buildAmbience() {
    const G = this.G;
    this.amb = {};
    const air = G(0.05, this.sfx); const lp = this.bq('lowpass', 420, 0.5); this.src(this.pink, 0.9).connect(lp); lp.connect(air);
    const fan = G(0.018, this.sfx); const bp = this.bq('bandpass', 185, 5); this.src(this.white).connect(bp); bp.connect(fan);
    const hum = G(0.006, this.sfx); this.osc('sine', 60).connect(hum); this.osc('sine', 120).connect(G(0.5, hum)); this.osc('sine', 180).connect(G(0.25, hum));
    this.amb.air = air;
  }
  buildStrain() {
    const G = this.G;
    this.strain = { out: G(0, this.sfx) };
    this.strain.out.connect(G(0.6, this.verbIn));
    const lp = this.bq('lowpass', 95, 1.2); this.src(this.brown, 0.7).connect(lp); lp.connect(this.strain.out);
    this.osc('sine', 27.5).connect(G(0.5, this.strain.out)); this.osc('sine', 41.2).connect(G(0.25, this.strain.out));
    // "gravity" drone: detuned low choir that swells near the hole
    this.grav = G(0, this.sfx); this.grav.connect(G(0.8, this.verbIn));
    const glp = this.bq('lowpass', 520, 0.6); glp.connect(this.grav);
    this.gravOsc = [55, 82.4, 110.3, 164.8, 220.6].map((f, i) => { const o = this.osc(i % 2 ? 'sawtooth' : 'triangle', f); o.detune.value = (Math.random() - 0.5) * 14; o.connect(G(0.16 / (i + 1), glp)); return o; });
    this.gravLp = glp;
  }
  buildRadio() {
    const G = this.G;
    this.rstatic = G(0, this.radio);
    const bp = this.bq('bandpass', 1750, 0.8); this.src(this.white).connect(bp); bp.connect(this.rstatic);
  }
  buildBeacon() {
    const G = this.G;
    this.bcn = G(0, this.radio);
    const bp = this.bq('bandpass', 1020, 3); bp.connect(this.bcn);
    this.bcnOsc = this.osc('sine', 1020); this.bcnOsc.connect(bp);
    this.bcnOsc2 = this.osc('triangle', 1020); this.bcnOsc2.connect(G(0.15, bp));
  }
  buildMusic() {
    // generative organ pad: slow chords, additive partials (8' 4' 2⅔' 2'), long reverb
    const G = this.G;
    this.musicOut = G(1, this.musicBus); this.musicOut.connect(G(1.4, this.verbIn));
    this.musLp = this.bq('lowpass', 1800, 0.5); this.musLp.connect(this.musicOut);
    this.chords = [[45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [48, 55, 60, 64, 67], [43, 50, 55, 59, 62], [45, 52, 57, 60, 67], [38, 45, 50, 53, 57]];
    this.chordIdx = 0; this.nextChord = 0;
  }
  playChord() {
    const c = this.ctx, t = c.currentTime, ch = this.chords[this.chordIdx++ % this.chords.length];
    const dur = 11;
    ch.forEach((m, i) => {
      const f = 440 * Math.pow(2, (m - 69) / 12);
      const v = c.createGain(); v.gain.value = 0; v.connect(this.musLp);
      v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(0.022 / (1 + i * 0.25), t + 3.8); v.gain.setValueAtTime(0.022 / (1 + i * 0.25), t + dur - 3); v.gain.linearRampToValueAtTime(0, t + dur + 1.5);
      [[1, 1], [2, 0.45], [3, 0.22], [4, 0.18]].forEach(([h, a]) => {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * h; o.detune.value = (Math.random() - 0.5) * 6;
        const og = c.createGain(); og.gain.value = a; o.connect(og); og.connect(v); o.start(t); o.stop(t + dur + 2);
      });
    });
  }
  env(node, t, a, peak, d, hold = 0) { node.gain.cancelScheduledValues(t); node.gain.setValueAtTime(0.0001, t); node.gain.linearRampToValueAtTime(peak, t + a); node.gain.setValueAtTime(peak, t + a + hold); node.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d); }
  oneShotNoise(filterType, f, q, peak, a, d, pan = 0, verb = 0.3, buf = this.white, rate = 1) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const fl = this.bq(filterType, f, q); const g = c.createGain(); const p = c.createStereoPanner(); p.pan.value = pan;
    s.connect(fl); fl.connect(g); g.connect(p); p.connect(this.sfx); if (verb) { const vs = c.createGain(); vs.gain.value = verb; p.connect(vs); vs.connect(this.verbIn); }
    this.env(g, t, a, peak, d); s.start(t, Math.random() * 2); s.stop(t + a + d + 0.1);
    return fl;
  }
  tone(f, dur, type = 'sine', peak = 0.08, bus = this.sfx, delay = 0, f2 = null) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    o.connect(g); g.connect(bus); this.env(g, t, 0.006, peak, dur); o.start(t); o.stop(t + dur + 0.05);
  }
  ui(kind) {
    if (kind === 'select') { this.tone(1320, 0.07, 'sine', 0.05); this.tone(1760, 0.09, 'sine', 0.04, this.sfx, 0.06); }
    else if (kind === 'confirm') { this.tone(880, 0.08, 'triangle', 0.06); this.tone(1320, 0.14, 'triangle', 0.05, this.sfx, 0.08); }
    else if (kind === 'deny') { this.tone(220, 0.18, 'square', 0.04); }
    else if (kind === 'wp') { [988, 1319, 1976].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.06, this.sfx, i * 0.09)); }
    else if (kind === 'click') this.tone(2400, 0.02, 'square', 0.02);
  }
  rcs(axis, amt) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    if (now - this.lastRcs[axis] < 0.085 + Math.random() * 0.03) return;
    this.lastRcs[axis] = now;
    const pan = axis === 1 ? (Math.random() < 0.5 ? -0.7 : 0.7) : (Math.random() - 0.5) * 1.2;
    this.oneShotNoise('bandpass', 2600 + Math.random() * 2400, 0.9, 0.11 * clamp(amt, 0.3, 1), 0.004, 0.09 + Math.random() * 0.06, pan, 0.25);
    this.oneShotNoise('lowpass', 300, 1, 0.05 * amt, 0.003, 0.06, pan, 0);
  }
  ignition() {
    if (!this.ready) return;
    this.tone(95, 0.9, 'sine', 0.5, this.sfx, 0, 30);
    this.oneShotNoise('lowpass', 900, 0.7, 0.35, 0.01, 1.2, 0, 0.6, this.brown);
    this.oneShotNoise('bandpass', 420, 9, 0.25, 0.002, 0.5, 0, 0.5);
  }
  clank() { this.oneShotNoise('bandpass', 180 + Math.random() * 400, 18, 0.25, 0.003, 0.9 + Math.random() * 0.8, (Math.random() - 0.5) * 1.6, 0.7); }
  boom(big = 1) {
    if (!this.ready) return;
    this.tone(70, 3.5 * big, 'sine', 0.7, this.sfx, 0, 24);
    this.oneShotNoise('lowpass', 400, 0.7, 0.6 * big, 0.02, 3.2 * big, 0, 1.0, this.brown);
    this.oneShotNoise('bandpass', 2400, 0.6, 0.12 * big, 0.01, 1.5, 0, 0.8);
  }
  bwaam() { // deep brass hit for thresholds
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime, g = c.createGain(), lp = this.bq('lowpass', 180, 2);
    lp.frequency.setValueAtTime(140, t); lp.frequency.linearRampToValueAtTime(900, t + 0.6); lp.frequency.exponentialRampToValueAtTime(120, t + 5);
    g.connect(this.sfx); const vs = c.createGain(); vs.gain.value = 0.8; g.connect(vs); vs.connect(this.verbIn);
    lp.connect(g); this.env(g, t, 0.25, 0.32, 5.5);
    [41.2, 41.5, 61.8, 82.4, 82.9].forEach((f) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + 6.5); });
  }
  whoosh(dur = 2.5) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.pink;
    const f = this.bq('bandpass', 200, 0.8), g = c.createGain();
    f.frequency.setValueAtTime(150, t); f.frequency.exponentialRampToValueAtTime(5000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    s.connect(f); f.connect(g); g.connect(this.sfx); g.connect(this.verbIn); s.start(t); s.stop(t + dur + 0.3);
  }
  quindar(intro) { if (this.ready) this.tone(intro ? 2525 : 2475, 0.25, 'sine', 0.085, this.radio); }
  squelch() { this.ready && this.oneShotNoise('bandpass', 1900, 0.7, 0.22, 0.002, 0.16, 0, 0); }
  radioStatic(on, level = 1) { if (this.ready) this.rstatic.gain.setTargetAtTime(on ? 0.035 * level : 0, this.ctx.currentTime, on ? 0.05 : 0.15); }
  crackle() { this.ready && this.oneShotNoise('highpass', 3000, 0.5, 0.08 + Math.random() * 0.1, 0.001, 0.03, (Math.random() - 0.5), 0); }
  tick(mc) {
    if (!this.ready) return;
    if (mc) { this.tone(1600, 0.03, 'sine', 0.035, this.radio); return; }
    this.oneShotNoise('highpass', 3800, 0.6, 0.12, 0.001, 0.035, -0.2, 0.15);
    this.tone(2100, 0.02, 'triangle', 0.02);
  }
  alarm(level) { if (level !== this.alarmOn) { this.alarmOn = level; this.alarmSince = this.ctx ? this.ctx.currentTime : 0; } }
  morse(text) { // schedule an ident
    if (!this.ready) return;
    const M = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.' };
    const c = this.ctx, u = 0.075; let t = c.currentTime + 0.05;
    const gn = this.bcn.gain;
    gn.cancelScheduledValues(c.currentTime); gn.setValueAtTime(0, c.currentTime);
    for (const ch of text) {
      const code = M[ch]; if (!code) { t += u * 4; continue; }
      for (const sym of code) { const d = sym === '.' ? u : u * 3; gn.setValueAtTime(0, t); gn.linearRampToValueAtTime(0.06, t + 0.004); gn.setValueAtTime(0.06, t + d); gn.linearRampToValueAtTime(0, t + d + 0.004); t += d + u; }
      t += u * 2;
    }
    this.beacon.busyUntil = t;
  }
  update(dt, s) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime, e = this.eng, T = 0.09;
    // engine
    const thr = s.thrust; // 0..1+ (boost)
    const lv = thr > 0.002 ? 0.3 + 0.7 * Math.min(thr, 1.5) : 0;
    e.rumble.gain.setTargetAtTime(0.75 * lv, t, T);
    e.lp1.frequency.setTargetAtTime(55 + 240 * Math.min(thr, 1.5), t, T);
    e.sub.gain.setTargetAtTime(0.35 * lv, t, T);
    e.subO.frequency.setTargetAtTime(30 + 10 * thr, t, 0.3);
    e.roar.gain.setTargetAtTime(0.16 * lv * lv, t, T);
    e.bp.frequency.setTargetAtTime(380 + 900 * Math.min(thr, 1.5), t, T);
    e.hiss.gain.setTargetAtTime(0.035 * lv * lv * (s.boost ? 2.2 : 1), t, T);
    e.whine.gain.setTargetAtTime(0.022 * lv, t, 0.3);
    e.w1.frequency.setTargetAtTime(170 + 260 * thr, t, 0.5); e.w2.frequency.setTargetAtTime(171.4 + 262 * thr, t, 0.5);
    e.lfoG.gain.setTargetAtTime(0.16 * lv, t, T);
    if (thr > 0.03 && this.thrLast <= 0.03 && t - (this.lastIgn || -9) > 2.5) { this.ignition(); this.lastIgn = t; }
    this.thrLast = thr;
    // tidal strain & gravity drone
    const tid = clamp(Math.log10(1 + s.tidal * 10) / 2.5, 0, 1.2);
    this.strain.out.gain.setTargetAtTime(0.45 * tid, t, 0.4);
    const gr = clamp(s.grav, 0, 1);
    this.grav.gain.setTargetAtTime(0.5 * gr * gr, t, 0.6);
    this.gravLp.frequency.setTargetAtTime(240 + 900 * gr, t, 0.6);
    this.gravOsc.forEach((o, i) => o.detune.setTargetAtTime(-1200 * clamp(s.dilate, 0, 1) * (i % 2 ? 1 : 0.98), t, 0.8));
    this.creakT -= dt;
    if (tid > 0.15 && this.creakT <= 0) { this.clank(); this.creakT = (2.5 + Math.random() * 4) / (0.3 + tid * 3); }
    // alarms
    if (this.alarmOn && t - (this.alarmSince || 0) < 14) {
      this.alarmPhase -= dt;
      if (this.alarmPhase <= 0) {
        if (this.alarmOn >= 2) { this.tone(880, 0.16, 'square', 0.035, this.sfx, 0); this.tone(660, 0.16, 'square', 0.035, this.sfx, 0.18); this.alarmPhase = 0.9; }
        else { this.tone(1250, 0.12, 'triangle', 0.03); this.alarmPhase = 2.4; }
      }
    }
    // radio range guidance (A ·− / N −·): equal → steady tone
    const b = this.beacon;
    if (b.on && !(b.busyUntil > t)) {
      const unit = 0.11; b.phase = (b.phase + dt / unit) % 8;
      const ph = b.phase, aOn = ph < 1 || (ph >= 2 && ph < 5), nOn = (ph >= 1 && ph < 2) || ph >= 5;
      const dev = clamp(b.dev, -1, 1), gA = 0.5 + 0.5 * dev, gN = 0.5 - 0.5 * dev;
      const lvl = 0.045 * ((aOn ? gA : 0) + (nOn ? gN : 0));
      this.bcn.gain.setTargetAtTime(lvl, t, 0.006);
      this.bcnOsc.frequency.setTargetAtTime(1020 * Math.pow(2, clamp(b.vdev, -1, 1) * 0.12), t, 0.05);
      b.next -= dt;
      if (b.next <= 0 && b.ident) { this.morse(b.ident); b.next = 9; }
    } else if (!b.on && !(b.busyUntil > t)) this.bcn.gain.setTargetAtTime(0, t, 0.02);
    // ticking clocks: ours (proper time) and Halcyon's time signal (as received)
    if (s.tickOn) {
      this.tickAcc += s.dtau; if (this.tickAcc >= 1) { this.tickAcc -= Math.floor(this.tickAcc); if (s.warp <= 2) this.tick(false); }
      if (s.mcRate > 0) { this.mcTickAcc += s.dtau * s.mcRate; if (this.mcTickAcc >= 1) { const n = Math.floor(this.mcTickAcc); this.mcTickAcc -= n; if (s.warp <= 2 && s.mcRate < 25) this.tick(true); } }
    }
    // music (ducked under dialogue)
    const talk = voiceBusy();
    this.musicBus.gain.setTargetAtTime(settings.music ? (talk ? 0.4 : 0.9) : 0, t, talk ? 0.35 : 1.5);
    if (settings.music && t > this.nextChord) { this.playChord(); this.nextChord = t + 9.5; }
    if (Math.random() < dt * 0.3 * s.radioActivity) this.crackle();
  }
}
const audio = new AudioEngine();

// ─────────────────────────────── ship state ───────────────────────────────
const ship = {
  S: new Float64Array(20), sheet: 1, tau: 0, universe: 0, alive: true,
  omega: [0, 0, 0], throttle: 0, boost: false, acc: [0, 0, 0], accMag: 0, strafe: [0, 0],
  sas: 'STAB', guide: false, hover: false, satur: false,
  head: { yaw: 0, pitch: 0 }, fov: 72, warp: 1, warpLimited: false, paused: false,
  stats: { maxG: 0, maxGamma: 1, minR: 1e9, startT: 0, tauStart: 0 },
  shake: 0,
};
const sim = { mode: 'title', scenario: 'mission', events: [], t0: performance.now(), wall: 0, prevSheet: 1, lastSafe: new Float64Array(20), endingShown: false };
const obs = { r: 26, th: 1.4, ph: 0, s: 26, region: 'EXTERIOR', ref: 'ZAMO', beta: 0, gamma: 1, E: 1, Lz: 0, dtaudt: 1, tidal: 0, omegaDrag: 0, gRx: 1, mcRate: 1, tRec: 0, gTx: 1, inErgo: false, dRing: 10, pro: [0, 0, 1], radIn: [0, 0, 1], spinUp: [0, 1, 0], ur: 0 };
const WARPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 60];

function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm3(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
// projects the coordinate spatial vector D onto the rest space of the timelike U and normalises it
function restDir(X, s, U, D, out) {
  const v = [0, D[0], D[1], D[2]];
  const du = gdot(X, s, v, U);
  for (let m = 0; m < 4; m++) out[m] = v[m] + du * U[m];
  const n = Math.sqrt(Math.max(gdot(X, s, out, out), 1e-30));
  for (let m = 0; m < 4; m++) out[m] /= n;
  return out;
}
// body-frame components (right, up, forward) of a 4-vector
function toBody(v, S, X, s) {
  const p = mparts(X[1], X[2], X[3], s);
  return [gdotP(p, v, 0, S, 12), gdotP(p, v, 0, S, 16), gdotP(p, v, 0, S, 8)];
}
function placeShip(o) {
  const S = ship.S, s = o.sheet || 1;
  const P = o.pos || ksPoint(o.r, o.th * DEG, o.ph * DEG);
  S.fill(0);
  S[0] = 0; S[1] = P[0]; S[2] = P[1]; S[3] = P[2];
  ship.sheet = s;
  const X = [0, P[0], P[1], P[2]];
  const U = new Float64Array(4);
  if (o.vel === 'circular') {
    const r = ksR(P[0], P[1], P[2], s), Om = 1 / (Math.pow(r, 1.5) + K.a);
    U.set([1, -P[1] * Om, P[0] * Om, 0]);
    const n = gdot(X, s, U, U); for (let m = 0; m < 4; m++) U[m] /= Math.sqrt(-n);
  } else if (o.vel === 'zamo') { if (!zamoInto(P[0], P[1], P[2], s, U)) eulerianInto(P[0], P[1], P[2], s, U); }
  else if (o.vel === 'static') staticInto(P[0], P[1], P[2], s, U);
  else eulerianInto(P[0], P[1], P[2], s, U);
  if (o.boost) {
    const d = restDir(X, s, U, o.boost[0], new Float64Array(4)), b = o.boost[1], g = 1 / Math.sqrt(1 - b * b);
    for (let m = 0; m < 4; m++) U[m] = g * (U[m] + b * d[m]);
  }
  S.set(U, 4);
  let F = norm3(o.face || [-P[0], -P[1], -P[2]]);
  let up = o.up || [0, 0, 1];
  if (Math.abs(F[0] * up[0] + F[1] * up[1] + F[2] * up[2]) > 0.95) up = [1, 0, 0];
  const R = norm3(cross3(F, up)); up = cross3(R, F);
  S.set([0, ...F], 8); S.set([0, ...R], 12); S.set([0, ...up], 16);
  orthonormalize(S, s);
  ship.tau = 0; ship.omega = [0, 0, 0]; ship.throttle = 0; ship.acc = [0, 0, 0];
  sim.lastSafe.set(S); sim.prevSheet = s;
}

// ─────────────────────────────── waypoints ───────────────────────────────
let WPS = [];
let tgtIdx = 0;
function buildWaypoints(phi0) {
  const P = (r, th, ph) => ksPoint(r, th * DEG, (phi0 + ph) * DEG);
  const outer = [
    { name: 'DISK RIM', id: 'DSK', r: 15, pos: P(15, 80, 40), cap: 2.6, beta: 0.55 },
    { name: 'PHOTON SHELL', id: 'PHS', r: 3.0, pos: P(3.0, 60, 120), cap: 0.6, beta: 0.45 },
    { name: 'ISCO GATE', id: 'ISC', r: K.isco + 0.35, pos: P(K.isco + 0.35, 78, 200), cap: 0.5, beta: 0.4 },
  ].sort((a, b) => b.r - a.r);
  // arrival lines are voiced as 'mission.wp.<id>' (src/voice/lines.js)
  WPS = [...outer, { name: 'POLAR GATE', id: 'POL', pos: P(4.0, 12, 300), cap: 0.7, beta: 0.5 }];
  if (K.a > 0.12) WPS.push({ name: 'ERGOSPHERE', id: 'ERG', kind: 'ergo', pos: P(K.rp + 0.02, 8, 330), fall: true, beta: 0.5, bmin: 0.3 });
  WPS.push(
    { name: 'EVENT HORIZON', id: 'EHZ', kind: 'horizon', pos: P(K.rp - 0.15, 5, 330), fall: true, beta: 0.5, bmin: 0.35 },
    { name: 'INNER HORIZON', id: 'IHZ', kind: 'inner', pos: P(Math.max(K.rm - 0.12, 0.05), 3, 330), fall: true, beta: 0.6, bmin: 0.4 },
    { name: 'RING THROAT', id: 'RNG', kind: 'ring', pos: [0, 0, -0.3], fall: true, beta: 0.9, bmin: 0.8, amax: 8 },
    { name: 'ANTIVERSE', id: 'ANV', kind: 'anti', pos: [0, 0, -15], sheet: -1, fall: true, beta: 0.9, bmin: 0.8, amax: 8 },
  );
  WPS.forEach((w) => { w.done = false; w.skipped = false; w.tau = null; });
  tgtIdx = 0;
}
function wpReached(w) {
  const r = obs.r;
  switch (w.kind) {
    case 'ergo': return ship.sheet > 0 && r < rErgo(obs.th);
    case 'horizon': return ship.sheet > 0 && r < K.rp;
    case 'inner': return ship.sheet > 0 && r < K.rm;
    case 'ring': return ship.sheet < 0;
    case 'anti': return ship.sheet < 0 && r < -12;
    default: {
      if ((w.sheet || 1) !== ship.sheet || ship.universe > 0) return false;
      const S = ship.S;
      return Math.hypot(S[1] - w.pos[0], S[2] - w.pos[1], S[3] - w.pos[2]) < w.cap;
    }
  }
}
function curWp() {
  if (nav.target) return nav.target.done ? null : nav.target;
  if (sim.scenario === 'free') return null; // free flight: the descent waypoints are nav destinations, never auto-targeted
  return WPS[tgtIdx] && !WPS[tgtIdx].done ? WPS[tgtIdx] : WPS.find((w) => !w.done) || null;
}

// ─────────────────────────────── guidance / autopilot ───────────────────────────────
const AP = { ref: new Float64Array(4), D: new Float64Array(4), Ud: new Float64Array(4), A: new Float64Array(4), dir: new Float64Array(4), gu: new Float64Array(4), dist: 0, sat: false, dock: false,
  udPrev: new Float64Array(4), ffT: NaN, ffKey: null, ff: new Float64Array(4) };
function guidanceAcc(target, mode, amax, out) {
  // mode: 'goto' (fly to target.pos at β ≤ target.beta) or 'hold' (match local reference observer)
  // targets with refU (worlds, stations) supply their own rest frame; targets with standoff are approached to that range
  const S = ship.S, s = ship.sheet, X = [S[0], S[1], S[2], S[3]], U = S.subarray(4, 8);
  if (target && target.refU) target.refU(X, AP.ref);
  else guideRefInto(X, s, mode === 'goto' && target && target.fall, AP.ref);
  let beta = 0;
  if (mode === 'goto' && target) {
    const tp = target.pos;
    const D = [tp[0] - S[1], tp[1] - S[2], tp[2] - S[3]];
    AP.dist = Math.hypot(D[0], D[1], D[2]);
    restDir(X, s, AP.ref, D, AP.D);
    // last 30 km to a docking port (standoff 0): critically damped (ζ = 1, τ ≈ 0.8 s) so the ship settles inside the port's
    // velocity tolerance within seconds; everything else keeps the gentler, underdamped cruise law
    AP.dock = target.standoff === 0 && AP.dist < 1e-4;
    if (target.standoff !== undefined) {
      const de = AP.dist - target.standoff;
      beta = Math.sign(de) * Math.min(target.beta, Math.abs(de) * (AP.dock ? 0.625 : (target.approachK || 0.9)));
    } else beta = Math.min(target.beta, Math.max(target.bmin || 0, 0.08 + 0.15 * AP.dist));
  } else AP.dock = false;
  const g = 1 / Math.sqrt(1 - beta * beta);
  for (let m = 0; m < 4; m++) AP.Ud[m] = g * (AP.ref[m] + beta * (mode === 'goto' ? AP.D[m] : 0));
  christoffel(S[1], S[2], S[3], s);
  gamUV(S, 4, S, 4, AP.gu);
  const Tr = AP.dock ? 0.4 : 1.2; // velocity-loop time constant; with position gain K, ζ = 1 / (2·√(K·Tr))
  // feed-forward of the reference's own 4-acceleration (finite difference of Ud along our worldline). An orbiting body's frame
  // accelerates at ~M/r² (≈ 4.7e-4 c/s at Halcyon); a purely proportional loop lags that by Tr·a and parks the ship
  // Tr·a/K ≈ 190 km short of the port. Only world/station targets: mission waypoints and plain hover keep the tuned law.
  const ffKey = target && target.refU ? `${target.id}|${AP.dock}` : null; // a gain switch is a command step, not an acceleration
  const fdt = ship.tau - AP.ffT, useFF = ffKey !== null && ffKey === AP.ffKey && fdt > 1e-9 && fdt < 1;
  for (let m = 0; m < 4; m++) { AP.ff[m] = useFF ? (AP.Ud[m] - AP.udPrev[m]) / fdt : 0; AP.udPrev[m] = AP.Ud[m]; }
  AP.ffT = ship.tau; AP.ffKey = ffKey;
  for (let m = 0; m < 4; m++) AP.A[m] = (AP.Ud[m] - U[m]) / Tr + AP.gu[m] + AP.ff[m];
  const au = gdot(X, s, AP.A, U);
  for (let m = 0; m < 4; m++) AP.A[m] += au * U[m];
  let am = Math.sqrt(Math.max(0, gdot(X, s, AP.A, AP.A)));
  AP.sat = am > amax;
  if (am > amax) { for (let m = 0; m < 4; m++) AP.A[m] *= amax / am; am = amax; }
  const p = mparts(S[1], S[2], S[3], s);
  out[0] = gdotP(p, AP.A, 0, S, 8); out[1] = gdotP(p, AP.A, 0, S, 12); out[2] = gdotP(p, AP.A, 0, S, 16);
  // desired heading (ship rest frame) for the flight director
  if (mode === 'goto' && target) {
    const du = gdotP(p, AP.D, 0, U, 0);
    for (let m = 0; m < 4; m++) AP.dir[m] = AP.D[m] + du * U[m];
  }
  return am;
}

// ─────────────────────────────── physics advance ───────────────────────────────
const MAN_ACC = 0.35, BOOST = 4;
const ACC = [0, 0, 0];
function controlAcc(out) {
  const wp = curWp();
  out[0] = out[1] = out[2] = 0;
  if (ship.guide && wp) return guidanceAcc(wp, 'goto', wp.amax || 2.0, out);
  if (ship.hover || input.brake) {
    if (ship.sheet > 0 && obs.r <= K.rp + 0.01) { ship.hover = false; flagOnce('hoverfail', () => lyra(null, 'mission.lyra.hoverfail')); return 0; }
    const hr = nav.holdRef;
    if (hr && hr.standoff !== undefined && (hr.sheet || 1) === ship.sheet) return guidanceAcc(hr, 'goto', 2.0 * (ship.boost ? 2 : 1), out);
    return guidanceAcc(null, 'hold', 2.0 * (ship.boost ? 2 : 1), out);
  }
  const amax = MAN_ACC * (ship.boost ? BOOST : 1);
  const thr = ship.throttle;
  out[0] = Math.pow(thr, 2.2) * amax;
  out[1] = ship.strafe[0] * amax * 0.4; out[2] = ship.strafe[1] * amax * 0.4;
  return Math.hypot(out[0], out[1], out[2]);
}
function substepSize(accMag) {
  const S = ship.S, r = ksR(S[1], S[2], S[3], ship.sheet), ar = Math.abs(r);
  const dRing = Math.hypot(Math.hypot(S[1], S[2]) - K.a, S[3]);
  const vs = Math.hypot(S[5], S[6], S[7]) + 1e-9;
  let dt = 0.02 * Math.pow(Math.max(ar, 0.05), 1.5);
  dt = Math.min(dt, (0.02 * Math.min(ar + 0.05, 2 * dRing + 0.002)) / vs, 0.04 / Math.max(accMag, 0.05));
  return clamp(dt, 2e-5, 0.5);
}
const BK = new Float64Array(20);
function stepShip(dt, acc) {
  const S = ship.S;
  BK.set(S);
  const sh0 = ship.sheet, z0 = S[3];
  rk4(S, ship.sheet, acc, dt);
  if (z0 * S[3] < 0) {
    const fr = z0 / (z0 - S[3]);
    const xc = BK[1] + fr * (S[1] - BK[1]), yc = BK[2] + fr * (S[2] - BK[2]);
    if (xc * xc + yc * yc < K.a * K.a) { ship.sheet = -ship.sheet; sim.events.push('sheet'); }
  }
  let ok = orthonormalize(S, ship.sheet);
  for (let i = 0; i < 20 && ok; i++) if (!Number.isFinite(S[i])) ok = false;
  if (!ok) { S.set(BK); ship.sheet = sh0; return false; }
  ship.tau += dt;
  return true;
}
function advancePhysics(dtReal) {
  if (ship.paused || !ship.alive) return 0;
  if (ship.lock) return advanceLocked(dtReal);
  const nearHole = (ship.sheet > 0 && obs.r < 5) || (ship.sheet < 0 && Math.abs(obs.r) < 8);
  const want = dtReal * (nearHole ? Math.min(ship.warp, 2) : ship.warp) * slowFactor();
  let done = 0, n = 0, accMag = 0;
  const per = ship.guide || ship.hover || input.brake;
  if (!per) accMag = controlAcc(ACC);
  while (done < want - 1e-12 && n < 700) {
    if (per) accMag = controlAcc(ACC);
    let h = Math.min(substepSize(accMag), want - done);
    if (!stepShip(h, ACC)) {
      h *= 0.1;
      if (!stepShip(h, ACC)) { recoverState(); break; }
    }
    done += h; n++;
    if (checkTransitions()) break;
  }
  ship.warpLimited = n >= 700;
  ship.acc = ACC.slice(); ship.accMag = Math.hypot(ACC[0], ACC[1], ACC[2]);
  ship.satur = AP.sat && (ship.guide || ship.hover || input.brake);
  return done;
}
// landed / docked / scripted descent: the worlds module dictates the worldline; proper time still flows
function advanceLocked(dtReal) {
  const S = ship.S, dtau = dtReal * ship.warp;
  let ok = false;
  try { ok = !!(ctx.worlds && ctx.worlds.lockState(ship.lock, S[0] + dtau * Math.max(S[4], 1), S)); } catch (e) { reportModuleError('worlds.lockState', e); }
  if (!ok) { ship.lock = null; return 0; }
  ship.tau += dtau;
  ship.acc = [0, 0, 0]; ship.accMag = 0; ship.satur = false; ship.warpLimited = false;
  return dtau;
}
function recoverState() {
  const S = ship.S, U = new Float64Array(4);
  refObserverInto(S[1], S[2], S[3], ship.sheet, U);
  S.set(U, 4); orthonormalize(S, ship.sheet);
  sim.events.push('recover');
}
// singular surfaces the ingoing Kerr–Schild chart cannot follow → narrative transits
function checkTransitions() {
  const S = ship.S, s = ship.sheet;
  const r = ksR(S[1], S[2], S[3], s);
  const sc = Math.hypot(S[1], S[2]), dRing = Math.hypot(sc - K.a, S[3]);
  if (dRing < 0.012) { // touched the ring singularity: the indestructible hull bounces
    const nx = (sc - K.a) / dRing, nz = S[3] / dRing, ex = sc > 1e-9 ? S[1] / sc : 1, ey = sc > 1e-9 ? S[2] / sc : 0;
    S[1] += ex * nx * 0.03; S[2] += ey * nx * 0.03; S[3] += nz * 0.03;
    const U = new Float64Array(4); refObserverInto(S[1], S[2], S[3], s, U); S.set(U, 4); orthonormalize(S, s);
    sim.events.push('ringhit');
    return true;
  }
  if (s > 0 && r > 0 && r < K.rm) {
    const p = mparts(S[1], S[2], S[3], s);
    const ur = (r * S[1] * S[5] + r * S[2] * S[6]) / p.D + (S[3] * (r * r + K.a * K.a) * S[7]) / (r * p.D);
    if (ur > 0 && (S[4] > 40 || K.rm - r < 0.004)) { whiteHoleTransit(); return true; }
  }
  if (s > 0 && r > K.rm && r < K.rp && S[4] > 60) { cauchyTransit(); return true; }
  return false;
}
function cauchyTransit() {
  const S = ship.S;
  const th = Math.acos(clamp(S[3] / ksR(S[1], S[2], S[3], 1), -1, 1)), ph = Math.atan2(S[2], S[1]) - Math.atan2(K.a, ksR(S[1], S[2], S[3], 1));
  const P = ksPoint(K.rm * 0.92, th, ph);
  S[1] = P[0]; S[2] = P[1]; S[3] = P[2];
  const U = new Float64Array(4); eulerianInto(P[0], P[1], P[2], 1, U); S.set(U, 4); orthonormalize(S, 1);
  sim.events.push('cauchy');
}
function whiteHoleTransit() {
  ship.universe++;
  const S = ship.S;
  const ph = Math.random() * Math.PI * 2, th = (40 + Math.random() * 30) * DEG;
  const P = ksPoint(3.6, th, ph);
  S[1] = P[0]; S[2] = P[1]; S[3] = P[2];
  const U = new Float64Array(4);
  if (!zamoInto(P[0], P[1], P[2], 1, U)) eulerianInto(P[0], P[1], P[2], 1, U);
  const X = [S[0], P[0], P[1], P[2]], d = restDir(X, 1, U, P, new Float64Array(4)), b = 0.66, g = 1 / Math.sqrt(1 - b * b);
  for (let m = 0; m < 4; m++) S[4 + m] = g * (U[m] + b * d[m]);
  orthonormalize(S, 1);
  ship.sheet = 1;
  sim.events.push('whitehole');
}

// ─────────────────────────────── observables ───────────────────────────────
const OB = { U: new Float64Array(4), ref: new Float64Array(4), tmp: new Float64Array(4), ul: new Float64Array(4) };
// automatic cinematic slow motion close to the hole (proper time otherwise passes in ~1 s per M)
function slowFactor() {
  if (!settings.slowmo) return 1;
  const r = obs.r;
  if (ship.sheet < 0) return Math.abs(r) < 3 ? 0.3 : Math.abs(r) < 8 ? 0.6 : 1;
  return r > 4 ? 1 : r > 2.2 ? 0.6 : r > 1.6 ? 0.35 : 0.13;
}
// apparent (aberrated) direction, in body components, of a point displaced by coordinate vector D:
// light from it travels straight in the local reference frame, then is aberrated into the ship frame
const APB = { d: new Float64Array(4), k: new Float64Array(4), ref: new Float64Array(4) };
function apparentBody(D) {
  const S = ship.S, s = ship.sheet, X = [S[0], S[1], S[2], S[3]], U = S.subarray(4, 8);
  refObserverInto(S[1], S[2], S[3], s, APB.ref);
  restDir(X, s, APB.ref, D, APB.d);
  for (let m = 0; m < 4; m++) APB.k[m] = APB.ref[m] - APB.d[m];
  const gku = gdot(X, s, APB.k, U);
  for (let m = 0; m < 4; m++) APB.k[m] = -(APB.k[m] + gku * U[m]);
  return norm3(toBody(APB.k, S, X, s));
}
function faceBody(b) {
  const S = ship.S;
  if (b[2] < 0) { for (let m = 0; m < 4; m++) { S[8 + m] = -S[8 + m]; S[12 + m] = -S[12 + m]; } b = [-b[0], b[1], -b[2]]; }
  const F = [0, 0, 0, 0];
  for (let m = 0; m < 4; m++) F[m] = b[0] * S[12 + m] + b[1] * S[16 + m] + b[2] * S[8 + m];
  for (let m = 0; m < 4; m++) S[8 + m] = F[m];
  orthonormalize(S, ship.sheet);
}
function observe() {
  const S = ship.S, s = ship.sheet, X = [S[0], S[1], S[2], S[3]], U = S.subarray(4, 8);
  const r = ksR(S[1], S[2], S[3], s), a = K.a;
  const sc = Math.hypot(S[1], S[2]);
  obs.r = r; obs.s = sc;
  obs.th = Math.acos(clamp(S[3] / r, -1, 1));
  obs.ph = Math.atan2(S[2], S[1]) - Math.atan2(a, r);
  obs.dRing = Math.hypot(sc - a, S[3]);
  const Sig = r * r + (a * a * S[3] * S[3]) / (r * r);
  const Dl = r * r - 2 * r + a * a;
  obs.Sigma = Sig; obs.Delta = Dl;
  obs.inErgo = s > 0 && r > K.rp && r < rErgo(obs.th);
  obs.region = ship.universe > 0 ? `UNIVERSE ${ship.universe + 1}` : s < 0 ? 'NEGATIVE UNIVERSE' : r < K.rm ? 'INNER REGION' : r < K.rp ? 'BLACK HOLE INTERIOR' : obs.inErgo ? 'ERGOREGION' : 'EXTERIOR';
  if (ship.universe > 0 && s > 0 && r < K.rp) obs.region = r < K.rm ? 'INNER REGION' : 'BLACK HOLE INTERIOR';
  obs.ref = refObserverInto(S[1], S[2], S[3], s, OB.ref);
  const p = mparts(S[1], S[2], S[3], s);
  const pc = { r: p.r, f: p.f, k1: p.k1, k2: p.k2, k3: p.k3, D: p.D };
  const gam = -gdotP(pc, OB.ref, 0, U, 0);
  obs.gamma = Math.max(1, gam); obs.beta = Math.sqrt(Math.max(0, 1 - 1 / (obs.gamma * obs.gamma)));
  // prograde: direction of motion relative to the reference observer, in body coordinates
  for (let m = 0; m < 4; m++) OB.tmp[m] = OB.ref[m] - gam * U[m];
  const bp = [gdotP(pc, OB.tmp, 0, S, 12), gdotP(pc, OB.tmp, 0, S, 16), gdotP(pc, OB.tmp, 0, S, 8)];
  obs.pro = norm3([-bp[0], -bp[1], -bp[2]]);
  // radial (toward the hole) and spin-axis directions in the body frame
  const rin = restDir(X, s, U, [-S[1], -S[2], -S[3]], OB.tmp);
  obs.radIn = toBody(rin, S, X, s);
  obs.bhApp = apparentBody([-S[1], -S[2], -S[3]]);
  const zu = restDir(X, s, U, [0, 0, 1], OB.tmp);
  obs.spinUp = toBody(zu, S, X, s);
  lowerInto(X, s, U, OB.ul);
  obs.E = -OB.ul[0]; obs.Lz = S[1] * OB.ul[2] - S[2] * OB.ul[1];
  obs.dtaudt = 1 / S[4];
  obs.tidal = 9.79 / Math.pow(Math.max(Sig, 1e-6), 1.5);
  obs.ur = (r * S[1] * S[5] + r * S[2] * S[6]) / pc.D + (S[3] * (r * r + a * a) * S[7]) / (r * pc.D);
  // frame dragging (ZAMO angular velocity), outside the horizon
  obs.omegaDrag = s > 0 && r > K.rp ? (pc.f * a) / (r * r + a * a) / (1 + (pc.f * a * a * sc * sc) / (r * r + a * a) ** 2) : 0;
  // Halcyon ⇄ ship along the radial principal null congruences: ingoing rays keep v = t + r, outgoing rays keep
  // u = t − r − 2L(r). Inside Halcyon's orbit the downlink falls in on ingoing rays and the uplink climbs out on outgoing
  // ones; beyond it (free flight) the roles swap. Both agree at r = rMC, so the clocks stay continuous. ×k: Halcyon's
  // clock is its own proper time.
  obs.mcOut = s > 0 && r > MC.rMC && ship.universe === 0;
  const kIn = S[4] + obs.ur; // dv/dτ
  obs.mcRate = MC.k * kIn;
  if (s > 0 && r > K.rp + 1e-6 && ship.universe === 0) {
    const ct = Math.cos(obs.th), st2 = 1 - ct * ct;
    const pr = (r * r + a * a * ct * ct - a * a * st2 + 2 * r) / Dl;
    const uph = (S[1] * S[6] - S[2] * S[5]) / Math.max(sc * sc, 1e-12) + (a * obs.ur) / (r * r + a * a);
    const kOut = S[4] - pr * obs.ur - a * st2 * uph; // outgoing-ray frequency factor
    if (obs.mcOut) obs.mcRate = MC.k * kOut;
    obs.gTx = 1 / (MC.k * (obs.mcOut ? kIn : kOut));
    obs.tRec = obs.mcOut ? S[0] + r - MC.rMC : S[0] - r - 2 * Lfun(r) + MC.rMC + 2 * Lfun(MC.rMC);
  } else { obs.gTx = 0; obs.tRec = Infinity; }
  obs.gRx = obs.mcRate;
  ship.stats.maxGamma = Math.max(ship.stats.maxGamma, obs.gamma);
  ship.stats.maxG = Math.max(ship.stats.maxG, ship.accMag * G_PER_ACC);
  ship.stats.minR = Math.min(ship.stats.minR, Math.abs(r));
}

// ─────────────────────────────── comms: Halcyon (light-travel-time exact) & LYRA ───────────────────────────────
// Every spoken line is a scripted id (src/voice/lines.js, ElevenLabs audio in voice/). Runtime numbers never get
// spoken: they ride along in the caption's meta row.
const MC = { rMC: 46, k: 1, connected: true, T: -1e9, idx: 0, tel: [], nextTel: 0, pending: [], uplinks: [], said: {}, last: null, lostSince: null, periodic: 0, periodicIdx: 0 };
// MC.T and every tRec are coordinate times at Halcyon; MC.k converts them to Halcyon's clock (proper time on its orbit)
const mcClock = (t) => fmtClock(MC.k * t);
function mcReset() {
  Object.assign(MC, { connected: true, T: -1e9, idx: 0, tel: [], nextTel: 0, pending: [], uplinks: [], said: {}, last: null, lostSince: null, periodic: 0, periodicIdx: 0 });
  const q = K.a / Math.pow(MC.rMC, 1.5); // prograde circular orbit: dτ/dt = √(1 − 3/r + 2a r^-3/2) / (1 + a r^-3/2)
  MC.k = Math.sqrt(1 - 3 / MC.rMC + 2 * q) / (1 + q);
}
// Halcyon coordinate time at which the signal reaching the ship right now was sent (same null families as observe())
function mcEmitT() {
  const r = obs.r, t = ship.S[0];
  return obs.mcOut ? t - r - 2 * Lfun(r) + MC.rMC + 2 * Lfun(MC.rMC) : t + r - MC.rMC;
}
const flags = {};
function flagOnce(k, fn) { if (!flags[k]) { flags[k] = 1; fn(); } }
const typewriter = [];
function addLog(cls, who, text, meta = '', opts = {}) {
  const log = $('log');
  const el = document.createElement('div');
  el.className = 'msg ' + cls;
  el.innerHTML = `<span class="who"></span><span class="tx"></span>${meta ? '<span class="meta"></span>' : ''}`;
  el.querySelector('.who').textContent = who;
  if (meta) el.querySelector('.meta').textContent = meta;
  log.appendChild(el);
  typewriter.push({ el: el.querySelector('.tx'), text, i: 0, cps: opts.cps || 52 });
  while (log.children.length > 7) log.removeChild(log.firstChild);
  [...log.children].forEach((c, i, arr) => c.classList.toggle('old', i < arr.length - 3));
}
function lyra(key, id, extraMeta) {
  if (key && flags['ly_' + key]) return;
  if (key) flags['ly_' + key] = 1;
  say(id, { meta: `τ ${fmtClock(ship.tau)}${extraMeta ? ' · ' + extraMeta : ''}` });
}
function mcDeliver(item) {
  const z = obs.gRx > 0 ? 1 / obs.gRx - 1 : 0;
  const meta = `sent ${mcClock(MC.T)} · rx τ ${fmtClock(ship.tau)} · Doppler ×${fmt(obs.gRx, 3)}${Math.abs(z) > 0.005 ? ` (z ${z > 0 ? '+' : ''}${fmt(z, 2)})` : ''}${item.meta ? ' · ' + item.meta : ''}`;
  say(item.id, { meta });
}
function mcSchedule(at, id, meta) { MC.pending.push({ at, id, meta }); MC.pending.sort((a, b) => a.at - b.at); }
// a Halcyon reaction to something happening at the ship right now: uplink light time + think time + downlink light time
function mcReact(id, think = 4, meta) {
  if (!MC.connected || ship.universe > 0 || !Number.isFinite(obs.tRec)) return false;
  mcSchedule(obs.tRec + think, id, meta);
  return true;
}
function mcTelemetry() {
  if (!MC.connected) return;
  if (ship.tau < MC.nextTel) return;
  MC.nextTel = ship.tau + 0.25;
  MC.tel.push({ tau: ship.tau, t: ship.S[0], r: obs.r, sheet: ship.sheet, tRec: obs.tRec, gtx: obs.gTx, burn: ship.accMag > 0.02 && !ship.lock, wps: WPS.filter((w) => w.done && !w.skipped).map((w) => w.id), ergo: obs.inErgo, omega: obs.omegaDrag });
}
function mcReceive(rec) {
  MC.last = rec;
  const once = (k, meta, d = 3.5) => { if (!MC.said[k]) { MC.said[k] = 1; mcSchedule(rec.tRec + d, 'mission.mc.' + k, meta); } };
  if (sim.scenario !== 'free') once('lock', `r ${rec.r.toFixed(1)} M · clocks agree to ${((1 - rec.gtx) * 100).toFixed(1)}%`, 4);
  if (rec.burn) once('burn');
  const has = (id) => rec.wps.includes(id);
  if (has('DSK')) once('dsk');
  if (rec.r < 6 && rec.sheet > 0) once('r6', `clock rate ×${rec.gtx.toFixed(2)} of Halcyon's`);
  if (has('PHS')) once('phs');
  if (has('ISC')) once('isc');
  if (has('POL')) once('pol');
  if (rec.ergo) once('erg', `frame dragging ${rec.omega.toFixed(3)} rad/s`);
  if (rec.r < K.rp + 0.6 && rec.gtx < 0.45) once('red1', `z = ${(1 / rec.gtx - 1).toFixed(1)}`);
  if (rec.gtx < 0.12 && rec.r < K.rp + 0.2) once('red2', null, 2);
  if (rec.gtx < 0.03 && rec.r < K.rp + 0.05) once('red3', null, 2);
}
const MC_LOST = ['mission.mc.lost.1', 'mission.mc.lost.2', 'mission.lost.mira', 'mission.mc.lost.3', 'mission.lost.fd', 'mission.mc.lost.4', 'mission.mc.lost.5'];
function mcReply(up) {
  const z = up.gtx > 0 ? 1 / up.gtx - 1 : Infinity;
  switch (up.kind) {
    case 1: return { id: 'mission.reply.status', meta: `at TX: r ${up.r.toFixed(2)} M · clock ×${up.gtx.toFixed(3)} · z ${z.toFixed(2)}` };
    case 2: return up.wp === 'EVENT HORIZON' || up.wp === 'ERGOSPHERE' ? { id: 'mission.reply.go.horizon' } : { id: 'mission.reply.go', meta: up.wp ? `go for ${up.wp.toLowerCase()}` : 'go for free flight' };
    case 3: return { id: 'mission.reply.personal', then: 'mission.reply.personal.mira' };
    default: return up.r > 8 ? { id: 'mission.reply.view.far' } : { id: 'mission.reply.view.near', meta: `your clock ×${up.gtx.toFixed(2)} of ours` };
  }
}
function mcUpdate() {
  if (!MC.connected) return;
  if (ship.universe > 0) { MC.connected = false; return; }
  const T = mcEmitT();
  if (T < MC.T) return;
  MC.T = T;
  while (MC.idx < MC.tel.length && MC.tel[MC.idx].tRec <= T) mcReceive(MC.tel[MC.idx++]);
  for (const up of MC.uplinks) if (!up.got && up.tRec <= T) {
    up.got = 1;
    const rep = mcReply(up), at = up.tRec + 4 + Math.random() * 2;
    mcSchedule(at, rep.id, rep.meta);
    if (rep.then) mcSchedule(at + 9, rep.then);
  }
  if (MC.last && MC.last.r < K.rp + 0.08 && T - MC.last.tRec > 18) {
    if (MC.lostSince === null) { MC.lostSince = T; MC.periodic = T + 2; }
    if (T >= MC.periodic && MC.periodicIdx < MC_LOST.length) { mcSchedule(T, MC_LOST[MC.periodicIdx++]); MC.periodic = T + 24; }
  }
  while (MC.pending.length && MC.pending[0].at <= T) mcDeliver(MC.pending.shift());
}
function transmit(kind) {
  const wp = curWp();
  const inside = !Number.isFinite(obs.tRec);
  const eta = inside ? '∞ — signal cannot escape' : `arrives Halcyon clock ${mcClock(obs.tRec)} (in ${fmt(MC.k * (obs.tRec - MC.T), 1)} s)`;
  const data = kind === 1 ? ` · r ${obs.r.toFixed(2)} M · β ${obs.beta.toFixed(3)}` : kind === 2 && wp ? ` · ${wp.name}` : '';
  say('cmdr.tx.' + ['', 'status', 'go', 'personal', 'view'][kind], { meta: `TX τ ${fmtClock(ship.tau)} · ${eta}${data}`, priority: 'high' });
  if (MC.connected) MC.uplinks.push({ kind, tRec: obs.tRec, r: obs.r, gtx: obs.gTx, wp: wp ? wp.name : '' });
  if (inside) flagOnce('txinside', () => setTimeout(() => lyra(null, 'mission.lyra.txinside'), 1800));
}

// ─────────────────────────────── input ───────────────────────────────
const input = { stick: [0, 0], brake: false, rmb: false, locked: false, lastMove: 0, commsOpen: false, gpPrev: [], gp: null };
const keys = new Set();
const SAS_MODES = ['OFF', 'STAB', 'PRO', 'RETRO', 'TGT', 'RAD-IN', 'RAD-OUT'];
function toast(text) { const h = $('hint'); h.innerHTML = text; h.style.opacity = 1; hints.until = performance.now() + 2600; }
function guideOff(why) { if (ship.guide) { ship.guide = false; toast(`GUIDANCE OFF · ${why}`); audio.ui('deny'); } }
function toggleGuide() {
  if (!curWp()) { toast(sim.scenario === 'free' ? 'NO TARGET · <kbd>T</kbd> PICK ONE · <kbd>J</kbd> NAV COMPUTER' : 'NO ACTIVE WAYPOINT'); return; }
  ship.guide = !ship.guide; ship.hover = false;
  if (ship.guide) { ship.sas = 'TGT'; audio.ui('confirm'); flagOnce('guide1', () => lyra(null, 'mission.lyra.guide')); toast('GUIDANCE ENGAGED → ' + curWp().name); }
  else toast('GUIDANCE DISENGAGED');
}
function toggleHover() {
  ship.hover = !ship.hover; ship.guide = false;
  toast(ship.hover ? 'STATION-KEEPING: MATCH LOCAL FRAME' : 'STATION-KEEPING OFF'); audio.ui(ship.hover ? 'confirm' : 'select');
}
function cycleTarget(d) {
  if (sim.scenario === 'free') { // every reachable destination: worlds, stations, then Erebus features
    const ids = [];
    if (ctx.worlds) { try { for (const x of ctx.worlds.destinations()) if (x.reachable && x.discovered && !(ship.lock && ship.lock.body === x.id)) ids.push(x.id); } catch (e) { reportModuleError('worlds.destinations', e); } }
    for (const f of navFeatures()) if (f.reachable && !f.done) ids.push(f.id);
    if (!ids.length) return;
    const cur = nav.target ? ids.indexOf(nav.target.id) : -1;
    setTarget(ids[cur < 0 ? (d > 0 ? 0 : ids.length - 1) : (cur + d + ids.length) % ids.length]);
    audio.beacon.next = 0;
    return;
  }
  const n = WPS.length; if (!n) return;
  let i = tgtIdx;
  for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (!WPS[i].done) break; }
  tgtIdx = i; audio.ui('select'); toast('TARGET → ' + WPS[i].name);
  audio.beacon.next = 0;
}
function setSAS(m) { ship.sas = m; audio.ui('select'); toast('SAS · ' + m); }
function warpStep(d) {
  let i = WARPS.indexOf(ship.warp); if (i < 0) i = 3;
  i = clamp(i + d, 0, WARPS.length - 1);
  if (d > 0 && ship.sheet > 0 && obs.r < 4 && WARPS[i] > 5) { toast('WARP LIMITED NEAR THE HOLE'); return; }
  ship.warp = WARPS[i]; toast(`TIME WARP ×${ship.warp}`); audio.ui('click');
}
function openComms() { input.commsOpen = true; $('commsMenu').classList.remove('hidden'); audio.squelch(); }
function closeComms() { input.commsOpen = false; $('commsMenu').classList.add('hidden'); }
function toggleHelp() { $('help').classList.toggle('hidden'); }
function togglePause(force) {
  ship.paused = force !== undefined ? force : !ship.paused;
  $('pause').classList.toggle('hidden', !ship.paused);
  if (ship.paused && document.pointerLockElement) document.exitPointerLock();
  if (audio.ctx) ship.paused ? audio.ctx.suspend() : audio.ctx.resume();
}
// overlays (nav computer, codex, dialogue) own the keyboard while open
function overlayOpen() {
  return !!((ctx.navComputer && ctx.navComputer.isOpen()) || (ctx.codexUI && ctx.codexUI.isOpen()) || (ctx.dialogue && ctx.dialogue.isOpen()));
}
addEventListener('keydown', (e) => {
  if (sim.mode === 'title') { if (e.code === 'Enter' && !$('go').disabled) startMission('mission'); else if (e.code === 'KeyH') toggleHelp(); return; }
  if (overlayOpen()) return;
  if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'Enter'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (input.commsOpen) {
    const m = /^Digit([1-4])$/.exec(e.code);
    if (m) { transmit(+m[1]); closeComms(); } else if (e.code === 'KeyC' || e.code === 'Escape') closeComms();
    return;
  }
  switch (e.code) { // global (every mode)
    case 'KeyC': openComms(); return;
    case 'KeyJ': if (ctx.navComputer) { if (document.pointerLockElement) document.exitPointerLock(); ctx.navComputer.toggle(); } else toast('NAV COMPUTER OFFLINE'); return;
    case 'Backquote': if (ctx.codexUI) { if (document.pointerLockElement) document.exitPointerLock(); ctx.codexUI.toggle(); } return;
    case 'KeyH': case 'F1': toggleHelp(); return;
    case 'KeyP': togglePause(); return;
    case 'Escape': if (!input.locked) { if (!$('help').classList.contains('hidden')) toggleHelp(); else togglePause(); } return;
    case 'Tab': settings.hud = !settings.hud; $('hud').classList.toggle('dim', !settings.hud); return;
    case 'KeyM': settings.mute = !settings.mute; audio.setMute(settings.mute); if (settings.mute) voiceStop(); toast(settings.mute ? 'MUTED' : 'SOUND ON'); return;
    case 'KeyL': lyraStatus(); return;
    case 'KeyI': settings.ticks = !settings.ticks; toast(settings.ticks ? 'CLOCK TICKS ON (ship · Halcyon)' : 'CLOCK TICKS OFF'); return;
    case 'BracketLeft': case 'Comma': warpStep(-1); return;
    case 'BracketRight': case 'Period': warpStep(1); return;
  }
  const m = modeObj();
  if (m && m.onKeyDown) try { m.onKeyDown(e); } catch (err) { reportModuleError('mode.onKeyDown', err); }
});
addEventListener('keyup', (e) => { keys.delete(e.code); const m = modeObj(); if (m && m.onKeyUp) try { m.onKeyUp(e); } catch (err) { reportModuleError('mode.onKeyUp', err); } });
addEventListener('blur', () => keys.clear());
canvas.addEventListener('mousedown', (e) => {
  if (sim.mode === 'title' || ship.paused || overlayOpen()) return;
  if (e.button === 2) input.rmb = true;
  else if (!input.locked) { canvas.requestPointerLock?.(); return; }
  const m = modeObj();
  if (m && m.onMouseDown) m.onMouseDown(e);
});
addEventListener('mouseup', (e) => { if (e.button === 2) input.rmb = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === canvas; if (!input.locked) input.stick = [0, 0]; });
addEventListener('mousemove', (e) => {
  if (sim.mode === 'title' || overlayOpen()) return;
  const m = modeObj();
  if (!m || !m.onMouseMove || (sim.mode !== 'flight' && !input.locked)) return;
  try { m.onMouseMove(e); } catch (err) { reportModuleError('mode.onMouseMove', err); }
});
addEventListener('wheel', (e) => { if (sim.mode !== 'title' && !overlayOpen()) { const m = modeObj(); if (m && m.onWheel) m.onWheel(e); } }, { passive: true });
function pollGamepad(dt) {
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = [...gps].find((g) => g && g.connected);
  input.gp = null;
  if (!gp || sim.mode !== 'flight' || overlayOpen()) return;
  const dz = (v) => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88);
  const b = (i) => gp.buttons[i] && gp.buttons[i].pressed, bv = (i) => (gp.buttons[i] ? gp.buttons[i].value : 0);
  input.gp = { yaw: dz(gp.axes[0] || 0), pitch: -dz(gp.axes[1] || 0) * (settings.invertY ? -1 : 1), roll: dz(gp.axes[2] || 0), lift: -dz(gp.axes[3] || 0) };
  const thr = bv(7) - bv(6);
  if (Math.abs(thr) > 0.05) { ship.throttle = clamp(ship.throttle + thr * dt * 0.7, 0, 1); guideOff('MANUAL THROTTLE'); }
  const edge = (i) => b(i) && !input.gpPrev[i];
  if (edge(0)) toggleGuide(); if (edge(1)) (input.commsOpen ? closeComms() : openComms()); if (edge(2)) setSAS('STAB'); if (edge(3)) cycleTarget(1);
  if (edge(12)) warpStep(1); if (edge(13)) warpStep(-1); if (edge(9)) togglePause(); if (edge(8)) toggleHelp();
  input.gpBoost = b(10); input.gpStrafe = (b(5) ? 1 : 0) - (b(4) ? 1 : 0);
  input.gpPrev = gp.buttons.map((x) => x.pressed);
}

// ─────────────────────────────── attitude control ───────────────────────────────
const TB = new Float64Array(4);
function targetBody() {
  const wp = curWp(); if (!wp) return null;
  const S = ship.S;
  return apparentBody([wp.pos[0] - S[1], wp.pos[1] - S[2], wp.pos[2] - S[3]]);
}
function cueBody() { const S = ship.S; return ship.guide ? norm3(toBody(AP.dir, S, [S[0], S[1], S[2], S[3]], ship.sheet)) : hud.tgt; }
function sasDir() {
  switch (ship.sas) {
    case 'PRO': return obs.beta > 1e-4 ? obs.pro : null;
    case 'RETRO': return obs.beta > 1e-4 ? obs.pro.map((v) => -v) : null;
    case 'RAD-IN': return obs.bhApp;
    case 'RAD-OUT': return obs.bhApp.map((v) => -v);
    case 'TGT': return cueBody();
    case 'ORBIT': return obs.beta > 1e-4 ? norm3(obs.pro.map((v, i) => v + (ship.sasAim || 0.5) * obs.bhApp[i])) : obs.bhApp;
    default: return null;
  }
}
// pilot = manual stick/throttle input allowed (seated in flight mode); otherwise SAS/autopilot fly alone
function updateAttitude(dt, pilot = true) {
  const S = ship.S;
  if (ship.lock) { ship.omega = [0, 0, 0]; ship.boost = false; input.brake = false; ship.strafe[0] = ship.strafe[1] = 0; return; }
  let sp = 0, sy = 0, sr = 0;
  if (pilot) {
    sp = input.stick[1]; sy = input.stick[0];
    if (keys.has('ArrowUp')) sp += 1; if (keys.has('ArrowDown')) sp -= 1;
    if (keys.has('ArrowLeft')) sy -= 1; if (keys.has('ArrowRight')) sy += 1;
    if (keys.has('KeyQ')) sr -= 1; if (keys.has('KeyE')) sr += 1;
    if (input.gp) { sp += input.gp.pitch; sy += input.gp.yaw; sr += input.gp.roll; }
  }
  const manual = Math.abs(sp) + Math.abs(sy) + Math.abs(sr) > 0.04;
  const cmd = [clamp(sp, -1, 1) * 1.15, clamp(sy, -1, 1) * 1.15, clamp(sr, -1, 1) * 1.7];
  if (!manual && ship.sas !== 'OFF') {
    const d = sasDir();
    if (d) {
      const ey = Math.atan2(d[0], d[2]), ep = Math.atan2(d[1], Math.hypot(d[0], d[2]));
      cmd[0] = clamp(ep * 2.4, -1.1, 1.1); cmd[1] = clamp(ey * 2.4, -1.1, 1.1);
    }
  }
  if (!manual && ship.sas === 'OFF') { cmd[0] = ship.omega[0]; cmd[1] = ship.omega[1]; cmd[2] = ship.omega[2]; }
  for (let i = 0; i < 3; i++) {
    const d = cmd[i] - ship.omega[i], mx = 2.8 * dt;
    ship.omega[i] += clamp(d, -mx, mx);
    if (Math.abs(d) > 0.06) audio.rcs(i, Math.min(1, Math.abs(d)));
  }
  const tp = ship.omega[0] * dt, ty = ship.omega[1] * dt, tr = ship.omega[2] * dt;
  for (let m = 0; m < 4; m++) {
    const F = S[8 + m], R = S[12 + m], U = S[16 + m];
    S[8 + m] = F + tp * U + ty * R; S[12 + m] = R - ty * F - tr * U; S[16 + m] = U - tp * F + tr * R;
  }
  orthonormalize(S, ship.sheet);
  // mouse virtual stick auto-centres gently
  if (performance.now() - input.lastMove > 120) { const k = Math.exp(-dt * 2.2); input.stick[0] *= k; input.stick[1] *= k; }
  if (!input.rmb) { const k = Math.exp(-dt * 3); ship.head.yaw *= k; ship.head.pitch *= k; }
  // throttle & translation
  if (!pilot) { ship.boost = false; input.brake = false; ship.strafe[0] = ship.strafe[1] = 0; return; }
  const dthr = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  if (dthr) { ship.throttle = clamp(ship.throttle + dthr * dt * 0.55, 0, 1); guideOff('MANUAL THROTTLE'); }
  ship.boost = keys.has('ShiftLeft') || keys.has('ShiftRight') || !!input.gpBoost;
  input.brake = keys.has('Space');
  ship.strafe[0] = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + (input.gpStrafe || 0);
  ship.strafe[1] = (keys.has('KeyR') ? 1 : 0) - (keys.has('KeyF') ? 1 : 0) + (input.gp ? input.gp.lift : 0);
  if ((ship.strafe[0] || ship.strafe[1]) && ship.guide) guideOff('MANUAL TRANSLATION');
}

// ─────────────────────────────── trajectory prediction ───────────────────────────────
const PY = new Float64Array(8), PK1 = new Float64Array(8), PK2 = new Float64Array(8), PK3 = new Float64Array(8), PK4 = new Float64Array(8), PTm = new Float64Array(8);
function rhs8(Y, s, d) { christoffel(Y[1], Y[2], Y[3], s); gamUV(Y, 4, Y, 4, T4); for (let m = 0; m < 4; m++) { d[m] = Y[4 + m]; d[4 + m] = -T4[m]; } }
function predict() {
  PY.set(ship.S.subarray(0, 8));
  let s = ship.sheet;
  const pts = [];
  let fate = 'BOUND ORBIT', crossed = false;
  for (let i = 0; i < 320; i++) {
    const r = ksR(PY[1], PY[2], PY[3], s);
    const dRing = Math.hypot(Math.hypot(PY[1], PY[2]) - K.a, PY[3]);
    const vs = Math.hypot(PY[5], PY[6], PY[7]) + 1e-9;
    const dt = clamp(Math.min(0.06 * Math.pow(Math.max(Math.abs(r), 0.3), 1.5), (0.08 * Math.min(Math.abs(r) + 0.1, 2 * dRing + 0.01)) / vs), 0.004, 4);
    const z0 = PY[3];
    rhs8(PY, s, PK1); for (let j = 0; j < 8; j++) PTm[j] = PY[j] + 0.5 * dt * PK1[j];
    rhs8(PTm, s, PK2); for (let j = 0; j < 8; j++) PTm[j] = PY[j] + 0.5 * dt * PK2[j];
    rhs8(PTm, s, PK3); for (let j = 0; j < 8; j++) PTm[j] = PY[j] + dt * PK3[j];
    rhs8(PTm, s, PK4); for (let j = 0; j < 8; j++) PY[j] += (dt / 6) * (PK1[j] + 2 * PK2[j] + 2 * PK3[j] + PK4[j]);
    if (z0 * PY[3] < 0 && PY[1] * PY[1] + PY[2] * PY[2] < K.a * K.a) s = -s;
    if (!Number.isFinite(PY[1])) break;
    const rn = ksR(PY[1], PY[2], PY[3], s);
    pts.push([PY[1], PY[2], PY[3], s]);
    if (s > 0 && rn < K.rp && !crossed) { crossed = true; fate = 'PLUNGE · HORIZON'; }
    if (s > 0 && rn < K.rm * 0.6) break;
    if (Math.abs(rn) > 220) { fate = s < 0 ? 'ESCAPE · r → −∞' : 'ESCAPE'; break; }
    if (PY[4] > 200) break;
  }
  if (ship.sheet > 0 && obs.r < K.rp) fate = obs.r > K.rm ? 'INWARD · r₋ INEVITABLE' : fate;
  hud.pred = pts; hud.fate = fate;
}

// ─────────────────────────────── mission director ───────────────────────────────
const hints = { until: 0, seq: [], idx: 0, next: 0 };
function showCine(a, b, red = false, dur = 4200) {
  const c = $('cine'); $('cineA').textContent = a; $('cineB').textContent = b;
  c.classList.toggle('red', red); c.classList.add('show');
  clearTimeout(showCine.t); showCine.t = setTimeout(() => c.classList.remove('show'), dur);
}
const fx = { flash: 0, flashCol: [1, 1, 1], glitch: 0, shake: 0, shakeY: 0, shakeP: 0 };
function onWaypoint(w) {
  audio.ui('wp');
  if (w.id) lyra(null, 'mission.wp.' + w.id);
  if (w.kind === 'anti') setTimeout(() => showEnding('anti'), 6500);
  else if (!['horizon', 'inner', 'ring', 'ergo'].includes(w.kind)) showCine(w.name, 'WAYPOINT REACHED', false, 3000);
}
function onRegion(now, prev) {
  if (!prev || sim.mode === 'title') return;
  if (now === 'ERGOREGION') { showCine('ERGOSPHERE', 'SPACETIME IS ROTATING FASTER THAN LIGHT', false); audio.whoosh(2.2); audio.bwaam(); }
  if (now === 'BLACK HOLE INTERIOR' && prev !== 'INNER REGION') {
    showCine('EVENT HORIZON', 'NO SIGNAL CAN EVER LEAVE', true, 5200); audio.boom(1.3); audio.bwaam(); fx.flash = 0.55; fx.flashCol = [1, 0.25, 0.1]; fx.glitch = 1.2; fx.shake = 1;
    $('hLink').textContent = 'UPLINK ∞';
    sim.crossMC = MC.T; sim.crossTau = ship.tau;
    const tmx = tauMaxToInner(Math.min(obs.r, K.rp - 1e-4));
    setTimeout(() => lyra('tmax', 'mission.lyra.tmax', `τ_max to r₋ ${tmx.toFixed(2)} s`), 3500);
  }
  if (now === 'INNER REGION') { showCine('INNER HORIZON', 'THE LIMIT OF PREDICTABILITY', false, 4600); audio.boom(1); fx.flash = 0.6; fx.flashCol = [0.5, 0.85, 1]; fx.glitch = 0.8; }
  if (now === 'NEGATIVE UNIVERSE') { showCine('r < 0', 'THROUGH THE RING SINGULARITY', false, 5500); audio.boom(1.6); audio.whoosh(1.2); fx.flash = 0.9; fx.flashCol = [1, 0.85, 1]; fx.glitch = 1.6; fx.shake = 1.5; }
  if (prev === 'NEGATIVE UNIVERSE' && now === 'INNER REGION') { showCine('r > 0', 'REPELLED BACK THROUGH THE RING', false); lyra('bounce', 'mission.lyra.bounce'); }
}
function onEvent(ev) {
  if (ev === 'whitehole') {
    showCine('WHITE HOLE', `EMERGING INTO UNIVERSE ${ship.universe + 1}`, false, 6500);
    fx.flash = 1; fx.flashCol = [1, 1, 1]; fx.glitch = 2; audio.boom(2); audio.bwaam();
    MC.connected = false;
    regenerateSky(ship.universe);
    bhUniforms.uDisk.value = 0;
    WPS = [{ name: 'CLEAR THE WHITE HOLE', id: 'ESC', pos: ksPoint(30, obs.th, obs.ph), cap: 4, beta: 0.6, done: false }];
    tgtIdx = 0; ship.guide = false;
    setTimeout(() => lyra(null, 'mission.lyra.whitehole'), 2500);
  } else if (ev === 'cauchy') {
    showCine('CAUCHY HORIZON', 'THE ENTIRE FUTURE OF THE OUTSIDE UNIVERSE, IN AN INSTANT', false, 6000);
    fx.flash = 1; fx.flashCol = [0.85, 0.92, 1]; fx.glitch = 2; audio.boom(2);
    lyra('cauchy', 'mission.lyra.cauchy');
  } else if (ev === 'sheet') { audio.whoosh(0.8); fx.shake = Math.max(fx.shake, 0.8); }
  else if (ev === 'ringhit') { fx.flash = 0.8; fx.flashCol = [1, 0.8, 1]; fx.glitch = 1.5; fx.shake = 2; audio.boom(1.2); lyra('ringhit', 'mission.lyra.ringhit'); }
  else if (ev === 'recover') lyra(null, 'mission.lyra.recover');
}
// LYRA status report: the voiced line fits the situation; the numbers go in the caption meta
function lyraStatus() {
  const wp = curWp();
  const lk = ship.lock && ship.lock.kind;
  const id = lk === 'landed' ? 'status.landed' : lk === 'docked' ? 'status.docked'
    : ship.universe > 0 && ship.sheet > 0 && obs.r > K.rp ? 'status.newverse'
      : ship.sheet < 0 ? 'status.negative'
        : obs.r < K.rm ? 'status.inner' : obs.r < K.rp ? 'status.interior' : obs.inErgo ? 'status.ergo'
          : ship.hover ? 'status.hold' : obs.beta > 0.3 && ship.accMag > 0.01 ? 'status.cruise' : 'status.exterior';
  const ref = obs.ref === 'ZAMO' ? 'ZAMO' : obs.ref === 'KS' ? 'infall frame' : 'static frame';
  const meta = `r ${fmt(obs.r, 3)} M · β ${fmt(obs.beta, 3)} (${ref}) · dτ/dt ${fmt(obs.dtaudt, 3)}${obs.tidal > 0.05 ? ` · tide ${fmt(obs.tidal, 1)} g` : ''}${wp ? ` · next: ${wp.name}` : ''}`;
  lyra(null, id, meta);
}
function missionUpdate(dt) {
  for (let i = 0; i < WPS.length; i++) {
    const w = WPS[i];
    if (!w.done && wpReached(w)) {
      w.done = true; w.tau = ship.tau;
      for (let j = 0; j < i; j++) if (!WPS[j].done) { WPS[j].done = true; WPS[j].skipped = true; }
      onWaypoint(w);
      if (w.id === 'ESC') setTimeout(() => showEnding('newverse'), 5000);
    }
  }
  if (WPS[tgtIdx] && WPS[tgtIdx].done) { const n = WPS.findIndex((w) => !w.done); tgtIdx = n < 0 ? WPS.length - 1 : n; audio.beacon.next = 0; }
  if (obs.region !== sim.lastRegion) { onRegion(obs.region, sim.lastRegion); sim.lastRegion = obs.region; }
  while (sim.events.length) onEvent(sim.events.shift());
  if (ship.sheet > 0 && obs.r < K.rp && obs.r > K.rm) flagOnce('tide', () => setTimeout(() => lyra(null, 'mission.lyra.tide', `tidal stretch ${obs.tidal.toFixed(1)} g`), 16000));
  if (obs.E < 0) flagOnce('penrose', () => lyra(null, 'mission.lyra.penrose', `E∞ ${fmt(obs.E, 3)}`));
  if (ship.hover && ship.satur && obs.r < K.rp + 0.5) flagOnce('hoverlim', () => lyra(null, 'mission.lyra.hoverlim'));
  if (obs.r < 3 && ship.sheet > 0 && !ship.guide && curWp()) flagOnce('nearhint', () => toast('TIP: <kbd>G</kbd> hands the descent to guidance · <kbd>N</kbd> shows the horizon grid'));
  // tutorial hint sequence
  const now = performance.now();
  if (hints.seq.length && hints.idx < hints.seq.length && now > hints.next && now > hints.until) {
    const h = $('hint'); h.innerHTML = hints.seq[hints.idx++]; h.style.opacity = 1; hints.next = now + 6200; hints.until = now + 5600;
  } else if (now > hints.until) $('hint').style.opacity = 0;
}

// ─────────────────────────────── HUD ───────────────────────────────
const hud = { plotMode: 1, dpr: 1, W: 0, H: 0, pred: [], predT: 0, fate: '', tgt: null, panelT: 0, alertKey: '', rows: {}, cue: null, wpKey: '' };
const COL = { c: '#86ecff', cd: 'rgba(134,236,255,0.55)', cf: 'rgba(134,236,255,0.18)', amber: '#ffb04d', red: '#ff4d6a', ok: '#6cffb0', mag: '#ff6cf0', pro: '#d6ff3a', white: '#e9fbff' };
function resizeHUD() {
  hud.dpr = Math.min(devicePixelRatio || 1, 2); hud.W = innerWidth; hud.H = innerHeight;
  hudc.width = Math.round(innerWidth * hud.dpr); hudc.height = Math.round(innerHeight * hud.dpr);
}
function camAxes() { return hud.ax || poseAxes(MODES.flight.cameraPose().quaternion); }
function project(b, ax) {
  const f = b[0] * ax.F[0] + b[1] * ax.F[1] + b[2] * ax.F[2];
  const r = b[0] * ax.R[0] + b[1] * ax.R[1] + b[2] * ax.R[2];
  const u = b[0] * ax.U[0] + b[1] * ax.U[1] + b[2] * ax.U[2];
  const th = Math.tan((POSE.fov * DEG) / 2), asp = hud.W / hud.H;
  if (f <= 0.02) return { x: 0, y: 0, vis: false, dx: r, dy: -u };
  const x = hud.W / 2 + (r / f / (th * asp)) * (hud.W / 2), y = hud.H / 2 - (u / f / th) * (hud.H / 2);
  return { x, y, vis: x > -40 && x < hud.W + 40 && y > -40 && y < hud.H + 40, dx: x - hud.W / 2, dy: y - hud.H / 2, f };
}
function glowLine(ctx, color, w = 1.4, blur = 8) { ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.shadowColor = color; ctx.shadowBlur = blur; }
function edgeArrow(ctx, p, color, label) {
  const W = hud.W, H = hud.H, a = Math.atan2(p.dy, p.dx), m = 46;
  const t = Math.min((W / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - m) / Math.abs(Math.sin(a) || 1e-6));
  const x = W / 2 + Math.cos(a) * t, y = H / 2 + Math.sin(a) * t;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); glowLine(ctx, color, 2);
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-6, -9); ctx.lineTo(-2, 0); ctx.lineTo(-6, 9); ctx.closePath(); ctx.fill(); ctx.restore();
  if (label) { ctx.font = '600 11px Rajdhani, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, x - Math.cos(a) * 26, y - Math.sin(a) * 26 + 4); }
}
function drawHUD(dt) {
  const ctx = hctx, W = hud.W, H = hud.H;
  ctx.setTransform(hud.dpr, 0, 0, hud.dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (sim.mode !== 'flight' || !settings.hud) return;
  const ax = camAxes();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // pitch ladder relative to the local horizontal (⊥ to the radial direction)
  const up = obs.radIn.map((v) => -v), fwd = ax.F;
  const hf = [fwd[0] - up[0] * (fwd[0] * up[0] + fwd[1] * up[1] + fwd[2] * up[2]), 0, 0];
  const dp = fwd[0] * up[0] + fwd[1] * up[1] + fwd[2] * up[2];
  const h = norm3([fwd[0] - up[0] * dp, fwd[1] - up[1] * dp, fwd[2] - up[2] * dp]);
  const side = [h[1] * up[2] - h[2] * up[1], h[2] * up[0] - h[0] * up[2], h[0] * up[1] - h[1] * up[0]];
  void hf;
  ctx.font = '600 10px Rajdhani, sans-serif';
  for (let pa = -80; pa <= 80; pa += 10) {
    const c = Math.cos(pa * DEG), s = Math.sin(pa * DEG);
    const d = [h[0] * c + up[0] * s, h[1] * c + up[1] * s, h[2] * c + up[2] * s];
    const p = project(d, ax);
    if (!p.vis || Math.hypot(p.dx, p.dy) > H * 0.36) continue;
    const q = project([d[0] + side[0] * 0.02, d[1] + side[1] * 0.02, d[2] + side[2] * 0.02], ax);
    let vx = q.x - p.x, vy = q.y - p.y; const l = Math.hypot(vx, vy) || 1; vx /= l; vy /= l;
    const len = pa === 0 ? 150 : 56, gap = pa === 0 ? 46 : 26;
    const ladA = clamp((70 - Math.abs(Math.asin(clamp(dp, -1, 1)) / DEG)) / 30, 0, 1);
    if (ladA <= 0) break;
    ctx.globalAlpha = (pa === 0 ? 0.5 : 0.3) * ladA; glowLine(ctx, COL.c, pa === 0 ? 1.3 : 1, 4);
    if (pa < 0) ctx.setLineDash([5, 5]); else ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(p.x - vx * (gap + len), p.y - vy * (gap + len)); ctx.lineTo(p.x - vx * gap, p.y - vy * gap);
    ctx.moveTo(p.x + vx * gap, p.y + vy * gap); ctx.lineTo(p.x + vx * (gap + len), p.y + vy * (gap + len)); ctx.stroke();
    if (pa !== 0) { ctx.textAlign = 'center'; ctx.fillText(String(pa), p.x + vx * (gap + len + 14), p.y + vy * (gap + len + 14) + 3); }
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  // boresight
  const bs = project([0, 0, 1], ax);
  if (bs.vis) {
    glowLine(ctx, COL.c, 1.6, 6);
    ctx.beginPath(); ctx.moveTo(bs.x - 30, bs.y); ctx.lineTo(bs.x - 12, bs.y); ctx.lineTo(bs.x - 6, bs.y + 8); ctx.lineTo(bs.x, bs.y); ctx.lineTo(bs.x + 6, bs.y + 8); ctx.lineTo(bs.x + 12, bs.y); ctx.lineTo(bs.x + 30, bs.y); ctx.stroke();
    ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(bs.x, bs.y, 70, -0.6, 0.6); ctx.stroke(); ctx.beginPath(); ctx.arc(bs.x, bs.y, 70, Math.PI - 0.6, Math.PI + 0.6); ctx.stroke(); ctx.globalAlpha = 1;
    // virtual stick
    if (input.locked) { const sx = bs.x + input.stick[0] * 64, sy = bs.y - input.stick[1] * 64; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(sx, sy, 4, 0, 7); ctx.stroke(); ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.moveTo(bs.x, bs.y); ctx.lineTo(sx, sy); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  // black hole centre (apparent: aberrated by our motion through the local frame)
  const bh = project(obs.bhApp, ax);
  if (ship.sheet > 0 || Math.abs(obs.r) < 30) {
    if (bh.vis) { glowLine(ctx, 'rgba(255,190,120,0.75)', 1.2, 6); ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(bh.x, bh.y, 16, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = '600 11px Rajdhani, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`BH  ${fmt(Math.abs(obs.r), 2)} M`, bh.x + 22, bh.y - 6); }
  }
  // prograde / retrograde
  if (obs.beta > 0.002) {
    const pp = project(obs.pro, ax), pr = project(obs.pro.map((v) => -v), ax);
    for (const [p, retro] of [[pp, false], [pr, true]]) {
      if (!p.vis) continue;
      glowLine(ctx, COL.pro, 1.8, 8);
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, 7); ctx.stroke();
      if (!retro) { ctx.beginPath(); ctx.moveTo(p.x, p.y - 9); ctx.lineTo(p.x, p.y - 18); ctx.moveTo(p.x - 9, p.y); ctx.lineTo(p.x - 20, p.y); ctx.moveTo(p.x + 9, p.y); ctx.lineTo(p.x + 20, p.y); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(p.x - 6, p.y - 6); ctx.lineTo(p.x + 6, p.y + 6); ctx.moveTo(p.x + 6, p.y - 6); ctx.lineTo(p.x - 6, p.y + 6); ctx.stroke(); }
    }
    if (pp.vis) { ctx.font = '600 11px Share Tech Mono, monospace'; ctx.textAlign = 'left'; ctx.fillText(`${fmt(obs.beta, 3)}c`, pp.x + 24, pp.y + 4); }
  }
  // waypoint marker + guidance cue
  const wp = curWp();
  hud.tgt = wp ? targetBody() : null;
  if (wp && hud.tgt) {
    const p = project(hud.tgt, ax), S = ship.S;
    const dist = Math.hypot(wp.pos[0] - S[1], wp.pos[1] - S[2], wp.pos[2] - S[3]);
    const lab = `${wp.name} · ${fmt(dist, dist < 10 ? 2 : 1)} M`;
    if (p.vis) {
      glowLine(ctx, COL.mag, 1.8, 10);
      const s = 13 + 4 * Math.sin(sim.wall * 4);
      ctx.beginPath(); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s, p.y); ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s, p.y); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, 7); ctx.fill();
      ctx.font = '700 12px Rajdhani, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(lab, p.x, p.y - s - 9);
    } else edgeArrow(ctx, p, COL.mag, wp.name);
    if (ship.guide) {
      const c = project(norm3(toBody(AP.dir, S, [S[0], S[1], S[2], S[3]], ship.sheet)), ax);
      if (c.vis) { glowLine(ctx, '#45b8ff', 2, 10); ctx.beginPath(); ctx.arc(c.x, c.y, 22, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(c.x - 30, c.y); ctx.lineTo(c.x - 16, c.y); ctx.moveTo(c.x + 16, c.y); ctx.lineTo(c.x + 30, c.y); ctx.moveTo(c.x, c.y - 30); ctx.lineTo(c.x, c.y - 16); ctx.stroke(); }
    }
  }
  ctx.shadowBlur = 0;
  // worlds, stations, derelicts (from the worlds module): small brackets with name + range
  for (const mk of worldMarkers()) {
    if (wp && mk.id === wp.id) continue;
    const p = project(mk.dir, ax), col = mk.color || (mk.kind === 'station' ? COL.ok : COL.c);
    if (!p.vis) continue;
    glowLine(ctx, col, 1.2, 6); ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(p.x - 9, p.y - 5); ctx.lineTo(p.x - 9, p.y - 9); ctx.lineTo(p.x - 5, p.y - 9); ctx.moveTo(p.x + 5, p.y - 9); ctx.lineTo(p.x + 9, p.y - 9); ctx.lineTo(p.x + 9, p.y - 5);
    ctx.moveTo(p.x + 9, p.y + 5); ctx.lineTo(p.x + 9, p.y + 9); ctx.lineTo(p.x + 5, p.y + 9); ctx.moveTo(p.x - 5, p.y + 9); ctx.lineTo(p.x - 9, p.y + 9); ctx.lineTo(p.x - 9, p.y + 5); ctx.stroke();
    ctx.font = '600 11px Rajdhani, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(mk.label, p.x + 14, p.y - 2);
    if (mk.sub) { ctx.font = '10px Share Tech Mono, monospace'; ctx.globalAlpha = 0.6; ctx.fillText(mk.sub, p.x + 14, p.y + 10); }
    ctx.globalAlpha = 1;
  }
  ctx.shadowBlur = 0;
  // throttle & speed arcs
  const cx = W / 2, cy = H / 2, R = Math.min(H * 0.34, 330);
  const arc = (a0, a1, frac, color, label, value, left) => {
    ctx.globalAlpha = 0.28; glowLine(ctx, COL.c, 4, 0); ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1, left); ctx.stroke();
    ctx.globalAlpha = 0.95; glowLine(ctx, color, 4, 10); ctx.beginPath(); ctx.arc(cx, cy, R, a0, lerp(a0, a1, clamp(frac, 0, 1)), left); ctx.stroke();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.font = '600 10px Orbitron, sans-serif'; ctx.textAlign = left ? 'right' : 'left';
    const lx = cx + Math.cos(a0) * (R + 14), ly = cy + Math.sin(a0) * (R + 14);
    ctx.fillStyle = COL.cd; ctx.fillText(label, lx, ly + 16); ctx.font = '15px Share Tech Mono, monospace'; ctx.fillStyle = COL.white; ctx.fillText(value, lx, ly + 34);
  };
  const thrFrac = ship.guide || ship.hover || input.brake ? ship.accMag / 2 : ship.throttle;
  arc(Math.PI * 0.82, Math.PI * 1.18, thrFrac, ship.boost ? COL.amber : COL.c, ship.guide ? 'AUTO THRUST' : 'THROTTLE', ship.guide || ship.hover || input.brake ? `${fmtSci(ship.accMag * G_PER_ACC, 1)} g` : `${Math.round(ship.throttle * 100)}%`, false);
  arc(Math.PI * 0.18, -Math.PI * 0.18, obs.beta, obs.beta > 0.9 ? COL.amber : COL.ok, `β · ${obs.ref}`, `${fmt(obs.beta, 4)} c`, true);
  // alerts
  const al = [];
  if (ship.sheet > 0 && obs.r < K.rp && obs.r > K.rm) al.push(['red', `NO RETURN · τ_max to r₋ ${fmt(tauMaxToInner(obs.r), 2)} s`]);
  if (ship.sheet > 0 && obs.r < K.rm && obs.r > 0) al.push(['red', 'INNER REGION · RING SINGULARITY VISIBLE']);
  if (obs.tidal > 2) al.push([obs.tidal > 50 ? 'red' : '', `TIDAL STRESS ${fmtSci(obs.tidal, 1)} g / HULL`]);
  if (ship.satur) al.push(['', 'THRUST LIMIT']);
  if (obs.inErgo) al.push(['info', `ERGOSPHERE · FRAME DRAG ${fmt(obs.omegaDrag, 3)} rad/s`]);
  if (obs.E < 0) al.push(['info', 'NEGATIVE-ENERGY ORBIT · PENROSE']);
  if (ship.warpLimited) al.push(['info', 'WARP LIMITED · PHYSICS']);
  if (ship.paused) al.push(['info', 'PAUSED']);
  const key = al.map((a) => a[0] + a[1]).join('|');
  if (key !== hud.alertKey) { hud.alertKey = key; $('alerts').innerHTML = al.map(([c, t]) => `<div class="alert ${c}">${t}</div>`).join(''); }
  audio.alarm(al.some((a) => a[0] === 'red') ? 1 : 0);
  drawNavballOverlay(ctx);
  drawRadioNav(ctx);
  if (hud.plotMode) drawPlot(ctx);
}
function navRect() { const s = Math.min(210, hud.H * 0.24); return { x: hud.W - s - 28, y: hud.H - s - 26, s }; }
function drawNavballOverlay(ctx) {
  const nr = navRect(), cx = nr.x + nr.s / 2, cy = nr.y + nr.s / 2, R = nr.s / 2;
  ctx.shadowBlur = 0;
  glowLine(ctx, 'rgba(134,236,255,0.65)', 2, 10); ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, 7); ctx.stroke();
  ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R + 10, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; const l = i % 3 === 0 ? 8 : 4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R + 10), cy + Math.sin(a) * (R + 10)); ctx.lineTo(cx + Math.cos(a) * (R + 10 + l), cy + Math.sin(a) * (R + 10 + l)); ctx.stroke(); }
  glowLine(ctx, COL.amber, 3, 8);
  ctx.beginPath(); ctx.moveTo(cx - 34, cy); ctx.lineTo(cx - 12, cy); ctx.lineTo(cx - 6, cy + 9); ctx.lineTo(cx, cy); ctx.lineTo(cx + 6, cy + 9); ctx.lineTo(cx + 12, cy); ctx.lineTo(cx + 34, cy); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, 7); ctx.fill();
  ctx.shadowBlur = 0; ctx.font = '600 10px Orbitron, sans-serif'; ctx.fillStyle = COL.cd; ctx.textAlign = 'center';
  ctx.fillText(`SAS · ${ship.sas}${ship.guide ? ' · GUIDE' : ''}${ship.hover ? ' · HOLD' : ''}`, cx, nr.y - 16);
  ctx.font = '13px Share Tech Mono, monospace'; ctx.fillStyle = COL.white;
  ctx.fillText(`HDG ${String(Math.round(hud.hdg || 0)).padStart(3, '0')}°  PITCH ${hud.pitch >= 0 ? '+' : ''}${Math.round(hud.pitch || 0)}°`, cx, nr.y + nr.s + 22);
}
function drawRadioNav(ctx) {
  const wp = curWp(); if (!wp || !hud.tgt) return;
  const nr = navRect(), w = 210, hgt = 92, x = nr.x - w - 300 < 520 ? hud.W - w - 28 : nr.x - w - 44, y = nr.x - w - 300 < 520 ? nr.y - hgt - 54 : nr.y + nr.s - hgt;
  ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(4,14,22,0.55)'; ctx.fillRect(x, y, w, hgt);
  ctx.strokeStyle = 'rgba(134,236,255,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, hgt - 1);
  ctx.font = '600 9.5px Orbitron, sans-serif'; ctx.fillStyle = COL.cd; ctx.textAlign = 'left'; ctx.fillText('RADIO NAV · ' + wp.id, x + 8, y + 14);
  const t = cueBody() || hud.tgt, ex = Math.atan2(t[0], t[2]), ey = Math.atan2(t[1], Math.hypot(t[0], t[2]));
  const dev = clamp(ex / 0.6, -1, 1), vdev = clamp(ey / 0.6, -1, 1);
  audio.beacon.dev = dev; audio.beacon.vdev = vdev; audio.beacon.ident = wp.id;
  const bx = x + 12, by = y + 24, bw = w - 24, bhh = 52, mx = bx + bw / 2, my = by + bhh / 2;
  ctx.strokeStyle = 'rgba(134,236,255,0.3)';
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(mx + (i * bw) / 5, my, 2, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(mx, my + (i * bhh) / 5, 2, 0, 7); ctx.stroke(); }
  const onc = Math.abs(dev) < 0.08 && Math.abs(vdev) < 0.08;
  glowLine(ctx, onc ? COL.ok : COL.mag, 2.2, 8);
  ctx.beginPath(); ctx.moveTo(mx + (dev * bw) / 2, by); ctx.lineTo(mx + (dev * bw) / 2, by + bhh); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx, my - (vdev * bhh) / 2); ctx.lineTo(bx + bw, my - (vdev * bhh) / 2); ctx.stroke();
  ctx.shadowBlur = 0; ctx.font = '11px Share Tech Mono, monospace'; ctx.fillStyle = onc ? COL.ok : COL.white; ctx.textAlign = 'right';
  ctx.fillText(onc ? 'ON COURSE' : `${(ex / DEG).toFixed(0)}° ${(ey / DEG).toFixed(0)}°`, x + w - 8, y + 14);
  ctx.textAlign = 'left'; ctx.fillStyle = audio.beacon.on ? COL.ok : COL.cd; ctx.fillText(audio.beacon.on ? '◉ AUDIO' : '○ AUDIO [B]', x + 8, y + hgt - 6);
}
function plotMap(px, py, pz, mode) { // nonlinear (log) radial compression
  let u, v;
  if (mode === 1) { u = Math.hypot(px, py); v = pz; } else { u = px; v = py; }
  const rr = Math.hypot(u, v), k = Math.log(1 + rr / 0.7) / Math.log(1 + hud.plotMax / 0.7);
  const s = rr > 1e-9 ? k / rr : 0;
  return [u * s, v * s];
}
function drawPlot(ctx) {
  const nr = navRect(), w = 236, h = 236, x = nr.x - w - 34, y = hud.H - h - 22;
  if (x < 520) return;
  ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(3,12,20,0.55)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(134,236,255,0.22)'; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  const mode = hud.plotMode; // 1 side (meridional), 2 top
  const S = ship.S;
  hud.plotMax = Math.max(8, Math.hypot(S[1], S[2], S[3]) * 1.35);
  const cx = mode === 1 ? x + 26 : x + w / 2, cy = y + h / 2 + 6, sc = mode === 1 ? w - 40 : w / 2 - 14;
  const P = (px, py, pz) => { const q = plotMap(px, py, pz, mode); return [cx + q[0] * sc, cy - q[1] * sc]; };
  ctx.font = '600 9.5px Orbitron, sans-serif'; ctx.fillStyle = COL.cd; ctx.textAlign = 'left';
  ctx.fillText(mode === 1 ? 'ORBIT · MERIDIONAL (LOG r)' : 'ORBIT · EQUATORIAL (LOG r)', x + 8, y + 14);
  const shape = (rf, color, fill, dash) => {
    ctx.beginPath();
    for (let i = 0; i <= 96; i++) {
      const th = mode === 1 ? (i / 96) * Math.PI : Math.PI / 2, ph = mode === 1 ? 0 : (i / 96) * Math.PI * 2;
      const r = rf(th), sx = Math.sqrt(r * r + K.a * K.a) * Math.sin(th);
      const q = mode === 1 ? P(sx, 0, r * Math.cos(th)) : P(sx * Math.cos(ph), sx * Math.sin(ph), 0);
      i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
    }
    ctx.setLineDash(dash || []); if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
  };
  // disk
  ctx.strokeStyle = 'rgba(255,170,80,0.85)'; ctx.lineWidth = 3;
  if (mode === 1) { const a = P(Math.sqrt(K.isco ** 2 + K.a ** 2), 0, 0), b = P(Math.sqrt(DISK_ROUT ** 2 + K.a ** 2), 0, 0); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  else { for (const rr of [K.isco, DISK_ROUT]) { ctx.lineWidth = rr === K.isco ? 1.5 : 1; ctx.globalAlpha = 0.6; shape(() => rr, 'rgba(255,170,80,0.8)'); ctx.globalAlpha = 1; } }
  shape(rErgo, 'rgba(120,200,255,0.7)', null, [3, 3]);
  shape(() => K.rp, 'rgba(255,90,60,0.9)', 'rgba(0,0,0,0.85)');
  shape(() => K.rm, 'rgba(90,200,255,0.8)');
  const rg = mode === 1 ? P(K.a, 0, 0) : null;
  ctx.fillStyle = '#fff'; if (rg) { ctx.beginPath(); ctx.arc(rg[0], rg[1], 2.2, 0, 7); ctx.fill(); }
  else { ctx.globalAlpha = 0.9; shape(() => 0, 'rgba(255,255,255,0.9)'); ctx.globalAlpha = 1; }
  // waypoints
  WPS.forEach((wp, i) => {
    if (!wp.pos) return;
    const q = P(wp.pos[0], wp.pos[1], wp.pos[2]);
    ctx.fillStyle = wp.done ? COL.ok : i === tgtIdx ? COL.mag : 'rgba(255,108,240,0.45)';
    ctx.beginPath(); ctx.moveTo(q[0], q[1] - 4); ctx.lineTo(q[0] + 4, q[1]); ctx.lineTo(q[0], q[1] + 4); ctx.lineTo(q[0] - 4, q[1]); ctx.fill();
  });
  // predicted path
  if (hud.pred.length > 1) {
    ctx.strokeStyle = 'rgba(214,255,58,0.85)'; ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]); ctx.beginPath();
    hud.pred.forEach((p, i) => { const q = P(p[0], p[1], p[2]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
    ctx.stroke(); ctx.setLineDash([]);
  }
  const sp = P(S[1], S[2], S[3]);
  glowLine(ctx, '#fff', 1.5, 10); ctx.beginPath(); ctx.arc(sp[0], sp[1], 3.5, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  ctx.font = '10.5px Share Tech Mono, monospace'; ctx.fillStyle = COL.pro; ctx.textAlign = 'left'; ctx.fillText(hud.fate || '', x + 8, y + h - 8);
  ctx.fillStyle = COL.cd; ctx.textAlign = 'right'; ctx.fillText('[O]', x + w - 8, y + h - 8);
}
function updateNavball() {
  const radOut = obs.radIn.map((v) => -v);
  let n = obs.spinUp, d = n[0] * radOut[0] + n[1] * radOut[1] + n[2] * radOut[2];
  let N = [n[0] - d * radOut[0], n[1] - d * radOut[1], n[2] - d * radOut[2]];
  if (Math.hypot(...N) < 0.05) { const b = Math.abs(radOut[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const e = b[0] * radOut[0] + b[1] * radOut[1] + b[2] * radOut[2]; N = [b[0] - e * radOut[0], b[1] - e * radOut[1], b[2] - e * radOut[2]]; }
  N = norm3(N);
  const U = radOut, E = norm3(cross3(N, U)).map((v) => -v);
  const m = new THREE.Matrix4().set(E[0], U[0], N[0], 0, E[1], U[1], N[1], 0, E[2], U[2], N[2], 0, 0, 0, 0, 1);
  navball.ball.matrix.copy(m); navball.ball.matrixWorldNeedsUpdate = true;
  const place = (sp, b, vis = true) => { sp.visible = vis && !!b; if (b) sp.position.set(b[0] * E[0] + b[1] * E[1] + b[2] * E[2], b[0] * U[0] + b[1] * U[1] + b[2] * U[2], b[0] * N[0] + b[1] * N[1] + b[2] * N[2]).multiplyScalar(1.03); };
  place(navball.pro, obs.pro, obs.beta > 0.002); place(navball.retro, obs.pro.map((v) => -v), obs.beta > 0.002);
  place(navball.tgt, hud.tgt);
  place(navball.cue, ship.guide ? norm3(toBody(AP.dir, ship.S, [ship.S[0], ship.S[1], ship.S[2], ship.S[3]], ship.sheet)) : null, ship.guide);
  // heading of the nose (0 = toward the spin axis, 90 = prograde/east)
  const f = [0, 0, 1];
  hud.pitch = Math.asin(clamp(f[0] * U[0] + f[1] * U[1] + f[2] * U[2], -1, 1)) / DEG;
  hud.hdg = (Math.atan2(f[0] * E[0] + f[1] * E[1] + f[2] * E[2], f[0] * N[0] + f[1] * N[1] + f[2] * N[2]) / DEG + 360) % 360;
}
function renderNavball() {
  if (sim.mode !== 'flight' || !settings.hud) return;
  const nr = navRect();
  renderer.autoClear = false;
  renderer.setScissorTest(true);
  renderer.setViewport(nr.x, hud.H - nr.y - nr.s, nr.s, nr.s); renderer.setScissor(nr.x, hud.H - nr.y - nr.s, nr.s, nr.s);
  renderer.clearDepth();
  renderer.render(navball.scene, navball.cam);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, hud.W, hud.H); renderer.autoClear = true;
}
// DOM panels (10 Hz)
function rowsInit(id, list) {
  const el = $(id); el.innerHTML = '';
  for (const [k, lab] of list) {
    if (k === '-') { const s = document.createElement('div'); s.className = 'sep'; el.appendChild(s); continue; }
    const r = document.createElement('div'); r.className = 'row'; r.innerHTML = `<span class="k">${lab}</span><span class="v"></span>`;
    el.appendChild(r); hud.rows[k] = r.lastChild;
  }
}
function setRow(k, v, cls = '') { const e = hud.rows[k]; if (!e) return; if (e.textContent !== v) e.textContent = v; if (e.className !== 'v ' + cls) e.className = 'v ' + cls; }
function initPanels() {
  rowsInit('rFlight', [['thr', 'THROTTLE'], ['acc', 'PROPER ACCEL'], ['beta', 'SPEED β'], ['gam', 'LORENTZ γ'], ['-'], ['sas', 'SAS / GUIDE'], ['warp', 'TIME WARP'], ['fov', 'FIELD OF VIEW']]);
  rowsInit('rTime', [['tau', 'SHIP CLOCK τ'], ['tks', 'COORD TIME t'], ['dil', 'dτ / dt'], ['-'], ['mcc', 'HALCYON CLOCK (rx)'], ['mcr', 'HALCYON RATE'], ['up', 'UPLINK LAG'], ['upz', 'UPLINK REDSHIFT']]);
  rowsInit('rNav', [['r', 'RADIUS r'], ['km', 'DISTANCE'], ['lat', 'LATITUDE'], ['hz', 'r − r₊'], ['-'], ['E', 'ENERGY E∞'], ['L', 'ANG. MOM. L_z'], ['drag', 'FRAME DRAG Ω'], ['tid', 'TIDAL / HULL'], ['-'], ['spin', 'BLACK HOLE'], ['mass', 'MASS']]);
}
function updatePanels() {
  const S = ship.S;
  setRow('thr', ship.guide ? 'AUTO' : ship.hover || input.brake ? 'HOLD' : `${Math.round(ship.throttle * 100)}%${ship.boost ? ' ⚡' : ''}`, ship.boost ? 'warn' : '');
  setRow('acc', `${fmtSci(ship.accMag * G_PER_ACC, 2)} g`, ship.satur ? 'warn' : '');
  setRow('beta', `${fmt(obs.beta, 5)} c · ${obs.ref}`);
  setRow('gam', fmt(obs.gamma, 4), obs.gamma > 3 ? 'warn' : '');
  setRow('sas', `${ship.sas}${ship.guide ? ' · GUIDE' : ship.hover ? ' · HOLD' : ''}`, ship.guide ? 'good' : '');
  const sf = slowFactor();
  setRow('warp', `×${ship.warp}${sf < 1 ? ` · ×${sf} CINE` : ''}${ship.warpLimited ? ' (LIM)' : ''}`, ship.warp !== 1 || sf < 1 ? 'warn' : '');
  setRow('fov', `${Math.round(ship.fov)}°`);
  setRow('tau', fmtClock(ship.tau));
  setRow('tks', fmtClock(S[0]));
  setRow('dil', fmt(obs.dtaudt, 4), obs.dtaudt < 0.5 ? 'warn' : '');
  const conn = MC.connected && ship.universe === 0;
  setRow('mcc', conn ? mcClock(MC.T) : '— NO CARRIER —', conn ? '' : 'bad');
  setRow('mcr', conn ? `×${fmt(obs.mcRate, 3)} ${obs.mcRate > 1.02 ? '(FAST)' : obs.mcRate < 0.98 ? '(SLOW)' : ''}` : '—', obs.mcRate > 2 ? 'warn' : '');
  const lag = MC.k * (obs.tRec - MC.T);
  setRow('up', Number.isFinite(obs.tRec) && conn ? `${fmt(lag, 1)} s` : '∞ · CANNOT ESCAPE', Number.isFinite(obs.tRec) ? '' : 'bad');
  setRow('upz', obs.gTx > 0 && conn ? `z = ${fmt(1 / obs.gTx - 1, 3)}` : 'z = ∞', obs.gTx < 0.5 ? 'warn' : '');
  setRow('r', `${fmt(obs.r, Math.abs(obs.r) < 10 ? 4 : 2)} M${ship.sheet < 0 ? ' (r<0)' : ''}`, ship.sheet > 0 && obs.r < K.rp ? 'bad' : ship.sheet < 0 ? 'good' : '');
  setRow('km', `${fmtSci(Math.abs(obs.r) * KM_PER_M, 2)} km`);
  setRow('lat', `${fmt(90 - obs.th / DEG, 1)}°`);
  setRow('hz', ship.sheet > 0 ? `${fmt(obs.r - K.rp, 4)} M` : '—', ship.sheet > 0 && obs.r < K.rp ? 'bad' : ship.sheet > 0 && obs.r - K.rp < 0.5 ? 'warn' : '');
  setRow('E', fmt(obs.E, 4), obs.E < 0 ? 'good' : '');
  setRow('L', fmt(obs.Lz, 3));
  setRow('drag', ship.sheet > 0 && obs.r > K.rp ? `${fmt(obs.omegaDrag, 4)} rad/s` : '—');
  setRow('tid', `${fmtSci(obs.tidal, 2)} g`, obs.tidal > 2 ? 'warn' : '');
  setRow('spin', `a* = ${K.a.toFixed(3)} · r₊ ${K.rp.toFixed(3)}`);
  setRow('mass', `${fmtSci(MSUN, 2)} M☉`);
  $('hMode').textContent = ship.guide ? 'GUIDANCE' : ship.hover ? 'STATION-KEEP' : 'MANUAL';
  $('hRegion').textContent = obs.region;
  $('hRegion').style.color = obs.region.includes('INTERIOR') || obs.region.includes('INNER') ? COL.red : obs.region.includes('NEGATIVE') || obs.region.includes('UNIVERSE ') ? COL.mag : '';
  $('hLink').textContent = !conn ? 'NO CARRIER' : Number.isFinite(obs.tRec) ? `LAG ${fmt(lag, 0)} s` : 'UPLINK ∞';
  const wp = curWp();
  const lk = ship.lock;
  const LOCK_LABEL = { descent: 'LANDING', landed: 'LANDED', ascent: 'ASCENT', docking: 'DOCKING', docked: 'DOCKED' };
  $('bn2').textContent = wp ? wp.name : lk ? `${LOCK_LABEL[lk.kind] || String(lk.kind).toUpperCase()} · ${String(lk.body).toUpperCase()}` : ship.hover && nav.holdRef ? `HOLDING · ${String(nav.holdRef.name).toUpperCase()}` : ship.universe > 0 ? 'FREE FLIGHT · NEW UNIVERSE' : ship.sheet < 0 ? 'FREE FLIGHT · NEGATIVE UNIVERSE' : 'FREE FLIGHT';
  if (wp && wp.pos) {
    const d = Math.hypot(wp.pos[0] - S[1], wp.pos[1] - S[2], wp.pos[2] - S[3]);
    const closing = hud.lastDist !== undefined ? (hud.lastDist - d) / Math.max(hud.panelDt, 1e-3) : 0; hud.lastDist = d;
    $('bn3').textContent = `${fmt(d, 2)} M · ${fmtSci(d * KM_PER_M, 2)} km${closing > 0.002 ? ` · ETA ${fmt(d / closing, 0)} s` : ''}`;
  } else $('bn3').textContent = '';
  $('cfR').textContent = conn ? `RX ${obs.gRx >= 1 ? 'BLUE' : 'RED'}SHIFT ×${fmt(obs.gRx, 3)}` : 'NO CARRIER';
  const wk = WPS.map((w, i) => `${w.done}${i === tgtIdx}`).join();
  if (wk !== hud.wpKey) {
    hud.wpKey = wk;
    $('wpstrip').innerHTML = WPS.map((w, i) => `<div class="wp ${w.done ? 'done' : ''} ${i === tgtIdx && !w.done ? 'cur' : ''}">${w.done ? '✓ ' : ''}${i === tgtIdx && !w.done ? w.name : w.id}</div>`).join('');
  }
}
function updateScreens() {
  const extra = ctx.shipModel ? ctx.shipModel.screens.filter((s) => s.id > 2 && s.draw) : [];
  for (const s of extra) { try { s.draw(s.ctx2d, s.canvas.width, s.canvas.height, sim.wall); s.tex.needsUpdate = true; } catch (e) { reportModuleError('screen.draw', e); } }
  for (const sc of screens) {
    const g = sc.ctx2d || sc.ctx, cv = sc.canvas || sc.cv, W = cv.width, H = cv.height;
    g.fillStyle = '#02080d'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(134,236,255,0.15)'; for (let i = 0; i < W; i += 24) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, H); g.stroke(); } for (let i = 0; i < H; i += 24) { g.beginPath(); g.moveTo(0, i); g.lineTo(W, i); g.stroke(); }
    g.font = 'bold 20px Orbitron, sans-serif'; g.fillStyle = '#7fe9ff'; g.textAlign = 'left';
    if (sc.id === 0) {
      g.fillText('TIDAL STRAIN', 14, 30);
      sc.hist = sc.hist || []; sc.hist.push(Math.log10(1e-3 + obs.tidal)); if (sc.hist.length > 120) sc.hist.shift();
      g.strokeStyle = '#ffb04d'; g.lineWidth = 3; g.beginPath(); sc.hist.forEach((v, i) => { const x = 14 + (i / 120) * (W - 28), y = H - 24 - ((v + 3) / 6) * (H - 70); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
      g.font = '26px Share Tech Mono, monospace'; g.fillStyle = '#fff'; g.fillText(`${fmtSci(obs.tidal, 2)} g`, 14, H - 18);
    } else if (sc.id === 1) {
      g.fillText('CLOCKS', 14, 30);
      g.font = '22px Share Tech Mono, monospace'; g.fillStyle = '#fff'; g.fillText(`SHIP  ${fmtClock(ship.tau)}`, 14, 84);
      g.fillStyle = MC.connected ? '#ffb04d' : '#ff4d6a'; g.fillText(`HALC  ${MC.connected ? mcClock(MC.T) : '--:--:--.-'}`, 14, 124);
      g.fillStyle = '#9fe'; g.fillText(`RATE  ×${fmt(obs.mcRate, 3)}`, 14, 164);
      g.fillStyle = '#6cffb0'; g.fillText(`γ ${fmt(obs.gamma, 3)}`, 14, 204);
    } else {
      g.fillText('SPECTRUM', 14, 30);
      const T0 = 6500 * obs.gRx;
      g.strokeStyle = '#ff6cf0'; g.lineWidth = 3; g.beginPath();
      for (let i = 0; i <= 100; i++) { const l = 300 + i * 6, x = 14 + (i / 100) * (W - 28); const v = planck(l, Math.max(T0, 500)) / planck(2.898e6 / Math.max(T0, 500), Math.max(T0, 500)); const y = H - 30 - clamp(v, 0, 1.2) * (H - 80); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      g.font = '18px Share Tech Mono, monospace'; g.fillStyle = '#fff'; g.fillText(`SKY BEHIND: ${Math.round(T0)} K`, 14, H - 8);
    }
    sc.tex.needsUpdate = true;
  }
}

// ─────────────────────────────── scenarios ───────────────────────────────
const SCEN = {
  attract: { place: () => ({ r: 30, th: 84, ph: -40, vel: 'circular' }), first: 'DSK', hidden: true },
  free: { label: 'FREE EXPLORE', sub: 'docked at Halcyon · the whole system is yours', place: () => ({ r: 46, th: 84, ph: -52, vel: 'circular' }), first: null, free: true, hidden: true },
  mission: { label: 'FULL DESCENT', sub: 'orbit · 30 M · nine waypoints', place: () => ({ r: 30, th: 84, ph: -40, vel: 'circular' }), first: null },
  disk: { label: 'DISK FLYBY', sub: '11 M · above the accretion disk', place: () => ({ r: 11, th: 83, ph: 10, vel: 'circular' }), first: 'PHS' },
  photon: { label: 'PHOTON SHELL', sub: '3.4 M · light orbits here', place: () => ({ r: 3.4, th: 80, ph: 60, vel: 'circular' }), first: 'ISC', aim: 0.6 },
  ergo: { label: 'INNERMOST ORBIT', sub: 'just above the ISCO, inside the ergosphere', place: () => ({ r: K.isco * 1.012, th: 84, ph: 120, vel: 'circular' }), first: 'POL', aim: 0.45 },
  horizon: { label: 'HORIZON PLUNGE', sub: '2.6 M · polar dive', place: () => ({ r: 2.6, th: 10, ph: 200, vel: 'fall', boost: [[0, 0, -1], 0.2] }), first: 'EHZ' },
  inside: { label: 'INSIDE THE HOLE', sub: 'between the horizons', place: () => ({ r: 0.5 * (K.rp + K.rm), th: 6, ph: 200, vel: 'fall' }), first: 'IHZ', dark: true },
  ring: { label: 'RING SINGULARITY', sub: 'region III · punch through', place: () => ({ r: 0.55 * K.rm, th: 3, ph: 200, vel: 'fall', boost: [[0, 0, -1], 0.82] }), first: 'RNG', dark: true },
  anti: { label: 'THE OTHER SIDE', sub: 'r < 0 · negative-mass universe', place: () => ({ pos: [0.05, 0.02, -4], sheet: -1, vel: 'static', boost: [[0, 0, -1], 0.35], face: [0, 0, 1], up: [1, 0, 0] }), first: 'ANV', dark: true },
};
function applySpin() {
  setSpin(settings.spin);
  bhUniforms.uA.value = K.a; bhUniforms.uRin.value = K.isco; bhUniforms.uRout.value = DISK_ROUT;
  if (ntTex) ntTex.dispose();
  ntTex = buildNTLUT(); bhUniforms.uNT.value = ntTex;
}
function resetFlags() { for (const k of Object.keys(flags)) delete flags[k]; }
function resetWorldState() {
  ship.lock = null; nav.target = null; nav.holdRef = null; nav.cruise = false;
  flightView.kind = 'cockpit';
  if (ctx.surface && ctx.surface.active && ctx.surface.reset) { try { ctx.surface.reset(); } catch (e) { reportModuleError('surface.reset', e); } }
  if (ctx.shipModel) { try { ctx.shipModel.setLanded(false); } catch (e) { reportModuleError('shipModel.setLanded', e); } }
  spaces.current = 'orpheus';
  idle.next = 150; idle.used = {};
  ui.prompt(null); ctxPromptKey = null;
}
function setupScenario(name) {
  const sc = SCEN[name];
  resetFlags();
  resetWorldState();
  sim.scenario = name;
  $('bn1').textContent = sc.free ? 'ORPHEUS · FREE FLIGHT · EREBUS SYSTEM' : 'MISSION ORPHEUS · DESCENT PROFILE';
  $('hud').classList.toggle('free', !!sc.free);
  ship.universe = 0; ship.guide = false; ship.hover = false; ship.sas = name === 'mission' ? 'STAB' : 'RAD-IN'; ship.warp = 1; ship.paused = false; ship.alive = true;
  ship.head.yaw = 0; ship.head.pitch = 0; ship.fov = 72; ship.throttle = 0;
  ship.stats = { maxG: 0, maxGamma: 1, minR: 1e9 };
  sim.crossMC = undefined; sim.crossTau = undefined;
  mcReset();
  sim.endingShown = false; sim.events.length = 0;
  bhUniforms.uDisk.value = 1;
  if (skies.cur && skies.cur !== skies.home) { skies.cur.dispose(); }
  skies.cur = skies.home; bhUniforms.uSkyA.value = skies.home.texture;
  const pl = sc.place();
  buildWaypoints(pl.ph !== undefined ? pl.ph : 0);
  placeShip(pl);
  if (!pl.face) {
    observe();
    faceBody(sc.aim ? norm3(obs.pro.map((v, i) => v + sc.aim * obs.bhApp[i])) : obs.bhApp);
    if (sc.aim) { ship.sas = 'ORBIT'; ship.sasAim = sc.aim; }
  }
  if (sc.first) { const fi = WPS.findIndex((w) => w.id === sc.first); for (let i = 0; i < fi; i++) { WPS[i].done = true; WPS[i].skipped = true; } tgtIdx = Math.max(0, fi); }
  if (sc.free && ctx.worlds) {
    ship.lock = { kind: 'docked', body: 'halcyon' };
    try { if (!ctx.worlds.lockState(ship.lock, ship.S[0], ship.S)) ship.lock = null; } catch (e) { reportModuleError('free.lock', e); ship.lock = null; }
    ship.sas = 'STAB';
  }
  observe();
  sim.lastRegion = obs.region;
  hud.wpKey = ''; hud.lastDist = undefined; hud.pred = [];
  $('log').innerHTML = ''; typewriter.length = 0;
  const T0 = mcEmitT();
  if (name === 'mission') mcSchedule(T0 + 1.5, 'mission.mc.open', `light lag ${Math.round(MC.rMC - obs.r)} s`);
  else if (sc.free) mcSchedule(T0 + 5, 'free.mc.start');
  else if (!sc.dark) mcSchedule(T0 + 1.5, 'mission.mc.open.profile', `r ${obs.r.toFixed(1)} M · light lag ${Math.round(MC.rMC - obs.r)} s`);
  else mcSchedule(T0 + 2.5, 'mission.mc.open.dark');
  hints.seq = name === 'mission' ? [
    'Click the view to take the stick · mouse steers · <kbd>Q</kbd> <kbd>E</kbd> roll · hold <kbd>RMB</kbd> to look around · wheel zooms',
    '<kbd>W</kbd> <kbd>S</kbd> throttle · <kbd>Shift</kbd> boost · <kbd>Space</kbd> match local frame · <kbd>A</kbd><kbd>D</kbd><kbd>R</kbd><kbd>F</kbd> translate',
    '<kbd>T</kbd> cycle waypoint · <kbd>G</kbd> guidance autopilot · <kbd>B</kbd> radio-range beacon audio · <kbd>1</kbd>–<kbd>7</kbd> SAS modes',
    '<kbd>C</kbd> talk to Halcyon — the light lag is real · <kbd>[</kbd> <kbd>]</kbd> time warp · <kbd>N</kbd> horizon grid · <kbd>H</kbd> flight manual',
    '<kbd>U</kbd> leave the pilot seat and walk the ship · <kbd>J</kbd> nav computer · <kbd>V</kbd> chase camera · <kbd>`</kbd> codex',
  ] : sc.free ? [
    '<kbd>U</kbd> unbuckle and walk the ship · <kbd>E</kbd> interact · <kbd>F</kbd> flashlight · click to capture the mouse',
    '<kbd>J</kbd> nav computer: pick a world, set course · <kbd>Enter</kbd> undock · dock · land · take off',
    '<kbd>V</kbd> cockpit / clean / chase camera · <kbd>`</kbd> codex · <kbd>C</kbd> radio Halcyon · <kbd>H</kbd> flight manual',
  ] : ['<kbd>G</kbd> guidance · <kbd>T</kbd> waypoint · <kbd>N</kbd> horizon grid · <kbd>U</kbd> walk the ship · <kbd>H</kbd> flight manual'];
  hints.idx = 0; hints.next = performance.now() + 2500;
}
function startMission(name) {
  audio.init(); audio.resume(); voiceStop();
  const wantSky = Q.sky;
  if (skies.home && skies.home.width !== wantSky) { skies.home.dispose(); skies.home = makeSky(wantSky, 0, 1, Q.stars); }
  applySpin();
  setupScenario(name);
  setMode('flight');
  $('title').classList.add('fade'); setTimeout(() => $('title').classList.add('hidden'), 1400);
  $('hud').classList.remove('hidden');
  initPanels();
  const intro = name === 'mission' ? 'mission.lyra.intro' : SCEN[name].free ? 'free.lyra.start' : 'mission.lyra.intro.' + name;
  setTimeout(() => lyra('intro', intro, SCEN[name].free ? 'docked · Halcyon Station' : `r ${obs.r.toFixed(1)} M`), name === 'mission' ? 1200 : 900);
  audio.whoosh(1.6);
  sim.fovT = 0; ship.fov = 108;
  setTimeout(() => audio.boom(0.6), 1500);
}
function regenerateSky(u) {
  const rt = makeSky(1024, 2, 10 + u, 90000);
  if (skies.cur && skies.cur !== skies.home) skies.cur.dispose();
  skies.cur = rt; bhUniforms.uSkyA.value = rt.texture;
}
function showEnding(kind) {
  if (sim.endingShown) return;
  sim.endingShown = kind;
  if (document.pointerLockElement) document.exitPointerLock();
  const st = ship.stats;
  $('endKicker').textContent = kind === 'anti' ? 'MISSION COMPLETE' : 'TRANSIT COMPLETE';
  $('endTitle').textContent = kind === 'anti' ? 'THE OTHER SIDE' : `UNIVERSE ${ship.universe + 1}`;
  $('endText').innerHTML = kind === 'anti'
    ? 'You fell through the event horizon and the inner horizon of a rotating black hole, threaded its ring singularity, and emerged on the <b>r&nbsp;&lt;&nbsp;0 sheet</b> of the Kerr spacetime — a universe in which the hole has negative mass and gravity pushes. In any real black hole this region is almost certainly sealed off by the instability of the inner horizon. Your ship is indestructible, and the mathematics is exact.'
    : 'You crossed the horizon, turned back inside the inner horizon, and came out of a <b>white hole</b> into another universe — one of the infinite chain of exteriors in the maximally extended Kerr solution. Halcyon is not here. It never was.';
  const rows = [
    ['Proper time (your clock)', fmtClock(ship.tau)], ['Coordinate time t', fmtClock(ship.S[0])],
    ['Halcyon clock you saw at the horizon', sim.crossMC !== undefined ? mcClock(sim.crossMC) : '—'],
    ['Your last signal reaches Halcyon at', MC.tel.length ? mcClock(Math.max(...MC.tel.filter((t) => Number.isFinite(t.tRec)).map((t) => t.tRec))) : '—'],
    ['Halcyon will see you cross at', '∞ (never)'], ['Peak Lorentz factor', fmt(st.maxGamma, 3)], ['Peak proper acceleration', `${fmtSci(st.maxG, 2)} g`],
    ['Black hole spin a*', K.a.toFixed(3)], ['Mass', `${fmtSci(MSUN, 2)} M☉`],
  ];
  $('stats').innerHTML = rows.map(([k, v]) => `<div>${k}</div><div class="v">${v}</div>`).join('');
  $('ending').classList.remove('hidden');
  audio.bwaam();
  setTimeout(() => say(kind === 'anti' ? 'mission.end.anti' : 'mission.end.newverse', { priority: 'high' }), 1800);
}
$('endGo').onclick = () => {
  $('ending').classList.add('hidden'); audio.ui('confirm');
  if (sim.endingShown === 'anti') setTimeout(() => sayOnce('anti.lyra.free'), 1200);
};

// ─────────────────────────────── UI: title, options, help, pause ───────────────────────────────
function chipGroup(parent, label, opts, get, set) {
  const wrap = document.createElement('div'); wrap.className = 'opt';
  wrap.innerHTML = `<div class="ol">${label}</div><div class="chips"></div>`;
  const chips = wrap.lastChild;
  const draw = () => { chips.innerHTML = ''; for (const [v, t] of opts) { const c = document.createElement('div'); c.className = 'chip' + (get() === v ? ' on' : ''); c.textContent = t; c.onclick = () => { set(v); draw(); audio.ready && audio.ui('click'); }; chips.appendChild(c); } };
  draw(); parent.appendChild(wrap);
}
function buildOptions(parent, title) {
  parent.innerHTML = '';
  if (title) chipGroup(parent, 'BLACK HOLE SPIN a*', [[0.5, '0.50'], [0.9, '0.90'], [0.95, '0.95'], [0.99, '0.99'], [0.998, '0.998']], () => settings.spin, (v) => { settings.spin = v; applySpin(); setupScenario('attract'); });
  chipGroup(parent, 'QUALITY', [['low', 'LOW'], ['medium', 'MED'], ['high', 'HIGH'], ['ultra', 'ULTRA']], () => settings.quality, (v) => { settings.quality = v; Q = QUALITY[v]; dpr = Math.min(devicePixelRatio || 1, Q.dpr); view.scale = Q.scale; onResize(); });
  chipGroup(parent, 'DOPPLER', [[1, 'PHYSICAL'], [0.35, 'CINEMATIC']], () => settings.beaming, (v) => { settings.beaming = v; });
  chipGroup(parent, 'NEAR-HOLE SLOW-MO', [[true, 'AUTO'], [false, 'REAL TIME']], () => settings.slowmo, (v) => { settings.slowmo = v; });
  chipGroup(parent, 'VOICE', [[true, 'ON'], [false, 'OFF']], () => settings.voice, (v) => { settings.voice = v; if (!v) voiceStop(); });
  chipGroup(parent, 'MUSIC', [[true, 'ON'], [false, 'OFF']], () => settings.music, (v) => { settings.music = v; });
  if (!title) {
    chipGroup(parent, 'MOUSE Y', [[false, 'NORMAL'], [true, 'INVERT']], () => settings.invertY, (v) => { settings.invertY = v; });
    chipGroup(parent, 'SOUND', [[false, 'ON'], [true, 'MUTE']], () => settings.mute, (v) => { settings.mute = v; audio.setMute(v); });
  }
  chipGroup(parent, 'COMMANDER VOICE', [['A', 'A'], ['B', 'B']], () => settings.cmdrVoice, (v) => { settings.cmdrVoice = v; });
}
function buildTitle() {
  buildOptions($('titleOpts'), true);
  const j = $('jumps'); j.innerHTML = '<div style="width:100%;text-align:center;font-family:var(--disp);font-size:9.5px;letter-spacing:.3em;color:var(--cd);margin-bottom:2px">OR JUMP STRAIGHT TO</div>';
  for (const [k, s] of Object.entries(SCEN)) {
    if (s.hidden || k === 'mission') continue;
    const b = document.createElement('button'); b.className = 'btn2'; b.innerHTML = `${s.label}<div style="font-family:var(--ui);letter-spacing:.08em;font-size:11px;color:rgba(200,240,255,.6);margin-top:3px">${s.sub}</div>`;
    b.onclick = () => startMission(k); j.appendChild(b);
  }
  $('go').onclick = () => startMission('mission');
  $('goFree').onclick = () => startMission('free');
}
function buildHelp() {
  const H = [
    ['FLIGHT', ''], ['Mouse (click to capture)', 'pitch / yaw'], ['Arrow keys', 'pitch / yaw'], ['Q / E', 'roll'], ['W / S', 'throttle ±'], ['Z / X', 'full / cut throttle'],
    ['Shift', 'boost ×4'], ['Space (hold)', 'match local frame (brake)'], ['A D / R F', 'translate left-right / up-down'], ['Right mouse (hold)', 'free look · orbit chase cam'], ['Mouse wheel', 'zoom · chase distance'],
    ['V', 'view: cockpit · clean · chase camera'], ['Enter', 'undock · dock · land · take off'], ['\\', 'next landing site'], ['U', 'unbuckle and walk the ship'],
    ['NAVIGATION', ''], ['J', 'nav computer · system map · set course'], ['T / Y', 'next / previous waypoint'], ['G', 'guidance autopilot'], ['K', 'station-keeping (hover / hold on a world)'], ['B', 'radio-range beacon audio'], ['1 … 7', 'SAS: off·stab·pro·retro·target·radial in·out'],
    ['[ / ]', 'time warp'], ['O', 'orbit plot: side / top / off'], ['N', 'horizon grid overlay'],
    ['ON FOOT', ''], ['W A S D', 'walk · Shift sprint'], ['Mouse', 'look (click to capture)'], ['E', 'interact · sit in the pilot seat'], ['F', 'flashlight'], ['Space / Ctrl', 'jump / crouch'],
    ['EVA', ''], ['W A S D · Space / Ctrl', 'suit thrusters'], ['Q / E', 'roll'], ['Z', 'auto-damping on/off'],
    ['SHIP', ''], ['C', 'comms channel to Halcyon'], ['L', 'LYRA status report'], ['`', 'codex · ship log'], ['I', 'clock ticks (ship & Halcyon)'], ['Tab', 'hide HUD'], ['M', 'mute'], ['P', 'pause / options'],
    ['GAMEPAD', ''], ['Sticks', 'attitude · roll · lift'], ['RT / LT', 'throttle'], ['A · B · X · Y', 'guidance · comms · stab · target'],
  ];
  $('helpGrid').innerHTML = H.map(([a, b]) => (b ? `<div><span><kbd>${a}</kbd></span><span>${b}</span></div>` : `<div class="hd">${a}</div>`)).join('');
  $('helpClose').onclick = toggleHelp;
  buildOptions($('pauseOpts'), false);
  $('resume').onclick = () => togglePause(false);
  $('toTitle').onclick = () => {
    togglePause(false); voiceStop();
    if (ctx.surface && ctx.surface.active && ctx.surface.reset) { try { ctx.surface.reset(); } catch (e) { reportModuleError('surface.reset', e); } }
    resetWorldState(); applyShipVisibility();
    setMode('title'); $('hud').classList.add('hidden'); $('title').classList.remove('hidden', 'fade'); setupScenario('attract');
  };
}

// ─────────────────────────────── main loop ───────────────────────────────
view.scale = Q.scale;
const perf = { ema: 16.7, t: 0, frames: 0, fpsT: 0, fps: 0, good: 0 };
function resizeBH() {
  const w = Math.max(64, Math.round(innerWidth * dpr * view.scale)), h = Math.max(48, Math.round(innerHeight * dpr * view.scale));
  bhRT.setSize(w, h); upMat.uniforms.uTexel.value.set(1 / w, 1 / h);
}
function onResize() {
  renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false);
  composer.setPixelRatio(dpr); composer.setSize(innerWidth, innerHeight);
  lensPass.uniforms.uRes.value.set(innerWidth * dpr, innerHeight * dpr);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  resizeBH(); resizeHUD();
}
addEventListener('resize', onResize);
// camera pose comes from the active mode (ship space, metres); the ray tracer gets the same orientation
const CAM = { Fc: new Float64Array(4), Rc: new Float64Array(4), Uc: new Float64Array(4) };
const POSE = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), fov: 72 };
const _shakeE = new THREE.Euler(), _shakeQ = new THREE.Quaternion(), _ax1 = new THREE.Vector3(), _ax2 = new THREE.Vector3(), _ax3 = new THREE.Vector3();
// camera axes as body components (right, up, forward) — ship space is (x, y, −z) of the body frame
function poseAxes(q) {
  _ax1.set(0, 0, -1).applyQuaternion(q); _ax2.set(1, 0, 0).applyQuaternion(q); _ax3.set(0, 1, 0).applyQuaternion(q);
  return { F: [_ax1.x, _ax1.y, -_ax1.z], R: [_ax2.x, _ax2.y, -_ax2.z], U: [_ax3.x, _ax3.y, -_ax3.z] };
}
function currentPose() {
  const m = modeObj();
  let p = null;
  try { p = m && m.cameraPose ? m.cameraPose() : null; } catch (e) { reportModuleError('mode.cameraPose', e); }
  if (!p) p = MODES.flight.cameraPose();
  POSE.position.copy(p.position); POSE.quaternion.copy(p.quaternion); POSE.fov = p.fov || ship.fov;
  if (fx.shakeY || fx.shakeP) { _shakeE.set(fx.shakeP, -fx.shakeY, 0, 'YXZ'); _shakeQ.setFromEuler(_shakeE); POSE.quaternion.multiply(_shakeQ); }
  return POSE;
}
function render(dt) {
  const S = ship.S;
  const pose = currentPose();
  const ax = poseAxes(pose.quaternion);
  hud.ax = ax;
  for (let m = 0; m < 4; m++) {
    const f = S[8 + m], r = S[12 + m], u = S[16 + m];
    CAM.Fc[m] = ax.F[0] * r + ax.F[1] * u + ax.F[2] * f;
    CAM.Rc[m] = ax.R[0] * r + ax.R[1] * u + ax.R[2] * f;
    CAM.Uc[m] = ax.U[0] * r + ax.U[1] * u + ax.U[2] * f;
  }
  const U = bhUniforms;
  U.uCamPos.value.set(S[1], S[2], S[3]); U.uSheet.value = ship.sheet; U.uCamT.value = S[0];
  U.uU.value.set(S[4], S[5], S[6], S[7]);
  U.uEf.value.set(CAM.Fc[0], CAM.Fc[1], CAM.Fc[2], CAM.Fc[3]); U.uEr.value.set(CAM.Rc[0], CAM.Rc[1], CAM.Rc[2], CAM.Rc[3]); U.uEu.value.set(CAM.Uc[0], CAM.Uc[1], CAM.Uc[2], CAM.Uc[3]);
  const th = Math.tan((pose.fov * DEG) / 2);
  U.uTanHalf.value = th; U.uAspect.value = innerWidth / innerHeight;
  U.uResc.value = Math.max(70, 1.25 * Math.hypot(S[1], S[2], S[3]));
  U.uPix.value = (2 * th) / bhRT.height;
  U.uSteps.value = Q.steps; U.uStepK.value = Q.stepK;
  U.uGrid.value = settings.grid ? 0.9 : 0;
  U.uBeam.value = settings.beaming; U.uWall.value = sim.wall;
  U.uDiskT.value = 6200; U.uSkyGain.value = 0.32; U.uSkyGainB.value = 0.45; U.uHot.value = 1.0;
  renderer.setRenderTarget(bhRT); renderer.render(bhScene, fsCam); renderer.setRenderTarget(null);
  if (++view.meterFrame % 4 === 0) runMeter();
  // auto exposure: blend of geometric and arithmetic mean luminance
  const Lg = Math.exp(view.meterLog), La = 0.2126 * view.meterCol[0] + 0.7152 * view.meterCol[1] + 0.0722 * view.meterCol[2];
  const Lm = Math.pow(Math.max(La, 1e-7), 0.85) * Math.pow(Math.max(Lg, 1e-7), 0.15);
  const target = clamp(0.15 / Math.max(Lm, 1e-7), 0.02, 10);
  if (!view.fixedExposure) view.exposure = Math.exp(lerp(Math.log(view.exposure), Math.log(target), 1 - Math.exp(-dt * 1.4)));
  const ex = view.exposure;
  updateEnvLights(La, ex);
  camera.fov = pose.fov; camera.aspect = innerWidth / innerHeight; camera.position.copy(pose.position); camera.quaternion.copy(pose.quaternion); camera.updateProjectionMatrix();
  farCam.quaternion.copy(pose.quaternion); farCam.position.copy(pose.position); farCam.fov = pose.fov; farCam.aspect = camera.aspect; farCam.exposure = ex;
  farCam.bhSize[0] = bhRT.width; farCam.bhSize[1] = bhRT.height;
  farCam.skip = spaces.current === 'halcyon' || spaces.current === 'eurydice' ? spaces.current : ship.lock && ship.lock.kind === 'landed' ? ship.lock.body : null;
  upMat.uniforms.uGain.value = ex; // exposure is applied to the sky before compositing; near-scene lighting is absolute
  const L = lensPass.uniforms;
  L.uExposure.value = 1; L.uTime.value = sim.wall; L.uFlash.value = fx.flash; L.uFlashCol.value.setRGB(...fx.flashCol); L.uGlitch.value = fx.glitch;
  composer.render(dt);
  renderNavball();
}
// env key light = Erebus and its disk (shadowed, follows the apparent hole direction); faint hemisphere fill
const envLights = {};
function buildEnvLights() {
  envLights.hemi = new THREE.HemisphereLight(0x9adfff, 0x0b0d12, 0.05); mainScene.add(envLights.hemi);
  const kl = (envLights.key = new THREE.DirectionalLight(0xffd0a0, 0));
  kl.castShadow = true;
  kl.shadow.mapSize.set(settings.quality === 'low' ? 1024 : 2048, settings.quality === 'low' ? 1024 : 2048);
  Object.assign(kl.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 220 });
  kl.shadow.bias = -0.0004; kl.shadow.normalBias = 0.03;
  mainScene.add(kl); mainScene.add(kl.target);
}
function shipCenter() {
  const b = ctx.shipModel && ctx.shipModel.hull && ctx.shipModel.hull.bounds;
  return b ? b.getCenter(_ax1) : _ax1.set(0, 0, 16);
}
function updateEnvLights(La, ex) {
  const kl = envLights.key;
  if (!kl) return;
  const d = obs.radIn, c = shipCenter();
  kl.target.position.copy(c);
  kl.position.set(c.x + d[0] * 90, c.y + d[1] * 90, c.z - d[2] * 90);
  const mc = view.meterCol, mx = Math.max(mc[0], mc[1], mc[2], 1e-6);
  kl.color.setRGB(0.55 + 0.45 * mc[0] / mx, 0.55 + 0.45 * mc[1] / mx, 0.55 + 0.45 * mc[2] / mx);
  const proxy = ship.sheet > 0 ? (bhUniforms.uDisk.value > 0 ? 0.32 * Math.pow(30 / Math.max(Math.abs(obs.r), 1.5), 1.1) : 0.03) : 0.06;
  const closedIn = (ctx.surface && ctx.surface.active) || spaces.current === 'halcyon'; // surface brings its own sun; Halcyon's interior is self-lit
  kl.intensity = closedIn ? 0 : clamp(0.6 * proxy + 0.4 * La * 1.6 * ex, 0, 6);
  envLights.hemi.intensity = spaces.current === 'halcyon' ? 0.015 : 0.05;
  if (cockpitLights.inst) { // legacy cockpit fallback (only when the ship model failed to load)
    cockpitLights.inst.intensity = 0.4;
    cockpitLights.warn.intensity = audio.alarmOn ? 0.6 + 0.6 * Math.sin(sim.wall * 7) : 0;
    cockpitLights.accent.color.setRGB(0.05, 0.34, 0.6); cockpitLights.amber.color.setRGB(0.6, 0.2, 0.04);
    for (const sc of screens) sc.mat.color.setScalar(0.85);
  }
}
function updateFX(dt) {
  fx.flash *= Math.exp(-dt * 1.6); fx.glitch *= Math.exp(-dt * 1.3); fx.shake *= Math.exp(-dt * 1.1);
  const thrustShake = ship.accMag > 0.01 ? 0.0012 * clamp(ship.accMag / 0.35, 0, 3) : 0;
  const tideShake = 0.0015 * clamp(Math.log10(1 + obs.tidal) / 2, 0, 1);
  const amp = 0.006 * fx.shake + thrustShake + tideShake;
  const t = sim.wall;
  fx.shakeY = amp * (Math.sin(t * 31.7) * 0.6 + Math.sin(t * 57.3 + 1.3) * 0.4);
  fx.shakeP = amp * (Math.sin(t * 27.1 + 0.7) * 0.6 + Math.sin(t * 63.9) * 0.4);
}
function updateTypewriter(dt) {
  for (let i = typewriter.length - 1; i >= 0; i--) {
    const tw = typewriter[i];
    tw.i = Math.min(tw.text.length, tw.i + dt * tw.cps);
    tw.el.textContent = tw.text.slice(0, Math.floor(tw.i));
    if (tw.i >= tw.text.length) typewriter.splice(i, 1);
  }
}
const waveBuf = new Uint8Array(1024);
function drawWave() {
  const c = $('wave'), g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  if (!audio.ready) return;
  audio.analyser.getByteTimeDomainData(waveBuf);
  g.strokeStyle = 'rgba(255,176,77,0.9)'; g.lineWidth = 1.2; g.beginPath();
  for (let i = 0; i < 220; i++) { const v = (waveBuf[i * 4] - 128) / 128, x = (i / 219) * c.width, y = c.height / 2 + v * c.height * 1.6; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
}

// ═══════════════════════════ EXPANSION LAYER: modules · modes · spaces · nav · voice ═══════════════════════════
const moduleErrors = [];
function reportModuleError(where, e) { console.error('[ORPHEUS]', where, e); if (moduleErrors.length < 30) moduleErrors.push(`${where}: ${e && e.message}`); }
const bus = (() => {
  const m = new Map();
  return {
    on(e, f) { if (!m.has(e)) m.set(e, new Set()); m.get(e).add(f); },
    off(e, f) { if (m.has(e)) m.get(e).delete(f); },
    emit(e, p) { const s = m.get(e); if (s) for (const f of [...s]) { try { f(p); } catch (err) { reportModuleError('bus:' + e, err); } } },
  };
})();
let LINES = {};
let overlay = null;
const RADIO_WHO = new Set(['CAPCOM', 'FD', 'SCI', 'MIRA']);
const captionOf = (t) => String(t || '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
// scripted line → ElevenLabs voice (voice module; it falls back to caption + Web Speech per line) or, if the module is missing, caption only
function say(id, opts = {}) {
  if (!id) return;
  if (ctx.voice) { try { return ctx.voice.say(id, opts); } catch (e) { reportModuleError('voice.say', e); } }
  const L = LINES[id];
  if (!L) { console.warn('[ORPHEUS] no line', id); return; }
  sayText(L.who, L.text, opts);
}
function sayText(who, text, opts = {}) {
  if (ctx.voice && ctx.voice.sayText) { try { return ctx.voice.sayText(who, text, opts); } catch (e) { reportModuleError('voice.sayText', e); } }
  const cap = captionOf(text);
  const tag = who === 'LYRA' ? ['ai', 'LYRA'] : who === 'CMDR' ? ['me', 'ORPHEUS'] : RADIO_WHO.has(who) ? ['mc', 'HALCYON'] : ['sys', who];
  addLog(tag[0], tag[1], cap, opts.meta || '');
  if (sim.mode !== 'flight') ui.subtitle(tag[1], cap, 2500 + cap.length * 55);
}
function voiceStop() { if (ctx.voice) ctx.voice.stop(); }
function voiceBusy() { return !!(ctx.voice && ctx.voice.busy); }
function voiceRadioActive() { return !!(ctx.voice && ctx.voice.busy && RADIO_WHO.has(ctx.voice.curWho)); }
function sayOnce(id, opts) { if (!flags['said_' + id]) { flags['said_' + id] = 1; say(id, opts); return true; } return false; }
const ui = {
  toast, cine: showCine,
  prompt(html) { if (overlay) overlay.prompt(html); },
  subtitle(who, text, ms) { if (overlay) overlay.subtitle(who, text, ms); },
  log(cls, who, text, meta, opts) { addLog(cls, who, text, meta || '', opts || {}); },
  choose(title, options) { if (!ctx.dialogue) return Promise.resolve(null); if (document.pointerLockElement) document.exitPointerLock(); return ctx.dialogue.choose(title, options); },
  fade(toBlack, ms = 800) { return overlay ? overlay.fade(toBlack, ms) : Promise.resolve(); },
};

// ── navigation: destinations from the worlds module + Erebus features (mission waypoints) ──
const nav = { target: null, holdRef: null, cruise: false };
const NAVU = new Float64Array(4);
function featureReach(w) {
  const inside = ship.sheet > 0 && obs.r < K.rp, deep = ship.sheet > 0 && obs.r < K.rm;
  if (ship.universe > 0) return w.id === 'ESC' ? [true] : [false, 'another universe now'];
  if (ship.sheet < 0) return w.kind === 'anti' ? [true] : [false, 'no path back through the ring'];
  if (deep) return ['ring', 'anti'].includes(w.kind) ? [true] : [false, 'inside the inner horizon'];
  if (inside) return ['inner', 'ring', 'anti'].includes(w.kind) ? [true] : [false, 'inside the event horizon'];
  return [true];
}
function navFeatures() {
  const S = ship.S;
  return WPS.filter((w) => w.pos).map((w) => { const [reachable, why] = featureReach(w); return { id: w.id, name: w.name, kind: w.kind || 'point', reachable, why, done: w.done, dist: Math.hypot(w.pos[0] - S[1], w.pos[1] - S[2], w.pos[2] - S[3]) }; });
}
function findDest(id) {
  if (ctx.worlds) { try { const d = ctx.worlds.destinations().find((x) => x.id === id); if (d) return { d, t: () => ctx.worlds.target(id), line: 'nav.course.' + id }; } catch (e) { reportModuleError('worlds.destinations', e); } }
  const f = navFeatures().find((x) => x.id === id);
  if (f) return { d: f, t: () => WPS.find((w) => w.id === id), line: 'nav.course.erebus' };
  return null;
}
function setCourse(id, opts = {}) {
  const hit = findDest(id);
  if (!hit) return false;
  if (!hit.d.reachable) { say(ship.sheet < 0 ? 'nav.nopath.anti' : 'nav.noreturn'); toast('NO PATH · ' + String(hit.d.why || 'UNREACHABLE').toUpperCase()); audio.ui('deny'); return false; }
  if (ship.lock) { toast(ship.lock.kind === 'landed' ? 'TAKE OFF FIRST · <kbd>Enter</kbd>' : 'UNDOCK FIRST · <kbd>Enter</kbd>'); audio.ui('deny'); return false; }
  const t = hit.t();
  if (!t) return false;
  if (opts.site && ctx.worlds && ctx.worlds.setSite) ctx.worlds.setSite(id, opts.site);
  if (t.done) t.done = false;
  nav.target = t; nav.holdRef = null; nav.cruise = true;
  ship.hover = false; ship.guide = true; ship.sas = 'TGT';
  audio.ui('confirm'); toast('COURSE SET → ' + t.name); audio.beacon.next = 0;
  say(hit.line);
  return true;
}
function setTarget(id) {
  const hit = findDest(id);
  if (!hit) return false;
  const t = hit.t();
  if (!t) return false;
  nav.target = t; nav.cruise = false; ship.guide = false;
  audio.ui('select'); toast('TARGET → ' + t.name);
  return true;
}
function clearNav(silent) {
  const had = !!nav.target;
  nav.target = null; nav.holdRef = null; nav.cruise = false;
  if (ship.guide) ship.guide = false;
  if (ship.warp > 1) ship.warp = 1;
  if (had && !silent) say('nav.cancel');
}
function navUpdate() {
  const t = nav.target;
  if (!t) return;
  if (t.done) { nav.target = null; nav.cruise = false; if (ship.warp > 1) ship.warp = 1; return; }
  if (t.standoff === undefined || !ship.guide || (t.sheet || 1) !== ship.sheet) return;
  const S = ship.S, p = t.pos, X = [S[0], S[1], S[2], S[3]];
  const d = Math.hypot(p[0] - S[1], p[1] - S[2], p[2] - S[3]);
  t.refU(X, NAVU);
  const gam = Math.max(1, -gdot(X, ship.sheet, NAVU, S.subarray(4, 8)));
  const relB = Math.sqrt(1 - 1 / (gam * gam));
  if (Math.abs(d - t.standoff) < Math.max(0.12 * t.standoff, 3e-6) && relB < 0.004 && portReady(t)) {
    ship.guide = false; ship.hover = true; nav.holdRef = t; nav.cruise = false; ship.warp = 1;
    audio.ui('wp'); toast('ARRIVED · ' + t.name + ' · HOLDING STATION');
    bus.emit('arrive', { target: t });
    return;
  }
  if (nav.cruise) { // automatic time compression on long hauls, never close to the hole
    const far = d - t.standoff, nearHole = (ship.sheet > 0 && obs.r < 8) || (ship.sheet < 0 && Math.abs(obs.r) < 8);
    const want = nearHole ? 1 : far > 150 ? 60 : far > 40 ? 25 : far > 8 ? 10 : far > 1 ? 2 : 1;
    if (ship.warp !== want) ship.warp = want;
  }
}
// a docking port only counts as reached once the worlds module will accept the dock (its velocity tolerance is far tighter
// than the generic arrival test), so ARRIVED and the DOCK prompt appear together
function portReady(t) {
  if (t.standoff !== 0 || !ctx.worlds) return true;
  try { const a = ctx.worlds.contextAction(); return !!(a && a.body === t.id); } catch (e) { reportModuleError('worlds.contextAction', e); return true; }
}
function worldMarkers() {
  if (!ctx.worlds || !ctx.worlds.hudMarkers) return [];
  try { return ctx.worlds.hudMarkers() || []; } catch (e) { reportModuleError('worlds.hudMarkers', e); return []; }
}
function contextAction() {
  let a = null;
  try { a = ctx.worlds && ctx.worlds.contextAction(); } catch (e) { reportModuleError('worlds.contextAction', e); }
  if (!a) { toast('NOTHING TO DOCK WITH OR LAND ON HERE'); audio.ui('deny'); return; }
  clearNav(true);
  try { a.run(); } catch (e) { reportModuleError('contextAction.run', e); }
}
let ctxPromptKey = null;
function updateContextPrompt() {
  if (sim.mode !== 'flight') { ctxPromptKey = null; return; }
  let a = null;
  try { a = ctx.worlds && ctx.worlds.contextAction(); } catch (e) { a = null; }
  const html = a ? `<kbd>Enter</kbd> ${a.label}${a.cycle || ctx.worlds.cycleSite ? (a.label.startsWith('LAND') ? ' &nbsp;·&nbsp; <kbd>\\</kbd> next site' : '') : ''}` : null;
  if (html !== ctxPromptKey) { ctxPromptKey = html; ui.prompt(html); }
}

// ── modes: title · flight (seated: cockpit / clean / chase) · walk · eva (walk + eva come from src/ship/walk.js) ──
const MODES = {};
const flightView = { kind: 'cockpit', chaseYaw: 0.35, chasePitch: 0.2, chaseDist: 85 };
const POSEF = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), fov: 72 };
const _eul = new THREE.Euler(), _m4 = new THREE.Matrix4(), _cc = new THREE.Vector3(), UP_Y = new THREE.Vector3(0, 1, 0);
function modeObj() { return MODES[sim.mode] || null; }
function setMode(name, opts = {}) {
  if (!MODES[name]) { reportModuleError('setMode', new Error('no mode ' + name)); return false; }
  const prev = sim.mode, from = MODES[prev];
  if (prev !== name) { try { if (from && from.exit) from.exit(name); } catch (e) { reportModuleError('mode.exit', e); } }
  if (prev === 'flight' && name !== 'flight') ui.prompt(null); // the dock/land prompt belongs to the pilot seat
  sim.mode = name;
  try { if (MODES[name].enter) MODES[name].enter(opts); } catch (e) { reportModuleError('mode.enter', e); }
  applyHudMode();
  bus.emit('mode', { from: prev, to: name });
  return true;
}
function applyHudMode() {
  const hm = (MODES[sim.mode] && MODES[sim.mode].hud) || 'none';
  $('hud').classList.toggle('walk', hm === 'walk');
  if (overlay) overlay.crosshair(hm === 'walk');
  if (hm !== 'walk' && hm !== 'flight') ui.prompt(null);
  ctxPromptKey = undefined;
  applyShipVisibility();
}
function applyShipVisibility() {
  const clean = sim.mode === 'flight' && flightView.kind === 'clean';
  if (ctx.shipModel) ctx.shipModel.group.visible = !clean && spaces.current !== 'eurydice';
  else cockpit.visible = !clean;
  if (spaces.eurydice) spaces.eurydice.group.visible = spaces.current === 'eurydice';
  if (spaces.halcyon && spaces.halcyon.group) spaces.halcyon.group.visible = spaces.current === 'halcyon';
}
function cycleView() {
  const order = ['cockpit', 'clean', 'chase'];
  flightView.kind = order[(order.indexOf(flightView.kind) + 1) % order.length];
  if (flightView.kind === 'chase' && !ctx.shipModel) flightView.kind = 'cockpit';
  applyShipVisibility();
  toast({ cockpit: 'VIEW · COCKPIT', clean: 'VIEW · CLEAN (NO FRAME)', chase: 'VIEW · CHASE CAMERA · hold <kbd>RMB</kbd> to orbit · wheel zooms' }[flightView.kind]);
}
MODES.title = {
  name: 'title', hud: 'none',
  cameraPose() { POSEF.position.set(0, 0, 0); _eul.set(ship.head.pitch - 0.1, -ship.head.yaw, 0, 'YXZ'); POSEF.quaternion.setFromEuler(_eul); POSEF.fov = ship.fov; return POSEF; },
};
MODES.flight = {
  name: 'flight', hud: 'flight',
  enter(opts = {}) {
    ship.head.yaw = 0; ship.head.pitch = 0;
    if (opts.from === 'walk') { if (ctx.foley && ctx.foley.buckle) ctx.foley.buckle(); say(flags.satOnce ? 'ship.sit.2' : 'ship.sit', { priority: 'low' }); flags.satOnce = 1; }
  },
  exit() { input.stick = [0, 0]; },
  cameraPose() {
    if (flightView.kind === 'chase') {
      _cc.copy(shipCenter());
      const cy = Math.cos(flightView.chaseYaw), sy = Math.sin(flightView.chaseYaw), cp = Math.cos(flightView.chasePitch), sp = Math.sin(flightView.chasePitch);
      POSEF.position.set(_cc.x + flightView.chaseDist * cp * sy, _cc.y + flightView.chaseDist * sp, _cc.z + flightView.chaseDist * cp * cy);
      _m4.lookAt(POSEF.position, _cc, UP_Y); POSEF.quaternion.setFromRotationMatrix(_m4);
      POSEF.fov = 55;
      return POSEF;
    }
    POSEF.position.set(0, 0, 0);
    _eul.set(ship.head.pitch, -ship.head.yaw, 0, 'YXZ'); POSEF.quaternion.setFromEuler(_eul);
    POSEF.fov = ship.fov;
    return POSEF;
  },
  onKeyDown(e) {
    const dm = /^Digit([1-7])$/.exec(e.code);
    if (dm) { setSAS(SAS_MODES[+dm[1] - 1]); return; }
    switch (e.code) {
      case 'KeyT': cycleTarget(1); break;
      case 'KeyY': cycleTarget(-1); break;
      case 'KeyG': toggleGuide(); break;
      case 'KeyK': toggleHover(); break;
      case 'KeyB': audio.beacon.on = !audio.beacon.on; audio.beacon.next = 0; toast(audio.beacon.on ? 'RADIO RANGE BEACON ON · A (·−) left of course · N (−·) right · steady tone = on course' : 'BEACON AUDIO OFF'); break;
      case 'KeyV': cycleView(); break;
      case 'KeyN': settings.grid = !settings.grid; toast(settings.grid ? 'HORIZON GRID OVERLAY ON' : 'HORIZON GRID OFF'); break;
      case 'KeyO': hud.plotMode = (hud.plotMode + 1) % 3; break;
      case 'KeyZ': ship.throttle = 1; guideOff('MANUAL THROTTLE'); break;
      case 'KeyX': ship.throttle = 0; guideOff('MANUAL THROTTLE'); break;
      case 'KeyU': unbuckle(); break;
      case 'Enter': contextAction(); break;
      case 'Backslash': if (ctx.worlds && ctx.worlds.cycleSite) { ctx.worlds.cycleSite(); audio.ui('select'); ctxPromptKey = undefined; } break;
    }
  },
  onMouseMove(e) {
    if (input.rmb) {
      if (flightView.kind === 'chase') { flightView.chaseYaw -= e.movementX * 0.005; flightView.chasePitch = clamp(flightView.chasePitch + e.movementY * 0.005, -1.45, 1.45); return; }
      ship.head.yaw = clamp(ship.head.yaw + e.movementX * 0.004, -2.6, 2.6); ship.head.pitch = clamp(ship.head.pitch - e.movementY * 0.004, -1.35, 1.35); return;
    }
    if (!input.locked) return;
    const k = 0.0032 * settings.sens;
    input.stick[0] += e.movementX * k; input.stick[1] += (settings.invertY ? 1 : -1) * e.movementY * k;
    const l = Math.hypot(input.stick[0], input.stick[1]); if (l > 1) { input.stick[0] /= l; input.stick[1] /= l; }
    input.lastMove = performance.now();
  },
  onWheel(e) {
    if (flightView.kind === 'chase') flightView.chaseDist = clamp(flightView.chaseDist * Math.exp(e.deltaY * 0.0012), 22, 900);
    else ship.fov = clamp(ship.fov * Math.exp(e.deltaY * 0.0012), 18, 115);
  },
};
function unbuckle() {
  if (!MODES.walk || !ctx.shipModel) { toast('THE SHIP INTERIOR FAILED TO LOAD'); return; }
  if (flightView.kind !== 'cockpit') { flightView.kind = 'cockpit'; }
  spaces.current = 'orpheus';
  if (ctx.foley && ctx.foley.unbuckle) ctx.foley.unbuckle();
  setMode('walk', { space: ctx.shipModel.space, from: 'seat', seat: ctx.shipModel.seats.pilot });
  const n = (flags.unbuckles = (flags.unbuckles || 0) + 1);
  if (n <= 3) say(['ship.unbuckle', 'ship.unbuckle.2', 'ship.unbuckle.3'][n - 1], { priority: 'low' });
}

// ── walkable spaces: Orpheus · Eurydice (derelict sister ship) · Halcyon interior · planet surface ──
const spaces = { current: 'orpheus', eurydice: null, halcyon: null };
function v3(a) { return a ? new THREE.Vector3(a[0], a[1], a[2]) : null; }
async function enterSpace(id, entry = 'spawn') {
  let space = null, pos = null, yaw;
  await ui.fade(true, 450);
  try {
    if (id === 'orpheus') {
      space = ctx.shipModel.space;
      pos = entry === 'airlock' ? ctx.shipModel.airlock.inner : entry === 'ramp' ? ctx.shipModel.landing.rampTop : null;
    } else if (id === 'eurydice') {
      if (!spaces.eurydice) { spaces.eurydice = ctx.shipModel && (await import('./ship/model.js')).buildShip(ctx, { variant: 'eurydice' }); mainScene.add(spaces.eurydice.group); }
      space = spaces.eurydice.space; pos = spaces.eurydice.airlock.inner;
      if (!flags.eurEntered) { flags.eurEntered = 1; setTimeout(() => { say('eurydice.enter'); say('eurydice.sys.1'); }, 1200); ctx.codex.unlock('vessel.eurydice'); ctx.codex.unlock('person.tomas'); }
    } else if (id === 'halcyon') {
      if (!spaces.halcyon) { spaces.halcyon = ctx.halcyonMod.createHalcyonInterior(ctx); mainScene.add(spaces.halcyon.group); }
      space = spaces.halcyon.space;
    } else if (id === 'surface') {
      space = ctx.surface && ctx.surface.space;
    }
  } catch (e) { reportModuleError('enterSpace ' + id, e); }
  if (!space) { await ui.fade(false, 300); toast('CANNOT GO THERE'); return false; }
  spaces.current = id;
  setMode('walk', pos ? { space, from: 'pos', pos, yaw } : { space, from: 'spawn' });
  bus.emit('space', { id });
  const body = ship.lock && ship.lock.body;
  const pre = id === 'orpheus' ? ['ship.room.*', 'ship.obj.*', 'talk.lyra.*'] : id === 'eurydice' ? ['eurydice.*', 'eur.log.*'] : id === 'halcyon' ? ['halcyon.*'] : body ? [`world.${body}.*`, `log.${body}.*`] : [];
  if (ctx.voice && pre.length) ctx.voice.preload(pre).catch((e) => reportModuleError('voice.preload', e));
  await ui.fade(false, 650);
  return true;
}
async function startEva() {
  if (!MODES.eva || !ctx.shipModel) { toast('EVA SYSTEMS OFFLINE'); return; }
  if (ship.accMag > 0.01 || ship.guide) { toast('CUT THRUST AND AUTOPILOT BEFORE EVA'); audio.ui('deny'); return; }
  const al = ctx.shipModel.airlock;
  if (ctx.foley && ctx.foley.airlock) ctx.foley.airlock('cycle');
  await ui.fade(true, 600);
  spaces.current = 'eva';
  setMode('eva', { anchor: al.evaExit, hull: ctx.shipModel.hull, pos: al.evaExit, yaw: Math.PI / 2,
    interactables: [{ id: 'eva.airlock', label: 'Re-enter the airlock', pos: v3(al.evaExit), radius: 2.6, use: () => { enterSpace('orpheus', 'airlock'); sayOnce('eva.return'); } }] });
  bus.emit('eva', { on: true });
  await ui.fade(false, 700);
  if (!sayOnce('eva.start')) say('eva.suit', { priority: 'low' }); else setTimeout(() => say('eva.suit', { priority: 'low' }), 400);
}

// ── what the ship's interactables do (ids from the SHIP model; WALK/SHIP emit 'interact') ──
const LYRA_TOPICS = ['who', 'kerr', 'noreturn', 'time', 'ergo', 'horizon', 'inner', 'ring', 'antiverse', 'eurydice', 'halcyon', 'worlds', 'ship', 'afraid', 'beautiful', 'mira', 'myth'];
const MESSAGE_IDS = ['msg.mira.1', 'msg.mira.2', 'msg.mira.3', 'msg.mira.4', 'msg.elena.old', 'msg.fd.1', 'msg.jonah.1'];
const WHO_NAME = { MIRA: 'Mira', ELENA: 'Elena Varis', FD: 'Director Bell', CAPCOM: 'Jonah Reyes', SCI: 'Dr. Ilse Varga', TOMAS: 'Tomas Oyelaran' };
async function openMessages() {
  const opts = MESSAGE_IDS.map((id) => ({ label: (LINES[id] && LINES[id].title) || id, sub: WHO_NAME[LINES[id] && LINES[id].who] || '', done: !!flags['heard_' + id] }));
  opts.push({ label: 'Close terminal' });
  const k = await ui.choose('PERSONAL MESSAGES', opts);
  if (k === null || k >= MESSAGE_IDS.length) return;
  const id = MESSAGE_IDS[k];
  flags['heard_' + id] = 1; say(id, { priority: 'high' }); ctx.codex.unlock('log.' + id);
}
async function talkToLyra() {
  const ids = LYRA_TOPICS.map((t) => 'talk.lyra.' + t);
  const opts = ids.map((id) => ({ label: (LINES[id] && LINES[id].q) || id.slice(10), done: !!flags['heard_' + id] }));
  opts.push({ label: 'That\u2019s all for now' });
  const k = await ui.choose('LYRA', opts);
  if (k === null || k >= ids.length) return;
  flags['heard_' + ids[k]] = 1; say(ids[k], { priority: 'high' });
}
async function sleepMenu() {
  if ((ship.sheet > 0 && obs.r < K.rp) || (ship.sheet > 0 && obs.r < 4 && !ship.lock)) { toast('NOT HERE · NOT NOW'); audio.ui('deny'); return; }
  const k = await ui.choose('REST', [{ label: 'Sleep one hour' }, { label: 'Sleep eight hours' }, { label: 'Not now' }]);
  if (k !== 0 && k !== 1) return;
  await skipTime(k === 0 ? 3600 : 28800);
  say('ship.sleep.wake');
}
// fast-forward proper time behind a black screen (physics, orbits and Halcyon's clock all advance)
async function skipTime(sec) {
  await ui.fade(true, 1100);
  const w0 = ship.warp, wantTau = ship.tau + sec;
  ship.warp = 1;
  let guard = 0;
  while (ship.tau < wantTau - 1e-6 && guard++ < 4000) {
    const chunk = Math.min(wantTau - ship.tau, ship.lock ? 600 : 40);
    if (ship.lock) advanceLocked(chunk);
    else { ship.warp = chunk / 0.05; advancePhysics(0.05); ship.warp = 1; }
    observe();
    if (guard % 25 === 0) await new Promise((r) => requestAnimationFrame(r));
  }
  ship.warp = w0;
  const T = mcEmitT();
  MC.pending = MC.pending.filter((p) => p.at > T); // what Halcyon said while we slept is in the log, not in our ears
  MC.idx = MC.tel.length;
  await ui.fade(false, 1400);
}
async function airlockPanel() {
  const lk = ship.lock;
  if (spaces.current === 'eurydice') return enterSpace('orpheus', 'airlock');
  if (lk && lk.kind === 'docked') return enterSpace(lk.body === 'eurydice' ? 'eurydice' : 'halcyon', 'airlock');
  if (lk && lk.kind === 'landed') return enterSpace('surface', 'ramp');
  return startEva();
}
const INTERACT = {
  'seat.systems': () => sayOnce('ship.obj.systems'),
  'quarters.terminal': openMessages,
  'quarters.photo': () => say('ship.obj.photo'),
  'quarters.bunk': sleepMenu,
  'galley.coffee': () => { if (ctx.foley && ctx.foley.beep) ctx.foley.beep('coffee'); sayOnce('ship.obj.coffee'); },
  'galley.plant': () => say('ship.obj.plant'),
  'galley.window': () => sayOnce('ship.obj.window'),
  'dome.view': () => { sayOnce('ship.obj.window'); ctx.codex.unlock('erebus.disk'); },
  'lab.gravimeter': () => say('ship.obj.gravimeter'),
  'lab.spectrometer': () => say('ship.obj.spectrometer'),
  'lab.display': () => say('ship.obj.display'),
  'medbay.pod': () => sayOnce('ship.obj.medpod'),
  'core.lyra': talkToLyra,
  'airlock.suit': () => sayOnce('ship.obj.suit'),
  'airlock.panel': airlockPanel,
  'cargo.probes': () => sayOnce('ship.obj.probes'),
  'cargo.ramp': () => (ship.lock && ship.lock.kind === 'landed' ? enterSpace('surface', 'ramp') : (toast('RAMP SEALED · WE ARE IN VACUUM'), audio.ui('deny'))),
  'engineering.drive': () => say('ship.obj.drive'),
  'engineering.console': () => sayOnce('ship.obj.console'),
  'flightdeck.plaque': () => sayOnce('ship.obj.plaque'),
  'eur.core': () => say('eurydice.obj.core'),
  'eur.photo': () => say('eurydice.obj.photo'),
};
const lastInteract = { id: '', t: 0 };
function onInteract({ id }) {
  const now = performance.now();
  if (id === lastInteract.id && now - lastInteract.t < 250) return; // walk + model may both report one press
  lastInteract.id = id; lastInteract.t = now;
  const m = /^eur\.log\.(\d)$/.exec(id);
  if (m) { say(id, { priority: 'high' }); ctx.codex.unlock('log.' + id); return; }
  const f = INTERACT[id];
  if (f) Promise.resolve(f()).catch((e) => reportModuleError('interact ' + id, e));
}
function onRoom({ space, room, name }) {
  if (overlay && name) overlay.toastRoom(name, space === 'orpheus' ? 'ORPHEUS' : space === 'eurydice' ? 'EURYDICE · HX-01' : space === 'halcyon' ? 'HALCYON STATION' : undefined);
  if (space === 'orpheus') sayOnce('ship.room.' + room, { priority: 'low' });
  else if (space === 'eurydice') sayOnce('eurydice.room.' + room, { priority: 'low' });
}
bus.on('interact', onInteract);
bus.on('room', onRoom);
// leaving a lock: hold station on the world we just climbed away from (a bare hover would brake to the hole's frame and let
// the planet sail off at its orbital speed); after undocking, coast beside the station on its orbit
bus.on('takeoff', ({ body } = {}) => {
  const t = ctx.worlds && body ? ctx.worlds.target(body) : null;
  nav.holdRef = t; ship.hover = !!t; ship.guide = false;
});
bus.on('undock', () => { nav.holdRef = null; ship.hover = false; });
// story beats that depend on where we are and what we look at
const _story = { negSince: null };
function storyUpdate() {
  if (ship.sheet < 0 && ship.universe === 0) {
    if (_story.negSince === null) _story.negSince = ship.tau;
    if (ship.tau - _story.negSince > 25 && Math.abs(obs.r) > 10) sayOnce('anti.lyra.gravity', { priority: 'low' });
    const ax = hud.ax;
    if (ax && Math.abs(obs.r) > 12 && ax.F[0] * obs.bhApp[0] + ax.F[1] * obs.bhApp[1] + ax.F[2] * obs.bhApp[2] > 0.93) sayOnce('anti.lyra.ringview', { priority: 'low' });
  } else _story.negSince = null;
}
bus.on('voice-end', ({ id } = {}) => {
  if (id === 'log.elysium.1') setTimeout(() => sayOnce('cmdr.camp.reply', { priority: 'high' }), 2500);
});
// codex entries that unlock from who/what you hear
bus.on('say', ({ id, who } = {}) => {
  if (!id) return;
  if (/^SURVEY_/.test(who || '')) ctx.codex.unlock('person.survey');
  if (who === 'TOMAS') ctx.codex.unlock('person.tomas');
  if (id === 'eur.log.4' || id === 'eur.log.5' || id.startsWith('log.elysium.')) ctx.codex.unlock('vessel.lantern');
});

// ── LYRA's occasional remarks when nothing is happening ──
const idle = { next: 150, used: {} };
const IDLE_POOLS = { 'idle.ship': 6, 'idle.flight': 4, 'idle.antiverse': 3, 'idle.surface': 3 };
function idleUpdate(dt) {
  if (voiceBusy() || audio.alarmOn) { idle.next = Math.max(idle.next, 45); return; }
  idle.next -= dt;
  if (idle.next > 0) return;
  idle.next = 160 + Math.random() * 160;
  if (ship.sheet > 0 && obs.r < 3.5 && !ship.lock) return;
  const pool = spaces.current === 'surface' && sim.mode === 'walk' ? 'idle.surface' : ship.sheet < 0 ? 'idle.antiverse' : sim.mode === 'walk' && spaces.current === 'orpheus' ? 'idle.ship' : sim.mode === 'flight' ? 'idle.flight' : null;
  if (!pool) return;
  const free = [];
  for (let i = 1; i <= IDLE_POOLS[pool]; i++) if (!idle.used[pool + '.' + i]) free.push(pool + '.' + i);
  if (!free.length) return;
  const id = free[Math.floor(Math.random() * free.length)];
  idle.used[id] = 1;
  say(id, { priority: 'low' });
}
function updateModules(dt) {
  const sm = ctx.shipModel;
  const feet = sim.mode === 'walk' && MODES.walk && MODES.walk.state ? MODES.walk.state.feet : null; // doors open for the walker's feet
  if (sm) {
    try {
      sm.setThrust(clamp(ship.accMag / 0.35, 0, 1.5), ship.boost);
      const mode = audio.alarmOn ? 'alert' : 'normal';
      if (mode !== updateModules.lights) { updateModules.lights = mode; sm.interiorLights(mode); }
      sm.update(dt, sim.wall, spaces.current === 'eurydice' ? null : feet);
    } catch (e) { reportModuleError('shipModel.update', e); }
  }
  if (spaces.eurydice && spaces.current === 'eurydice') try { spaces.eurydice.update(dt, sim.wall, feet); } catch (e) { reportModuleError('eurydice.update', e); }
  if (ctx.surface && ctx.surface.active) try { ctx.surface.setIndoors(spaces.current === 'surface' ? 0 : 1); ctx.surface.update(dt); } catch (e) { reportModuleError('surface.update', e); }
  if (ctx.voice && ctx.voice.update) try { ctx.voice.update(dt); } catch (e) { reportModuleError('voice.update', e); }
}

const ctx = {
  THREE, renderer, scenes: { near: mainScene }, cameras: { near: camera }, view, settings, K, ship, obs, sim, MC,
  kerr: { ksR, ksPoint, mparts, gdot, gdotP, lowerInto, eulerianInto, staticInto, zamoInto, refObserverInto, orthonormalize, restDir, toBody, apparentBody, faceBody, placeShip, observe, rErgo, christoffel, gamUV },
  units: { DEG, KM_PER_M, G_PER_ACC, MSUN },
  audio, say, sayText, mcReact, ui, bus, fx,
  modes: { set: setMode, current: () => sim.mode },
  input: { keys, locked: () => input.locked, requestLock: () => canvas.requestPointerLock && canvas.requestPointerLock() },
  flags: { once: flagOnce, get: (k) => flags[k], set: (k, v) => { flags[k] = v; } },
  codex: { unlock: (id) => { if (ctx.codexUI) ctx.codexUI.unlock(id); }, isUnlocked: (id) => !!(ctx.codexUI && ctx.codexUI.isUnlocked(id)) },
  nav: { setCourse, setTarget, clear: () => clearNav(false), current: () => nav.target },
  spaces: { enter: enterSpace, current: () => spaces.current },
  get bhTex() { return bhRT.texture; }, get bhSize() { return [bhRT.width, bhRT.height]; },
  hudPred: () => hud.pred, navFeatures,
  worlds: null, surface: null, shipModel: null, halcyonMod: null, voice: null, navComputer: null, codexUI: null, dialogue: null, foley: null,
};
async function loadModules() {
  const imp = async (p) => { try { return await import(p); } catch (e) { reportModuleError('import ' + p, e); return null; } };
  const init = (name, fn) => { try { return fn() || null; } catch (e) { reportModuleError('init ' + name, e); return null; } };
  const [linesM, voiceM, overlayM, dialogueM, codexM, navM, shipM, walkM, foleyM, worldsM, surfaceM, halcyonM] = await Promise.all([
    imp('./voice/lines.js'), imp('./voice/voice.js'), imp('./ui/overlay.js'), imp('./ui/dialogue.js'), imp('./ui/codex.js'), imp('./ui/navmap.js'),
    imp('./ship/model.js'), imp('./ship/walk.js'), imp('./audio/foley.js'), imp('./world/space.js'), imp('./world/surface.js'), imp('./world/halcyon.js'),
  ]);
  if (linesM) LINES = linesM.LINES || {};
  if (overlayM) overlay = init('overlay', () => overlayM.createOverlay());
  if (dialogueM) ctx.dialogue = init('dialogue', () => dialogueM.createDialogue(ctx));
  if (codexM) ctx.codexUI = init('codex', () => codexM.createCodex(ctx));
  if (voiceM) ctx.voice = init('voice', () => voiceM.createVoice(ctx));
  if (foleyM) ctx.foley = init('foley', () => foleyM.createFoley(ctx));
  if (shipM) { // ~1-3 s on first build (textures): yield between parts so the loading line stays alive
    try { ctx.shipModel = await shipM.buildShipAsync(ctx, { variant: 'orpheus' }, (p) => { $('loadmsg').textContent = `building ORPHEUS · ${Math.round(p * 100)}%`; }); } catch (e) { reportModuleError('init ship', e); ctx.shipModel = null; }
  }
  if (ctx.shipModel) { mainScene.add(ctx.shipModel.group); screens.length = 0; for (const s of ctx.shipModel.screens) if (s.id <= 2) screens.push(s); }
  else buildCockpit();
  if (walkM) { MODES.walk = init('walk', () => walkM.createWalkMode(ctx)); MODES.eva = init('eva', () => walkM.createEvaMode(ctx)); }
  if (worldsM) ctx.worlds = init('worlds', () => worldsM.createWorlds(ctx));
  if (surfaceM) ctx.surface = init('surface', () => surfaceM.createSurface(ctx));
  if (halcyonM) ctx.halcyonMod = halcyonM;
  if (navM) ctx.navComputer = init('nav', () => navM.createNavComputer(ctx));
  for (const k of Object.keys(MODES)) if (!MODES[k]) delete MODES[k];
  if (moduleErrors.length) console.warn('[ORPHEUS] module problems:\n' + moduleErrors.join('\n'));
}

let lastT = performance.now(), panelT = 0, screenT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const rawMs = now - lastT; lastT = now;
  const dt = clamp(rawMs / 1000, 0, 0.05);
  sim.wall += dt;
  perf.ema = lerp(perf.ema, rawMs, 0.05);
  if (settings.autoRes && now - perf.t > 700) {
    perf.t = now;
    if (perf.ema > 21 && view.scale > 0.3) { view.scale = Math.max(0.3, view.scale * 0.88); resizeBH(); perf.good = 0; }
    else if (perf.ema < 17.6 && view.scale < Q.scale) { if (++perf.good > 3) { view.scale = Math.min(Q.scale, view.scale * 1.06); resizeBH(); } }
    else perf.good = 0;
  }
  pollGamepad(dt);
  if (sim.mode !== 'title') {
    if (!ship.paused) {
      updateAttitude(dt, sim.mode === 'flight' && !overlayOpen());
      const dtau = advancePhysics(dt);
      if (ctx.worlds && !ship.lock) { try { if (ctx.worlds.collide(ship.S, ship.sheet)) flagOnce('collide', () => lyra(null, 'nav.collide')); } catch (e) { reportModuleError('worlds.collide', e); } }
      observe();
      if (ctx.worlds) { try { ctx.worlds.update(dt); } catch (e) { reportModuleError('worlds.update', e); } }
      navUpdate();
      missionUpdate(dt);
      storyUpdate();
      mcTelemetry(); mcUpdate();
      hud.predT -= dt; if (hud.predT <= 0) { predict(); hud.predT = 0.4; }
      audio.update(dt, { thrust: ship.accMag / 0.35, boost: ship.boost, tidal: obs.tidal, grav: ship.sheet > 0 ? clamp(2.2 / Math.max(obs.r, 0.5), 0, 1) : 0.4, dilate: clamp(1 - obs.dtaudt, 0, 1) * 0.25, dtau, warp: ship.warp, mcRate: MC.connected ? obs.mcRate : 0, tickOn: settings.ticks && sim.mode === 'flight', radioActivity: voiceRadioActive() ? 1 : 0 });
      updateNavball();
      const m = modeObj();
      if (m && m.update) { try { m.update(dt); } catch (e) { reportModuleError('mode.update', e); } }
      updateModules(dt);
      idleUpdate(dt);
      updateContextPrompt();
      if (sim.mode === 'flight' && sim.fovT !== undefined && sim.fovT < 1) { sim.fovT = Math.min(1, sim.fovT + dt / 4.5); const e = sim.fovT * sim.fovT * (3 - 2 * sim.fovT); ship.fov = lerp(108, 72, e); }
    }
  } else {
    updateAttitude(dt, false); advancePhysics(dt); observe();
    if (ctx.worlds) { try { ctx.worlds.update(dt); } catch (e) { reportModuleError('worlds.update', e); } }
    if (audio.ready) audio.update(dt, { thrust: 0, boost: false, tidal: 0, grav: 0, dilate: 0, dtau: 0, warp: 1, mcRate: 0, tickOn: false, radioActivity: 0 });
  }
  updateFX(dt); updateTypewriter(dt);
  render(dt);
  drawHUD(dt);
  panelT -= dt; screenT -= dt;
  if (sim.mode !== 'title' && panelT <= 0) { hud.panelDt = 0.1 - panelT; panelT = 0.1; updatePanels(); drawWave(); }
  if (sim.mode !== 'title' && screenT <= 0) { screenT = 0.15; updateScreens(); }
  if (URLP.has('debug') && (perf.frames++ % 15 === 0)) $('fps').textContent = `${(1000 / perf.ema).toFixed(0)} fps · bh ${bhRT.width}×${bhRT.height} · steps ${Q.steps} · exp ${view.exposure.toFixed(3)} · ${sim.mode}`;
}

// ─────────────────────────────── boot ───────────────────────────────
async function boot() {
  onResize();
  buildEnvLights(); buildNavball(); initPanels(); buildHelp(); buildTitle();
  applySpin();
  $('loadmsg').textContent = 'synthesizing 150,000 stars and two universes…';
  await new Promise((r) => setTimeout(r, 30));
  skies.home = makeSky(Q.sky, 0, 1, Q.stars);
  skies.anti = makeSky(1024, 1, 2, 70000);
  bhUniforms.uSkyA.value = skies.home.texture; bhUniforms.uSkyB.value = skies.anti.texture;
  $('loadmsg').textContent = 'building Orpheus, Halcyon and the worlds of Erebus…';
  await loadModules();
  // a dropped connection during the first load (~200 module files) leaves the game half-built: reload once; a module that is
  // genuinely broken (syntax error, missing file) fails again and is then reported, with no reload loop
  const store = (() => { try { return window.sessionStorage; } catch { return null; } })(); // blocked storage → no auto-reload
  if (store && moduleErrors.some((m) => /^import .*(Failed to fetch|error loading|Importing a module script failed)/i.test(m)) && !store.getItem('orpheus.reloaded')) {
    store.setItem('orpheus.reloaded', '1'); $('loadmsg').textContent = 'network hiccup · reloading…'; location.reload(); return;
  }
  if (store) store.removeItem('orpheus.reloaded');
  buildTitle();
  setupScenario('attract');
  setMode('title');
  $('go').disabled = false; $('goFree').disabled = false;
  $('loadmsg').textContent = moduleErrors.length ? `ready (${moduleErrors.length} module warning${moduleErrors.length > 1 ? 's' : ''} — see console)` : 'ready · ENTER begins the descent';
  requestAnimationFrame(frame);
  window.__kerr = { ship, obs, K, settings, view, sim, WPS: () => WPS, startMission, setupScenario, placeShip, bhRT, perf, MC, fx, Q: () => Q, ctx, nav, spaces, setMode, enterSpace, flightView, moduleErrors, LINES: () => LINES, say };
  if (URLP.has('autostart')) startMission(URLP.get('autostart') || 'mission');
}
boot().catch((e) => { console.error(e); fatal('Startup failed: ' + e.message); });

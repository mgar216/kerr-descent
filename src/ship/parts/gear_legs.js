// Landing legs (4): telescoping struts + secondary brace + swing actuator, swivel foot pads. Moving parts are InstancedMeshes (one set for
// all four legs); static bays / doors live in gear_bays.js. Maintains kit.state.legDeploy (0 stowed … 1 down) from kit.state.landed.
import * as THREE from 'three';
import { loftProfile } from './builder.js';
import { Part, telescope, D2R, sstep, lerp } from './gear_util.js';
import bays from './gear_bays.js';

const V3 = THREE.Vector3, Q = THREE.Quaternion, M4 = THREE.Matrix4;
const RET = 1.85;                 // stowed reach hinge → ankle ball (m)
const PB = 0.22;                  // ankle ball height above the pad underside
const DOOR_MAX = 96 * D2R;
const BRACE = { th: 38, dz: 1.9, sA: 1.15, lz: 0.31, rT: 0.075, rR: 0.05 };    // secondary (drag) brace: hull anchor (corner angle, along-z) + strut attach
const ACT = { th: 25, dz: 1.25, sA: 0.60, lz: 0.28, rT: 0.062, rR: 0.043 };    // swing actuator

// geometry + kinematic constants of one leg (corner-polar frame of the hull chine it folds into)
function legData(kit, lg) {
  const L = kit.L, prof = loftProfile(L.HULL_STATIONS, lg.hinge[2]);
  const s = lg.side, fz = lg.hinge[2] < 20 ? 1 : -1;                      // fz: direction the folded strut lies along z
  const R = Math.min(prof.rc, prof.w * 0.98, (prof.top - prof.bot) * 0.49), c0x = s * (prof.w - R), c0y = prof.bot + R;
  const H = new V3(...lg.hinge), Bd = new V3(lg.foot[0], lg.foot[1] + PB, lg.foot[2]);
  const hx = H.x - c0x, hy = H.y - c0y, thH = Math.atan2(Math.abs(hx), -hy);
  const nOut = new V3(s * Math.sin(thH), -Math.cos(thH), 0);              // skin normal at the hinge (outward/down)
  const dDep = Bd.clone().sub(H), Ldep = dDep.length(); dDep.normalize();
  const dRet = new V3(0, 0, fz).addScaledVector(nOut, -0.035).normalize();
  const axis = new V3().crossVectors(dRet, dDep).normalize(), psi = Math.acos(dRet.dot(dDep));
  const cp = (th, r, z) => new V3(c0x + s * r * Math.sin(th), c0y - r * Math.cos(th), z);
  const d = { id: lg.id, s, fz, H, Bd, foot: new V3(...lg.foot), c0x, c0y, R, thH, nOut, dDep, dRet, Ldep, axis, psi, cp,
    qPadRet: new Q().setFromUnitVectors(new V3(0, 1, 0), nOut.clone().negate()) };
  d.Kb = cp(BRACE.th * D2R, R + 0.06, H.z + fz * BRACE.dz); d.Ka = cp(ACT.th * D2R, R + 0.06, H.z + fz * ACT.dz);
  return d;
}

function buildParts(kit) {
  const A = new Part(kit), B = new Part(kit), C = new Part(kit);
  // strut outer cylinder (local: origin = hinge, strut along −Y, pin along X)
  A.cyl('darkMetal', [0, 0, 0], 0.25, 0.56, { axis: 'x', seg: 28 }).cyl('darkMetal', [0, 0, 0], 0.17, 0.64, { axis: 'x', seg: 20 });
  A.box('darkMetal', [0, -0.2, 0], [0.48, 0.34, 0.4], { bev: 0.03 });
  A.cyl('paintWhite', [0, -0.84, 0], 0.205, 1.16, { rb: 0.212, rt: 0.205, seg: 28 });
  A.cyl('paintOrange', [0, -0.47, 0], 0.216, 0.07, { seg: 28 }).cyl('paintOrange', [0, -0.64, 0], 0.216, 0.03, { seg: 28 });
  for (const sx of [-1, 1]) A.box(kit.eur ? 'screenOff' : 'emitCyan', [sx * 0.208, -0.9, 0], [0.012, 0.62, 0.028], { bev: 0 });
  A.cyl('darkMetal', [0, -0.3, 0], 0.235, 0.06, { seg: 28 }).cyl('darkMetal', [0, -1.43, 0], 0.255, 0.17, { seg: 28 });
  A.box('darkMetal', [0, -1.15, 0.23], [0.26, 0.22, 0.14], { bev: 0.02 }).cyl('darkMetal', [0, -1.15, 0.31], 0.055, 0.34, { axis: 'x', seg: 12 });
  A.box('darkMetal', [0, -0.6, 0.21], [0.24, 0.18, 0.12], { bev: 0.02 }).cyl('darkMetal', [0, -0.6, 0.28], 0.05, 0.32, { axis: 'x', seg: 12 });
  // piston (origin = ankle ball, rod runs up +Y into the cylinder)
  B.cyl('steel', [0, 0.95, 0], 0.135, 1.9, { seg: 24 });
  B.sphere('darkMetal', [0, 0, 0], 0.18, { seg: 18 }).cyl('darkMetal', [0, 0.2, 0], 0.16, 0.26, { rb: 0.175, rt: 0.155, seg: 20 }).cyl('darkMetal', [0, 0.36, 0], 0.17, 0.04, { seg: 20 });
  // foot pad (origin = underside centre, +Y up)
  C.cyl('rubber', [0, 0.0175, 0], 0.52, 0.035, { seg: 36 });
  C.cyl('darkMetal', [0, 0.0775, 0], 0.5, 0.085, { rb: 0.56, rt: 0.43, seg: 36 }).cyl('darkMetal', [0, 0.13, 0], 0.4, 0.02, { seg: 28 });
  C.cyl('darkMetal', [0, 0.165, 0], 0.2, 0.07, { seg: 20 });
  C.torus('paintOrange', [0, 0.07, 0], 0.545, 0.013, { tube: 6, seg: 44 });
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; C.between('darkMetal', [0.38 * Math.cos(a), 0.14, 0.38 * Math.sin(a)], [0.13 * Math.cos(a), 0.21, 0.13 * Math.sin(a)], 0.03, { box: true, bev: 0.006 }); }
  for (const sx of [-1, 1]) C.box('darkMetal', [sx * 0.17, 0.2, 0], [0.05, 0.14, 0.22], { bev: 0.01 });
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.78; C.box(kit.eur && k !== 2 ? 'screenOff' : (kit.eur ? 'ledAmberBlink' : 'emitCyan'), [0.5 * Math.cos(a), 0.075, 0.5 * Math.sin(a)], [0.05, 0.028, 0.05], { bev: 0, quat: new Q().setFromAxisAngle(new V3(0, 1, 0), -a) }); }
  return { A: A.instanced(4, 'gear.strut'), B: B.instanced(4, 'gear.piston'), C: C.instanced(4, 'gear.pad') };
}

export default function legs(kit) {
  const st = kit.state, L = kit.L, eur = kit.eur;
  const data = L.LEGS.map((lg) => legData(kit, lg));
  const P = buildParts(kit);
  const links = telescope(kit, 8, 'gear.link');                 // [leg*2] brace, [leg*2+1] actuator
  const doors = bays(kit, data, { DOOR_MAX });                  // static bays + door meshes (returns [{ g, set(angle) }])
  const cols = data.map((d) => ({
    pad: kit.colCyl([d.foot.x, d.foot.y + 0.16, d.foot.z], 0.5, 0.32),
    str: kit.colCyl([lerp(d.foot.x, d.H.x, 0.3), d.foot.y + 0.9, lerp(d.foot.z, d.H.z, 0.3)], 0.3, 1.8),
  }));

  let raw = Math.min(1, Math.max(0, st.legDeploy || (st.landed ? 1 : 0))), lastU = -1;
  const ONE = new V3(1, 1, 1), IDQ = new Q();
  const dir = new V3(), X = new V3(), Y = new V3(), Z = new V3(), Bp = new V3(), P0 = new V3(), Mp = new V3(), tmp = new V3();
  const m4 = new M4(), mat = new M4(), qS = new Q(), qP = new Q();

  function pose(u) {
    const w = sstep(0.14, 0.78, u), e = sstep(0.42, 1.0, u), pl = sstep(0.25, 0.95, u), dopen = sstep(0.0, 0.3, u);
    data.forEach((d, i) => {
      dir.copy(d.dRet).applyAxisAngle(d.axis, d.psi * w);
      X.copy(d.axis); Y.copy(dir).negate(); Z.crossVectors(X, Y);
      qS.setFromRotationMatrix(m4.makeBasis(X, Y, Z));
      P.A.set(i, mat.compose(d.H, qS, ONE));
      Bp.copy(d.H).addScaledVector(dir, lerp(RET, d.Ldep, e));
      P.B.set(i, mat.compose(Bp, qS, ONE));
      qP.slerpQuaternions(d.qPadRet, IDQ, pl);
      P0.copy(Bp).sub(tmp.set(0, PB, 0).applyQuaternion(qP));
      P.C.set(i, mat.compose(P0, qP, ONE));
      for (const [k, K, S] of [[0, d.Kb, BRACE], [1, d.Ka, ACT]]) {
        Mp.copy(d.H).addScaledVector(dir, S.sA).addScaledVector(Z, S.lz);
        links.set(i * 2 + k, K, Mp, S.rT, S.rR);
      }
      let ang = dopen * DOOR_MAX;
      if (eur && i === 2) ang = Math.max(ang, 64 * D2R);       // derelict: this bay door hangs on a broken hinge
      doors[i].set(ang);
      cols[i].pad.off = cols[i].str.off = u < 0.97;
    });
    P.A.commit(); P.B.commit(); P.C.commit(); links.commit();
  }

  st.legDeploy = sstep(0, 1, raw); lastU = st.legDeploy; pose(st.legDeploy);
  kit.onUpdate((dt, t, s) => {
    const target = s.landed ? 1 : 0;
    if (raw !== target) raw += Math.max(-dt * 0.35, Math.min(dt * 0.35, target - raw));
    s.legDeploy = sstep(0, 1, raw);
    if (Math.abs(s.legDeploy - lastU) < 1e-5) return;
    lastU = s.legDeploy; pose(s.legDeploy);
  });
}

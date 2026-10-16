// Boarding ladder: four hinged rail sections (one InstancedMesh set), Z-folded into a flat stack under the hatch sill when stowed and swung out
// + unfolded to the ground when the gear is down (state.legDeploy > 0.9). Published progress: C.ladder.v (0 stowed … 1 ground).
import * as THREE from 'three';
import { Part, sstep } from './gear_util.js';

const V3 = THREE.Vector3, M4 = THREE.Matrix4, Q = THREE.Quaternion;

export default function ladder(kit, C) {
  const st = kit.state, eur = kit.eur, Z0 = C.Z0;
  const J0 = new V3(-4.88, -1.285, Z0), FOOT = new V3(-5.7, -4.17, Z0);
  const dd = FOOT.clone().sub(J0), LEN = dd.length(), NS = 4, l = LEN / NS, DEP = Math.atan2(dd.y, dd.x);      // deployed direction angle (≈ −106°)
  const SWING = DEP;                                                                                          // section 1: 0 (points inboard) → DEP (clockwise)
  const W = 0.29;

  // one rail section, local +X along the section, Y = thickness normal, Z across
  const S = new Part(kit);
  for (const sz of [-1, 1]) {
    S.box('metal', [l / 2, 0, sz * W], [l, 0.04, 0.05], { bev: 0.01 });
    S.box('paintOrange', [0.05, 0.001, sz * W], [0.06, 0.043, 0.053], { bev: 0.004 });
    S.box('paintOrange', [l - 0.05, 0.001, sz * W], [0.06, 0.043, 0.053], { bev: 0.004 });
    S.box(eur ? 'screenOff' : 'emitCyan', [l * 0.5, 0.0215, sz * (W - 0.012)], [0.05, 0.004, 0.018], { bev: 0 });
  }
  for (let k = 0; k < 3; k++) S.cyl('rubber', [l * (k + 0.5) / 3, 0, 0], 0.024, 2 * W, { axis: 'z', seg: 12 });
  S.cyl('metal', [0, 0, 0], 0.03, 2 * W + 0.06, { axis: 'z', seg: 12 }).cyl('metal', [l, 0, 0], 0.03, 2 * W + 0.06, { axis: 'z', seg: 12 });
  const inst = S.instanced(NS, 'gear.ladder');

  const m4 = new M4(), q = new Q(), ZA = new V3(0, 0, 1), one = new V3(1, 1, 1), p = new V3(), n1 = new V3(), pos = [new V3(), new V3(), new V3(), new V3()];
  const phi = [0, 0, 0, 0];
  function pose(v) {
    const a = sstep(0.0, 0.55, v), b = sstep(0.35, 1.0, v), d = 0.046 * (1 - b);
    phi[0] = SWING * a; phi[1] = phi[0] + Math.PI * (1 - b); phi[2] = phi[1] - Math.PI * (1 - b); phi[3] = phi[2] + Math.PI * (1 - b);
    n1.set(Math.sin(phi[0]), -Math.cos(phi[0]), 0);
    pos[0].copy(J0);
    for (let i = 0; i < NS; i++) {
      q.setFromAxisAngle(ZA, phi[i]); inst.set(i, m4.compose(pos[i], q, one));
      if (i < NS - 1) pos[i + 1].copy(pos[i]).add(p.set(Math.cos(phi[i]), Math.sin(phi[i]), 0).multiplyScalar(l)).addScaledVector(n1, d);
    }
    inst.commit();
  }

  const C_L = C.ladder = { v: st.legDeploy > 0.9 ? 1 : 0, floor: kit.floor(-5.7, Z0 - 0.3, -4.95, Z0 + 0.3, -4.2, -1.2, 'x', { enabled: false }) };
  pose(eur ? Math.min(C_L.v, 0.14) : C_L.v);
  kit.onUpdate((dt, t, s) => {
    const target = s.legDeploy > 0.9 ? 1 : 0;
    if (C_L.v !== target) C_L.v += Math.max(-dt * 0.55, Math.min(dt * 0.55, target - C_L.v));
    const v = eur ? Math.min(C_L.v, 0.14) : C_L.v;                               // derelict: the ladder is jammed almost folded
    C_L.floor.enabled = !eur && C_L.v > 0.995;
    if (Math.abs(v - (C_L.last == null ? -1 : C_L.last)) < 1e-5) return;
    C_L.last = v; pose(v);
  });
}

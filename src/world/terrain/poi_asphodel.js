// ORPHEUS · asphodel POIs — entry point. Builds every slot present in env.slots:
//   meadow → outpost  (Meadow Base hab + recorder log.asphodel.1)   · mast  (weather mast)
//   shore  → drone    (crashed survey drone + recorder log.asphodel.2) · pools (tide pools)
// Heavy lifting lives in poi_asphodel_{outpost,mast,drone,pools}.js (+ _parts / _decals / _ground helpers).
import * as THREE from 'three';
import { createStyle } from './poi_asphodel_parts.js';
import { buildOutpost } from './poi_asphodel_outpost.js';
import { buildMast } from './poi_asphodel_mast.js';
import { buildDrone } from './poi_asphodel_drone.js';
import { buildPools } from './poi_asphodel_pools.js';

const BUILDERS = { outpost: buildOutpost, mast: buildMast, drone: buildDrone, pools: buildPools };

export function buildPois(env) {
  const group = new THREE.Group(); group.name = 'asphodel.pois';
  const S = createStyle(env), interactables = [], colliders = [], updaters = [], disposers = [];
  for (const [id, build] of Object.entries(BUILDERS)) {
    const slot = env.slots?.[id]; if (!slot) continue;
    try {
      const r = build(S, slot); if (!r) continue;
      group.add(r.group); interactables.push(...(r.interactables || [])); colliders.push(...(r.colliders || []));
      if (r.update) updaters.push(r.update); if (r.dispose) disposers.push(r.dispose);
    } catch (e) { console.error(`[asphodel] slot '${id}' failed`, e); }
  }
  S.tick(0);
  // sky-reflection materials get re-pointed when the surface re-bakes its env map (surface.refreshEnv)
  if (env.materials) group.traverse((o) => { for (const m of (Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])) if (m.envMap && !env.materials.includes(m)) env.materials.push(m); });
  return {
    group, interactables, colliders,
    update(dt, t, camPos) { S.tick(t); for (const u of updaters) u(dt, t, camPos); },
    dispose() { S.cancel(); for (const d of disposers) d(); },
  };
}

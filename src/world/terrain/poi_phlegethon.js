// ORPHEUS · surface POIs · PHLEGETHON (volcanic iron world: black basalt, lava rivers, ash haze, 1.2 g).
//   ridge  → slot `seismic`: Cinder Ridge seismic station straddling the lava river (poi_phlegethon_ridge.js)
//   forge  → slot `lander`:  abandoned Halcyon survey lander HX-S2, scorched and ash-drifted (poi_phlegethon_forge.js)
// Everything is built in absolute ship-space coordinates; see poi_common.js for the env/kit contract.
import * as THREE from 'three';
import { buildSeismic } from './poi_phlegethon_ridge.js';
import { buildLander } from './poi_phlegethon_forge.js';

export function buildPois(env) {
  const group = new THREE.Group(); group.name = 'phlegethon-pois';
  const interactables = [], colliders = [], updates = [], disposers = [];
  const take = (r) => {
    if (!r) return;
    group.add(r.group);
    interactables.push(...(r.interactables || [])); colliders.push(...(r.colliders || []));
    if (r.update) updates.push(r.update); if (r.dispose) disposers.push(r.dispose);
  };
  if (env.slots?.seismic) take(buildSeismic(env));
  if (env.slots?.lander) take(buildLander(env));
  return {
    group, interactables, colliders,
    update(dt, t, camPos) { for (let i = 0; i < updates.length; i++) updates[i](dt, t, camPos); },
    dispose() { for (const d of disposers) d(); },
  };
}

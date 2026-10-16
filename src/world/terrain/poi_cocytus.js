// ORPHEUS · surface POIs for Cocytus (frozen world: blue ice plains, N₂ haze, howling wind, geysers): wailing/geyser station and lake/memorial.
// buildPois(env) builds only the slots present in env.slots (see sites.js). Parts: poi_cocytus_geyser.js, poi_cocytus_memorial.js, poi_cocytus_frost.js (+ poi_charon_icekit.js helpers).
import * as THREE from 'three';
import { buildGeyser } from './poi_cocytus_geyser.js';
import { buildMemorial } from './poi_cocytus_memorial.js';

export function buildPois(env) {
  const group = new THREE.Group(); group.name = 'poi_cocytus';
  const parts = [];
  if (env.slots.geyser) parts.push(buildGeyser(env, env.slots.geyser));
  if (env.slots.memorial) parts.push(buildMemorial(env, env.slots.memorial));
  const interactables = [], colliders = [], updaters = [];
  for (const p of parts) {
    group.add(p.group); interactables.push(...p.interactables); colliders.push(...p.colliders);
    if (p.update) updaters.push(p.update);
  }
  return {
    group, interactables, colliders,
    update(dt, t, camPos) { for (const u of updaters) u(dt, t, camPos); },
  };
}

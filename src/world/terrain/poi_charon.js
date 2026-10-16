// ORPHEUS · surface POIs for Charon (airless ice-rock moon of Lethe): sentinel/telescope and ferryman/marker.
// buildPois(env) builds only the slots present in env.slots (see sites.js). Parts: poi_charon_sentinel.js, poi_charon_ferryman.js (+ poi_charon_icekit.js helpers).
import * as THREE from 'three';
import { buildSentinel } from './poi_charon_sentinel.js';
import { buildFerryman } from './poi_charon_ferryman.js';

export function buildPois(env) {
  const group = new THREE.Group(); group.name = 'poi_charon';
  const parts = [];
  if (env.slots.telescope) parts.push(buildSentinel(env, env.slots.telescope));
  if (env.slots.marker) parts.push(buildFerryman(env, env.slots.marker));
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

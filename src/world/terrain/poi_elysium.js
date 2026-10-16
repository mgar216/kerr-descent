// ORPHEUS · Elysium surface POIs (negative-mass rogue world, glass plains, phosphorescent crystals, 0.4 g, lit by the anti-sky galaxy).
//   camp site   → slot `camp`    : Elena & Tomas's camp (log.elysium.1 ELENA) · slot `lantern` : their lander LANTERN (log.elysium.2 TOMAS)
//   garden site → slot `sensor`  : Tomas's sensor array (log.elysium.3 TOMAS) · slot `monolith` : the great crystal cluster (poi…crystals)
// buildPois(env) builds every slot present in env.slots. Heavy lifting lives in poi_elysium_{camp,lander,sensor,crystals}.js (+ poi_elysium_lib.js).
import * as THREE from 'three';
import { slotFrame } from './poi_elysium_lib.js';
import { buildCamp } from './poi_elysium_camp.js';
import { buildLander } from './poi_elysium_lander.js';
import { buildSensor } from './poi_elysium_sensor.js';
import { buildMonolith } from './poi_elysium_crystals.js';

const BUILDERS = { camp: buildCamp, lantern: buildLander, sensor: buildSensor, monolith: buildMonolith };

export function buildPois(env) {
  const group = new THREE.Group(); group.name = 'elysium.pois';
  const interactables = [], colliders = [], updaters = [], disposers = [];
  for (const [id, build] of Object.entries(BUILDERS)) {
    const slot = env.slots?.[id]; if (!slot) continue;
    const r = build(env, slot, slotFrame(env, slot));
    group.add(r.group); interactables.push(...r.interactables); colliders.push(...r.colliders);
    if (r.update) updaters.push(r.update);
    if (r.dispose) disposers.push(r.dispose);
  }
  return {
    group, interactables, colliders,
    update(dt, t, camPos) { for (const u of updaters) u(dt, t, camPos); },
    dispose() { for (const d of disposers) d(); },
  };
}

// Port-side crew rooms: QUARTERS (z 3..8), GALLEY (z 8..14), AIRLOCK (z 14..18) — props, lived-in detail, interactables.
// Split into modules (crew_*.js); a failing module is reported without losing the others.
import { makeArt } from './crew_art.js';
import { fabricMats } from './crew_util.js';
import quarters from './crew_quarters.js';
import galley from './crew_galley.js';
import airlock from './crew_airlock.js';

export default function build(kit) {
  const errs = [];
  const run = (name, fn) => { try { fn(kit); } catch (e) { errs.push(`crew.${name}: ${e && e.message}`); console.error(`[ship:${kit.variant}] crew.${name} failed`, e); } };
  run('fabrics', fabricMats);
  run('art', () => { kit.crewArt = makeArt(kit); });
  run('quarters', quarters);
  run('galley', galley);
  run('airlock', airlock);
  if (errs.length) throw new Error(errs.join(' | '));
}

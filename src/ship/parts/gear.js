// Landing gear part: legs + bays (gear_legs / gear_bays), ventral cargo ramp (gear_ramp), airlock hatch + docking collar + boarding ladder
// (gear_hatch / gear_collar / gear_ladder). Maintains kit.state.legDeploy / rampOpen / hatchOpen.
// Order matters: legs first (ramp + ladder read legDeploy in their updates).
import legs from './gear_legs.js';
import ramp from './gear_ramp.js';
import hatch from './gear_hatch.js';

export default function build(kit) {
  const st = kit.state;
  st.legDeploy = st.landed ? 1 : 0;                 // built landed → gear already down
  const errs = [];
  for (const [name, fn] of [['legs', legs], ['ramp', ramp], ['hatch', hatch]]) {
    try { fn(kit); } catch (e) { errs.push(`${name}: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ← ') : e}`); console.error(`[gear:${name}]`, e); }
  }
  if (errs.length) throw new Error(errs.join(' | '));
}

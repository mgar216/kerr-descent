// AFT DRIVE SECTION (exterior): torch nozzle + plume, tail structure, radiator wings, EURYDICE damage.
// The heavy lifting lives in drive_nozzle / drive_plume / drive_tail / drive_truss / drive_radiators (+ drive_wing, drive_util); this file
// wires them together and owns the smoothed heat state (thrust / boost) that every glowing element reads.
import { AY, bellContour, driveMats } from './drive_util.js';
import buildNozzle from './drive_nozzle.js';
import buildPlume from './drive_plume.js';
import buildTail from './drive_tail.js';
import buildTruss from './drive_truss.js';
import buildRadiators from './drive_radiators.js';

export default function build(kit) {
  const eur = kit.eur, B = bellContour(kit.L.DRIVE);
  driveMats(kit);
  buildNozzle(kit, B); buildTail(kit, B); buildTruss(kit, B);
  const fx = buildPlume(kit, B), rad = buildRadiators(kit);
  kit.hullColliders.push({ min: [-2.85, AY - 2.85, B.z0], max: [2.85, AY + 2.85, B.z1 + 0.1] });   // bell + thrust structure

  // heat: smoothed thrust/boost, ember factor (follows the interior light mode), flicker — updated once per frame, read by every glow
  const heat = { th: -1, bo: 0, idle: 1, fl: 1 };
  kit.onUpdate((dt, t, s) => {
    const th = eur ? 0 : s.thrust, bo = eur ? 0 : s.boost * Math.min(1, th * 4);
    if (heat.th < 0) { heat.th = th; heat.bo = bo; }
    else { heat.th += (th - heat.th) * (1 - Math.exp(-dt * (th > heat.th ? 2.4 : 3.4))); heat.bo += (bo - heat.bo) * (1 - Math.exp(-dt * 2.6)); }
    heat.idle = eur ? 0.5 : (s.mode === 'off' ? 0.3 : s.mode === 'emergency' ? 0.65 : 1);
    heat.fl = 1 + 0.06 * Math.sin(t * 47) * Math.sin(t * 13.1) + 0.04 * Math.sin(t * 91 + 1.3);
    fx.update(t, s, heat); rad.update(t, s, heat);
  });
}

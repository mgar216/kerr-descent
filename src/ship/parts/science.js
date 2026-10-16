// SCIENCE (starboard side rooms): lab z 3..10, medbay z 10..14, LYRA core z 14..18. Split into modules so each stays small.
import { defMats } from './science_util.js';
import lab from './science_lab.js';
import instr from './science_instr.js';
import medbay from './science_medbay.js';
import core from './science_core.js';

export default function build(kit) {
  defMats(kit);
  const errs = [], orig = kit.screen;
  // every screen of this part goes dark when the interior lights are 'off' (kit screens do not follow the light mode by themselves)
  kit.screen = (o) => orig(o.draw ? { ...o, draw: (g, W, H, t, s) => { if (kit.state.mode === 'off') { g.fillStyle = '#010304'; g.fillRect(0, 0, W, H); } else o.draw(g, W, H, t, s); } } : o);
  for (const [name, fn] of [['lab', lab], ['instr', instr], ['medbay', medbay], ['core', core]]) {
    try { fn(kit); } catch (e) { errs.push(`${name}: ${e && e.message}`); console.error(`[science:${name}]`, e); }
  }
  kit.screen = orig;
  if (errs.length) throw new Error(errs.join(' | '));
}

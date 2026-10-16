// Dorsal observation dome + the stair to it. Sub-modules are isolated so one failure cannot take the rest of the dome down.
import glass from './dome_glass.js';
import stair from './dome_stair.js';
import deck from './dome_deck.js';
import props from './dome_props.js';
import frost from './dome_frost.js';

export default function build(kit) {
  const errs = [];
  for (const [name, fn] of [['glass', glass], ['stair', stair], ['deck', deck], ['props', props], ['frost', frost]]) {
    try { fn(kit); } catch (e) { errs.push(`${name}: ${e && e.message}`); console.error(`[dome] ${name}`, e); }
  }
  if (errs.length) throw new Error(errs.join(' | '));
}

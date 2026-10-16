// FLIGHT DECK — pilot dash (classic cockpit framing), seats, overhead, crew stations, bulkhead fittings, personal props, derelict dressing.
// Split into fd_*.js modules (each exports build(kit, U)); a failure in one module never loses the others.
import { defMats, makeU } from './fd_util.js';
import dash from './fd_dash.js';
import seats from './fd_seats.js';
import over from './fd_over.js';
import stations from './fd_stations.js';
import walls from './fd_walls.js';
import extras from './fd_extras.js';
import eurydice from './fd_eur.js';

export default function build(kit) {
  defMats(kit);
  const U = makeU(kit), errs = [];
  for (const [name, fn] of [['dash', dash], ['seats', seats], ['over', over], ['stations', stations], ['walls', walls], ['extras', extras], ['eur', eurydice]]) {
    try { fn(kit, U); } catch (e) { errs.push(`${name}: ${e && e.message}`); console.error(`[flightdeck:${name}]`, e); }
  }
  if (errs.length) throw new Error(errs.join(' | '));
}

/**
 * ORPHEUS — codex / lore entries (WRITER).
 *
 *   CODEX[id] = { title, category, body, voice? }
 *     category : 'Erebus' | 'Worlds' | 'Vessels' | 'People' | 'Physics' | 'Logs'
 *     body     : plain text paragraphs separated by '\n\n'
 *     voice    : (optional) a LINES id (src/voice/lines.js) the codex UI can replay
 *
 * ID scheme
 *   erebus, erebus.<feature>      disk photon isco polar ergosphere horizon inner ring antiverse whitehole
 *   vessel.<name>                 orpheus halcyon eurydice lantern
 *   world.<id>, site.<world>.<site>
 *   person.<name>
 *   physics.<topic>
 *   log.<id>                      one per voiced log / message, keyed exactly as the runtime unlocks them:
 *                                   recorders on worlds  → the line id itself:   'log.asphodel.1' … 'log.elysium.3'
 *                                   messages + Eurydice  → 'log.' + line id:     'log.msg.mira.2', 'log.eur.log.3'
 *                                 (logEntryId(lineId) builds either form)
 *
 * Numbers here are fixed facts of the simulation: M = GM/c^2 = 1 light-second = 299,792 km, mass 2.03e5 Msun,
 * spin a* = 0.95 (r+ = 1.312 M, r- = 0.688 M, ISCO 1.94 M prograde, ring radius 0.95 M).
 */

const P = (...paras) => paras.join('\n\n');

export const CODEX_CATEGORIES = ['Erebus', 'Worlds', 'Vessels', 'People', 'Physics', 'Logs'];
export const logEntryId = (lineId) => (lineId.startsWith('log.') ? lineId : 'log.' + lineId);

export const CODEX = {
  // ───────────────────────────── EREBUS ─────────────────────────────
  'erebus': {
    title: 'EREBUS',
    category: 'Erebus',
    voice: 'talk.lyra.kerr',
    body: P(
      "Erebus is the name Halcyon's first crew gave to XRB-J1840: a rotating black hole of about 203,000 solar masses, spinning at ninety-five percent of the fastest rate the equations allow. It is the largest thing you will ever fly toward, and it is the reason everything else here exists.",
      "Black holes this heavy are gentle at the edges. The horizon is some 800,000 kilometres across — a little over half the width of the Sun — and its tides are mild. Distances in this system are counted in gravitational radii, written M: one M is one light-second, about 300,000 kilometres. Halcyon orbits at 46 M. The ring singularity at the heart of the hole is 0.95 M in radius.",
      "Every world in the system is lit by the hole's own accretion disk, a thin, cool, starved flow of gas. A hungrier disk would have scorched the planets to cinders; this one gives them a long, strange twilight. The survey crews named the worlds for the rivers of the Greek underworld, and the hole for the primordial darkness the dead walk through to reach them.",
    ),
  },
  'erebus.disk': {
    title: 'ACCRETION DISK',
    category: 'Erebus',
    voice: 'mission.wp.DSK',
    body: P(
      "Gas falling toward Erebus cannot fall straight in; it carries too much sideways motion. It spirals instead, flattens into a thin disk, and rubs against itself as it descends. The friction heats it. The disk here runs from the innermost stable orbit, about 1.9 M, out to roughly 17 M, and it burns hottest at its inner edge.",
      "What you see is not a still picture. Gas at the rim, 15 M out, orbits at about a quarter of the speed of light, so the half of the disk turning toward you is blueshifted and beamed — that is why one side burns brighter than the other. Light from the far side of the disk is bent up and over the top of the shadow, so the back of the disk arches above the hole like a halo.",
      "This is a starved disk: cool, thin, and quiet compared with a quasar. That is the only reason planets survive within a few hundred radii. Every world here lives on its light.",
    ),
  },
  'erebus.photon': {
    title: 'PHOTON SHELL',
    category: 'Erebus',
    voice: 'mission.wp.PHS',
    body: P(
      "Light can orbit a black hole. Near Erebus there is a shell of radii — from about 1.4 M for light chasing the spin to about 4 M for light running against it — where a photon can circle the hole instead of falling in or flying away. These orbits are unstable: nudge a photon and it spirals inward or escapes. That knife-edge is why the shadow of the hole has such a sharp rim.",
      "From inside the shell, every star appears more than once. Light that went around the hole once, twice, many times still arrives, each loop squeezed closer to the edge of the shadow. Look the right way and you can see the back of your own ship.",
      "Halcyon's imaging team swears it can see a second copy of Orpheus on the far side of the hole whenever she passes through. They would like you to wave.",
    ),
  },
  'erebus.isco': {
    title: 'INNERMOST STABLE ORBIT (ISCO)',
    category: 'Erebus',
    voice: 'mission.wp.ISC',
    body: P(
      "Orbits close to a black hole cannot stay circular forever. Inside a certain radius — the innermost stable circular orbit — any small disturbance, a pinch of drag or a push from a thruster, sends the orbit falling instead of settling. For Erebus the ISCO lies at about 1.94 M if you orbit with the spin, and nearly 8.9 M if you orbit against it.",
      "That is where the disk ends. Gas spirals down to the ISCO in slow circles and then plunges the rest of the way in nearly a straight line. The disk's inner edge glows hottest because the gas arrives there having radiated away almost everything it can.",
      "A ship's clock at the ISCO runs at about three-tenths the rate of Halcyon's. Below this radius, everything is a fall. For Orpheus the gate marks the end of orbiting and the beginning of descent.",
    ),
  },
  'erebus.polar': {
    title: 'POLAR GATE',
    category: 'Erebus',
    voice: 'mission.wp.POL',
    body: P(
      "A spinning black hole has a preferred axis, and its singularity is not a point at the centre but a ring lying flat in the equatorial plane. The ring is 0.95 M in radius — nearly 285,000 kilometres. A path that falls through the middle of the ring never touches it.",
      "So the road through Erebus runs along the spin axis. The polar gate marks the line: come in from above, fall straight down the axis, cross both horizons, and pass through the disk the ring encloses. The equatorial plane is where everything dies. The axis is a thread.",
      "It is the only way to the other side, and it demands a steady hand: a few degrees off, and the thread turns into a wall.",
    ),
  },
  'erebus.ergosphere': {
    title: 'ERGOSPHERE',
    category: 'Erebus',
    voice: 'talk.lyra.ergo',
    body: P(
      "Spin drags space itself. Close to the hole the drag is so strong that nothing — not even light — can hold still relative to the distant stars. The boundary where that begins is the static limit, and the region between it and the event horizon is the ergosphere.",
      "At Erebus the static limit sits at 2 M on the equator and touches the horizon at the poles, so the ergosphere is a flattened shell, like a fruit squeezed around the hole. Inside it, space rotates at up to a third of a radian per second. No engine can turn that off. You can leave whenever you like; you just can't stand still.",
      "It is also where Penrose's trick lives: energy can be taken from the hole's rotation. It is where Eurydice was working eleven years ago, flying a survey of grazing passes through this shell, when her drive failed.",
    ),
  },
  'erebus.horizon': {
    title: 'EVENT HORIZON',
    category: 'Erebus',
    voice: 'talk.lyra.horizon',
    body: P(
      "The event horizon is not a surface. It is a one-way boundary in spacetime, at r = 1.31 M for Erebus — about 393,000 kilometres from the centre on the equator. Cross it and every possible future points inward. Light emitted outward at the horizon hangs there; light just inside is dragged to the centre.",
      "The crossing is quiet. For a hole of 200,000 solar masses the tidal stretch across a person at the horizon is about a twentieth of a g. You would not feel it. From outside, though, everything looks different: your clock slows, your light reddens and dims, and your image never quite reaches the edge. Halcyon's receivers lost Eurydice's carrier the way every carrier is lost — fading by a factor of e every eight seconds or so, and then into the noise.",
      "The horizon turns as well. At Erebus's spin it makes one full rotation every seventeen seconds.",
    ),
  },
  'erebus.inner': {
    title: 'INNER HORIZON · CAUCHY HORIZON',
    category: 'Erebus',
    voice: 'talk.lyra.inner',
    body: P(
      "A rotating black hole has two horizons. Between the outer one, at 1.31 M, and the inner one, at 0.69 M, you cannot stand still: space itself falls toward the inner horizon and carries you with it. In that region the radius is a direction in time.",
      "The inner horizon is a Cauchy horizon — the edge of what the equations can predict. Anyone who reaches it sees the whole future of the outside universe arrive at once: all the light that will ever fall into the hole, infinitely blueshifted. In any realistic black hole that burst probably grows violent enough to seal the passage, a process called mass inflation. That is why most physicists doubt what lies beyond.",
      "Orpheus's hull is indestructible and the mathematics is exact. Past this line the equations stop making predictions. You are no longer reading the answer. You are the experiment.",
    ),
  },
  'erebus.ring': {
    title: 'THE RING SINGULARITY',
    category: 'Erebus',
    voice: 'talk.lyra.ring',
    body: P(
      "At the centre of a Kerr black hole, spacetime curvature becomes infinite not at a point but along a ring: a circle of radius a, here about 285,000 kilometres, lying in the equatorial plane. Anything that falls in along the equator meets it. Anything that falls along the axis flies through the middle without touching it.",
      "The flat disk the ring encloses is a doorway. Pass through it and the radial coordinate r becomes negative: you have entered a second sheet of the same spacetime, a universe with no horizon, where the ring itself is visible from the outside, bare, with nothing to hide it.",
      "Touch the ring and the equations stop. Near it, the mathematics permits paths that loop back on themselves in time. No instrument has ever tested any of this. The numbers say the way is open.",
    ),
  },
  'erebus.antiverse': {
    title: 'THE NEGATIVE-MASS UNIVERSE',
    category: 'Erebus',
    voice: 'talk.lyra.antiverse',
    body: P(
      "Beyond the ring the radial coordinate runs negative. That region is a complete universe in its own right — asymptotically flat, with its own sky and its own galaxies — and with one startling difference. To everything out there, Erebus behaves as if it had negative mass. Gravity pushes.",
      "A dropped stone does not fall toward the hole; it drifts away. A ship that cuts its engines is nudged gently outward. There is no event horizon on this side, so the ring singularity sits naked in the sky, a circle of infinite curvature, visible to anyone who turns around to look. The push weakens with distance. Nothing is flung; it drifts outward, slowly and forever.",
      "In a real black hole this passage would almost certainly be sealed shut by the instability of the inner horizon. In the exact solution it is open.",
    ),
  },
  'erebus.whitehole': {
    title: 'WHITE HOLES AND NEW UNIVERSES',
    category: 'Erebus',
    voice: 'mission.end.newverse',
    body: P(
      "Extend the Kerr solution as far as the mathematics goes and the picture opens like a corridor of doors. Inside the inner horizon the paths do not end; they lead out again — through a white hole, the time reverse of a black hole, into a new exterior universe with its own Erebus, its own sky, its own disk. Behind that, another black hole, and another corridor. In the maximal extension the chain is infinite.",
      "A white hole is the opposite of a horizon: nothing can enter it, and everything must leave. Exit through one and you emerge from a region no one in the new universe can ever reach. The hole behind you is not the hole you fell into. There is no Halcyon here. There never was.",
      "Physicists suspect that real black holes seal these doors and that most of the universes in the chain are only mathematics. The ship does not need to agree. It needs the right trajectory, and nerve.",
    ),
  },

  // ───────────────────────────── VESSELS ─────────────────────────────
  'vessel.orpheus': {
    title: 'ORPHEUS (HX-02)',
    category: 'Vessels',
    voice: 'talk.lyra.ship',
    body: P(
      "Forty-eight metres of white ceramic and carbon, orange-and-cyan stripes, and a lyre painted on each flank. Orpheus is Halcyon's exploration torch-ship, the second hull of her class: built to go where the first one did not come back from. Her drive can push at ten million g; the crew is inertially decoupled, and the hull is, in the engineers' word, unconditional.",
      "Aboard: a flight deck with the pilot's seat and a systems seat; a spine corridor with crew quarters, galley and airlock to port; lab, medbay and LYRA's core to starboard; a dorsal observation dome; cargo and survey probes aft; and engineering, where the drive core glows. Artificial gravity holds the deck at one g under every burn. The galley window looks out onto Erebus, and beside it, in a pot, a basil plant named Pesto is losing no ground.",
      "Her sister ship, Eurydice, was lost eleven years ago. Orpheus's official purpose is the first crewed descent through a rotating black hole. Everyone on Halcyon knows the unofficial one.",
    ),
  },
  'vessel.halcyon': {
    title: 'HALCYON STATION',
    category: 'Vessels',
    voice: 'talk.lyra.halcyon',
    body: P(
      "A research station in a circular orbit 46 gravitational radii from Erebus — about 13.8 million kilometres — completing one lap every thirty-three minutes. Fourteen years old. A hundred and eighty people live aboard, with families: there is a greenhouse, a school of nineteen children, a viewing gallery that is never empty during a launch, and a bar called the Ergosphere, because nobody leaves in the direction they came in.",
      "Halcyon is the only place from which the descent can be watched, and the only place that cannot see its end. Light takes seconds to reach the ship, and what it carries is old, slowed, and reddened. Mission Control is run by Jonah Reyes at CAPCOM, with Director Arthur Bell on the flight director's desk and Dr. Ilse Varga's science teams in the next room.",
      "There is a light in every window. That is not policy. It is habit.",
    ),
  },
  'world.eurydice': {
    title: 'EURYDICE — ADRIFT',
    category: 'Vessels',
    voice: 'eurydice.approach',
    body: P(
      "She is here. Orpheus's elder sister drifts in the negative-mass universe, dark, frosted and whole: her name legible on the hull, the lyre still on her flanks. One radiator wing is damaged. The drive section is scorched. The cargo cradle is empty — they took the lander down to a world.",
      "No running lights burn. Her emergency lighting glows red behind the glass, and a low-power transponder repeats her ship ID, patiently, into a sky no one else had ever seen. She is as large as Orpheus and as quiet as a held breath. She looks asleep.",
    ),
  },
  'vessel.eurydice': {
    title: 'EURYDICE (HX-01)',
    category: 'Vessels',
    voice: 'talk.lyra.eurydice',
    body: P(
      "Orpheus's elder sister: same hull, same drive, same lyre on her flanks. Eleven years ago, by Halcyon's clock, she was flying an ergosphere survey with two aboard — Commander Elena Varis and flight engineer Tomas Oyelaran — when her drive faulted and she fell through the horizon. From outside she never finished falling: her clock slowed, her light reddened, and her image froze at the edge of the hole. Halcyon's Sentinel telescope has watched it ever since.",
      "Aboard, the recorders are where the crew left them — six logs, from the fall through the horizon to the decision to leave. Two bunks are made. A message on the galley wall reads TOMAS — NOT FISH PIE AGAIN. On the console, in a frame, a photograph: Elena, the Commander, and five-year-old Mira.",
      "The ship's mind, Thea, is cold. She kept them alive long enough to get where they were going.",
    ),
  },
  'vessel.lantern': {
    title: 'LANTERN',
    category: 'Vessels',
    voice: 'world.elysium.poi.camp',
    body: P(
      "Eurydice's lander: a four-legged pressurised ferry, small enough to ride in her cargo cradle and tough enough to set down on an unknown world. A lantern is what you carry into the dark. Whoever named her was making a promise.",
      "Lantern has her own scrubbers and a battery bigger than Tomas Oyelaran felt he deserved. When Eurydice's reactor began to fail, she was the sensible place to live. On Elysium she stands beside the habitat module on her four legs, on the glowing plain, as if she touched down this morning.",
    ),
  },

  // ───────────────────────────── WORLDS ─────────────────────────────
  'world.asphodel': {
    title: 'ASPHODEL',
    category: 'Worlds',
    voice: 'world.asphodel.scan',
    body: P(
      "A temperate ocean-and-island world 140 M from Erebus, 5,400 km in radius, with 0.86 g at the surface and nitrogen-oxygen air at eight-tenths of an atmosphere. It is the gentlest world in the system. A year here lasts about three hours, and because the orbit is that fast the planet is tidally locked: one face looks at Erebus forever, the other never sees it.",
      "On the near face Erebus hangs fixed in the sky, its shadow about four degrees wide and its disk fourteen — a dim, restless lamp that never rises or sets. Pale silver-grey grass, asphodel, covers the lowlands; the beaches are black basalt sand; the seas are shallow and turquoise. The weather lives at the terminator, the twilight band where day meets night, where storms gather.",
      "Halcyon's survey crews called it the nearest thing they had to a garden. They named the grass.",
    ),
  },
  'world.phlegethon': {
    title: 'PHLEGETHON',
    category: 'Worlds',
    voice: 'world.phlegethon.scan',
    body: P(
      "A dense, iron-rich world 118 M from Erebus, 4,100 km in radius, with a gravity of 1.2 g. Its orbit is not quite circular, so about every two hours Erebus squeezes the planet harder at one end of the lap than the other. The flexing heats it from within. The interior never cools. The surface is basalt plains cut by rivers of lava and glowing fissures.",
      "The air is a thick haze of ash and sulphur dioxide: unbreathable, opaque, and lit orange from below. The terminator is the most dramatic place on it, the night side cracked with light and the day side buried in cloud. The survey crews named it for the river of fire in the underworld, and named its landing sites Cinder Ridge and the Forge.",
      "It is hostile. It is also, by every account, magnificent.",
    ),
  },
  'world.lethe': {
    title: 'LETHE',
    category: 'Worlds',
    voice: 'world.lethe.scan',
    body: P(
      "A ringed gas giant 800 M from Erebus, 58,000 km in radius, banded in pale blue and violet. Storms older than Halcyon turn in its cloud decks, and some are wider than most planets. There is no surface: the atmosphere deepens into fluid hydrogen and then something denser, all the way down. It cannot be landed on.",
      "Its rings are the most delicate large structure in the system. They run from 1.3 to 2.0 planetary radii — some 41,000 km across — and in places they are only a few metres thick: ice, dust, and small stones. Its moon Charon orbits well outside them, at 140,000 km, once every 6.6 hours.",
      "The name is the river of forgetfulness. The dead drank from it to forget the world they had left.",
    ),
  },
  'world.charon': {
    title: 'CHARON',
    category: 'Worlds',
    voice: 'world.charon.scan',
    body: P(
      "An airless moon of ice over rock, 1,250 km in radius, orbiting Lethe at 140,000 km. Gravity is 0.12 g. One face stays toward Lethe, which fills 47 degrees of the sky — nearly a hundred full moons wide. Erebus is a small ring of fire beyond it. There is no air, no weather, and no sound but what you carry.",
      "It is the quietest world in the system, and Halcyon put its most patient instrument there: the Sentinel Observatory, a telescope trained for eleven years on one point at the edge of Erebus's shadow. In the old myth, Charon is the ferryman who carries the dead across the river. The crater the survey crews named after him is full of ice spires.",
    ),
  },
  'world.cocytus': {
    title: 'COCYTUS',
    category: 'Worlds',
    voice: 'world.cocytus.scan',
    body: P(
      "A frozen world 420 M from Erebus: 4,700 km in radius, 0.9 g, and about minus 190 degrees Celsius at the surface. Pale blue ice plains, a thin nitrogen haze, deep crevasses, and a twilight that never changes. Erebus is a dim smear of orange on the horizon.",
      "The cold has teeth, and the planet has a pulse: in places heat leaking up from below pushes gas and ice crystals out through vents in plumes kilometres high. The wind through the vents makes a sound the survey crews describe as a chord. In the underworld Cocytus is the river of lamentation; they named the field where the geysers stand the Wailing Field. On the Frozen Lake, flat and clear and quiet, Halcyon built a memorial.",
    ),
  },
  'world.elysium': {
    title: 'ELYSIUM',
    category: 'Worlds',
    voice: 'world.elysium.scan',
    body: P(
      "A rogue world in the negative-mass universe, about 130 M from Erebus's centre on the far side of the ring, and drifting outward, slowly, on the push of the hole's repulsive gravity. It has a radius of 3,300 km, a gravity of 0.4 g, and a thin cold atmosphere a person can breathe.",
      "It has no sun. What it has is the sky: a great spiral galaxy that fills a quarter of the heavens and lights the world by day and by night alike. The plains are crystalline silicate that soaks up that light and gives it back, a pale glow that lasts for hours, so the ground shines in the dark. In the crystal forest the stems tick as they cool, each with its own pitch.",
      "In the old myth Elysium is the end of the road, the fields where the beloved go. The name is theirs, and it suits the place.",
    ),
  },

  // ───────────────────────────── LANDING SITES ─────────────────────────────
  'site.asphodel.meadow': {
    title: 'MEADOW BASE · ASPHODEL',
    category: 'Worlds',
    voice: 'world.asphodel.poi.outpost',
    body: P(
      "The Halcyon survey team's outpost on the Asphodel lowlands: a handful of modular huts, a laboratory dome, a weather mast, a field of solar sheets. It was built to last a season and has stood empty for far longer, and whoever left it left it tidy. The console in the main hut still holds survey lead Okafor's field log.",
      "From the door the meadow runs down to the sea, and when the wind comes off the water every blade of grass turns silver at once. The crew's geologist suggested the name asphodel for it as a joke — the old poets planted that flower in the underworld — and the joke stuck. Erebus never moves in this sky. Okafor wrote that living under it was like living under a lamp someone had left on for them.",
    ),
  },
  'site.asphodel.shore': {
    title: 'GREY SHORE · ASPHODEL',
    category: 'Worlds',
    voice: 'world.asphodel.poi.drone',
    body: P(
      "A long beach of black sand — basalt glass, ground fine by the sea — on Asphodel's day side. Because the planet is tidally locked, the tidal bulge never moves: the water sits where it has always sat, and the shoreline neither advances nor retreats. Behind the beach, warm turquoise pools hold small silver animals going about their lives.",
      "Survey Drone Seven came down here, nose-first in the sand. The wind that took it blew off the sea from the terminator, where all the planet's weather lives. Its memory holds a log from the geologist Petra Lind, who admits that she went swimming. The water, she says, was warm.",
    ),
  },
  'site.phlegethon.ridge': {
    title: 'CINDER RIDGE · PHLEGETHON',
    category: 'Worlds',
    voice: 'world.phlegethon.poi.seismic',
    body: P(
      "A basalt ridge above a river of molten rock, forty metres wide and moving at walking pace. Halcyon's volcanologists put a seismic station here: a handful of sensors bolted into the stone, listening to the planet's pulse. Every couple of hours, as Erebus squeezes Phlegethon a little harder, the river speeds up.",
      "You feel the heat through the suit before you feel it through the air; the ground itself radiates. Volcanologist Sam Ward spent a season here and wore out two left boots. His log is on the station console, and it contains the most affectionate thing anyone has ever said about a place that was trying to kill them.",
    ),
  },
  'site.phlegethon.forge': {
    title: 'THE FORGE · PHLEGETHON',
    category: 'Worlds',
    voice: 'world.phlegethon.poi.lander',
    body: P(
      "At the terminator, where the molten day side meets the frozen night side, the ground never settles. The survey crew landed a lander here and left it behind when a fissure opened beneath its third leg. It stands where they left it, legs fused to the rock in places, because the ground melted around it and cooled again. Nobody was hurt. The samples and the coffee were saved.",
      "Okafor recorded a goodbye on its console. The sentiment, he admits, is not scientific. His geologist told him as much. She was wrong.",
    ),
  },
  'site.charon.sentinel': {
    title: 'SENTINEL OBSERVATORY · CHARON',
    category: 'Worlds',
    voice: 'world.charon.poi.telescope',
    body: P(
      "A single instrument on a plain of ice: a long telescope on a rotating mount, designed by Dr. Ilse Varga and aimed for eleven years at one point at the edge of Erebus's shadow. It watches the light of Eurydice's last moments before the horizon, still arriving, stretched and dim, one photon at a time.",
      "In principle that image should have faded to nothing long ago. What Sentinel shows is not a picture. It is eleven years of integration on a patch of sky, a shadow of a shadow, a shape the eye would never find without being told where to look. It is the most patient thing in the system, and the operator's console holds the doctor's log.",
    ),
  },
  'site.charon.ferryman': {
    title: "FERRYMAN'S CRATER · CHARON",
    category: 'Worlds',
    voice: 'world.charon.poi.marker',
    body: P(
      "A crater whose floor is mirror-smooth ice and whose rim is a stand of ice spires, grown over billions of years by creep and refreezing in a place with no air to stop them. When Lethe's light falls on the floor you can see yourself: one small figure in a mirror the size of a county.",
      "Petra Lind built a cairn of ice blocks at the rim, with a survey pole through the top and a plate screwed to it. It isn't procedure. She says it is somewhere to put a hand on something while a planet that large stares down.",
    ),
  },
  'site.cocytus.wailing': {
    title: 'WAILING FIELD · COCYTUS',
    category: 'Worlds',
    voice: 'world.cocytus.poi.geyser',
    body: P(
      "A broad plain where heat leaking up from below pushes gas and ice crystals out of vents in tall plumes. The wind in the vents makes a sound: eight geysers, eight pitches, a chord that never resolves. A monitor station stands in the field, its microphones running longer than anyone has been listening.",
      "The survey crew called it the Wailing Field, and Petra Lind's log explains why the name is wrong. It is not a scream. It is a chord, she says, the sound of this world breathing out.",
    ),
  },
  'site.cocytus.lake': {
    title: 'THE FROZEN LAKE · COCYTUS',
    category: 'Worlds',
    voice: 'world.cocytus.poi.memorial',
    body: P(
      "The flattest, clearest, quietest ice in the system. Halcyon's crew built the Eurydice memorial here: a stone, a plaque, two names. Director Arthur Bell dedicated it. The names are Elena Varis and Tomas Oyelaran. The stone does not say they are dead. It says only that they are on a journey.",
      "It is a good place for it. The lake is a single sheet of ice so flat and clear that the twilight lies in it like a second sky, and the sky above is dark enough to look for them. Halcyon's crew carried the stone down themselves.",
    ),
  },
  'site.elysium.camp': {
    title: 'EURYDICE CAMP · ELYSIUM',
    category: 'Worlds',
    voice: 'world.elysium.poi.camp',
    body: P(
      "A habitat module on a glowing plain, with a flag the size of a handkerchief, a few solar sheets, and a lander parked beside it: Lantern, on her four legs, as if she touched down this morning. Everything is neat. The table in the module holds a recorder, still powered, and what it holds was meant for the Commander and for Mira.",
      "The camp belonged to Elena Varis and Tomas Oyelaran. Their logs do not say what they did when they were done. They say only that they were going to walk up to the ridge and watch the galaxy rise, and that they would leave the lights on.",
    ),
  },
  'site.elysium.garden': {
    title: 'GLASS GARDEN · ELYSIUM',
    category: 'Worlds',
    voice: 'world.elysium.poi.crystals',
    body: P(
      "A forest of crystal spires, some taller than a ship, rooted in the silicate plain. They absorb the galaxy's light and give it back for hours, so the garden shines in the dark. They tick as they cool, each at its own pitch, and at night the whole forest sounds like a thousand wind chimes the size of thumbnails.",
      "Tomas Oyelaran set a sensor array among them. It is still listening. A recorder clipped to its mast holds his last log.",
    ),
  },

  // ───────────────────────────── PEOPLE ─────────────────────────────
  'person.lyra': {
    title: 'LYRA',
    category: 'People',
    voice: 'talk.lyra.who',
    body: P(
      "The ship's mind. Named for Orpheus's lyre, and built to sing the way down and, if the physics allows, back. She runs the hull, the drive, the sky maps, the galley and the coffee machine, in descending order of success. She is calm, exact, and funnier than her specification allows, and she is protective of the Commander in ways she would deny if asked.",
      "Her architecture is the younger sister of Thea, who flew Eurydice. She says only what she can compute, keeps a copy of everything that matters, and has never once called a catastrophe 'unfortunate.' Her core is the glowing lattice column in the ship's starboard bay. It brightens when she thinks.",
    ),
  },
  'person.commander': {
    title: 'THE COMMANDER',
    category: 'People',
    body: P(
      "You. Pilot of Orpheus, Halcyon's most experienced descent pilot, partner of Elena Varis and parent of Mira. Nobody on the station uses a name in the control room. They say 'Commander,' and over the years it has come to sound like one.",
      "You have been flying toward Erebus, one way or another, for eleven years. You keep a basil plant alive. You do not sleep well. You have played one particular recorded message more times than LYRA will say. What you do with the rest of this is yours to choose.",
    ),
  },
  'person.jonah': {
    title: 'JONAH REYES — CAPCOM',
    category: 'People',
    voice: 'halcyon.jonah.hello',
    body: P(
      "The voice you hear most. Jonah has been Halcyon's capsule communicator for fourteen years: the one person on the console who speaks to the ship. On the loop he is all brevity and procedure. The rest of him is warm, steady, and quietly stubborn. He and the Commander are old friends.",
      "He keeps a chair for the Commander on the comms floor, the one by the window with the rattling sunshade, and nobody else is allowed to sit in it. He pretends something is wrong with a cable whenever Mira is in the room. He has promised to keep talking to Orpheus after the signal fades, and he calls that procedure.",
    ),
  },
  'person.bell': {
    title: 'DIRECTOR ARTHUR BELL — FLIGHT DIRECTOR',
    category: 'People',
    voice: 'halcyon.fd.hello',
    body: P(
      "Halcyon's Flight Director: older, measured, careful with words in the way of someone who has had to speak at memorials. He signed the Eurydice survey. The review found no fault in his paperwork. He has read it every year since, hoping to find the line that was his.",
      "He dedicated the memorial on the Frozen Lake, wrote Orpheus's mission brief in the only language the review board would approve, and has promised the Commander that the channel stays open. He is the person on the station least likely to tell you that things will be fine, and the one you most believe on the day he does.",
    ),
  },
  'person.varga': {
    title: 'DR. ILSE VARGA — SCIENCE LEAD',
    category: 'People',
    voice: 'halcyon.sci.hello',
    body: P(
      "Halcyon's head of science: a brilliant, precise, unexpectedly kind physicist who designed the Sentinel telescope on Charon. For eleven years she has watched a single patch of sky, the last light of Eurydice at the horizon of Erebus. Her colleagues call it the ghost. She calls it the data.",
      "She is quietly obsessed and knows it and has stopped apologising. She teaches Mira physics, treating her, Mira reports, like a postdoc, and she lets her read the papers. She will tell you exactly what the image is and exactly what it isn't. She will also tell you she knows precisely where to look, which is more than most scientists ever get.",
    ),
  },
  'person.mira': {
    title: 'MIRA',
    category: 'People',
    voice: 'talk.lyra.mira',
    body: P(
      "Sixteen. The Commander's daughter, and Elena Varis's. Born on a station and raised between a school of nineteen children and a mission control that treats her as its mascot, a role she resents and exploits. Sharp, funny, brave, and aching in ways she hides behind jokes.",
      "She grew the basil plant that rides in Orpheus's galley — Pesto, from the greenhouse's third batch — and asked LYRA to report on it monthly. She is the only person on Halcyon who has read every one of Dr. Varga's papers, and the only one who argues with them. She says she is not scared. She did the homework.",
    ),
  },
  'person.elena': {
    title: 'ELENA VARIS — COMMANDER OF EURYDICE',
    category: 'People',
    voice: 'msg.elena.old',
    body: P(
      "Commander of HX-01 and the best pilot Halcyon ever had. Mira's mother; the Commander's partner. Luminous, wry, and — according to everyone who flew with her — unafraid. She recorded a message before every flight because she thought it was manners. The Commander thought it was bad luck. They have never agreed.",
      "She was lost at the horizon of Erebus eleven years ago, on a survey that was supposed to be home by dinner. She left a daughter who was five, a partner who has never stopped flying toward her, and a family habit of saying a small, odd phrase at bedtime that nobody outside the family has been able to decode.",
    ),
  },
  'person.tomas': {
    title: 'TOMAS OYELARAN — FLIGHT ENGINEER',
    category: 'People',
    voice: 'eur.log.4',
    body: P(
      "Flight engineer of Eurydice. Gentle, funny, Nigerian-British, and in possession of an unreasonable store of sea shanties. He could shut down a coolant cascade in nine seconds and could not leave a heater alone. He cooked a fish pie that the whole station remembers, and not for the right reasons.",
      "His engineering notes are the only record of Eurydice's failing systems, and his logs are deliberately funny. He believed that when you cannot change a situation, you can at least describe it well.",
    ),
  },
  'person.survey': {
    title: 'THE SURVEY CREW',
    category: 'People',
    voice: 'log.asphodel.1',
    body: P(
      "Halcyon's field teams: the people who landed on the worlds before anyone else and wrote down what they found. Okafor, the survey lead, is older and steady and a little wry. Petra Lind, the geologist, watches closely and secretly swims. Sam Ward, the volcanologist, adores a planet that is doing its best to kill him.",
      "They named the asphodel grass, the Forge and the Wailing Field. They left recorders running on empty consoles for whoever came next, and they were each, in their own way, in love with the places they worked.",
    ),
  },

  // ───────────────────────────── PHYSICS ─────────────────────────────
  'physics.units': {
    title: 'ONE M · LENGTHS AND TIMES',
    category: 'Physics',
    voice: 'talk.lyra.kerr',
    body: P(
      "Near a black hole, the natural unit of length is the gravitational radius, M = GM/c². For Erebus, with 2.03 × 10⁵ solar masses, one M is almost exactly one light-second: about 299,792 kilometres. The natural unit of time is the same M, divided by the speed of light: about one second.",
      "That makes the map easy to read. Halcyon orbits at 46 M, which is 46 light-seconds out. The event horizon is at 1.31 M, the ring at 0.95 M across, the ISCO at 1.94 M, the disk's rim near 17 M, Asphodel at 140 M and Lethe at 800 M. When the display says M, it means seconds of light.",
    ),
  },
  'physics.dilation': {
    title: 'TIME DILATION',
    category: 'Physics',
    voice: 'talk.lyra.time',
    body: P(
      "Gravity slows clocks. The deeper you sit in a gravitational well, the slower your time runs relative to a clock far away. Speed does the same. Near Erebus the two effects combine: a ship in orbit at the ISCO ticks at about three-tenths the rate of Halcyon's clocks, and a ship hovering near the horizon crawls toward a stop. The effect is physical, not an illusion; a hovering twin comes home younger.",
      "You never feel it. Your seconds always feel like seconds. It is Halcyon's clocks that look wrong to you — they race — and your clock that looks wrong to them. Both are correct, because the two of you are measuring different paths through spacetime.",
      "At the event horizon the story forks. From outside, you slow forever and never arrive. From inside, you cross in finite time, and the outside universe's clocks are already in your past.",
    ),
  },
  'physics.lag': {
    title: 'LIGHT LAG & REDSHIFT',
    category: 'Physics',
    voice: 'mission.reply.view.near',
    body: P(
      "Everything you receive from Halcyon is old, and everything it receives from you is older. Light covers one gravitational radius — one light-second — per second. Halcyon at 46 M is nearly a minute from the hole and sixteen seconds from where Orpheus starts her descent. Every question you send waits for its answer.",
      "The signal changes colour too. Climbing out of a gravitational well costs a photon energy, so it arrives redshifted, and the closer to the horizon it starts, the redder it arrives. Close enough, and the redshift grows exponentially: the carrier fades through infrared and into nothing, and your clock, as Halcyon sees it, slows and stops. They never see you cross.",
      "From inside the horizon, nothing can leave at all. The channel stays open only on their side.",
    ),
  },
  'physics.dragging': {
    title: 'FRAME DRAGGING',
    category: 'Physics',
    voice: 'mission.wp.ERG',
    body: P(
      "A spinning mass twists the spacetime around it. This is the Lense–Thirring effect, and for most objects it is vanishingly small. Around Erebus it dominates: close in, space itself rotates, and everything — light, gas, ships — is carried around with it. An observer who is not rotating in this frame, a zero-angular-momentum observer, circles the hole at the local drag rate.",
      "At the horizon that rate is 0.36 radians per second: once around every seventeen seconds. In the ergosphere it is faster than light can move against, so staying still is not merely difficult but meaningless. The dragging is also how the hole's spin reaches into the disk and shapes the way it shines.",
    ),
  },
  'physics.penrose': {
    title: 'THE PENROSE PROCESS',
    category: 'Physics',
    voice: 'mission.lyra.penrose',
    body: P(
      "Inside the ergosphere an object can have negative energy, as measured from far away. Roger Penrose saw what that allows: send something in, let it split, and let one half fall on a negative-energy orbit into the hole while the other escapes. The escaping half leaves with more energy than the whole thing carried in. The surplus is rotation, paid for by the hole, which spins down a little.",
      "It is not free; it is a loan against spin. For Erebus about nineteen percent of the mass — roughly 38,000 suns' worth of energy — is stored in rotation and could in principle be harvested this way, down to the irreducible mass that no process can take. Nobody has ever tried. Orpheus has only ever noticed, in passing, that her energy went negative.",
    ),
  },
  'physics.tides': {
    title: 'TIDAL FORCES',
    category: 'Physics',
    voice: 'mission.lyra.tide',
    body: P(
      "Gravity pulls harder on your feet than on your head. The difference is the tidal force, and near a small black hole it is lethal: it stretches a body into a thread. But the tide at the horizon falls with the square of the hole's mass. For Erebus, with 203,000 suns, the horizon is so large that the stretch across a person is about a twentieth of a g. You could cross it and not notice.",
      "The tide does not stay small. It grows as the cube of the distance shrinks: near the ring singularity it climbs without limit, and nothing, not even an indestructible hull, would survive it unchanged. The horizon is gentle. The centre is not.",
    ),
  },

  // ───────────────────────────── LOGS & MESSAGES  (id = 'log.' + lineId) ─────────────────────────────
  'log.msg.mira.1': {
    title: 'MIRA — "IS IT RECORDING?"',
    category: 'Logs',
    voice: 'msg.mira.1',
    body: P(
      "Recorded in the weeks before launch. Mira's first message to the Commander: awkward, funny, and entirely in her voice. She introduces Pesto, the basil plant she has put in Orpheus's galley beside the temperamental coffee machine, and issues instructions for his care. The red recording light, she reports, is on.",
    ),
  },
  'log.msg.mira.2': {
    title: 'MIRA — THE QUIZ',
    category: 'Logs',
    voice: 'msg.mira.2',
    body: P(
      "Mira on school and on rituals. She aced the special-relativity quiz; Dr. Varga warned her not to let it go to her head. And she explains the family 'orbit thing,' a bedtime phrase her mother started — circular, prograde, stable — which she now says aloud to the ceiling on the nights the Commander is in the simulator. It still works.",
    ),
  },
  'log.msg.mira.3': {
    title: 'MIRA — THE JACKET',
    category: 'Logs',
    voice: 'msg.mira.3',
    body: P(
      "Mira wore Elena's old flight jacket to the viewing gallery today. The sleeves finally reach her wrists. She admits, on the authority of something she read, that brave is just scared with the homework done, and that she has done the homework.",
    ),
  },
  'log.msg.mira.4': {
    title: 'MIRA — LAST ONE BEFORE THE BURN',
    category: 'Logs',
    voice: 'msg.mira.4',
    body: P(
      "The last recording before departure. Mira's list of rules for the Commander includes an amended rule three: she looked up the myth, found that Orpheus is the one who looked back, and decided she is not having it. Look back all you want, she says. Look back at me. She will be right where she is, on a space station, which is the only place she can be.",
    ),
  },
  'log.msg.elena.old': {
    title: 'ELENA — BEFORE THE SURVEY · ELEVEN YEARS OLD',
    category: 'Logs',
    voice: 'msg.elena.old',
    body: P(
      "Recorded in the hangar before Eurydice's ergosphere survey, eleven years ago. Elena leaves a message because she always does; to her it is manners, to the Commander it is bad luck. She asks the Commander to say the orbit to Mira that night, remarks that at this mass the horizon is practically a velvet rope, and promises to be back by dinner.",
    ),
  },
  'log.msg.fd.1': {
    title: 'DIRECTOR BELL — THE REAL BRIEF',
    category: 'Logs',
    voice: 'msg.fd.1',
    body: P(
      "A recorded message from Halcyon's Flight Director. The official mission is a first descent. Bell admits it was written that way because the review board would not have approved the real one. He will not say her name here; he said it at the lake. If there is a way home, he tells the Commander, find it. If not, the station keeps listening.",
    ),
  },
  'log.msg.jonah.1': {
    title: 'JONAH — CLOSED CHANNEL',
    category: 'Logs',
    voice: 'msg.jonah.1',
    body: P(
      "A personal message on a closed channel from CAPCOM Jonah Reyes. He promises to keep talking after the signal fades, since the math says the Commander will hear it. 'That's not optimism, that's procedure.' A chair is waiting for the Commander on the comms floor: the one by the window with the rattling sunshade.",
    ),
  },
  'log.asphodel.1': {
    title: 'FIELD LOG — MEADOW BASE · OKAFOR',
    category: 'Logs',
    voice: 'log.asphodel.1',
    body: P(
      "Survey lead Okafor, day forty-one at Meadow Base. The team named the grass asphodel after the old poets' underworld meadows, as a joke, until the wind off the sea turned every blade silver at once and nobody spoke for a minute. Erebus never moves in this sky; Okafor likens it to living under a lamp someone left on for them. If you find this log, he says, sit down on the grass. It's allowed.",
    ),
  },
  'log.asphodel.2': {
    title: 'FIELD LOG — GREY SHORE · LIND',
    category: 'Logs',
    voice: 'log.asphodel.2',
    body: P(
      "Geologist Petra Lind at Grey Shore. Survey Drone Seven has been lost to a gust off the sea, and 'sorry' is chalked on its fuselage. Her notes cover the basalt-glass sand and the permanent tidal bulge of a tidally locked ocean, where the water sits where it has always sat. She also swam, against procedure, and it was the best minute of the year.",
    ),
  },
  'log.phlegethon.1': {
    title: 'FIELD LOG — CINDER RIDGE · WARD',
    category: 'Logs',
    voice: 'log.phlegethon.1',
    body: P(
      "Volcanologist Sam Ward at the seismic station on Cinder Ridge. Below him a river of lava forty metres wide speeds up like a pulse every time Erebus squeezes the planet a little harder. He has worn out two left boots, and he has never loved a place so much that was so determined to kill him.",
    ),
  },
  'log.phlegethon.2': {
    title: 'FIELD LOG — THE FORGE · OKAFOR',
    category: 'Logs',
    voice: 'log.phlegethon.2',
    body: P(
      "Okafor records a goodbye to the survey lander at the Forge. A fissure opened under its third leg; nobody was hurt; the samples and the coffee were saved. The lander got them down through ash and sulphur, and Okafor intends to say so. Petra says he cannot be sentimental about a lander. Petra, he says, is wrong.",
    ),
  },
  'log.charon.1': {
    title: 'SENTINEL LOG — DR. VARGA',
    category: 'Logs',
    voice: 'log.charon.1',
    body: P(
      "Dr. Ilse Varga on the Sentinel Observatory. What the telescope shows of Eurydice is not a picture but eleven years of integration on a patch of sky where her last light still straggles in, stretched and dim. She knows what it is, she knows what it isn't, and she knows exactly where to look.",
    ),
  },
  'log.charon.2': {
    title: "FIELD LOG — FERRYMAN'S CRATER · LIND",
    category: 'Logs',
    voice: 'log.charon.2',
    body: P(
      "Petra Lind at Ferryman's Crater: ice spires grown over billions of years with no air to stop them, and a mirror-smooth floor that reflects you as one small astronaut in a mirror the size of a county. She built a cairn at the rim, against procedure — somewhere to put her hand on something while a planet stares down.",
    ),
  },
  'log.cocytus.1': {
    title: 'FIELD LOG — WAILING FIELD · LIND',
    category: 'Logs',
    voice: 'log.cocytus.1',
    body: P(
      "Lind at the Wailing Field. The sound that names the place is not a scream but a chord: eight geysers, eight vents, eight pitches. At first she slept with the radio off. Now she leaves a recorder running while she sleeps. 'It's the sound of this world breathing out.'",
    ),
  },
  'log.cocytus.2': {
    title: 'MEMORIAL DEDICATION — DIRECTOR BELL',
    category: 'Logs',
    voice: 'log.cocytus.2',
    body: P(
      "Director Arthur Bell's words at the Frozen Lake, where Halcyon has set a stone for Elena Varis and Tomas Oyelaran. They are not buried here, nor anywhere. The station has decided to go on not knowing. Until it knows otherwise, the stone says only that they are on a journey.",
    ),
  },
  'log.elysium.1': {
    title: 'ELENA — THE LAST MESSAGE',
    category: 'Logs',
    voice: 'log.elysium.1',
    body: P(
      "Elena Varis's final message, recorded in the doorway of the camp module while a galaxy rises over Elysium. It is for the Commander, who she knew would come, and for Mira, who will be taller than her by now. She says she is not afraid. She says: don't look back — look forward; it's the only direction there is now.",
    ),
  },
  'log.elysium.2': {
    title: 'CAMP LOG — OYELARAN',
    category: 'Logs',
    voice: 'log.elysium.2',
    body: P(
      "Tomas Oyelaran at Eurydice Camp. The module holds, the heater has been rewired twice, and the lander's speakers play a single sea shanty, which he has now heard sixty-one times. The galaxy rises, the plains light up, and he and Elena sit in the middle of ten thousand little lamps with what is left of the tea.",
    ),
  },
  'log.elysium.3': {
    title: 'GARDEN LOG — OYELARAN',
    category: 'Logs',
    voice: 'log.elysium.3',
    body: P(
      "Tomas's last log, from the Glass Garden. The crystals tick as they cool and the forest sounds like a thousand tiny wind chimes; he recorded it so the listener could hear. 'When you find this: hello.' They are going to walk up to the ridge and watch the galaxy rise, and they will leave the lights on.",
    ),
  },
  'log.eur.log.1': {
    title: 'EURYDICE LOG 1 — THE CROSSING',
    category: 'Logs',
    voice: 'eur.log.1',
    body: P(
      "Commander Elena Varis logs the fall: a coolant cascade at the edge of the ergosphere, a drive that could not be saved in time, and a horizon that felt like a doorway that wasn't there. Tomas is unsettled, and would like it noted that he is not holding a cup of tea. They sent the mayday, knowing what Halcyon would see.",
    ),
  },
  'log.eur.log.2': {
    title: 'EURYDICE LOG 2 — THE RING',
    category: 'Logs',
    voice: 'eur.log.2',
    body: P(
      "Tomas Oyelaran logs the inner horizon: a blue wall of light, infinitely sharp, and a hull that held. Elena is hand-flying them down the spin axis to the ring, which he describes as bigger than any gas giant. They will thread it like a needle. He signs off with love for everyone he loves.",
    ),
  },
  'log.eur.log.3': {
    title: 'EURYDICE LOG 3 — THE SKY',
    category: 'Logs',
    voice: 'eur.log.3',
    body: P(
      "Elena Varis, through the ring. The radius is negative, the sky is an enormous spiral galaxy, and every star is wrong and beautiful. The hole no longer pulls but pushes; they are being sent gently away, like guests at the end of a long night. Tomas is crying and blaming the glare.",
    ),
  },
  'log.eur.log.4': {
    title: 'EURYDICE LOG 4 — THE FOOD MATH',
    category: 'Logs',
    voice: 'eur.log.4',
    body: P(
      "Tomas Oyelaran's housekeeping: reactor at forty percent, life support marginal, the lander Lantern far better provisioned than the ship. Food for sixty-three days, or ninety if Elena is right and he stops improving the rations. He has started rationing the tea, which is the first time he has considered mutiny against himself.",
    ),
  },
  'log.eur.log.5': {
    title: 'EURYDICE LOG 5 — WHERE THE LIGHT IS',
    category: 'Logs',
    voice: 'eur.log.5',
    body: P(
      "Elena Varis finds a rogue world whose plains glow. With Eurydice dying, they will take Lantern down, to where there is light, air, and ground that stays put. They leave the ship's beacon running as an invitation. 'It's the only place out here that feels like it's waiting for somebody.'",
    ),
  },
  'log.eur.log.6': {
    title: 'EURYDICE LOG 6 — FOR THE COMMANDER',
    category: 'Logs',
    voice: 'eur.log.6',
    body: P(
      "Elena Varis, recorded for the Commander alone. She knows they will come, though she cannot prove it and does not know when. There is no way back through the ring. She is all right; they are both all right. The rest of what she has to say is down on the ground, where it is lit.",
    ),
  },

};

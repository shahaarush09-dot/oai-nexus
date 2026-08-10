// Station definitions for the lab tour. This is the single source of truth
// for BOTH the camera choreography (LabGate's navigator tweens control.cam
// to these poses) and the scene layout (LabScene places each bay's geometry
// at the matching `origin`), so a station can't drift out of alignment with
// the camera that's supposed to be looking at it.
//
// Layout is a straight hall running along -Z with construction bays on
// alternating sides — the camera walks down the centre line and turns to
// face each bay in turn, which is what makes it read as a museum/exhibit
// hall rather than a corridor you fly through. Camera y sits at ~1.7
// throughout (human eye level in these units) so the room has a real floor
// and a real ceiling rather than reading as a void with objects in it.

export const HALL = {
  // Floor/ceiling extents. The hall is deliberately wider than the camera
  // ever needs so the side walls stay out of frame at the bay-facing
  // angles and the room reads as large rather than as a tunnel.
  width: 26,
  zNear: 12,
  zFar: -96,
  ceilingHeight: 6.2,
};

export const MODULE_ACCENTS = {
  patient: {
    key: "patient",
    // Brightened glow variants of the brand palette (tailwind.config.js:
    // teal #2a9d8f / clinicalblue #3b6fd6 / gold #c8a24a). The brand values
    // themselves are tuned for text on navy and read muddy as emissive
    // accents against a white room.
    accent: "#2a9d8f",
    glow: "#3fd6c4",
    sign: "PATIENT NEXUS",
  },
  clinical: {
    key: "clinical",
    accent: "#3b6fd6",
    glow: "#5c8ef0",
    sign: "CLINICAL NEXUS",
  },
  diligence: {
    key: "diligence",
    accent: "#c8a24a",
    glow: "#e0b563",
    sign: "NEXUS DILIGENCE",
  },
};

// Pacing model.
//
// `budget` is leftover scroll-scrubbed assembly and is now 0 everywhere:
// every station advances on a single gesture. The previous model made a
// station's build-in a function of accumulated scroll delta, with a budget
// of 2600px. Against a trackpad's fine-grained stream that was tolerable;
// against a notched mouse wheel — one event of ~100px per notch, clamped
// to MAX_EVENT_DELTA anyway — it meant TWENTY-SIX notches to get through
// one station and a twenty-seventh to leave it. Scroll stopped reading as
// pacing and started reading as resistance.
//
// `dwellMs` replaces it. On arrival the station plays its own timed
// build-in (see BUILD_SECONDS in LabScene) while input is refused; once
// that lapses, one gesture moves on. Arrive, watch it assemble, scroll
// once. The dwell is deliberately a little shorter than the build-in, so
// the room is essentially complete by the time input is accepted without
// the user ever waiting on a lockout they can't see.
const NO_BUDGET = 0;
const BUILD_DWELL_MS = 900;

// `index` is attached below rather than written out by hand — a bay needs
// to know its own position in the tour to tell whether it is the active
// one, and hand-numbering a list that has already been reordered once is
// exactly the kind of thing that silently desyncs.
const STATION_DEFS = [
  {
    id: "entry",
    module: null,
    budget: NO_BUDGET,
    dwellMs: 0,
    origin: [0, 0, -4],
    cam: { x: 0, y: 1.7, z: 9, lookAtX: 0, lookAtY: 1.6, lookAtZ: -30 },
    caption: "Nexus Fabrication Lab",
    sub: "Three modules. One system.",
  },
  {
    id: "patient",
    module: "patient",
    budget: NO_BUDGET,
    dwellMs: BUILD_DWELL_MS,
    // Bay on the left of the hall.
    origin: [-7.2, 2.0, -18],
    // Framing is now tuned for a furnished room at human scale, not for a
    // single object on a plinth. At the old ~10.4 units out with the
    // camera above eye level, a 2m examination table and 1.8m figures
    // rendered at roughly a fifth of frame height and read as toys on a
    // floor. These viewpoints step INTO the bay (~5.4 units out) and drop
    // to standing eye height, so the scene is seen the way a person in the
    // doorway would see it.
    // The look-at is aimed at the CONTENT centroid, not at the bay origin.
    // Those are not the same point once a room is furnished — aiming at
    // the origin left the furniture bunched into the left third of frame
    // with a blank wall filling the rest.
    cam: { x: -4.6, y: 1.72, z: -17.3, lookAtX: -11.0, lookAtY: 1.34, lookAtZ: -18.3 },
    caption: "Station 01",
    sub: "Patient Nexus",
  },
  {
    id: "clinical",
    module: "clinical",
    budget: NO_BUDGET,
    dwellMs: BUILD_DWELL_MS,
    // Bay on the right — alternating sides means the camera turns the
    // other way for each station, so consecutive stations never feel like
    // the same shot twice.
    origin: [7.2, 2.0, -40],
    cam: { x: 4.1, y: 1.6, z: -37.7, lookAtX: 8.0, lookAtY: 1.2, lookAtZ: -40.4 },
    caption: "Station 02",
    sub: "Clinical Nexus",
  },
  {
    id: "diligence",
    module: "diligence",
    budget: NO_BUDGET,
    dwellMs: BUILD_DWELL_MS,
    origin: [-7.2, 2.0, -62],
    cam: { x: -4.1, y: 1.6, z: -59.7, lookAtX: -8.0, lookAtY: 1.2, lookAtZ: -62.4 },
    caption: "Station 03",
    sub: "Nexus Diligence",
  },
  {
    id: "exit",
    module: null,
    budget: NO_BUDGET,
    dwellMs: 0,
    origin: [0, 0, -80],
    // Raised and turned to look back UP the hall: bay 3 near, bay 2 mid,
    // bay 1 far. The three finished constructs are all in frame at once,
    // at three different depths, which is the "look at what you built"
    // beat — and it's also the frame the lights-down handoff plays out in.
    // Pulled back to -87 rather than -78: at the closer distance Station
    // 3's bay sits only 16 units away and its signage ran off the frame
    // edge, which undercut the whole point of the shot — all three
    // stations named and legible in one frame.
    // Distance and pitch are traded off against each other here: far
    // enough back that Station 3's signage clears the frame edge, but with
    // the look-at raised so the shot isn't 60% empty floor. Both failure
    // modes were observed directly.
    cam: { x: 1.2, y: 3.2, z: -83, lookAtX: -0.5, lookAtY: 2.5, lookAtZ: -42 },
    caption: "Nexus",
    sub: "All systems online.",
  },
];

export const STATIONS = STATION_DEFS.map((s, index) => ({ ...s, index }));

export const BUILD_STATIONS = STATIONS.filter((s) => s.module !== null);
export const BUILD_STATION_IDS = BUILD_STATIONS.map((s) => s.id);

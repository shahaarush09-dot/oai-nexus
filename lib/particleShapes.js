// Target coordinate generators for the intro's module "coalesce" beats.
// Each returns an array of [x, y, z] points, one per particle in the
// shape's subset — computed once and reused, not regenerated per frame.
// Kept as simple parametric/piecewise math rather than literal detailed
// models, per the brief: abstract forms that read clearly at a glance.

function lerpKeypoints(keypoints, t) {
  for (let i = 0; i < keypoints.length - 1; i++) {
    const [t0, v0] = keypoints[i];
    const [t1, v1] = keypoints[i + 1];
    if (t >= t0 && t <= t1) {
      const localT = (t - t0) / (t1 - t0 || 1);
      return v0 + (v1 - v0) * localT;
    }
  }
  return keypoints[keypoints.length - 1][1];
}

// Flat -> small bump -> sharp spike -> dip -> small bump -> flat. A classic
// ECG silhouette, standing in for "Patient" without a literal figure.
const HEARTBEAT_KEYPOINTS = [
  [0, 0], [0.32, 0], [0.38, 0.3], [0.44, -0.25],
  [0.5, 2.4], [0.56, -1.7], [0.62, 0.25], [0.68, 0], [1, 0],
];

export function heartbeatShape(n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    pts.push([(t - 0.5) * 6.5, lerpKeypoints(HEARTBEAT_KEYPOINTS, t), 0]);
  }
  return pts;
}

// A short double-helix segment — two interleaved strands, deliberately
// echoing the helix motif already used elsewhere on the site.
export function helixShape(n) {
  const pts = [];
  const turns = 2;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const strand = i % 2;
    const angle = t * Math.PI * 2 * turns + (strand ? Math.PI : 0);
    pts.push([Math.cos(angle) * 1.3, (t - 0.5) * 6.5, Math.sin(angle) * 1.3]);
  }
  return pts;
}

// An ascending bar-chart silhouette — reads as "growth / analytics" at a
// glance, standing in for Nexus Diligence's financial-modeling core.
export function barsShape(n) {
  const bars = 5;
  const perBar = Math.ceil(n / bars);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const barIndex = Math.min(Math.floor(i / perBar), bars - 1);
    const barHeight = ((barIndex + 1) / bars) * 5;
    const withinBar = (i % perBar) / perBar;
    pts.push([(barIndex - (bars - 1) / 2) * 1.3, withinBar * barHeight - 2.5, 0]);
  }
  return pts;
}

export const MODULE_SHAPES = {
  patient: { generator: heartbeatShape, label: "PATIENT NEXUS // ONLINE" },
  clinical: { generator: helixShape, label: "CLINICAL NEXUS // ONLINE" },
  diligence: { generator: barsShape, label: "NEXUS DILIGENCE // ONLINE" },
};

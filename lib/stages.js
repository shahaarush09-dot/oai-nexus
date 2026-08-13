// The development-stage vocabulary, shared by the badge, the stage chart,
// and the roll-up helpers. Lives in lib/ rather than alongside the badge
// component so the aggregation layer can order by clinical progress
// without importing UI.
//
// These ten strings are the complete set present in the export, verified
// against both map.json and products.json. Ordered most to least
// advanced — sorting stages alphabetically puts "Approved" next to "Early
// Phase 1" and tells you nothing.
export const STAGE_ORDER = [
  "Approved",
  "Phase 4",
  "Phase 3",
  "Phase 2/Phase 3",
  "Phase 2",
  "Phase 1/Phase 2",
  "Phase 1",
  "Early Phase 1",
  "Orphan Designated",
  "Unknown",
];

export function stageRank(stage) {
  const i = STAGE_ORDER.indexOf(stage);
  return i === -1 ? STAGE_ORDER.length : i;
}

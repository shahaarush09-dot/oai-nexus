"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { STAGE_ORDER } from "@/lib/stages";

// Hex rather than Tailwind classes: recharts paints SVG fills directly and
// never sees the stylesheet. Mirrors the StageBadge ramp — teal for
// approved, a darkening blue ramp through the trial phases, gold and grey
// for the two non-trial states.
const STAGE_FILL = {
  Approved: "#2a9d8f",
  "Phase 4": "#3b6fd6",
  "Phase 3": "#3b6fd6",
  "Phase 2/Phase 3": "#3560b8",
  "Phase 2": "#2f57ab",
  "Phase 1/Phase 2": "#2a4a8f",
  "Phase 1": "#243d73",
  "Early Phase 1": "#1e3157",
  "Orphan Designated": "#c8a24a",
  Unknown: "#2a3654",
};

// Distinct products per development stage for one disease — an
// at-a-glance read on how mature the pipeline is, which a table of 800
// rows can't give you. Counts products, not map rows: the same product
// appears once per company that works on it, and counting rows would
// inflate whichever stage happens to have the most crowded partnerships.
export default function StageDistributionChart({ rows }) {
  const data = useMemo(() => {
    const byStage = new Map();
    for (const row of rows) {
      const stage = row.developmentStage || "Unknown";
      if (!byStage.has(stage)) byStage.set(stage, new Set());
      byStage.get(stage).add((row.productName || "").toLowerCase());
    }
    return STAGE_ORDER.filter((s) => byStage.has(s)).map((stage) => ({
      stage,
      count: byStage.get(stage).size,
    }));
  }, [rows]);

  if (!data.length) return null;

  return (
    <div className="rounded border border-navy-border bg-navy-900/60 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
        Products by development stage
      </p>
      <div className="mt-3" style={{ height: data.length * 28 + 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 28, bottom: 0, left: 0 }}
            barCategoryGap={6}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="stage"
              width={116}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94a3b8", fontSize: 10 }}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                background: "#080b15",
                border: "1px solid #1e2740",
                borderRadius: 4,
                fontSize: 12,
              }}
              labelStyle={{ color: "#e2e8f0" }}
              itemStyle={{ color: "#2a9d8f" }}
              formatter={(value) => [value.toLocaleString("en-US"), "Products"]}
            />
            <Bar dataKey="count" radius={[0, 2, 2, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.stage} fill={STAGE_FILL[d.stage] || "#2a3654"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

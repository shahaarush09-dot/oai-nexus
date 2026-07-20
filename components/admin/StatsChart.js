"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

const COLORS = { patient: "#2a9d8f", clinical: "#3b6fd6", bio: "#c8a24a" };
const LABELS = {
  patient: "Patient Nexus",
  clinical: "Clinical Nexus",
  bio: "Nexus Diligence",
};

export default function StatsChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-slate-400">No activity in the last 30 days yet.</p>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <Tooltip />
          <Legend formatter={(value) => LABELS[value] || value} />
          <Bar dataKey="patient" name="patient" fill={COLORS.patient} radius={[2, 2, 0, 0]} />
          <Bar dataKey="clinical" name="clinical" fill={COLORS.clinical} radius={[2, 2, 0, 0]} />
          <Bar dataKey="bio" name="bio" fill={COLORS.bio} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

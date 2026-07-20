import crypto from "node:crypto";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { login, signOut } from "./actions";
import { sessionToken, SESSION_COOKIE } from "@/lib/adminAuth";
import { fetchStats } from "@/lib/adminStats";
import StatsChart from "@/components/admin/StatsChart";
import RefreshButton from "@/components/admin/RefreshButton";

const MODULE_LABELS = {
  patient: "Patient Nexus",
  clinical: "Clinical Nexus",
  bio: "Nexus Diligence",
};

function isAuthenticated(secret) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return false;

  const expected = sessionToken(secret);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 p-5">
      <div className="text-3xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  );
}

export default async function AdminStatsPage({ searchParams }) {
  const dbUrl = process.env.DATABASE_URL;
  const password = process.env.ANALYTICS_PASSWORD;

  if (!dbUrl || !password) {
    console.error(
      "[admin/stats] Route disabled: DATABASE_URL or ANALYTICS_PASSWORD is not set in the environment."
    );
    notFound();
  }

  if (!isAuthenticated(password)) {
    const showError = searchParams?.error === "1";
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <form action={login} className="w-full max-w-sm">
          <h1 className="text-xl font-semibold text-slate-900">Nexus Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter the analytics password to continue.
          </p>
          {showError && (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Incorrect password.
            </p>
          )}
          <input
            type="password"
            name="password"
            required
            autoFocus
            placeholder="Password"
            className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-400"
          />
          <button
            type="submit"
            className="mt-3 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Sign In
          </button>
        </form>
      </div>
    );
  }

  let stats = null;
  let dbError = null;

  try {
    stats = await fetchStats();
  } catch (err) {
    console.error("[admin/stats] Database query failed:", err);
    dbError = "Database connection failed. Check environment variables and try again.";
  }

  const refreshedAt = new Date();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Nexus Analytics</h1>
          <div className="flex items-center gap-3">
            <RefreshButton />
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>

        {dbError ? (
          <p className="mt-10 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {dbError}
          </p>
        ) : (
          <>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Total Messages"
                value={stats.totalMessages.toLocaleString()}
              />
              <StatTile
                label="Users in Last 5 Minutes"
                value={stats.concurrentVisitors.toLocaleString()}
              />
              {Object.keys(MODULE_LABELS).map((key) => (
                <StatTile
                  key={key}
                  label={MODULE_LABELS[key]}
                  value={`${stats.perModule[key].toLocaleString()} messages`}
                />
              ))}
            </div>

            <p className="mt-6 text-sm text-slate-600">
              Unique Visitors — Patient: {stats.uniqueVisitors.patient} | Clinical:{" "}
              {stats.uniqueVisitors.clinical} | Diligence: {stats.uniqueVisitors.bio}
            </p>

            <div className="mt-12">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Last 30 Days
              </h2>
              <StatsChart data={stats.dailyData} />
            </div>
          </>
        )}

        <p className="mt-10 text-xs text-slate-400">
          Last refreshed: {refreshedAt.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

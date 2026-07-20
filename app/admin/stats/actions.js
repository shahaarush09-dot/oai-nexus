"use server";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionToken, SESSION_COOKIE } from "@/lib/adminAuth";

export async function login(formData) {
  const password = String(formData.get("password") || "");
  const expected = process.env.ANALYTICS_PASSWORD || "";

  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  const valid = expected.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!valid) {
    redirect("/admin/stats?error=1");
  }

  cookies().set(SESSION_COOKIE, sessionToken(expected), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60,
    path: "/admin/stats",
  });

  redirect("/admin/stats");
}

export async function signOut() {
  cookies().delete({ name: SESSION_COOKIE, path: "/admin/stats" });
  redirect("/admin/stats");
}

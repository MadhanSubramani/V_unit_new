"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  username: string;
  [key: string]: unknown;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("user");
    if (!stored) {
      router.replace("/login");
      return;
    }
    try {
      setUser(JSON.parse(stored));
    } catch {
      router.replace("/login");
    }
  }, [router]);

  function handleLogout() {
    sessionStorage.removeItem("user");
    router.push("/login");
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#0f0f11] px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,102,241,0.12),transparent)]"
      />
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/30">
              {user.username?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user.username}</p>
              <p className="text-xs text-zinc-500">Authenticated via Firestore</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-white/20 hover:text-white"
          >
            Sign out
          </button>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8">
          <h1 className="mb-1 text-2xl font-semibold text-white">
            Welcome, {user.username} 👋
          </h1>
          <p className="mb-6 text-sm text-zinc-500">
            You are signed in. Your session is stored in{" "}
            <code className="rounded bg-white/10 px-1 py-0.5 text-xs text-zinc-300">
              sessionStorage
            </code>
            .
          </p>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
              User record
            </p>
            <pre className="overflow-x-auto text-xs text-zinc-300">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </main>
  );
}

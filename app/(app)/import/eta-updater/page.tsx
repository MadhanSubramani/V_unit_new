"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import ModuleHeader from "@/components/ModuleHeader";
import {
  findImportJobsByVesselName,
  updateImportEtaByVesselName,
} from "@/lib/freightForward/freightForward";
import { formatContainersDisplay } from "@/lib/freightForward/containers";
import { FreightForward } from "@/types/freightForward";

export default function ImportEtaUpdaterPage() {
  const [vesselName, setVesselName] = useState("");
  const [etaDate, setEtaDate] = useState("");
  const [matches, setMatches] = useState<FreightForward[]>([]);
  const [searching, setSearching] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState<{ username?: string } | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        setUser(null);
      }
    }
  }, []);

  const searchVessel = useCallback(async (name: string) => {
    const trimmed = name.trim();
    setMessage("");
    setError("");
    if (!trimmed) {
      setMatches([]);
      return;
    }
    setSearching(true);
    try {
      const rows = await findImportJobsByVesselName(trimmed);
      setMatches(rows);
    } catch {
      setError("Unable to search Import jobs for this vessel.");
      setMatches([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void searchVessel(vesselName);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [vesselName, searchVessel]);

  const handleUpdate = async () => {
    setMessage("");
    setError("");
    const name = vesselName.trim();
    const eta = etaDate.trim();
    if (!name) {
      setError("Enter a vessel name.");
      return;
    }
    if (!eta) {
      setError("Select an ETA date.");
      return;
    }
    if (!matches.length) {
      setError("No Import jobs found for this vessel name.");
      return;
    }

    setUpdating(true);
    try {
      const result = await updateImportEtaByVesselName(
        name,
        eta,
        user?.username ?? "unknown"
      );
      setMessage(`Updated ETA to ${eta} on ${result.updated} Import job(s).`);
      const rows = await findImportJobsByVesselName(name);
      setMatches(rows);
    } catch {
      setError("Unable to update ETA. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <ModuleHeader
        title="Import — ETA Updater"
        description="Find IMP and Import-enabled Freight Forward jobs by vessel name and update ETA for all matches."
      />

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-600">
            Vessel Name
          </label>
          <input
            type="text"
            value={vesselName}
            onChange={(e) => setVesselName(e.target.value)}
            placeholder="Enter exact vessel name"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-600">
            ETA Date
          </label>
          <input
            type="date"
            value={etaDate}
            onChange={(e) => setEtaDate(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleUpdate()}
          disabled={updating || !vesselName.trim() || !etaDate || !matches.length}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          <CalendarClock size={14} />
          {updating ? "Updating..." : "Update ETA for all matching jobs"}
        </button>
        {searching && (
          <span className="text-[11px] text-zinc-400">Searching jobs...</span>
        )}
        {!searching && vesselName.trim() && (
          <span className="text-[11px] text-zinc-500">
            {matches.length} Import job(s) matched
          </span>
        )}
      </div>

      {error && <p className="mt-3 text-[11px] text-red-500">{error}</p>}
      {message && <p className="mt-3 text-[11px] text-emerald-600">{message}</p>}

      <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-200">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Job No</th>
              <th className="px-3 py-2 font-semibold">Consignee</th>
              <th className="px-3 py-2 font-semibold">Vessel</th>
              <th className="px-3 py-2 font-semibold">Current ETA</th>
              <th className="px-3 py-2 font-semibold">Containers</th>
              <th className="px-3 py-2 font-semibold">MBL</th>
            </tr>
          </thead>
          <tbody>
            {!vesselName.trim() ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-400">
                  Enter a vessel name to list matching Import jobs.
                </td>
              </tr>
            ) : searching ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-400">
                  Loading...
                </td>
              </tr>
            ) : matches.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-400">
                  No active Import jobs found for this vessel name.
                </td>
              </tr>
            ) : (
              matches.map((item) => (
                <tr key={item.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2 font-medium text-zinc-800">
                    {item.jobNumber || "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">
                    {item.consignmentName}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">
                    {item.vesselName || "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">{item.eta || "—"}</td>
                  <td className="px-3 py-2 text-zinc-700">
                    {formatContainersDisplay(item)}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">{item.mbl || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

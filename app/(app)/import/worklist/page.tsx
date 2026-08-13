"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import ModuleHeader from "@/components/ModuleHeader";
import ImportJobEditDrawer from "@/components/import/ImportJobEditDrawer";
import ImportLinerDrawer from "@/components/import/ImportLinerDrawer";
import ActionMenu from "@/components/shared/ActionMenu";
import {
  getImportLinerRecords,
} from "@/lib/freightForward/freightForward";
import { formatContainersDisplay } from "@/lib/freightForward/containers";
import {
  getImportCompletionCount,
  isImportLinerCompleted,
} from "@/lib/import/linerWorkflow";
import { FreightForward } from "@/types/freightForward";

const PAGE_SIZE = 15;

function locationLabel(item: FreightForward) {
  return item.locationType === "sez"
    ? item.sez || "—"
    : item.cfs || item.sez || "—";
}

export default function ImportWorklistPage() {
  const [records, setRecords] = useState<FreightForward[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<FreightForward | null>(null);
  const [drawerMode, setDrawerMode] = useState<"edit" | "view" | null>(null);
  const [user] = useState<{ username?: string } | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = sessionStorage.getItem("user");
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  });

  const reload = async () => {
    setLoading(true);
    try {
      setRecords(await getImportLinerRecords());
      setError("");
    } catch {
      setError("Unable to load Import job list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((item) =>
      [
        item.jobNumber,
        item.ezRefNumber,
        item.consignmentName,
        item.clientName,
        item.mbl,
        item.hbl,
        item.vesselName,
        item.liner,
        item.containerNumber,
        formatContainersDisplay(item),
      ].some((value) => String(value ?? "").toLowerCase().includes(needle))
    );
  }, [records, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const closeDetailDrawer = () => {
    setActiveItem(null);
    setDrawerMode(null);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <ModuleHeader
          title="Import — Job List"
          description="All IMP sequence jobs and Freight Forward jobs enabled for Import."
        />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      <div className="mt-5">
        <input
          value={search}
          onChange={(event) => {
            setPage(0);
            setSearch(event.target.value);
          }}
          placeholder="Search job no, consignee, MBL, HBL, vessel, container..."
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
        />
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
        <table className="min-w-[1100px] w-full text-left text-xs">
          <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-3 font-semibold">Job No</th>
              <th className="px-3 py-3 font-semibold">EZ No</th>
              <th className="px-3 py-3 font-semibold">Vessel</th>
              <th className="px-3 py-3 font-semibold">ETA</th>
              <th className="px-3 py-3 font-semibold">Location</th>
              <th className="px-3 py-3 font-semibold">Consignee</th>
              <th className="px-3 py-3 font-semibold">Client</th>
              <th className="px-3 py-3 font-semibold">MBL</th>
              <th className="px-3 py-3 font-semibold">HBL</th>
              <th className="px-3 py-3 font-semibold">Containers</th>
              <th className="px-3 py-3 font-semibold">Completion</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-zinc-400">
                  Loading job list...
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-zinc-400">
                  No jobs found. Use Add, or enable “Use this job for Import” in
                  Freight Forward.
                </td>
              </tr>
            ) : (
              visibleRows.map((item) => {
                const done = getImportCompletionCount(item);
                return (
                  <tr key={item.id} className="border-t border-zinc-100">
                    <td className="px-3 py-3 font-medium text-zinc-900">
                      {item.jobNumber || "—"}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">
                      {item.ezRefNumber || "—"}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">
                      {item.vesselName || "—"}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">{item.eta || "—"}</td>
                    <td className="px-3 py-3 text-zinc-700">
                      {locationLabel(item)}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">
                      {item.consignmentName || "—"}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">
                      {item.clientName || "—"}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">{item.mbl || "—"}</td>
                    <td className="px-3 py-3 text-zinc-700">{item.hbl || "—"}</td>
                    <td className="px-3 py-3 text-zinc-700">
                      {formatContainersDisplay(item)}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">{done} / 3</td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                          isImportLinerCompleted(item)
                            ? "bg-zinc-900 text-white"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {isImportLinerCompleted(item)
                          ? "Completed"
                          : "In Process"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <ActionMenu
                        showDelete={false}
                        onView={() => {
                          setActiveItem(item);
                          setDrawerMode("view");
                        }}
                        onEdit={() => {
                          setActiveItem(item);
                          setDrawerMode("edit");
                        }}
                        onDelete={() => undefined}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-xs">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-zinc-500">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page + 1 >= totalPages}
          onClick={() =>
            setPage((current) => Math.min(totalPages - 1, current + 1))
          }
          className="rounded-lg border border-zinc-200 px-3 py-1.5 disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {drawerOpen ? (
        <ImportLinerDrawer
          onClose={() => setDrawerOpen(false)}
          onSaved={() => void reload()}
          username={user?.username ?? "Unknown"}
        />
      ) : null}

      {activeItem && drawerMode ? (
        <ImportJobEditDrawer
          item={activeItem}
          mode={drawerMode}
          onClose={closeDetailDrawer}
          onSaved={(updated) => {
            setRecords((current) =>
              current.map((record) =>
                record.id === updated.id ? updated : record
              )
            );
            closeDetailDrawer();
          }}
          username={user?.username ?? "Unknown"}
        />
      ) : null}
    </div>
  );
}

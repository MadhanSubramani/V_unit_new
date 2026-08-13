"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import ModuleHeader from "@/components/ModuleHeader";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  getTrashedFreightForwardJobs,
  permanentlyDeleteFreightForwards,
  restoreFreightForwards,
} from "@/lib/freightForward/freightForward";
import { formatContainersDisplay } from "@/lib/freightForward/containers";
import { FreightForward } from "@/types/freightForward";

function formatDeletedAt(value: unknown) {
  if (!value) return "—";
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toLocaleString();
  }
  if (value instanceof Date) return value.toLocaleString();
  return String(value);
}

export default function FreightForwardTrashPage() {
  const router = useRouter();
  const [rows, setRows] = useState<FreightForward[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<{ username?: string; role?: string } | null>(null);
  const [allowed, setAllowed] = useState(false);

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTrashedFreightForwardJobs();
      setRows(data);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem("user");
    if (!stored) {
      router.replace("/login");
      return;
    }
    try {
      const parsed = JSON.parse(stored) as { username?: string; role?: string };
      setUser(parsed);
      if (parsed.role !== "admin") {
        router.replace("/freight-forward");
        return;
      }
      setAllowed(true);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (allowed) loadTrash();
  }, [allowed, loadTrash]);

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm">
        Checking access...
      </div>
    );
  }

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(rows.map((row) => row.id!).filter(Boolean)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRecover = async (ids: string[]) => {
    if (!ids.length || busy) return;
    setBusy(true);
    try {
      await restoreFreightForwards(ids, user?.username ?? "unknown");
      await loadTrash();
    } finally {
      setBusy(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!selectedIds.size) return;
    setBusy(true);
    try {
      await permanentlyDeleteFreightForwards([...selectedIds]);
      setConfirmOpen(false);
      await loadTrash();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <ModuleHeader
          title="Freight Forward Trash"
          description="Recover jobs back to the list, or permanently delete selected items and their files."
        />

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            {selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : `${rows.length} item${rows.length === 1 ? "" : "s"} in trash`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!selectedIds.size || busy}
              onClick={() => handleRecover([...selectedIds])}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw size={14} />
              Recover
            </button>
            <button
              type="button"
              disabled={!selectedIds.size || busy}
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={14} />
              Delete permanently
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-slate-50">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={!rows.length}
                      className="h-3.5 w-3.5 rounded border-zinc-300"
                      aria-label="Select all"
                    />
                  </th>
                  {[
                    "FF No",
                    "EZ No",
                    "Consignee",
                    "Cont No",
                    "ETA",
                    "Deleted By",
                    "Deleted At",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className={`whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 ${
                        h === "Actions" ? "text-center" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-zinc-500">
                      Loading...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-zinc-400">
                      Trash is empty.
                    </td>
                  </tr>
                ) : (
                  rows.map((item) => {
                    const id = item.id!;
                    const checked = selectedIds.has(id);
                    return (
                      <tr
                        key={id}
                        className="border-b border-zinc-100 hover:bg-zinc-50"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOne(id)}
                            className="h-3.5 w-3.5 rounded border-zinc-300"
                            aria-label={`Select ${item.jobNumber || id}`}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-800">
                          {item.jobNumber || "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {item.ezRefNumber || "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-800">
                          {item.consignmentName || "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {formatContainersDisplay(item)}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {item.eta || "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {item.deletedBy || "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {formatDeletedAt(item.deletedAt)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRecover([id])}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                          >
                            <RotateCcw size={12} />
                            Recover
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Permanently delete jobs?"
        message={`This will permanently delete ${selectedIds.size} job(s) and all uploaded files from storage. This cannot be undone.`}
        confirmLabel={busy ? "Deleting..." : "Delete forever"}
        onCancel={() => {
          if (!busy) setConfirmOpen(false);
        }}
        onConfirm={handlePermanentDelete}
      />
    </>
  );
}

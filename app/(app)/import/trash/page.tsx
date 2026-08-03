"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import ModuleHeader from "@/components/ModuleHeader";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  getTrashedImportLinerRecords,
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

export default function ImportTrashPage() {
  const router = useRouter();
  const [rows, setRows] = useState<FreightForward[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [user] = useState<{ username?: string; role?: string } | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = sessionStorage.getItem("user");
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  });

  const isAdmin = user?.role === "admin";

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTrashedImportLinerRecords();
      setRows(data);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isAdmin) {
      router.replace("/import/liner");
      return;
    }
    void loadTrash();
  }, [user, isAdmin, router, loadTrash]);

  if (!user || !isAdmin) {
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
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <ModuleHeader
        title="Import Trash"
        description="Recover or permanently delete Import Liner jobs."
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!selectedIds.size || busy}
          onClick={() => void handleRecover([...selectedIds])}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium disabled:opacity-40"
        >
          <RotateCcw size={14} />
          Recover selected
        </button>
        <button
          type="button"
          disabled={!selectedIds.size || busy}
          onClick={() => setConfirmOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 disabled:opacity-40"
        >
          <Trash2 size={14} />
          Delete permanently
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
        <table className="min-w-[960px] w-full text-left text-xs">
          <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-3 py-3 font-semibold">Job No</th>
              <th className="px-3 py-3 font-semibold">Consignee</th>
              <th className="px-3 py-3 font-semibold">MBL</th>
              <th className="px-3 py-3 font-semibold">HBL</th>
              <th className="px-3 py-3 font-semibold">Containers</th>
              <th className="px-3 py-3 font-semibold">Deleted At</th>
              <th className="px-3 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-zinc-400">
                  Loading trash...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-zinc-400">
                  No trashed Import jobs.
                </td>
              </tr>
            ) : (
              rows.map((item) => (
                <tr key={item.id} className="border-t border-zinc-100">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id!)}
                      onChange={() => toggleOne(item.id!)}
                    />
                  </td>
                  <td className="px-3 py-3 font-medium">
                    {item.jobNumber || "—"}
                  </td>
                  <td className="px-3 py-3">{item.consignmentName || "—"}</td>
                  <td className="px-3 py-3">{item.mbl || "—"}</td>
                  <td className="px-3 py-3">{item.hbl || "—"}</td>
                  <td className="px-3 py-3">
                    {formatContainersDisplay(item)}
                  </td>
                  <td className="px-3 py-3">
                    {formatDeletedAt(item.deletedAt)}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleRecover([item.id!])}
                      className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px] disabled:opacity-40"
                    >
                      Recover
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete permanently?"
        message="Selected Import jobs and their files will be permanently deleted. This cannot be undone."
        confirmLabel="Delete permanently"
        onConfirm={() => void handlePermanentDelete()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

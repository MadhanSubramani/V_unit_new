"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import ModuleHeader from "@/components/ModuleHeader";
import ImportJobEditDrawer from "@/components/import/ImportJobEditDrawer";
import ImportLinerDrawer from "@/components/import/ImportLinerDrawer";
import ActionMenu from "@/components/shared/ActionMenu";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  getImportLinerRecords,
  softDeleteFreightForward,
} from "@/lib/freightForward/freightForward";
import { formatContainersDisplay } from "@/lib/freightForward/containers";
import {
  getImportCompletionCount,
  getImportDoEmptyDisplay,
  getImportDoPortDisplay,
  getImportDoStatusLabel,
  getInwardBoeNoDisplay,
  isImportLinerCompleted,
} from "@/lib/import/linerWorkflow";
import { ImportLocationCell } from "@/components/import/ImportLocationCell";
import ImportSortableHeader from "@/components/import/ImportSortableHeader";
import { ImportSearchDownloadBar } from "@/components/import/ImportTableExtras";
import {
  ImportCurrentStatusCell,
  useImportTableRows,
} from "@/components/import/ImportTableState";
import {
  canActOnImportModule,
  isImportAdmin,
  parseImportSessionUser,
} from "@/lib/import/permissions";
import {
  ImportSortDir,
  ImportSortKey,
  toggleImportSort,
} from "@/lib/import/sortImportRecords";
import { FreightForward } from "@/types/freightForward";

const PAGE_SIZE = 15;

export default function ImportWorklistPage() {
  const [records, setRecords] = useState<FreightForward[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<ImportSortKey>("eta");
  const [sortDir, setSortDir] = useState<ImportSortDir>("asc");
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<FreightForward | null>(null);
  const [drawerMode, setDrawerMode] = useState<"edit" | "view" | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [user] = useState(() => parseImportSessionUser());
  const canAct = canActOnImportModule(user, "worklist");
  const canDelete = isImportAdmin(user);

  const handleColumnSort = (key: ImportSortKey) => {
    const next = toggleImportSort(sortKey, sortDir, key);
    setSortKey(next.sortKey);
    setSortDir(next.sortDir);
  };

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

  const { filtered, totalPages, visibleRows } = useImportTableRows({
    records,
    module: "worklist",
    search,
    page,
    pageSize: PAGE_SIZE,
    sortKey,
    sortDir,
  });

  const closeDetailDrawer = () => {
    setActiveItem(null);
    setDrawerMode(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await softDeleteFreightForward(deleteId, user?.username ?? "Unknown");
      setDeleteId(null);
      await reload();
    } catch {
      setError("Unable to move job to trash.");
    }
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
          disabled={!canAct}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      <ImportSearchDownloadBar
        search={search}
        onSearchChange={(value) => {
          setPage(0);
          setSearch(value);
        }}
        records={filtered}
        filePrefix="import-job-list"
      />

      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
        <table className="min-w-[1100px] w-full text-left text-xs">
          <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <ImportSortableHeader
                label="Job No"
                sortKey="jobNumber"
                activeSortKey={sortKey}
                sortDir={sortDir}
                onSort={handleColumnSort}
              />
              <th className="px-3 py-3 font-semibold">EZ No</th>
              <th className="px-3 py-3 font-semibold">Vessel</th>
              <ImportSortableHeader
                label="ETA"
                sortKey="eta"
                activeSortKey={sortKey}
                sortDir={sortDir}
                onSort={handleColumnSort}
              />
              <th className="px-3 py-3 font-semibold">Location</th>
              <th className="px-3 py-3 font-semibold">Consignee</th>
              <th className="px-3 py-3 font-semibold">Client</th>
              <th className="px-3 py-3 font-semibold">DO Status</th>
              <th className="px-3 py-3 font-semibold">Port</th>
              <th className="px-3 py-3 font-semibold">Empty</th>
              <th className="px-3 py-3 font-semibold">Inward BOE No</th>
              <th className="px-3 py-3 font-semibold">MBL</th>
              <th className="px-3 py-3 font-semibold">HBL</th>
              <th className="px-3 py-3 font-semibold">Containers</th>
              <th className="px-3 py-3 font-semibold">Completion</th>
              <th className="px-3 py-3 font-semibold">Current Status</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={18} className="px-4 py-10 text-center text-zinc-400">
                  Loading job list...
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={18} className="px-4 py-10 text-center text-zinc-400">
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
                    <ImportLocationCell item={item} />
                    <td className="px-3 py-3 text-zinc-700">
                      {item.consignmentName || "—"}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">
                      {item.clientName || "—"}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">
                      {getImportDoStatusLabel(item)}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">
                      {getImportDoPortDisplay(item)}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">
                      {getImportDoEmptyDisplay(item)}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">
                      {getInwardBoeNoDisplay(item)}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">{item.mbl || "—"}</td>
                    <td className="px-3 py-3 text-zinc-700">{item.hbl || "—"}</td>
                    <td className="px-3 py-3 text-zinc-700">
                      {formatContainersDisplay(item)}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">{done} / 3</td>
                    <ImportCurrentStatusCell item={item} module="worklist" />
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
                        showDelete={canDelete}
                        onView={() => {
                          setActiveItem(item);
                          setDrawerMode("view");
                        }}
                        onEdit={() => {
                          setActiveItem(item);
                          setDrawerMode(canAct ? "edit" : "view");
                        }}
                        onDelete={() => setDeleteId(item.id ?? null)}
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

      <ConfirmDialog
        open={!!deleteId}
        title="Move to trash?"
        message="This Import job will move to Import Trash. You can recover it later."
        confirmLabel="Move to trash"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

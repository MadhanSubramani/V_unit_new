"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import ModuleHeader from "@/components/ModuleHeader";
import ImportJobEditDrawer from "@/components/import/ImportJobEditDrawer";
import ImportLinerDrawer from "@/components/import/ImportLinerDrawer";
import ActionMenu from "@/components/shared/ActionMenu";
import HorizontalDragScroll from "@/components/shared/HorizontalDragScroll";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  getImportLinerRecords,
  softDeleteFreightForward,
} from "@/lib/freightForward/freightForward";
import { isImportAccountsCompleted } from "@/lib/import/accountsWorkflow";
import { getImportCompletionCount } from "@/lib/import/linerWorkflow";
import {
  ImportCoreTableCells,
  ImportCoreTableHeaders,
  ImportSearchDownloadBar,
} from "@/components/import/ImportTableExtras";
import {
  ImportCurrentStatusCell,
  useCfsScopedImportRecords,
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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

  const scoped = useCfsScopedImportRecords(records);
  const completedCount = scoped.filter(isImportAccountsCompleted).length;
  const inProgressCount = scoped.length - completedCount;

  const { filtered, totalPages, visibleRows } = useImportTableRows({
    records: scoped,
    module: "worklist",
    search,
    dateFrom,
    dateTo,
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
        {canAct ? (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white"
        >
          <Plus size={14} />
          Add
        </button>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            In Progress
          </p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{inProgressCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Completed
          </p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{completedCount}</p>
        </div>
      </div>

      <ImportSearchDownloadBar
        search={search}
        onSearchChange={(value) => {
          setPage(0);
          setSearch(value);
        }}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={(value) => {
          setPage(0);
          setDateFrom(value);
        }}
        onDateToChange={(value) => {
          setPage(0);
          setDateTo(value);
        }}
        records={filtered}
        filePrefix="import-job-list"
      />

      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <HorizontalDragScroll className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
        <table className="min-w-[1100px] w-full text-left text-xs">
          <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <ImportCoreTableHeaders
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleColumnSort}
              />
              <th className="px-3 py-3 font-semibold">Completion</th>
              <th className="px-3 py-3 font-semibold">Current Status</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={26} className="px-4 py-10 text-center text-zinc-400">
                  Loading job list...
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={26} className="px-4 py-10 text-center text-zinc-400">
                  No jobs found. Use Add, or enable “Use this job for Import” in
                  Freight Forward.
                </td>
              </tr>
            ) : (
              visibleRows.map((item) => {
                const done = getImportCompletionCount(item);
                const jobCompleted = isImportAccountsCompleted(item);
                return (
                  <tr key={item.id} className="border-t border-zinc-100">
                    <ImportCoreTableCells item={item} />
                    <td className="px-3 py-3 text-zinc-700">{done} / 3</td>
                    <ImportCurrentStatusCell item={item} module="worklist" />
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                          jobCompleted
                            ? "bg-zinc-900 text-white"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {jobCompleted ? "Completed" : "In Process"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <ActionMenu
                        showDelete={canDelete}
                        showEdit={canAct}
                        onView={() => {
                          setActiveItem(item);
                          setDrawerMode("view");
                        }}
                        onEdit={() => {
                          setActiveItem(item);
                          setDrawerMode("edit");
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
      </HorizontalDragScroll>

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

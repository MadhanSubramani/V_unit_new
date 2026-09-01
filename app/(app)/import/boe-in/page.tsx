"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import ModuleHeader from "@/components/ModuleHeader";
import ImportAuditLine from "@/components/import/ImportAuditLine";
import ImportDoStatusPanel from "@/components/import/ImportDoStatusPanel";
import {
  ImportDoTableCells,
  ImportSearchDownloadBar,
} from "@/components/import/ImportTableExtras";
import { ImportLocationCell } from "@/components/import/ImportLocationCell";
import { ImportTableCell } from "@/components/import/ImportJobTableCells";
import {
  completeImportBoeIn,
  getImportLinerRecords,
  revertImportBoeInAdmin,
  saveImportBoeInInward,
  updateImportBoeChecklist,
  updateImportBoeFiling,
} from "@/lib/freightForward/freightForward";
import { formatContainersDisplay } from "@/lib/freightForward/containers";
import {
  BOE_CHECKLIST_ITEMS,
  computeImportBoeInCounts,
  getBoeFilingStatus,
  getImportBoeInRecords,
  ImportBoeInCard,
  isBoeChecklistComplete,
  isImportBoeInCompleted,
  matchesImportBoeInCard,
} from "@/lib/import/boeInWorkflow";
import { getInwardBoeNoDisplay } from "@/lib/import/linerWorkflow";
import {
  FreightForward,
  ImportBoeChecklist,
  ImportBoeClearanceStatus,
  ImportBoeFilingStatus,
  INWARD_BOE_NO_REGEX,
} from "@/types/freightForward";

const PAGE_SIZE = 10;

export default function ImportBoeInPage() {
  const [records, setRecords] = useState<FreightForward[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<ImportBoeInCard | null>(
    "pendingChecklist"
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [panelWidth, setPanelWidth] = useState(0);
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

  useEffect(() => {
    let active = true;
    getImportLinerRecords()
      .then((items) => {
        if (active) setRecords(getImportBoeInRecords(items));
      })
      .catch(() => {
        if (active) setError("Unable to load BOE In jobs.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const container = tableScrollRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setPanelWidth(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const counts = useMemo(() => computeImportBoeInCounts(records), [records]);
  const cards: {
    key: ImportBoeInCard;
    label: string;
    value: string | number;
  }[] = [
    { key: "inProcess", label: "In Process", value: counts.inProcess },
    {
      key: "pendingChecklist",
      label: "Pending Checklist",
      value: counts.pendingChecklist,
    },
    { key: "unfiledBoe", label: "Unfiled BOE", value: counts.unfiledBoe },
    { key: "filedBoe", label: "Filed BOE", value: counts.filedBoe },
    {
      key: "completed",
      label: "Completed",
      value: counts.completed,
    },
  ];

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return records.filter((item) => {
      if (activeCard && !matchesImportBoeInCard(item, activeCard)) return false;
      if (!needle) return true;
      return [
        item.jobNumber,
        item.ezRefNumber,
        item.consignmentName,
        item.clientName,
        item.mbl,
        item.hbl,
        item.vesselName,
        item.inwardBoeNo,
        formatContainersDisplay(item),
      ].some((value) => String(value ?? "").toLowerCase().includes(needle));
    });
  }, [activeCard, records, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const applyUpdated = (updated: FreightForward) => {
    setRecords((current) =>
      current.map((record) => (record.id === updated.id ? updated : record))
    );
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <ModuleHeader
        title="Import — Z type BE"
        description="Import jobs run in parallel with Liner. Complete checklist, file BOE, then capture inward details."
      />

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => {
          const selected = activeCard === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => {
                setPage(0);
                setActiveCard((current) =>
                  current === card.key ? null : card.key
                );
              }}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                selected
                  ? "border-zinc-400 bg-white shadow-md ring-1 ring-zinc-300"
                  : "border-zinc-200 bg-zinc-50 hover:bg-white hover:shadow-sm"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                {card.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">
                {card.value}
              </p>
            </button>
          );
        })}
      </div>

      <ImportSearchDownloadBar
        search={search}
        onSearchChange={(value) => {
          setPage(0);
          setSearch(value);
        }}
        records={filtered}
        filePrefix="import-z-type-be"
      />

      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <div
        ref={tableScrollRef}
        className="mt-4 overflow-x-auto rounded-xl border border-zinc-200"
      >
        <table className="min-w-[1280px] w-full text-left text-xs">
          <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="w-9 px-2 py-3" />
              <th className="px-3 py-3 font-semibold">Job No</th>
              <th className="px-3 py-3 font-semibold">EZ No</th>
              <th className="px-3 py-3 font-semibold">BL Type</th>
              <th className="px-3 py-3 font-semibold">Trade Terms</th>
              <th className="px-3 py-3 font-semibold">Vessel</th>
              <th className="px-3 py-3 font-semibold">ETA</th>
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
              <th className="px-3 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={18} className="px-4 py-10 text-center text-zinc-400">
                  Loading BOE In jobs...
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={18} className="px-4 py-10 text-center text-zinc-400">
                  No import jobs found.
                </td>
              </tr>
            ) : (
              visibleRows.map((item) => (
                <BoeRow
                  key={item.id}
                  item={item}
                  expanded={expandedId === item.id}
                  busy={updatingId === item.id}
                  username={user?.username ?? "Unknown"}
                  isAdmin={user?.role === "admin"}
                  panelWidth={panelWidth}
                  onToggle={() =>
                    setExpandedId((current) =>
                      current === item.id ? null : item.id ?? null
                    )
                  }
                  onBusy={(id) => setUpdatingId(id)}
                  onError={setError}
                  onUpdated={applyUpdated}
                />
              ))
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
    </div>
  );
}

function BoeRow({
  item,
  expanded,
  busy,
  username,
  isAdmin,
  panelWidth,
  onToggle,
  onBusy,
  onError,
  onUpdated,
}: {
  item: FreightForward;
  expanded: boolean;
  busy: boolean;
  username: string;
  isAdmin: boolean;
  panelWidth: number;
  onToggle: () => void;
  onBusy: (id: string | null) => void;
  onError: (message: string) => void;
  onUpdated: (item: FreightForward) => void;
}) {
  const completed = isImportBoeInCompleted(item);
  const checklistDone = isBoeChecklistComplete(item);
  const filed = getBoeFilingStatus(item) === "filed";

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50"
      >
        <td className="px-2 py-3 text-zinc-400">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </td>
        <ImportTableCell value={item.jobNumber} width={105} className="font-medium text-zinc-900" />
        <ImportTableCell value={item.ezRefNumber} width={105} />
        <ImportTableCell value={item.blType} width={90} />
        <ImportTableCell value={item.tradeTerms} width={110} />
        <ImportTableCell value={item.vesselName} />
        <ImportTableCell value={item.eta} width={100} />
        <ImportLocationCell item={item} />
        <ImportTableCell value={item.consignmentName} />
        <ImportTableCell value={item.clientName} />
        <ImportDoTableCells item={item} />
        <ImportTableCell value={getInwardBoeNoDisplay(item)} width={120} />
        <ImportTableCell value={item.mbl} width={130} />
        <ImportTableCell value={item.hbl} width={130} />
        <ImportTableCell value={formatContainersDisplay(item)} width={170} />
        <td className="px-3 py-3">
          {busy ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-600">
              <LoaderCircle size={12} className="animate-spin" />
              Updating...
            </span>
          ) : (
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                completed
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {completed ? "Completed" : "In Process"}
            </span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-zinc-100 bg-zinc-100/70">
          <td colSpan={18} className="p-0">
            <div
              className="sticky left-0 min-w-0 p-3"
              style={panelWidth ? { width: panelWidth } : undefined}
            >
              <BoeExpansion
                item={item}
                busy={busy}
                username={username}
                isAdmin={isAdmin}
                checklistDone={checklistDone}
                filed={filed}
                completed={completed}
                onBusy={onBusy}
                onError={onError}
                onUpdated={onUpdated}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function BoeExpansion({
  item,
  busy,
  username,
  isAdmin,
  checklistDone,
  filed,
  completed,
  onBusy,
  onError,
  onUpdated,
}: {
  item: FreightForward;
  busy: boolean;
  username: string;
  isAdmin: boolean;
  checklistDone: boolean;
  filed: boolean;
  completed: boolean;
  onBusy: (id: string | null) => void;
  onError: (message: string) => void;
  onUpdated: (item: FreightForward) => void;
}) {
  const [adminEdit, setAdminEdit] = useState(false);
  const locked = completed && !(isAdmin && adminEdit);
  const [inwardNo, setInwardNo] = useState(item.inwardBoeNo ?? "");
  const [inwardDate, setInwardDate] = useState(item.inwardBoeDate ?? "");
  const [clearance, setClearance] = useState<ImportBoeClearanceStatus>(
    item.importBoeClearanceStatus ?? "rms"
  );

  useEffect(() => {
    setInwardNo(item.inwardBoeNo ?? "");
    setInwardDate(item.inwardBoeDate ?? "");
    setClearance(item.importBoeClearanceStatus ?? "rms");
  }, [item]);

  const run = async (task: () => Promise<FreightForward>) => {
    if (!item.id) return;
    onBusy(item.id);
    onError("");
    try {
      onUpdated(await task());
    } catch (updateError) {
      onError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update BOE In."
      );
    } finally {
      onBusy(null);
    }
  };

  const toggleCheck = (key: keyof ImportBoeChecklist, checked: boolean) => {
    const next = {
      ...(item.importBoeChecklist ?? {}),
      [key]: checked,
    };
    void run(() => updateImportBoeChecklist(item.id!, next, username));
  };

  const setFiling = (status: ImportBoeFilingStatus) => {
    void run(() => updateImportBoeFiling(item.id!, status, username));
  };

  const complete = () => {
    void run(() =>
      completeImportBoeIn(
        item.id!,
        {
          inwardBoeNo: inwardNo,
          inwardBoeDate: inwardDate,
          importBoeClearanceStatus: clearance,
        },
        username,
        { allowCompletedEdit: isAdmin && adminEdit }
      )
    );
  };

  const saveOpen = () => {
    void run(() =>
      saveImportBoeInInward(
        item.id!,
        {
          inwardBoeNo: inwardNo,
          inwardBoeDate: inwardDate,
          importBoeClearanceStatus: clearance,
        },
        username,
        { allowCompletedEdit: isAdmin && adminEdit }
      )
    );
  };

  const revertSection = (section: "checklist" | "filing" | "inward") => {
    void run(() => revertImportBoeInAdmin(item.id!, section, username, isAdmin));
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Z type BE workflow
            </p>
            <h3 className="mt-1 text-sm font-semibold text-zinc-900">
              {item.jobNumber || "Import"} — checklist, filing, inward
            </h3>
          </div>
          {isAdmin && completed && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setAdminEdit((current) => !current);
              }}
              className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[10px] font-semibold text-zinc-700"
            >
              {adminEdit ? "Lock" : "Edit"}
            </button>
          )}
        </div>
      </div>

      <div className="grid min-w-0 gap-3 p-4 lg:grid-cols-3">
        <section className="rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-[11px] font-bold text-white">
              {checklistDone ? <Check size={14} strokeWidth={3} /> : "1"}
            </span>
            <h3 className="text-sm font-semibold text-zinc-900">Checklist</h3>
          </div>
          <div
            className="mt-3 space-y-2"
            onClick={(event) => event.stopPropagation()}
          >
            {BOE_CHECKLIST_ITEMS.map((entry) => (
              <label
                key={entry.key}
                className="flex items-center gap-2 text-xs text-zinc-700"
              >
                <input
                  type="checkbox"
                  checked={!!item.importBoeChecklist?.[entry.key]}
                  disabled={busy || locked}
                  onChange={(event) =>
                    toggleCheck(entry.key, event.target.checked)
                  }
                />
                {entry.label}
              </label>
            ))}
          </div>
          <ImportAuditLine audit={item.importBoeChecklistAudit} />
          {isAdmin && adminEdit && (
            <button
              type="button"
              disabled={busy}
              onClick={() => revertSection("checklist")}
              className="mt-2 rounded-lg border border-red-200 px-2.5 py-1 text-[10px] font-semibold text-red-600"
            >
              Revert checklist
            </button>
          )}
        </section>

        <section
          className={`rounded-xl border p-4 ${
            checklistDone ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-50/80"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold ${
                checklistDone ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"
              }`}
            >
              {filed ? (
                <Check size={14} strokeWidth={3} />
              ) : checklistDone ? (
                "2"
              ) : (
                <LockKeyhole size={13} />
              )}
            </span>
            <h3 className="text-sm font-semibold text-zinc-900">BOE status</h3>
          </div>
          {!checklistDone ? (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
              <LockKeyhole size={12} />
              Complete checklist first
            </p>
          ) : (
            <div
              className="mt-3 space-y-2 text-xs"
              onClick={(event) => event.stopPropagation()}
            >
              {(["unfiled", "filed"] as ImportBoeFilingStatus[]).map(
                (status) => (
                  <label key={status} className="flex items-center gap-2 capitalize">
                    <input
                      type="radio"
                      name={`boe-filing-${item.id}`}
                      checked={getBoeFilingStatus(item) === status}
                      disabled={busy || locked}
                      onChange={() => setFiling(status)}
                    />
                    {status}
                  </label>
                )
              )}
            </div>
          )}
          <ImportAuditLine audit={item.importBoeFilingAudit} />
          {isAdmin && adminEdit && (
            <button
              type="button"
              disabled={busy}
              onClick={() => revertSection("filing")}
              className="mt-2 rounded-lg border border-red-200 px-2.5 py-1 text-[10px] font-semibold text-red-600"
            >
              Revert filing
            </button>
          )}
        </section>

        <section
          className={`rounded-xl border p-4 ${
            filed ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-50/80"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold ${
                filed ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"
              }`}
            >
              {completed ? (
                <Check size={14} strokeWidth={3} />
              ) : filed ? (
                "3"
              ) : (
                <LockKeyhole size={13} />
              )}
            </span>
            <h3 className="text-sm font-semibold text-zinc-900">Inward BOE</h3>
          </div>
          {!filed ? (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
              <LockKeyhole size={12} />
              File BOE first
            </p>
          ) : (
            <div
              className="mt-3 space-y-2"
              onClick={(event) => event.stopPropagation()}
            >
              <label className="block text-xs">
                <span className="font-medium text-zinc-700">Inward No</span>
                <input
                  value={inwardNo}
                  maxLength={7}
                  disabled={busy || locked}
                  onChange={(event) =>
                    setInwardNo(event.target.value.replace(/\D/g, "").slice(0, 7))
                  }
                  placeholder="7 digits"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                />
              </label>
              <label className="block text-xs">
                <span className="font-medium text-zinc-700">Date</span>
                <input
                  type="date"
                  value={inwardDate}
                  disabled={busy || locked}
                  onChange={(event) => setInwardDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                />
              </label>
              <label className="block text-xs">
                <span className="font-medium text-zinc-700">Status</span>
                <select
                  value={clearance}
                  disabled={busy || locked}
                  onChange={(event) =>
                    setClearance(event.target.value as ImportBoeClearanceStatus)
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                >
                  <option value="rms">RMS</option>
                  <option value="open">Open</option>
                </select>
              </label>
              {(!locked || (isAdmin && adminEdit)) && (
                <div className="flex flex-wrap gap-2">
                  {clearance === "open" ? (
                    <button
                      type="button"
                      disabled={
                        busy ||
                        !INWARD_BOE_NO_REGEX.test(inwardNo.trim()) ||
                        !inwardDate
                      }
                      onClick={saveOpen}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
                    >
                      Save
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        busy ||
                        !INWARD_BOE_NO_REGEX.test(inwardNo.trim()) ||
                        !inwardDate
                      }
                      onClick={complete}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
                    >
                      Complete
                    </button>
                  )}
                  {isAdmin && adminEdit && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => revertSection("inward")}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-[10px] font-semibold text-red-600"
                    >
                      Clear inward
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <ImportAuditLine audit={item.importBoeInCompleteAudit} />
        </section>
      </div>
      <ImportDoStatusPanel item={item} />
    </div>
  );
}

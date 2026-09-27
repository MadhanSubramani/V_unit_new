"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  LockKeyhole,
  Plus,
} from "lucide-react";
import ModuleHeader from "@/components/ModuleHeader";
import ImportAuditLine from "@/components/import/ImportAuditLine";
import ImportDoStatusPanel from "@/components/import/ImportDoStatusPanel";
import ImportJobDocumentsPanel from "@/components/import/ImportJobDocumentsPanel";
import ImportSectionProgress from "@/components/import/ImportSectionProgress";
import {
  ImportDoTableCells,
  ImportGoodsAndBeHeaders,
  ImportGoodsAndBeCells,
  ImportSearchDownloadBar,
} from "@/components/import/ImportTableExtras";
import { ImportLocationCell } from "@/components/import/ImportLocationCell";
import ImportSortableHeader from "@/components/import/ImportSortableHeader";
import {
  ImportCurrentStatusCell,
  useCfsScopedImportRecords,
  useImportTableRows,
} from "@/components/import/ImportTableState";
import { ImportEzCell } from "@/components/import/ImportEzCell";
import ImportSectionRemarks from "@/components/import/ImportSectionRemarks";
import { formatHblDisplay } from "@/lib/import/hbl";
import { ImportTableCell } from "@/components/import/ImportJobTableCells";
import {
  changeImportBoeOutVehicle,
  addImportSectionRemark,
  dispatchImportBoeOut,
  getImportLinerRecords,
  saveImportTTypeBoe,
  updateImportBoeOutDuty,
  updateImportBoeOutInwardOcc,
  updateImportBoeOutNewVehicle,
  updateImportEwayBill,
} from "@/lib/freightForward/freightForward";
import { formatContainersDisplay } from "@/lib/freightForward/containers";
import {
  getImportTruckDetails,
  getImportVehicleChanges,
  isVehicleChangeComplete,
} from "@/lib/import/transportWorkflow";
import {
  canTakeTTypeAction,
  canUnlockImportDutySection,
  canUnlockImportEwaySection,
  canUnlockImportTTypeSection,
  computeImportBoeOutCounts,
  createEmptyTTypeEntry,
  getImportBoeOutDutyStatus,
  getImportBoeOutInwardOccStatus,
  getImportBoeOutRecords,
  getImportTTypeEntries,
  getTTypeBoeNoDisplay,
  ImportBoeOutCard,
  isImportBoeOutDispatched,
  isImportBoeOutInwardOccDone,
  isImportTTypeBoeSaved,
  isImportTTypeSectionCompleted,
  isTTypeEntryCompleted,
  matchesImportBoeOutCard,
  T_TYPE_CLEARANCE_OPTIONS,
} from "@/lib/import/boeOutWorkflow";
import { getImportModuleProgressSteps } from "@/lib/import/sectionProgress";
import { getInwardBoeNoDisplay } from "@/lib/import/linerWorkflow";
import {
  canActOnImportModule,
  canExpandImportRow,
  parseImportSessionUser,
} from "@/lib/import/permissions";
import {
  ImportSortDir,
  ImportSortKey,
  toggleImportSort,
} from "@/lib/import/sortImportRecords";
import {
  FreightForward,
  ImportBoeClearanceStatus,
  ImportBoeOutDutyStatus,
  ImportBoeOutInwardOccStatus,
  ImportTTypeEntry,
  ImportVehicleChange,
  ImportYesNo,
  INWARD_BOE_NO_REGEX,
} from "@/types/freightForward";

const PAGE_SIZE = 10;

export default function ImportBoeOutPage() {
  const [records, setRecords] = useState<FreightForward[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<ImportBoeOutCard | null>(
    "inProcess"
  );
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<ImportSortKey>("eta");
  const [sortDir, setSortDir] = useState<ImportSortDir>("asc");
  const [error, setError] = useState("");
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [panelWidth, setPanelWidth] = useState(0);
  const [user] = useState(() => parseImportSessionUser());
  const canExpand = canExpandImportRow(user, "ttype");
  const canAct = canActOnImportModule(user, "ttype");

  const handleColumnSort = (key: ImportSortKey) => {
    const next = toggleImportSort(sortKey, sortDir, key);
    setSortKey(next.sortKey);
    setSortDir(next.sortDir);
  };

  useEffect(() => {
    let active = true;
    getImportLinerRecords()
      .then((items) => {
        if (active) setRecords(getImportBoeOutRecords(items));
      })
      .catch(() => {
        if (active) setError("Unable to load T type BE jobs.");
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

  const scoped = useCfsScopedImportRecords(records);
  const counts = useMemo(() => computeImportBoeOutCounts(scoped), [scoped]);
  const cards: {
    key: ImportBoeOutCard;
    label: string;
    value: number;
  }[] = [
    { key: "inProcess", label: "Joblist", value: counts.inProcess },
    { key: "todaysTask", label: "Today's Task", value: counts.todaysTask },
    { key: "filedBoe", label: "Filed BOE", value: counts.filedBoe },
    { key: "unfiledBoe", label: "Unfiled BOE", value: counts.unfiledBoe },
    { key: "dispatched", label: "Dispatched", value: counts.dispatched },
  ];

  const { filtered, totalPages, visibleRows } = useImportTableRows({
    records: scoped,
    module: "ttype",
    search,
    dateFrom,
    dateTo,
    page,
    pageSize: PAGE_SIZE,
    sortKey,
    sortDir,
    activeCard,
    matchesCard: matchesImportBoeOutCard as (
      item: FreightForward,
      card: string
    ) => boolean,
  });

  const applyUpdated = (updated: FreightForward) => {
    setRecords((current) =>
      current.map((record) => (record.id === updated.id ? updated : record))
    );
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <ModuleHeader
        title="Import — T type BE"
        description="All Import jobs. Complete inward OOC, T type filing, duty, and dispatch after Transport."
      />

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
        filePrefix="import-t-type-be"
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
              <ImportSortableHeader
                label="Job No"
                sortKey="jobNumber"
                activeSortKey={sortKey}
                sortDir={sortDir}
                onSort={handleColumnSort}
              />
              <th className="px-3 py-3 font-semibold">EZ No</th>
              <th className="px-3 py-3 font-semibold">BL Type</th>
              <th className="px-3 py-3 font-semibold">Trade Terms</th>
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
              <ImportGoodsAndBeHeaders />
              <th className="px-3 py-3 font-semibold">DO Status</th>
              <th className="px-3 py-3 font-semibold">Port</th>
              <th className="px-3 py-3 font-semibold">Empty</th>
              <th className="px-3 py-3 font-semibold">MBL</th>
              <th className="px-3 py-3 font-semibold">HBL</th>
              <th className="px-3 py-3 font-semibold">Containers</th>
              <th className="px-3 py-3 font-semibold">Current Status</th>
              <th className="px-3 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={19} className="px-4 py-10 text-center text-zinc-400">
                  Loading T type BE jobs...
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={19} className="px-4 py-10 text-center text-zinc-400">
                  No import jobs found.
                </td>
              </tr>
            ) : (
              visibleRows.map((item) => (
                <BoeOutRow
                  key={item.id}
                  item={item}
                  expanded={expandedId === item.id}
                  busy={updatingId === item.id}
                  username={user?.username ?? "Unknown"}
                  canExpand={canExpand}
                  canAct={canAct}
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

function BoeOutRow({
  item,
  expanded,
  busy,
  username,
  canExpand,
  canAct,
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
  canExpand: boolean;
  canAct: boolean;
  panelWidth: number;
  onToggle: () => void;
  onBusy: (id: string | null) => void;
  onError: (message: string) => void;
  onUpdated: (item: FreightForward) => void;
}) {
  const dispatched = isImportBoeOutDispatched(item);

  return (
    <>
      <tr
        onClick={canExpand ? onToggle : undefined}
        className={`border-t border-zinc-100 ${
          canExpand ? "cursor-pointer hover:bg-zinc-50" : ""
        }`}
      >
        <td className="px-2 py-3 text-zinc-400">
          {canExpand ? (
            expanded ? (
              <ChevronDown size={15} />
            ) : (
              <ChevronRight size={15} />
            )
          ) : null}
        </td>
        <ImportTableCell value={item.jobNumber} width={105} className="font-medium text-zinc-900" />
        <ImportEzCell item={item} />
        <ImportTableCell value={item.blType} width={90} />
        <ImportTableCell value={item.tradeTerms} width={110} />
        <ImportTableCell value={item.vesselName} />
        <ImportTableCell value={item.eta} width={100} />
        <ImportLocationCell item={item} />
        <ImportTableCell value={item.consignmentName} />
        <ImportTableCell value={item.clientName} />
        <ImportGoodsAndBeCells item={item} />
        <ImportDoTableCells item={item} />
        <ImportTableCell value={item.mbl} width={130} />
        <ImportTableCell value={formatHblDisplay(item)} width={130} />
        <ImportTableCell value={formatContainersDisplay(item)} width={170} />
        <ImportCurrentStatusCell item={item} module="ttype" />
        <td className="px-3 py-3">
          {busy ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-600">
              <LoaderCircle size={12} className="animate-spin" />
              Updating...
            </span>
          ) : (
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                dispatched
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {dispatched ? "Dispatched" : "In Process"}
            </span>
          )}
        </td>
      </tr>
      {canExpand && expanded && (
        <tr className="border-t border-zinc-100 bg-zinc-100/70">
          <td colSpan={19} className="p-0">
            <div
              className="sticky left-0 min-w-0 p-3"
              style={panelWidth ? { width: panelWidth } : undefined}
            >
              <BoeOutExpansion
                item={item}
                busy={busy}
                username={username}
                canAct={canAct}
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

function BoeOutExpansion({
  item,
  busy,
  username,
  canAct,
  onBusy,
  onError,
  onUpdated,
}: {
  item: FreightForward;
  busy: boolean;
  username: string;
  canAct: boolean;
  onBusy: (id: string | null) => void;
  onError: (message: string) => void;
  onUpdated: (item: FreightForward) => void;
}) {
  const dispatched = isImportBoeOutDispatched(item);
  const readOnly = dispatched || !canAct;
  const transportReady = canTakeTTypeAction(item);
  const occDone = isImportBoeOutInwardOccDone(item);
  const tTypeSaved = isImportTTypeBoeSaved(item);
  const tTypeCompleted = isImportTTypeSectionCompleted(item);
  const dutyUnlocked = canUnlockImportDutySection(item);
  const ewayUnlocked = canUnlockImportEwaySection(item);
  const dutyStatus = getImportBoeOutDutyStatus(item);
  const occStatus = getImportBoeOutInwardOccStatus(item);

  const [tTypeEntries, setTTypeEntries] = useState<ImportTTypeEntry[]>(() => {
    const existing = getImportTTypeEntries(item);
    return existing.length ? existing : [createEmptyTTypeEntry()];
  });
  const [statusPick, setStatusPick] = useState<Record<string, ImportBoeClearanceStatus>>(
    {}
  );
  const [dutyAccValue, setDutyAccValue] = useState(item.importBoeOutDutyAccValue ?? "");
  const [dutyAmt, setDutyAmt] = useState(item.importBoeOutDutyAmt ?? "");

  const [vehicleChanges, setVehicleChanges] = useState<ImportVehicleChange[]>(() =>
    getImportVehicleChanges(item)
  );

  useEffect(() => {
    const existing = getImportTTypeEntries(item);
    setTTypeEntries(existing.length ? existing : [createEmptyTTypeEntry()]);
    setDutyAccValue(item.importBoeOutDutyAccValue ?? "");
    setDutyAmt(item.importBoeOutDutyAmt ?? "");
    setVehicleChanges(getImportVehicleChanges(item));
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
          : "Unable to update T type BE."
      );
    } finally {
      onBusy(null);
    }
  };

  const setOcc = (status: ImportBoeOutInwardOccStatus) => {
    void run(() => updateImportBoeOutInwardOcc(item.id!, status, username));
  };

  const saveTType = () => {
    void run(() => saveImportTTypeBoe(item.id!, tTypeEntries, username));
  };

  const updateEntry = (id: string, patch: Partial<ImportTTypeEntry>) => {
    setTTypeEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    );
  };

  const addTTypeStatus = (entryId: string) => {
    const status = statusPick[entryId] ?? "open";
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setTTypeEntries((current) =>
      current.map((entry) => {
        if (entry.id !== entryId) return entry;
        const statuses = [
          ...(entry.statuses ?? []),
          { status, date, updatedBy: username },
        ];
        return {
          ...entry,
          statuses,
          completed: statuses.some((row) => row.status === "ooc"),
        };
      })
    );
  };

  const setDuty = (status: ImportBoeOutDutyStatus) => {
    void run(() =>
      updateImportBoeOutDuty(item.id!, status, username, {
        accValue: dutyAccValue,
        dutyAmt,
      })
    );
  };

  const startVehicleChange = () => {
    void run(() => changeImportBoeOutVehicle(item.id!, username));
  };

  const saveNewVehicle = () => {
    void run(() =>
      updateImportBoeOutNewVehicle(item.id!, vehicleChanges, username)
    );
  };

  const dispatch = () => {
    void run(() => dispatchImportBoeOut(item.id!, username));
  };

  const locked = readOnly;

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          T type BE workflow
        </p>
        <h3 className="mt-1 text-sm font-semibold text-zinc-900">
          {item.jobNumber || "Import"} — inward OOC, T type, duty, e waybill & dispatch
        </h3>
      </div>

      <div className="grid min-w-0 gap-3 p-4 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-[11px] font-bold text-white">
              {occDone ? <Check size={14} strokeWidth={3} /> : "1"}
            </span>
            <h3 className="text-sm font-semibold text-zinc-900">Inward OOC</h3>
          </div>
          {!transportReady ? (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
              <LockKeyhole size={12} />
              Complete Transport first
            </p>
          ) : (
          <div
            className="mt-3 space-y-2 text-xs"
            onClick={(event) => event.stopPropagation()}
          >
            {(["pending", "occ"] as ImportBoeOutInwardOccStatus[]).map(
              (status) => (
                <label key={status} className="flex items-center gap-2 capitalize">
                  <input
                    type="radio"
                    name={`inward-occ-${item.id}`}
                    checked={occStatus === status}
                    disabled={busy || locked}
                    onChange={() => setOcc(status)}
                  />
                  {status === "occ" ? "OOC" : "Pending"}
                </label>
              )
            )}
          </div>
          )}
          <ImportAuditLine audit={item.importBoeOutInwardOccAudit} />
        </section>

        <section
          className={`rounded-xl border p-4 ${
            canUnlockImportTTypeSection(item)
              ? "border-zinc-200 bg-white"
              : "border-zinc-200 bg-zinc-50/80"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold ${
                canUnlockImportTTypeSection(item)
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-200 text-zinc-500"
              }`}
            >
              {tTypeCompleted ? (
                <Check size={14} strokeWidth={3} />
              ) : canUnlockImportTTypeSection(item) ? (
                "2"
              ) : (
                <LockKeyhole size={13} />
              )}
            </span>
            <h3 className="text-sm font-semibold text-zinc-900">T type</h3>
          </div>
          {!canUnlockImportTTypeSection(item) ? (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
              <LockKeyhole size={12} />
              {transportReady
                ? "Mark Inward OOC first"
                : "Complete Transport first"}
            </p>
          ) : (
            <div
              className="mt-3 space-y-3"
              onClick={(event) => event.stopPropagation()}
            >
              {tTypeEntries.map((entry, index) => {
                const done = isTTypeEntryCompleted(entry);
                return (
                  <div
                    key={entry.id}
                    className="space-y-2 rounded-lg border border-zinc-200 p-3"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      T type {index + 1}
                      {done ? " — completed" : ""}
                    </p>
                    <label className="block text-xs">
                      <span className="font-medium text-zinc-700">T type No</span>
                      <input
                        value={entry.boeNo}
                        maxLength={7}
                        disabled={busy || locked}
                        onChange={(event) =>
                          updateEntry(entry.id, {
                            boeNo: event.target.value.replace(/\D/g, "").slice(0, 7),
                          })
                        }
                        placeholder="7 digits"
                        className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="font-medium text-zinc-700">Date</span>
                      <input
                        type="date"
                        value={entry.boeDate}
                        disabled={busy || locked}
                        onChange={(event) =>
                          updateEntry(entry.id, { boeDate: event.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                      />
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block text-xs">
                        <span className="font-medium text-zinc-700">Weight</span>
                        <input
                          value={entry.weight ?? ""}
                          disabled={busy || locked}
                          onChange={(event) =>
                            updateEntry(entry.id, { weight: event.target.value })
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                        />
                      </label>
                      <label className="block text-xs">
                        <span className="font-medium text-zinc-700">Package</span>
                        <input
                          value={entry.packages ?? ""}
                          disabled={busy || locked}
                          onChange={(event) =>
                            updateEntry(entry.id, { packages: event.target.value })
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                        />
                      </label>
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="block min-w-0 flex-1 text-xs">
                        <span className="font-medium text-zinc-700">Status</span>
                        <select
                          value={statusPick[entry.id] ?? "open"}
                          disabled={busy || locked}
                          onChange={(event) =>
                            setStatusPick((current) => ({
                              ...current,
                              [entry.id]: event.target.value as ImportBoeClearanceStatus,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                        >
                          {T_TYPE_CLEARANCE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {!readOnly && (
                        <button
                          type="button"
                          disabled={busy}
                          title="Add status"
                          onClick={() => addTTypeStatus(entry.id)}
                          className="mb-0.5 rounded-lg border border-zinc-300 p-1.5 text-zinc-700"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                    {(entry.statuses ?? []).length > 0 && (
                      <ul className="space-y-1 rounded-lg bg-zinc-50 px-2 py-1.5">
                        {entry.statuses.map((row, statusIndex) => (
                          <li
                            key={`${row.status}-${row.date}-${statusIndex}`}
                            className="flex items-center justify-between text-[11px] text-zinc-700"
                          >
                            <span className="font-semibold uppercase">
                              {row.status === "psc" ? "PCV" : row.status}
                            </span>
                            <span className="text-zinc-500">{row.date || "—"}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              {!readOnly && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setTTypeEntries((current) => [...current, createEmptyTTypeEntry()])
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-[10px] font-semibold text-zinc-700"
                >
                  <Plus size={12} />
                  Add T type
                </button>
              )}
              {!readOnly && (
                <button
                  type="button"
                  disabled={
                    busy ||
                    !tTypeEntries.some(
                      (entry) =>
                        INWARD_BOE_NO_REGEX.test(entry.boeNo.trim()) &&
                        Boolean(entry.boeDate)
                    )
                  }
                  onClick={saveTType}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
                >
                  Save
                </button>
              )}
              {tTypeCompleted && (
                <p className="text-[11px] font-medium text-zinc-700">
                  All T type BEs completed
                </p>
              )}
            </div>
          )}
          <ImportAuditLine audit={item.importTTypeBoeSaveAudit} />
        </section>

        <section
          className={`rounded-xl border p-4 ${
            dutyUnlocked ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-50/80"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold ${
                dutyUnlocked ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"
              }`}
            >
              {dutyStatus === "final" ? (
                <Check size={14} strokeWidth={3} />
              ) : dutyUnlocked ? (
                "3"
              ) : (
                <LockKeyhole size={13} />
              )}
            </span>
            <h3 className="text-sm font-semibold text-zinc-900">Duty</h3>
          </div>
          {!dutyUnlocked ? (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
              <LockKeyhole size={12} />
              Save T type first (OOC on all T types)
            </p>
          ) : (
            <div
              className="mt-3 space-y-2 text-xs"
              onClick={(event) => event.stopPropagation()}
            >
              {(["pending", "paid", "final"] as ImportBoeOutDutyStatus[]).map(
                (status) => (
                  <label key={status} className="flex items-center gap-2 capitalize">
                    <input
                      type="radio"
                      name={`duty-${item.id}`}
                      checked={dutyStatus === status}
                      disabled={
                        busy ||
                        locked ||
                        (status === "final" &&
                          (!dutyAccValue.trim() || !dutyAmt.trim()))
                      }
                      onChange={() => setDuty(status)}
                    />
                    {status}
                  </label>
                )
              )}
              {(dutyStatus === "paid" || dutyStatus === "final") && (
                <div className="grid gap-2 sm:grid-cols-2 pt-1">
                  <label className="block text-xs">
                    <span className="font-medium text-zinc-700">Acc value</span>
                    <input
                      value={dutyAccValue}
                      disabled={busy || locked || dutyStatus === "final"}
                      onChange={(event) => setDutyAccValue(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-medium text-zinc-700">Duty amt</span>
                    <input
                      value={dutyAmt}
                      disabled={busy || locked || dutyStatus === "final"}
                      onChange={(event) => setDutyAmt(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                    />
                  </label>
                </div>
              )}
            </div>
          )}
          <ImportAuditLine audit={item.importBoeOutDutyAudit} />
        </section>

        <section
          className={`rounded-xl border p-4 ${
            ewayUnlocked ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-50/80"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold ${
                ewayUnlocked ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"
              }`}
            >
              {dispatched ? (
                <Check size={14} strokeWidth={3} />
              ) : ewayUnlocked ? (
                "4"
              ) : (
                <LockKeyhole size={13} />
              )}
            </span>
            <h3 className="text-sm font-semibold text-zinc-900">E waybill</h3>
          </div>
          {tTypeSaved && (
            <div
              className="mt-3 flex gap-4 text-xs"
              onClick={(event) => event.stopPropagation()}
            >
              {(["yes", "no"] as ImportYesNo[]).map((value) => (
                <label key={value} className="inline-flex items-center gap-1.5 capitalize">
                  <input
                    type="radio"
                    name={`eway-${item.id}`}
                    checked={item.importEwayBill === value}
                    disabled={busy || readOnly}
                    onChange={() =>
                      void run(() =>
                        updateImportEwayBill(item.id!, value, username)
                      )
                    }
                  />
                  {value}
                </label>
              ))}
            </div>
          )}
          {!ewayUnlocked ? (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
              <LockKeyhole size={12} />
              Mark duty as Final first
            </p>
          ) : (
            <div
              className="mt-3 space-y-3"
              onClick={(event) => event.stopPropagation()}
            >
              <TransportTrucksReadOnly item={item} />

              {!item.importBoeOutVehicleChanged && !readOnly && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={startVehicleChange}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[10px] font-semibold text-zinc-700"
                >
                  Change of vehicle
                </button>
              )}

              {item.importBoeOutVehicleChanged && (
                <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
                  <ImportAuditLine audit={item.importBoeOutVehicleChangeAudit} />
                  {vehicleChanges.map((change, index) => (
                    <div key={index} className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Vehicle {index + 1}
                        {change.containerNumber ? ` — ${change.containerNumber}` : ""}
                      </p>
                      <dl className="grid gap-1 text-[11px] text-zinc-700 sm:grid-cols-2">
                        <div>
                          <dt className="text-zinc-500">Old transporter</dt>
                          <dd className="font-medium">{change.oldTransporter || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">Old vehicle</dt>
                          <dd className="font-medium">{change.oldVehicleNo || "—"}</dd>
                        </div>
                      </dl>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="block text-xs sm:col-span-2">
                          <span className="font-medium text-zinc-700">New transporter</span>
                          <input
                            value={change.newTransporter ?? ""}
                            disabled={busy || locked}
                            onChange={(event) =>
                              setVehicleChanges((current) =>
                                current.map((row, i) =>
                                  i === index
                                    ? { ...row, newTransporter: event.target.value }
                                    : row
                                )
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                          />
                        </label>
                        <label className="block text-xs">
                          <span className="font-medium text-zinc-700">New vehicle No</span>
                          <input
                            value={change.newVehicleNo ?? ""}
                            disabled={busy || locked}
                            onChange={(event) =>
                              setVehicleChanges((current) =>
                                current.map((row, i) =>
                                  i === index
                                    ? { ...row, newVehicleNo: event.target.value.toUpperCase() }
                                    : row
                                )
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                          />
                        </label>
                        <label className="block text-xs">
                          <span className="font-medium text-zinc-700">New driver</span>
                          <input
                            value={change.newDriverName ?? ""}
                            disabled={busy || locked}
                            onChange={(event) =>
                              setVehicleChanges((current) =>
                                current.map((row, i) =>
                                  i === index
                                    ? { ...row, newDriverName: event.target.value }
                                    : row
                                )
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                          />
                        </label>
                        <label className="block text-xs sm:col-span-2">
                          <span className="font-medium text-zinc-700">Ph no</span>
                          <input
                            value={change.newDriverPhone ?? ""}
                            disabled={busy || locked}
                            onChange={(event) =>
                              setVehicleChanges((current) =>
                                current.map((row, i) =>
                                  i === index
                                    ? {
                                        ...row,
                                        newDriverPhone: event.target.value
                                          .replace(/\D/g, "")
                                          .slice(0, 10),
                                      }
                                    : row
                                )
                              )
                            }
                            placeholder="10 digits"
                            className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                  {!readOnly && (
                    <button
                      type="button"
                      disabled={
                        busy || !vehicleChanges.every(isVehicleChangeComplete)
                      }
                      onClick={saveNewVehicle}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[10px] font-semibold text-zinc-700 disabled:opacity-40"
                    >
                      Save new vehicles
                    </button>
                  )}
                </div>
              )}

              {!readOnly && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={dispatch}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
                >
                  Dispatch
                </button>
              )}
              <ImportAuditLine audit={item.importBoeOutDispatchAudit} />
            </div>
          )}
        </section>
      </div>
      <ImportSectionRemarks
        remarks={item.importBoeOutRemarks ?? []}
        busy={busy}
        canAct={canAct && !readOnly}
        onAdd={(text) =>
          run(() => addImportSectionRemark(item.id!, "ttype", text, username))
        }
      />
      <ImportDoStatusPanel item={item} />
      <ImportJobDocumentsPanel
        item={item}
        canManage={canAct}
        username={username}
        onUpdated={onUpdated}
      />
      <ImportSectionProgress steps={getImportModuleProgressSteps(item)} />
    </div>
  );
}

function TransportTrucksReadOnly({ item }: { item: FreightForward }) {
  const trucks = getImportTruckDetails(item);
  return (
    <div className="space-y-2">
      {trucks.map((truck, index) => (
        <div key={index}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Transport {index + 1}
            {truck.containerNumber ? ` — ${truck.containerNumber}` : ""}
          </p>
          <dl className="mt-2 grid gap-1 text-[11px] text-zinc-700 sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Transporter</dt>
              <dd className="font-medium">{truck.importTransporter?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Vehicle No</dt>
              <dd className="font-medium">{truck.importVehicleNo?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Driver</dt>
              <dd className="font-medium">{truck.importDriverName?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Phone</dt>
              <dd className="font-medium">{truck.importDriverPhone?.trim() || "—"}</dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  );
}

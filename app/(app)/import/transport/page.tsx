"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  ScanLine,
} from "lucide-react";
import ModuleHeader from "@/components/ModuleHeader";
import HorizontalDragScroll from "@/components/shared/HorizontalDragScroll";
import ImportAuditLine from "@/components/import/ImportAuditLine";
import ImportDoStatusPanel from "@/components/import/ImportDoStatusPanel";
import ImportJobDocumentsPanel from "@/components/import/ImportJobDocumentsPanel";
import ImportSectionProgress from "@/components/import/ImportSectionProgress";
import {
  ImportCurrentStatusCell,
  useCfsScopedImportRecords,
  useImportTableRows,
} from "@/components/import/ImportTableState";
import ImportSectionRemarks from "@/components/import/ImportSectionRemarks";
import {
  ImportCoreTableCells,
  ImportCoreTableHeaders,
  ImportSearchDownloadBar,
} from "@/components/import/ImportTableExtras";
import {
  completeImportTransport,
  addImportSectionRemark,
  getImportLinerRecords,
  saveImportTransportDraft,
  updateImportTransportCfsReached,
  updateImportTransportPortDirection,
} from "@/lib/freightForward/freightForward";
import { getInwardBoeNoDisplay } from "@/lib/import/linerWorkflow";
import {
  canTakeTransportAction,
  computeImportTransportCounts,
  getImportTransportRecords,
  getImportTruckDetails,
  ImportTransportCard,
  isImportTransportCompleted,
  matchesImportTransportCard,
} from "@/lib/import/transportWorkflow";
import { getImportModuleProgressSteps } from "@/lib/import/sectionProgress";
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
import { FreightForward, ImportCfsReachedStatus, ImportPortDirection, ImportScanningResult, ImportTruckDetail } from "@/types/freightForward";

const PAGE_SIZE = 10;

export default function ImportTransportPage() {
  const [records, setRecords] = useState<FreightForward[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<ImportTransportCard | null>(
    "incomplete"
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
  const canExpand = canExpandImportRow(user, "transport");
  const canAct = canActOnImportModule(user, "transport");

  const handleColumnSort = (key: ImportSortKey) => {
    const next = toggleImportSort(sortKey, sortDir, key);
    setSortKey(next.sortKey);
    setSortDir(next.sortDir);
  };

  useEffect(() => {
    let active = true;
    getImportLinerRecords()
      .then((items) => {
        if (active) setRecords(getImportTransportRecords(items));
      })
      .catch(() => {
        if (active) setError("Unable to load Transport jobs.");
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
  const counts = useMemo(
    () => computeImportTransportCounts(scoped),
    [scoped]
  );
  const cards: {
    key: ImportTransportCard;
    label: string;
    value: number;
  }[] = [
    { key: "incomplete", label: "Joblist", value: counts.incomplete },
    { key: "boeFiled", label: "BOE Filed", value: counts.boeFiled },
    { key: "boeUnfiled", label: "BOE Unfiled", value: counts.boeUnfiled },
    { key: "completed", label: "Completed", value: counts.completed },
  ];

  const { filtered, totalPages, visibleRows } = useImportTableRows({
    records: scoped,
    module: "transport",
    search,
    dateFrom,
    dateTo,
    page,
    pageSize: PAGE_SIZE,
    sortKey,
    sortDir,
    activeCard,
    matchesCard: matchesImportTransportCard as (
      item: FreightForward,
      card: string
    ) => boolean,
  });

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <ModuleHeader
        title="Import — Transport"
        description="All Import jobs. Capture truck details after Z type BE is completed."
      />

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        filePrefix="import-transport"
      />

      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <HorizontalDragScroll
        scrollRef={tableScrollRef}
        className="mt-4 overflow-x-auto rounded-xl border border-zinc-200"
      >
        <table className="min-w-[1280px] w-full text-left text-xs">
          <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="w-9 px-2 py-3" />
              <ImportCoreTableHeaders
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleColumnSort}
              />
              <th className="px-3 py-3 font-semibold">Current Status</th>
              <th className="px-3 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={25} className="px-4 py-10 text-center text-zinc-400">
                  Loading Transport jobs...
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={25} className="px-4 py-10 text-center text-zinc-400">
                  No import jobs found.
                </td>
              </tr>
            ) : (
              visibleRows.map((item) => (
                <TransportRow
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
                  onUpdated={(updated) =>
                    setRecords((current) =>
                      current.map((record) =>
                        record.id === updated.id ? updated : record
                      )
                    )
                  }
                />
              ))
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
    </div>
  );
}

function TransportRow({
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
  const completed = isImportTransportCompleted(item);
  const actionable = canTakeTransportAction(item);

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
        <ImportCoreTableCells item={item} />
        <ImportCurrentStatusCell item={item} module="transport" />
        <td className="px-3 py-3">
          {busy ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-600">
              <LoaderCircle size={12} className="animate-spin" />
              Updating...
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <ScanLine
                size={14}
                className={
                  item.importScanningEnabled
                    ? "text-zinc-900"
                    : "text-zinc-300"
                }
              />
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                  completed
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {completed ? "Completed" : "In Process"}
              </span>
            </span>
          )}
        </td>
      </tr>
      {canExpand && expanded && (
        <tr className="border-t border-zinc-100 bg-zinc-100/70">
          <td colSpan={25} className="p-0">
            <div
              className="sticky left-0 min-w-0 p-3"
              style={panelWidth ? { width: panelWidth } : undefined}
            >
              <TruckDetailCard
                item={item}
                busy={busy}
                username={username}
                completed={completed}
                actionable={actionable}
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

function TruckDetailCard({
  item,
  busy,
  username,
  completed,
  actionable,
  canAct,
  onBusy,
  onError,
  onUpdated,
}: {
  item: FreightForward;
  busy: boolean;
  username: string;
  completed: boolean;
  actionable: boolean;
  canAct: boolean;
  onBusy: (id: string | null) => void;
  onError: (message: string) => void;
  onUpdated: (item: FreightForward) => void;
}) {
  const editable = actionable && canAct && !completed;
  const [trucks, setTrucks] = useState<ImportTruckDetail[]>(() =>
    getImportTruckDetails(item)
  );

  useEffect(() => {
    setTrucks(getImportTruckDetails(item));
  }, [item]);

  const updateTruck = (index: number, patch: Partial<ImportTruckDetail>) => {
    setTrucks((current) =>
      current.map((truck, i) => (i === index ? { ...truck, ...patch } : truck))
    );
  };

  const saveDraft = async () => {
    if (!item.id) return;
    onBusy(item.id);
    onError("");
    try {
      onUpdated(await saveImportTransportDraft(item.id, trucks, username));
    } catch (updateError) {
      onError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to save Transport."
      );
    } finally {
      onBusy(null);
    }
  };

  const complete = async () => {
    if (!item.id) return;
    onBusy(item.id);
    onError("");
    try {
      onUpdated(await completeImportTransport(item.id, trucks, username));
    } catch (updateError) {
      onError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to complete Transport."
      );
    } finally {
      onBusy(null);
    }
  };

  const allTrucksReady = trucks.every(
    (truck) =>
      Boolean(truck.importTransporter?.trim()) &&
      Boolean(truck.importVehicleNo?.trim()) &&
      Boolean(truck.importDriverName?.trim()) &&
      Boolean(truck.importDriverPhone?.trim()) &&
      (!truck.importScanningEnabled || Boolean(truck.importScanningResult))
  );

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Transport workflow
        </p>
        <h3 className="mt-1 text-sm font-semibold text-zinc-900">
          Truck detail & tracking
        </h3>
      </div>
      <section
        className="max-w-xl space-y-3 p-4"
        onClick={(event) => event.stopPropagation()}
      >
        {!actionable && !completed && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            BOE must be filed and Z type BE completed before transport actions are
            available.
          </p>
        )}
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-[11px] font-bold text-white">
            {completed ? <Check size={14} strokeWidth={3} /> : "1"}
          </span>
          <h3 className="text-sm font-semibold text-zinc-900">Truck status</h3>
        </div>
        {trucks.map((truck, index) => (
          <div key={index} className="rounded-lg border border-zinc-200 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Truck {index + 1}
              {truck.containerNumber ? ` — ${truck.containerNumber}` : ""}
            </p>
            <div className="mt-3 flex gap-4 text-xs">
              <span className="font-medium text-zinc-700">Stash</span>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name={`stash-${item.id}-${index}`}
                  checked={truck.importTruckStash === true}
                  disabled={busy || !editable}
                  onChange={() => updateTruck(index, { importTruckStash: true })}
                />
                Yes
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name={`stash-${item.id}-${index}`}
                  checked={truck.importTruckStash !== true}
                  disabled={busy || !editable}
                  onChange={() => updateTruck(index, { importTruckStash: false })}
                />
                No
              </label>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="block text-xs sm:col-span-2">
                <span className="font-medium text-zinc-700">Transporter</span>
                <input
                  value={truck.importTransporter ?? ""}
                  disabled={busy || !editable}
                  onChange={(event) =>
                    updateTruck(index, { importTransporter: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                />
              </label>
              <label className="block text-xs">
                <span className="font-medium text-zinc-700">Vehicle No</span>
                <input
                  value={truck.importVehicleNo ?? ""}
                  disabled={busy || !editable}
                  onChange={(event) =>
                    updateTruck(index, {
                      importVehicleNo: event.target.value.toUpperCase(),
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                />
              </label>
              <label className="block text-xs">
                <span className="font-medium text-zinc-700">Driver name</span>
                <input
                  value={truck.importDriverName ?? ""}
                  disabled={busy || !editable}
                  onChange={(event) =>
                    updateTruck(index, { importDriverName: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                />
              </label>
              <label className="block text-xs sm:col-span-2">
                <span className="font-medium text-zinc-700">Ph no</span>
                <input
                  value={truck.importDriverPhone ?? ""}
                  disabled={busy || !editable}
                  onChange={(event) =>
                    updateTruck(index, {
                      importDriverPhone: event.target.value.replace(/\D/g, "").slice(0, 10),
                    })
                  }
                  placeholder="10 digits"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                />
              </label>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <p className="font-medium text-zinc-700">Scanning</p>
              <div className="flex gap-4">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`scan-${item.id}-${index}`}
                    checked={truck.importScanningEnabled === true}
                    disabled={busy || !editable}
                    onChange={() => updateTruck(index, { importScanningEnabled: true })}
                  />
                  Yes
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`scan-${item.id}-${index}`}
                    checked={truck.importScanningEnabled !== true}
                    disabled={busy || !editable}
                    onChange={() =>
                      updateTruck(index, {
                        importScanningEnabled: false,
                        importScanningResult: undefined,
                      })
                    }
                  />
                  No
                </label>
              </div>
              {truck.importScanningEnabled && (
                <label className="mt-2 block text-xs">
                  <span className="font-medium text-zinc-700">Scanning result</span>
                  <select
                    value={truck.importScanningResult ?? ""}
                    disabled={busy || !editable}
                    onChange={(event) =>
                      updateTruck(index, {
                        importScanningResult: event.target.value as ImportScanningResult,
                      })
                    }
                    className="mt-1 w-full max-w-xs rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                  >
                    <option value="">Select</option>
                    <option value="clean">Clean</option>
                    <option value="mismatch">Mismatch</option>
                  </select>
                </label>
              )}
            </div>
          </div>
        ))}
        {!completed && canAct && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !actionable}
              onClick={() => void saveDraft()}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[10px] font-semibold text-zinc-700 disabled:opacity-40"
            >
              Save
            </button>
            <button
              type="button"
              disabled={busy || !editable || !allTrucksReady}
              onClick={() => void complete()}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
            >
              Complete
            </button>
          </div>
        )}
        <ImportAuditLine audit={item.importTransportCompleteAudit} />
      </section>
      <TransportTrackingSection
        item={item}
        busy={busy}
        actionable={actionable && canAct}
        username={username}
        onBusy={onBusy}
        onError={onError}
        onUpdated={onUpdated}
      />
      <ImportSectionRemarks
        className="px-4"
        remarks={item.importTransportRemarks ?? []}
        busy={busy}
        canAct={canAct}
        onAdd={async (text) => {
          if (!item.id) return;
          onBusy(item.id);
          onError("");
          try {
            onUpdated(
              await addImportSectionRemark(item.id, "transport", text, username)
            );
          } catch (updateError) {
            onError(
              updateError instanceof Error
                ? updateError.message
                : "Unable to save remark."
            );
          } finally {
            onBusy(null);
          }
        }}
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

function TransportTrackingSection({
  item,
  busy,
  actionable,
  username,
  onBusy,
  onError,
  onUpdated,
}: {
  item: FreightForward;
  busy: boolean;
  actionable: boolean;
  username: string;
  onBusy: (id: string | null) => void;
  onError: (message: string) => void;
  onUpdated: (item: FreightForward) => void;
}) {
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
          : "Unable to update transport tracking."
      );
    } finally {
      onBusy(null);
    }
  };

  return (
    <section
      className="border-t border-zinc-200 p-4"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-[11px] font-bold text-white">
          2
        </span>
        <h3 className="text-sm font-semibold text-zinc-900">Port & CFS tracking</h3>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="font-medium text-zinc-700">Port</span>
          <select
            value={item.importPortDirection ?? ""}
            disabled={busy || !actionable}
            onChange={(event) =>
              void run(() =>
                updateImportTransportPortDirection(
                  item.id!,
                  event.target.value as ImportPortDirection,
                  username
                )
              )
            }
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
          >
            <option value="">Select</option>
            <option value="port_in">Port in</option>
            <option value="port_out">Port out</option>
          </select>
          <ImportAuditLine audit={item.importPortDirectionAudit} emptyLabel="" />
        </label>
        <label className="block text-xs">
          <span className="font-medium text-zinc-700">CFS</span>
          <select
            value={item.importCfsReached ?? ""}
            disabled={busy || !actionable}
            onChange={(event) =>
              void run(() =>
                updateImportTransportCfsReached(
                  item.id!,
                  event.target.value as ImportCfsReachedStatus,
                  username
                )
              )
            }
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
          >
            <option value="">Select</option>
            <option value="reached">Reached FTWZ</option>
            <option value="not_reached">Pending</option>
          </select>
          <ImportAuditLine audit={item.importCfsReachedAudit} emptyLabel="" />
        </label>
      </div>
    </section>
  );
}

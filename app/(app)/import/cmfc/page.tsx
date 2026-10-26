"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, LoaderCircle } from "lucide-react";
import ModuleHeader from "@/components/ModuleHeader";
import HorizontalDragScroll from "@/components/shared/HorizontalDragScroll";
import ImportAuditLine from "@/components/import/ImportAuditLine";
import ImportJobDocumentsPanel from "@/components/import/ImportJobDocumentsPanel";
import ImportSectionRemarks from "@/components/import/ImportSectionRemarks";
import {
  ImportCurrentStatusCell,
  useCfsScopedImportRecords,
  useImportTableRows,
} from "@/components/import/ImportTableState";
import {
  ImportCoreTableCells,
  ImportCoreTableHeaders,
  ImportSearchDownloadBar,
  IMPORT_TABLE_HEAD_CLASS,
} from "@/components/import/ImportTableExtras";
import {
  addImportSectionRemark,
  getImportLinerRecords,
  updateImportCmfcPrintStatus,
} from "@/lib/freightForward/freightForward";
import {
  computeImportCmfcCounts,
  getImportCmfcPrintStatus,
  getImportCmfcRecords,
  ImportCmfcCard,
  matchesImportCmfcCard,
} from "@/lib/import/cmfcWorkflow";
import { collectCmfcPrintDocuments } from "@/lib/import/collectJobDocuments";
import { downloadMergedImportDocuments } from "@/lib/import/mergeDocuments";
import {
  canActOnImportModule,
  canExpandImportRow,
  parseImportSessionUser,
} from "@/lib/import/permissions";
import type { ImportDateField } from "@/lib/import/dateFields";
import {
  ImportSortDir,
  ImportSortKey,
  toggleImportSort,
} from "@/lib/import/sortImportRecords";
import { FreightForward } from "@/types/freightForward";

const PAGE_SIZE = 10;

export default function ImportCmfcPage() {
  const [records, setRecords] = useState<FreightForward[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<ImportCmfcCard | null>("not_completed");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateField, setDateField] = useState<ImportDateField>("eta");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<ImportSortKey>("eta");
  const [sortDir, setSortDir] = useState<ImportSortDir>("asc");
  const [error, setError] = useState("");
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [panelWidth, setPanelWidth] = useState(0);
  const [user] = useState(() => parseImportSessionUser());
  const canExpand = canExpandImportRow(user, "cmfc");
  const canAct = canActOnImportModule(user, "cmfc");

  useEffect(() => {
    let active = true;
    getImportLinerRecords()
      .then((items) => {
        if (active) setRecords(getImportCmfcRecords(items));
      })
      .catch(() => {
        if (active) setError("Unable to load CMFC jobs.");
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
  const counts = useMemo(() => computeImportCmfcCounts(scoped), [scoped]);
  const { filtered, totalPages, visibleRows } = useImportTableRows({
    records: scoped,
    module: "cmfc",
    search,
    dateFrom,
    dateTo,
    dateField,
    page,
    pageSize: PAGE_SIZE,
    sortKey,
    sortDir,
    activeCard,
    matchesCard: matchesImportCmfcCard as (item: FreightForward, card: string) => boolean,
  });

  const applyUpdated = (updated: FreightForward) => {
    setRecords((current) =>
      current.map((row) => (row.id === updated.id ? updated : row))
    );
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <ModuleHeader
        title="Import — CMFC"
        description="Filed BOE jobs. Print IGM, BL, CI, PL and other documents, then mark print complete."
      />
      <div className="mt-5 grid grid-cols-3 gap-3">
        {(
          [
            { key: "filedBoe", label: "Filed BOE", value: counts.filedBoe },
            { key: "not_completed", label: "Print not completed", value: counts.not_completed },
            { key: "completed", label: "Print completed", value: counts.completed },
          ] as { key: ImportCmfcCard; label: string; value: number }[]
        ).map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => {
              setPage(0);
              setActiveCard((current) => (current === card.key ? null : card.key));
            }}
            className={`rounded-xl border px-4 py-3 text-left ${
              activeCard === card.key
                ? "border-zinc-400 bg-white shadow-md"
                : "border-zinc-200 bg-zinc-50"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-zinc-900">{card.value}</p>
          </button>
        ))}
      </div>
      <ImportSearchDownloadBar
        search={search}
        onSearchChange={(value) => {
          setPage(0);
          setSearch(value);
        }}
        dateFrom={dateFrom}
        dateTo={dateTo}
        dateField={dateField}
        onDateFromChange={(value) => {
          setPage(0);
          setDateFrom(value);
        }}
        onDateToChange={(value) => {
          setPage(0);
          setDateTo(value);
        }}
        onDateFieldChange={setDateField}
        records={filtered}
        filePrefix="import-cmfc"
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
          <thead className={IMPORT_TABLE_HEAD_CLASS}>
            <tr>
              <th className="w-9 px-2 py-3" />
              <ImportCoreTableHeaders
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(key) => {
                  const next = toggleImportSort(sortKey, sortDir, key);
                  setSortKey(next.sortKey);
                  setSortDir(next.sortDir);
                }}
              />
              <th className="px-3 py-3 font-semibold">Print</th>
              <th className="px-3 py-3 font-semibold">Current Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={26} className="px-4 py-10 text-center text-zinc-400">
                  Loading CMFC jobs...
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={26} className="px-4 py-10 text-center text-zinc-400">
                  No filed BOE jobs.
                </td>
              </tr>
            ) : (
              visibleRows.map((item) => {
                const expanded = expandedId === item.id;
                const printed = getImportCmfcPrintStatus(item) === "completed";
                const busy = updatingId === item.id;
                return (
                  <>
                    <tr
                      key={item.id}
                      onClick={canExpand ? () => setExpandedId(expanded ? null : item.id ?? null) : undefined}
                      className={`border-t border-zinc-100 ${canExpand ? "cursor-pointer hover:bg-zinc-50" : ""}`}
                    >
                      <td className="px-2 py-3 text-zinc-400">
                        {canExpand ? expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : null}
                      </td>
                      <ImportCoreTableCells item={item} />
                      <td className="px-3 py-3">
                        {busy ? (
                          <LoaderCircle size={14} className="animate-spin" />
                        ) : printed ? (
                          <span className="rounded-full bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-white">
                            Completed
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-600">
                            Not completed
                          </span>
                        )}
                      </td>
                      <ImportCurrentStatusCell item={item} module="cmfc" />
                    </tr>
                    {canExpand && expanded && (
                      <tr className="border-t border-zinc-100 bg-zinc-100/70">
                        <td colSpan={26} className="p-0">
                          <div className="sticky left-0 min-w-0 p-3" style={panelWidth ? { width: panelWidth } : undefined}>
                            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-4">
                              <div className="flex items-center gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white">
                                  {printed ? <Check size={14} /> : "1"}
                                </span>
                                <h3 className="text-sm font-semibold">CMFC print pack</h3>
                              </div>
                              <p className="mt-2 text-[11px] text-zinc-500">
                                Prints IGM, BL, commercial invoice, packing list and other supporting documents.
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={busy || !collectCmfcPrintDocuments(item).length}
                                  onClick={() => {
                                    void downloadMergedImportDocuments(
                                      item,
                                      `${item.jobNumber}-cmfc`,
                                      collectCmfcPrintDocuments(item)
                                    );
                                  }}
                                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
                                >
                                  Print documents
                                </button>
                                {canAct && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      setUpdatingId(item.id ?? null);
                                      void updateImportCmfcPrintStatus(
                                        item.id!,
                                        printed ? "not_completed" : "completed",
                                        user?.username ?? "Unknown"
                                      )
                                        .then(applyUpdated)
                                        .catch((printError) =>
                                          setError(
                                            printError instanceof Error
                                              ? printError.message
                                              : "Unable to update print status."
                                          )
                                        )
                                        .finally(() => setUpdatingId(null));
                                    }}
                                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[10px] font-semibold"
                                  >
                                    {printed ? "Mark not completed" : "Mark print completed"}
                                  </button>
                                )}
                              </div>
                              <ImportAuditLine audit={item.importCmfcPrintAudit} />
                              <ImportSectionRemarks
                                remarks={item.importCmfcRemarks ?? []}
                                busy={busy}
                                canAct={canAct}
                                onAdd={(text) =>
                                  addImportSectionRemark(
                                    item.id!,
                                    "cmfc",
                                    text,
                                    user?.username ?? "Unknown"
                                  ).then(applyUpdated)
                                }
                              />
                              <ImportJobDocumentsPanel
                                item={item}
                                canManage={canAct}
                                username={user?.username ?? "Unknown"}
                                onUpdated={applyUpdated}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </HorizontalDragScroll>
      <div className="mt-4 flex items-center justify-end gap-2 text-xs">
        <button type="button" disabled={page === 0} onClick={() => setPage((c) => Math.max(0, c - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">
          Prev
        </button>
        <span>
          {page + 1} / {totalPages}
        </span>
        <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((c) => c + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">
          Next
        </button>
      </div>
    </div>
  );
}

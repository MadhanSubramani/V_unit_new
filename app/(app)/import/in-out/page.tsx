"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import ModuleHeader from "@/components/ModuleHeader";
import HorizontalDragScroll from "@/components/shared/HorizontalDragScroll";
import ImportInOutPanel from "@/components/import/ImportInOutPanel";
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
import { getImportLinerRecords } from "@/lib/freightForward/freightForward";
import {
  computeImportInOutCounts,
  getImportInOutRecords,
  ImportInOutCard,
  matchesImportInOutCard,
} from "@/lib/import/inOutWorkflow";
import type { ImportDateField } from "@/lib/import/dateFields";
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
import { FreightForward } from "@/types/freightForward";

const PAGE_SIZE = 10;

export default function ImportInOutPage() {
  const [records, setRecords] = useState<FreightForward[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<ImportInOutCard | null>("pending");
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
  const canExpand = canExpandImportRow(user, "inout");
  const canAct = canActOnImportModule(user, "inout");

  useEffect(() => {
    let active = true;
    getImportLinerRecords()
      .then((items) => {
        if (active) setRecords(getImportInOutRecords(items));
      })
      .catch(() => {
        if (active) setError("Unable to load In & Out jobs.");
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
  const counts = useMemo(() => computeImportInOutCounts(scoped), [scoped]);
  const { filtered, totalPages, visibleRows } = useImportTableRows({
    records: scoped,
    module: "inout",
    search,
    dateFrom,
    dateTo,
    dateField,
    page,
    pageSize: PAGE_SIZE,
    sortKey,
    sortDir,
    activeCard,
    matchesCard: matchesImportInOutCard as (item: FreightForward, card: string) => boolean,
  });

  const applyUpdated = (updated: FreightForward) => {
    setRecords((current) =>
      current.map((row) => (row.id === updated.id ? updated : row))
    );
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <ModuleHeader
        title="Import — In & Out"
        description="E waybill, DO party details and delivery challan after T type BE is saved."
      />
      <div className="mt-5 grid grid-cols-3 gap-3">
        {(
          [
            { key: "pending", label: "E way pending", value: counts.pending },
            { key: "ewayDone", label: "E way done", value: counts.ewayDone },
            { key: "dispatched", label: "Dispatched", value: counts.dispatched },
          ] as { key: ImportInOutCard; label: string; value: number }[]
        ).map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => {
              setPage(0);
              setActiveCard((current) => (current === card.key ? null : card.key));
            }}
            className={`rounded-xl border px-4 py-3 text-left ${
              activeCard === card.key ? "border-zinc-400 bg-white shadow-md" : "border-zinc-200 bg-zinc-50"
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
        filePrefix="import-in-out"
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
              <th className="px-3 py-3 font-semibold">E way</th>
              <th className="px-3 py-3 font-semibold">Current Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={26} className="px-4 py-10 text-center text-zinc-400">Loading In & Out...</td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={26} className="px-4 py-10 text-center text-zinc-400">No T type jobs yet.</td>
              </tr>
            ) : (
              visibleRows.map((item) => {
                const expanded = expandedId === item.id;
                const busy = updatingId === item.id;
                return (
                  <>
                    <tr
                      key={item.id}
                      onClick={
                        canExpand
                          ? () => setExpandedId(expanded ? null : item.id ?? null)
                          : undefined
                      }
                      className={`border-t border-zinc-100 ${canExpand ? "cursor-pointer hover:bg-zinc-50" : ""}`}
                    >
                      <td className="px-2 py-3 text-zinc-400">
                        {canExpand ? expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : null}
                      </td>
                      <ImportCoreTableCells item={item} />
                      <td className="px-3 py-3 uppercase">{item.importEwayBill || "—"}</td>
                      <ImportCurrentStatusCell item={item} module="inout" />
                    </tr>
                    {canExpand && expanded && (
                      <tr className="border-t border-zinc-100 bg-zinc-100/70">
                        <td colSpan={26} className="p-0">
                          <div className="sticky left-0 min-w-0 p-3" style={panelWidth ? { width: panelWidth } : undefined}>
                            <ImportInOutPanel
                              item={item}
                              busy={busy}
                              canAct={canAct}
                              username={user?.username ?? "Unknown"}
                              onBusy={setUpdatingId}
                              onError={setError}
                              onUpdated={applyUpdated}
                            />
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
      <div className="mt-4 flex justify-end gap-2 text-xs">
        <button type="button" disabled={page === 0} onClick={() => setPage((c) => Math.max(0, c - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Prev</button>
        <span>{page + 1} / {totalPages}</span>
        <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((c) => c + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

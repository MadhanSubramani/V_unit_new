"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { FreightForward } from "@/types/freightForward";
import { Cfs } from "@/types/cfs";
import { Sez } from "@/types/sez";
import { getCfsList } from "@/lib/cfs/cfs";
import { getSezList } from "@/lib/sez/sez";
import {
  buildImportTableExportRows,
  exportImportTableToExcel,
  ImportTableExportRow,
} from "@/lib/import/exportImportExcel";
import { ImportTableCell } from "@/components/import/ImportJobTableCells";
import ImportDocumentLink from "@/components/import/ImportDocumentLink";
import { ImportLocationCell } from "@/components/import/ImportLocationCell";
import ImportSortableHeader from "@/components/import/ImportSortableHeader";
import { formatContainersDisplay } from "@/lib/freightForward/containers";
import { formatEzDate, formatHblDisplay } from "@/lib/import/hbl";
import {
  getImportDoEmptyDisplay,
  getImportDoPlaceOfDelivery,
  getImportDoPortDisplay,
  getImportDoStatusLabel,
} from "@/lib/import/linerWorkflow";
import {
  getTTypeBoeDateDisplay,
  getTTypeBoeNoDisplay,
} from "@/lib/import/boeOutWorkflow";
import type { ImportSortDir, ImportSortKey } from "@/lib/import/sortImportRecords";
import {
  IMPORT_DATE_FIELD_OPTIONS,
  type ImportDateField,
} from "@/lib/import/dateFields";

export function ImportDoTableCells({ item }: { item: FreightForward }) {
  return (
    <>
      <td className="px-3 py-3">
        <span className="block text-[11px] font-medium text-zinc-800">
          {getImportDoStatusLabel(item)}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className="block text-[11px]">{getImportDoPortDisplay(item)}</span>
        {item.importDoPortAttachment?.url ? (
          <ImportDocumentLink
            label="Port file"
            doc={item.importDoPortAttachment}
            variant="icon"
          />
        ) : null}
      </td>
      <td className="px-3 py-3">
        <span className="block text-[11px]">{getImportDoEmptyDisplay(item)}</span>
        {item.importDoEmptyAttachment?.url ? (
          <ImportDocumentLink
            label="Empty file"
            doc={item.importDoEmptyAttachment}
            variant="icon"
          />
        ) : null}
      </td>
      <ImportTableCell value={getImportDoPlaceOfDelivery(item)} width={140} />
    </>
  );
}

export const IMPORT_DO_TABLE_HEADERS = [
  "DO Status",
  "Port",
  "Empty",
  "Place of delivery",
] as const;

export const IMPORT_CORE_COLUMN_COUNT = 23;
export const IMPORT_TABLE_HEAD_CLASS =
  "sticky top-0 z-[1] bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500 shadow-[0_1px_0_0_#e4e4e7]";

export function ImportCoreTableHeaders({
  sortKey,
  sortDir,
  onSort,
}: {
  sortKey: ImportSortKey;
  sortDir: ImportSortDir;
  onSort: (key: ImportSortKey) => void;
}) {
  return (
    <>
      <ImportSortableHeader
        label="Job No"
        sortKey="jobNumber"
        activeSortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
      />
      <th className="px-3 py-3 font-semibold">EZ No</th>
      <th className="px-3 py-3 font-semibold">EZ Date</th>
      <th className="px-3 py-3 font-semibold">BL Type</th>
      <th className="px-3 py-3 font-semibold">Trade Terms</th>
      <th className="px-3 py-3 font-semibold">Location</th>
      <th className="px-3 py-3 font-semibold">Vessel</th>
      <ImportSortableHeader
        label="ETA"
        sortKey="eta"
        activeSortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
      />
      <th className="px-3 py-3 font-semibold">Consignee</th>
      <th className="px-3 py-3 font-semibold">Client</th>
      <th className="px-3 py-3 font-semibold">MBL</th>
      <th className="px-3 py-3 font-semibold">HBL</th>
      <th className="px-3 py-3 font-semibold">Containers</th>
      <th className="px-3 py-3 font-semibold">DO Status</th>
      <th className="px-3 py-3 font-semibold">Port</th>
      <th className="px-3 py-3 font-semibold">Empty</th>
      <th className="px-3 py-3 font-semibold">Place of delivery</th>
      <th className="px-3 py-3 font-semibold">Z type BE No</th>
      <th className="px-3 py-3 font-semibold">Z type BE Date</th>
      <th className="px-3 py-3 font-semibold">EZ Ref</th>
      <th className="px-3 py-3 font-semibold">T type BE No</th>
      <th className="px-3 py-3 font-semibold">T type BE Date</th>
      <th className="px-3 py-3 font-semibold">Desc of goods</th>
    </>
  );
}

export function ImportCoreTableCells({ item }: { item: FreightForward }) {
  return (
    <>
      <ImportTableCell
        value={item.jobNumber}
        width={105}
        className="font-medium text-zinc-900"
      />
      <ImportTableCell value={item.ezRefNumber} width={105} />
      <ImportTableCell value={formatEzDate(item)} width={90} />
      <ImportTableCell value={item.blType} width={90} />
      <ImportTableCell value={item.tradeTerms} width={110} />
      <ImportLocationCell item={item} />
      <ImportTableCell value={item.vesselName} />
      <ImportTableCell value={item.eta} width={100} />
      <ImportTableCell value={item.consignmentName} />
      <ImportTableCell value={item.clientName} />
      <ImportTableCell value={item.mbl} width={130} />
      <ImportTableCell value={formatHblDisplay(item)} width={130} />
      <ImportTableCell value={formatContainersDisplay(item)} width={170} />
      <ImportDoTableCells item={item} />
      <ImportTableCell value={item.inwardBoeNo} width={110} />
      <ImportTableCell value={item.inwardBoeDate} width={100} />
      <td className="px-3 py-3">
        <span className="block truncate font-medium text-zinc-800" style={{ maxWidth: 110 }}>
          {item.ezRefNumber || "—"}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-zinc-400">
          {formatEzDate(item) || "—"}
        </span>
      </td>
      <ImportTableCell value={getTTypeBoeNoDisplay(item)} width={110} />
      <ImportTableCell value={getTTypeBoeDateDisplay(item)} width={100} />
      <ImportTableCell value={item.descriptionOfGoods} width={120} />
    </>
  );
}

export function ImportGoodsAndBeHeaders() {
  return (
    <>
      <th className="px-3 py-3 font-semibold">Z type BE No</th>
      <th className="px-3 py-3 font-semibold">Z type BE Date</th>
      <th className="px-3 py-3 font-semibold">T type BE No</th>
      <th className="px-3 py-3 font-semibold">T type BE Date</th>
      <th className="px-3 py-3 font-semibold">Desc of goods</th>
    </>
  );
}

export function ImportGoodsAndBeCells({ item }: { item: FreightForward }) {
  return (
    <>
      <ImportTableCell value={item.inwardBoeNo} width={110} />
      <ImportTableCell value={item.inwardBoeDate} width={100} />
      <ImportTableCell value={getTTypeBoeNoDisplay(item)} width={110} />
      <ImportTableCell value={getTTypeBoeDateDisplay(item)} width={100} />
      <ImportTableCell value={item.descriptionOfGoods} width={120} />
    </>
  );
}

export function useImportLocationLookups() {
  const [cfsList, setCfsList] = useState<Cfs[]>([]);
  const [sezList, setSezList] = useState<Sez[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([getCfsList(), getSezList()])
      .then(([cfs, sez]) => {
        if (active) {
          setCfsList(cfs);
          setSezList(sez);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return { cfsList, sezList };
}

export function ImportSearchDownloadBar({
  search,
  onSearchChange,
  records,
  filePrefix,
  extraColumns,
  dateFrom = "",
  dateTo = "",
  dateField = "eta",
  onDateFromChange,
  onDateToChange,
  onDateFieldChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  records: FreightForward[];
  filePrefix: string;
  extraColumns?: (item: FreightForward) => ImportTableExportRow;
  dateFrom?: string;
  dateTo?: string;
  dateField?: ImportDateField;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
  onDateFieldChange?: (value: ImportDateField) => void;
}) {
  const { cfsList, sezList } = useImportLocationLookups();
  const [exporting, setExporting] = useState(false);

  const handleDownload = () => {
    if (!records.length) return;
    setExporting(true);
    try {
      exportImportTableToExcel(
        records,
        filePrefix,
        cfsList,
        sezList,
        extraColumns
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mt-5 flex flex-col gap-2 lg:flex-row lg:items-center">
      <input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search job no, consignee, inward BOE no, MBL, HBL..."
        className="w-full flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
      />
      <select
        value={dateField}
        onChange={(event) =>
          onDateFieldChange?.(event.target.value as ImportDateField)
        }
        className="rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500"
        title="Date field"
      >
        {IMPORT_DATE_FIELD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={dateFrom}
        onChange={(event) => onDateFromChange?.(event.target.value)}
        className="rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500"
        title="From date"
      />
      <input
        type="date"
        value={dateTo}
        onChange={(event) => onDateToChange?.(event.target.value)}
        className="rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500"
        title="To date"
      />
      <button
        type="button"
        disabled={!records.length || exporting}
        onClick={handleDownload}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
      >
        <Download size={14} />
        {exporting ? "Downloading..." : "Download report"}
      </button>
    </div>
  );
}

export function buildImportExportData(
  records: FreightForward[],
  cfsList: Cfs[],
  sezList: Sez[],
  extraColumns?: (item: FreightForward) => ImportTableExportRow
) {
  return buildImportTableExportRows(records, cfsList, sezList, extraColumns);
}

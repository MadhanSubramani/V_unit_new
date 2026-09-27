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
import {
  getImportDoEmptyDisplay,
  getImportDoPlaceOfDelivery,
  getImportDoPortDisplay,
  getImportDoStatusLabel,
} from "@/lib/import/linerWorkflow";
import { getTTypeBoeNoDisplay } from "@/lib/import/boeOutWorkflow";

export function ImportDoTableCells({ item }: { item: FreightForward }) {
  return (
    <>
      <td className="px-3 py-3">
        <span className="block text-[11px] font-medium text-zinc-800">
          {getImportDoStatusLabel(item)}
        </span>
        <span className="mt-0.5 block max-w-[110px] truncate text-[10px] text-zinc-400" title={getImportDoPlaceOfDelivery(item)}>
          {getImportDoPlaceOfDelivery(item)}
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
    </>
  );
}

export const IMPORT_DO_TABLE_HEADERS = ["DO Status", "Port", "Empty"] as const;

export function ImportGoodsAndBeHeaders() {
  return (
    <>
      <th className="px-3 py-3 font-semibold">Desc of goods</th>
      <th className="px-3 py-3 font-semibold">Z type BE No</th>
      <th className="px-3 py-3 font-semibold">Z type BE Date</th>
      <th className="px-3 py-3 font-semibold">T type BE No</th>
      <th className="px-3 py-3 font-semibold">T type BE Date</th>
    </>
  );
}

export function ImportGoodsAndBeCells({ item }: { item: FreightForward }) {
  return (
    <>
      <ImportTableCell value={item.descriptionOfGoods} width={120} />
      <ImportTableCell value={item.inwardBoeNo} width={110} />
      <ImportTableCell value={item.inwardBoeDate} width={100} />
      <ImportTableCell value={getTTypeBoeNoDisplay(item)} width={110} />
      <ImportTableCell value={item.importTTypeBoeDate} width={100} />
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
  onDateFromChange,
  onDateToChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  records: FreightForward[];
  filePrefix: string;
  extraColumns?: (item: FreightForward) => ImportTableExportRow;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
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
      <input
        type="date"
        value={dateFrom}
        onChange={(event) => onDateFromChange?.(event.target.value)}
        className="rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500"
        title="ETA from"
      />
      <input
        type="date"
        value={dateTo}
        onChange={(event) => onDateToChange?.(event.target.value)}
        className="rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500"
        title="ETA to"
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

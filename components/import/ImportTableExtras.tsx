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
import {
  getImportDoEmptyDisplay,
  getImportDoPortDisplay,
  getImportDoStatusLabel,
} from "@/lib/import/linerWorkflow";

export function ImportDoTableCells({ item }: { item: FreightForward }) {
  return (
    <>
      <ImportTableCell value={getImportDoStatusLabel(item)} width={90} />
      <ImportTableCell value={getImportDoPortDisplay(item)} width={100} />
      <ImportTableCell value={getImportDoEmptyDisplay(item)} width={100} />
    </>
  );
}

export const IMPORT_DO_TABLE_HEADERS = ["DO Status", "Port", "Empty"] as const;

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
}: {
  search: string;
  onSearchChange: (value: string) => void;
  records: FreightForward[];
  filePrefix: string;
  extraColumns?: (item: FreightForward) => ImportTableExportRow;
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
    <div className="mt-5 flex flex-col gap-2 sm:flex-row">
      <input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search job no, consignee, inward BOE no, MBL, HBL..."
        className="w-full flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
      />
      <button
        type="button"
        disabled={!records.length || exporting}
        onClick={handleDownload}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
      >
        <Download size={14} />
        {exporting ? "Downloading..." : "Download XLS"}
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

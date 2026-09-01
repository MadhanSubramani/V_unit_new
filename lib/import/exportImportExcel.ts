import * as XLSX from "xlsx";
import { FreightForward } from "@/types/freightForward";
import { formatContainersDisplay } from "@/lib/freightForward/containers";
import { Cfs } from "@/types/cfs";
import { Sez } from "@/types/sez";
import { resolveImportLocationCode } from "@/lib/import/location";
import {
  getImportDoEmptyDisplay,
  getImportDoPortDisplay,
  getImportDoStatusLabel,
} from "@/lib/import/linerWorkflow";

export type ImportTableExportRow = Record<string, string>;

export function buildImportTableExportRows(
  records: FreightForward[],
  cfsList: Cfs[] = [],
  sezList: Sez[] = [],
  extraColumns?: (item: FreightForward) => ImportTableExportRow
): ImportTableExportRow[] {
  return records.map((item) => ({
    "Job No": item.jobNumber ?? "",
    "EZ No": item.ezRefNumber ?? "",
    "BL Type": item.blType ?? "",
    "Trade Terms": item.tradeTerms ?? "",
    Vessel: item.vesselName ?? "",
    ETA: item.eta ?? "",
    Location: resolveImportLocationCode(item, cfsList, sezList),
    Consignee: item.consignmentName ?? "",
    Client: item.clientName ?? "",
    "DO Status": getImportDoStatusLabel(item),
    Port: getImportDoPortDisplay(item),
    Empty: getImportDoEmptyDisplay(item),
    "Inward BOE No": item.inwardBoeNo ?? "",
    MBL: item.mbl ?? "",
    HBL: item.hbl ?? "",
    Containers: formatContainersDisplay(item),
    ...(extraColumns ? extraColumns(item) : {}),
  }));
}

export function exportImportTableToExcel(
  records: FreightForward[],
  filePrefix: string,
  cfsList: Cfs[] = [],
  sezList: Sez[] = [],
  extraColumns?: (item: FreightForward) => ImportTableExportRow
) {
  const rows = buildImportTableExportRows(
    records,
    cfsList,
    sezList,
    extraColumns
  );
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Import");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filePrefix}-${date}.xlsx`);
}

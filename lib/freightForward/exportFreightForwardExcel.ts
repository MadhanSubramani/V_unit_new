import * as XLSX from "xlsx";
import { FreightForward } from "@/types/freightForward";
import {
  formatDollar,
  formatExpenseItems,
  getRecordProfitLoss,
  getRecordTotalExpenses,
} from "./amounts";

function docUrl(doc?: { url?: string }) {
  return doc?.url ?? "";
}

export function exportFreightForwardToExcel(
  records: FreightForward[],
  etaFrom: string,
  etaTo: string
) {
  const rows = records.map((item) => {
    const totalExpenses = getRecordTotalExpenses(item);
    const profitLoss = getRecordProfitLoss(item);

    return {
      "Job Number": item.jobNumber ?? "",
      "EZ Ref Number": item.ezRefNumber ?? "",
      "Consignment Name": item.consignmentName ?? "",
      MBL: item.mbl ?? "",
      "MBL URL": docUrl(item.mblUrl),
      HBL: item.hbl ?? "",
      "HBL URL": docUrl(item.hblUrl),
      "Container Number": item.containerNumber ?? "",
      "Container Size": item.containerSize ?? "",
      "Container Type": item.containerType ?? "",
      ETD: item.etd ?? "",
      ETA: item.eta ?? "",
      "Vessel Name": item.vesselName ?? "",
      POL: item.pol ?? "",
      POD: item.pod ?? "",
      Location: item.cfs ?? item.sez ?? "",
      Liner: item.liner ?? "",
      Agent: item.agent ?? "",
      "Ocean Freight": formatDollar(item.oceanFreight),
      "Ex Works": formatExpenseItems(item.exWorks),
      "Other Expenses": formatExpenseItems(item.otherExpenses),
      "Total Expenses": formatDollar(totalExpenses),
      "Billed Amount": formatDollar(item.billedAmount ?? item.buildAmount),
      "Billed Amount URL": docUrl(item.billedAmountUrl),
      "Credit Note": formatDollar(item.creditNote),
      "Credit Note URL": docUrl(item.creditNoteUrl),
      "Profit / Loss Amount": formatDollar(Math.abs(profitLoss)),
      "Profit / Loss": profitLoss > 0 ? "Profit" : "Loss",
      "Payment Type": item.paymentType ?? "",
      "Payment Date": item.paymentDate ?? "",
      Status: item.status ?? "",
      "Created By": item.createdBy ?? "",
      "Updated By": item.updatedBy ?? "",
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Freight Forward");

  const date = new Date().toISOString().slice(0, 10);
  const range =
    etaFrom && etaTo ? `${etaFrom}_to_${etaTo}` : etaFrom || etaTo || date;
  XLSX.writeFile(workbook, `freight-forward-export-${range}.xlsx`);
}

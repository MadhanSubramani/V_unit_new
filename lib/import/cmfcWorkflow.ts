import { FreightForward } from "@/types/freightForward";
import { getBoeFilingStatus } from "@/lib/import/boeInWorkflow";
import { isImportWorklistJob } from "@/lib/import/linerWorkflow";

export type ImportCmfcCard = "not_completed" | "completed" | "filedBoe";

export function getImportCmfcPrintStatus(item: FreightForward) {
  return item.importCmfcPrintStatus === "completed"
    ? "completed"
    : "not_completed";
}

export function isImportCmfcPrintCompleted(item: FreightForward) {
  return getImportCmfcPrintStatus(item) === "completed";
}

export function matchesImportCmfcCard(item: FreightForward, card: ImportCmfcCard) {
  const filed = getBoeFilingStatus(item) === "filed";
  const printed = isImportCmfcPrintCompleted(item);
  switch (card) {
    case "filedBoe":
      return filed;
    case "completed":
      return filed && printed;
    case "not_completed":
      return filed && !printed;
  }
}

export function computeImportCmfcCounts(records: FreightForward[]) {
  const filed = records.filter((item) => getBoeFilingStatus(item) === "filed");
  return {
    filedBoe: filed.length,
    completed: filed.filter(isImportCmfcPrintCompleted).length,
    not_completed: filed.filter((item) => !isImportCmfcPrintCompleted(item)).length,
  };
}

export function getImportCmfcRecords(records: FreightForward[]) {
  return records.filter(
    (item) => isImportWorklistJob(item) && getBoeFilingStatus(item) === "filed"
  );
}

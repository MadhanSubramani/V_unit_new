import { FreightForward } from "@/types/freightForward";
import { getBoeFilingStatus } from "@/lib/import/boeInWorkflow";
import { isImportWorklistJob } from "@/lib/import/linerWorkflow";

export type ImportCmfcCard = "pending" | "not_completed" | "completed" | "filedBoe";

export type ImportCmfcZone = {
  id: string;
  kind: "cfs" | "sez";
  code: string;
  name: string;
};

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
    case "pending":
      return !filed;
    case "filedBoe":
      return filed;
    case "completed":
      return filed && printed;
    case "not_completed":
      return filed && !printed;
  }
}

export function matchesImportCmfcZone(
  item: FreightForward,
  zoneId: string,
  zones: ImportCmfcZone[]
) {
  if (!zoneId || zoneId === "all") return true;
  const zone = zones.find((entry) => entry.id === zoneId);
  if (!zone) return true;
  const locationType =
    item.locationType ?? (item.sez && !item.cfs ? "sez" : "cfs");
  if (locationType !== zone.kind) return false;
  const stored = (zone.kind === "sez" ? item.sez : item.cfs)?.trim().toLowerCase() ?? "";
  if (!stored) return false;
  const code = zone.code.trim().toLowerCase();
  const name = zone.name.trim().toLowerCase();
  const storedCode = stored.split(/\s*[-–|]\s*/)[0]?.trim() ?? stored;
  return stored === code || stored === name || storedCode === code;
}

export function computeImportCmfcCounts(records: FreightForward[]) {
  const filed = records.filter((item) => getBoeFilingStatus(item) === "filed");
  return {
    pending: records.filter((item) => getBoeFilingStatus(item) !== "filed").length,
    filedBoe: filed.length,
    completed: filed.filter(isImportCmfcPrintCompleted).length,
    not_completed: filed.filter((item) => !isImportCmfcPrintCompleted(item)).length,
  };
}

export function getImportCmfcRecords(records: FreightForward[]) {
  return records.filter((item) => isImportWorklistJob(item));
}

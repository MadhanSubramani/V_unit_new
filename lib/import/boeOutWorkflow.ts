import { FreightForward } from "@/types/freightForward";
import { isImportWorklistJob } from "@/lib/import/linerWorkflow";
import { isImportTransportCompleted } from "@/lib/import/transportWorkflow";

export type ImportBoeOutCard =
  | "inProcess"
  | "unfiledBoe"
  | "filedBoe"
  | "dispatched";

export function getImportBoeOutInwardOccStatus(item: FreightForward) {
  return item.importBoeOutInwardOccStatus === "occ" ? "occ" : "pending";
}

export function isImportTTypeBoeSaved(item: FreightForward) {
  return item.importTTypeBoeSaved === true;
}

export function getImportBoeOutDutyStatus(item: FreightForward) {
  const status = item.importBoeOutDutyStatus;
  if (status === "paid" || status === "final") return status;
  return "pending";
}

export function isImportBoeOutDispatched(item: FreightForward) {
  return item.importBoeOutCompleted === true;
}

export function isImportBoeOutInwardOccDone(item: FreightForward) {
  return getImportBoeOutInwardOccStatus(item) === "occ";
}

export function canTakeTTypeAction(item: FreightForward) {
  return isImportTransportCompleted(item);
}

export function canUnlockImportTTypeSection(item: FreightForward) {
  return canTakeTTypeAction(item) && isImportBoeOutInwardOccDone(item);
}

export function canUnlockImportDutySection(item: FreightForward) {
  return isImportTTypeBoeSaved(item);
}

export function canUnlockImportEwaySection(item: FreightForward) {
  return getImportBoeOutDutyStatus(item) === "final";
}

export function matchesImportBoeOutCard(item: FreightForward, card: ImportBoeOutCard) {
  const dispatched = isImportBoeOutDispatched(item);
  const tTypeSaved = isImportTTypeBoeSaved(item);

  switch (card) {
    case "dispatched":
      return dispatched;
    case "inProcess":
      return !dispatched;
    case "unfiledBoe":
      return !dispatched && !tTypeSaved;
    case "filedBoe":
      return !dispatched && tTypeSaved;
  }
}

export function computeImportBoeOutCounts(records: FreightForward[]) {
  return {
    inProcess: records.filter((item) =>
      matchesImportBoeOutCard(item, "inProcess")
    ).length,
    unfiledBoe: records.filter((item) =>
      matchesImportBoeOutCard(item, "unfiledBoe")
    ).length,
    filedBoe: records.filter((item) =>
      matchesImportBoeOutCard(item, "filedBoe")
    ).length,
    dispatched: records.filter((item) =>
      matchesImportBoeOutCard(item, "dispatched")
    ).length,
  };
}

export function getImportBoeOutRecords(records: FreightForward[]) {
  return records.filter(isImportWorklistJob);
}

export function getTTypeBoeNoDisplay(item: FreightForward) {
  const value = item.importTTypeBoeNo?.trim();
  return value || "—";
}

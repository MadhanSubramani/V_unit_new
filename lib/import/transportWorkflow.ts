import { FreightForward } from "@/types/freightForward";
import { isImportBoeInCompleted } from "@/lib/import/boeInWorkflow";

export type ImportTransportCard = "completed" | "incomplete";

export function isImportTransportCompleted(item: FreightForward) {
  return item.importTransportCompleted === true;
}

export function matchesImportTransportCard(
  item: FreightForward,
  card: ImportTransportCard
) {
  const completed = isImportTransportCompleted(item);
  return card === "completed" ? completed : !completed;
}

export function computeImportTransportCounts(records: FreightForward[]) {
  const completed = records.filter(isImportTransportCompleted).length;
  return {
    completed,
    incomplete: records.length - completed,
  };
}

export function getImportTransportRecords(records: FreightForward[]) {
  return records.filter(isImportBoeInCompleted);
}

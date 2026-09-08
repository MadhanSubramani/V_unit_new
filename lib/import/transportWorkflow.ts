import { FreightForward } from "@/types/freightForward";
import { getBoeFilingStatus, isImportBoeInCompleted } from "@/lib/import/boeInWorkflow";
import { isImportWorklistJob } from "@/lib/import/linerWorkflow";

export type ImportTransportCard =
  | "incomplete"
  | "completed"
  | "boeFiled"
  | "boeUnfiled";

export function isImportTransportCompleted(item: FreightForward) {
  return item.importTransportCompleted === true;
}

export function canTakeTransportAction(item: FreightForward) {
  return isImportBoeInCompleted(item);
}

export function isTransportBoeUnfiled(item: FreightForward) {
  return getBoeFilingStatus(item) === "unfiled";
}

export function matchesImportTransportCard(
  item: FreightForward,
  card: ImportTransportCard
) {
  const filed = getBoeFilingStatus(item) === "filed";
  const transportCompleted = isImportTransportCompleted(item);
  const unfiled = isTransportBoeUnfiled(item);

  switch (card) {
    case "completed":
      return transportCompleted;
    case "incomplete":
      return !transportCompleted;
    case "boeFiled":
      return filed && !transportCompleted;
    case "boeUnfiled":
      return unfiled;
  }
}

/** Non–BOE-unfiled cards hide unfiled jobs from the table. */
export function excludeTransportBoeUnfiledFromList(
  item: FreightForward,
  activeCard: ImportTransportCard | null
) {
  if (activeCard === "boeUnfiled") return false;
  return isTransportBoeUnfiled(item);
}

export function computeImportTransportCounts(records: FreightForward[]) {
  const completed = records.filter(isImportTransportCompleted).length;
  return {
    completed,
    incomplete: records.filter((item) =>
      matchesImportTransportCard(item, "incomplete")
    ).length,
    boeFiled: records.filter((item) =>
      matchesImportTransportCard(item, "boeFiled")
    ).length,
    boeUnfiled: records.filter((item) =>
      matchesImportTransportCard(item, "boeUnfiled")
    ).length,
  };
}

/** All Import jobs — actions stay locked until Z type BE is completed. */
export function getImportTransportRecords(records: FreightForward[]) {
  return records.filter(isImportWorklistJob);
}

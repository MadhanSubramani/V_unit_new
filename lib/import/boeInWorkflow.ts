import {
  FreightForward,
  ImportBoeChecklist,
  ImportBoeFilingStatus,
} from "@/types/freightForward";
import { isImportLinerCompleted } from "@/lib/import/linerWorkflow";

export type ImportBoeInCard =
  | "inProcess"
  | "pendingChecklist"
  | "unfiledBoe"
  | "filedBoe"
  | "completed";

export const BOE_CHECKLIST_ITEMS: {
  key: keyof ImportBoeChecklist;
  label: string;
}[] = [
  { key: "docReceived", label: "Doc received" },
  { key: "checklist", label: "Checklist" },
  { key: "clientConfirmation", label: "Client confirmation" },
];

export function isBoeChecklistComplete(item: FreightForward) {
  const checklist = item.importBoeChecklist ?? {};
  return BOE_CHECKLIST_ITEMS.every((entry) => checklist[entry.key] === true);
}

export function getBoeFilingStatus(item: FreightForward): ImportBoeFilingStatus {
  return item.importBoeFilingStatus === "filed" ? "filed" : "unfiled";
}

export function isImportBoeInCompleted(item: FreightForward) {
  return item.importBoeInCompleted === true;
}

export function matchesImportBoeInCard(
  item: FreightForward,
  card: ImportBoeInCard
) {
  const completed = isImportBoeInCompleted(item);
  const checklistDone = isBoeChecklistComplete(item);
  const filed = getBoeFilingStatus(item) === "filed";

  switch (card) {
    case "inProcess":
      return !completed;
    case "pendingChecklist":
      return !completed && !checklistDone;
    case "unfiledBoe":
      return !completed && checklistDone && !filed;
    case "filedBoe":
      return !completed && filed;
    case "completed":
      return completed;
  }
}

export function computeImportBoeInCounts(records: FreightForward[]) {
  const completed = records.filter(isImportBoeInCompleted).length;
  return {
    inProcess: records.length - completed,
    pendingChecklist: records.filter((item) =>
      matchesImportBoeInCard(item, "pendingChecklist")
    ).length,
    unfiledBoe: records.filter((item) =>
      matchesImportBoeInCard(item, "unfiledBoe")
    ).length,
    filedBoe: records.filter((item) =>
      matchesImportBoeInCard(item, "filedBoe")
    ).length,
    completed,
    incomplete: records.length - completed,
  };
}

export function getImportBoeInRecords(records: FreightForward[]) {
  return records.filter(isImportLinerCompleted);
}

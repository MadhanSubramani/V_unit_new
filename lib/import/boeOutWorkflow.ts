import { FreightForward, ImportBoeClearanceStatus, ImportTTypeEntry } from "@/types/freightForward";
import { isImportWorklistJob } from "@/lib/import/linerWorkflow";
import { isImportTransportCompleted } from "@/lib/import/transportWorkflow";

export type ImportBoeOutCard =
  | "inProcess"
  | "todaysTask"
  | "unfiledBoe"
  | "filedBoe"
  | "dispatched";

export function getImportBoeOutInwardOccStatus(item: FreightForward) {
  return item.importBoeOutInwardOccStatus === "occ" ? "occ" : "pending";
}

export function normalizeTTypeClearance(
  status?: string | null
): ImportBoeClearanceStatus | undefined {
  if (!status) return undefined;
  if (status === "psc") return "pcv";
  return status as ImportBoeClearanceStatus;
}

export function isTTypeEntryCompleted(entry: ImportTTypeEntry) {
  if (entry.completed) return true;
  return (entry.statuses ?? []).some(
    (row) => normalizeTTypeClearance(row.status) === "ooc"
  );
}

export function getImportTTypeEntries(item: FreightForward): ImportTTypeEntry[] {
  if (item.importTTypeEntries?.length) {
    return item.importTTypeEntries.map((entry) => ({
      ...entry,
      statuses: (entry.statuses ?? []).map((row) => ({
        ...row,
        status: normalizeTTypeClearance(row.status) ?? row.status,
      })),
      completed: isTTypeEntryCompleted(entry),
    }));
  }
  if (!item.importTTypeBoeSaved && !item.importTTypeBoeNo?.trim()) return [];
  const status = normalizeTTypeClearance(item.importTTypeBoeClearanceStatus);
  return [
    {
      id: "legacy",
      boeNo: item.importTTypeBoeNo ?? "",
      boeDate: item.importTTypeBoeDate ?? "",
      statuses: status
        ? [{ status, date: item.importTTypeBoeDate ?? "" }]
        : [],
      completed: status === "ooc",
    },
  ];
}

export function isImportTTypeBoeSaved(item: FreightForward) {
  if (getImportTTypeEntries(item).some((entry) => entry.boeNo.trim())) {
    return true;
  }
  return item.importTTypeBoeSaved === true;
}

export function isImportTTypeSectionCompleted(item: FreightForward) {
  const entries = getImportTTypeEntries(item);
  return entries.length > 0 && entries.every(isTTypeEntryCompleted);
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

export const T_TYPE_CLEARANCE_OPTIONS: {
  value: Exclude<ImportBoeClearanceStatus, "psc">;
  label: string;
}[] = [
  { value: "open", label: "Open" },
  { value: "rms", label: "RMS" },
  { value: "ins", label: "INS" },
  { value: "pcv", label: "PCV" },
  { value: "sup", label: "SUP" },
  { value: "ooc", label: "OOC" },
];

export const T_TYPE_CLEARANCE_VALUES = T_TYPE_CLEARANCE_OPTIONS.map(
  (option) => option.value
);

export function canUnlockImportDutySection(item: FreightForward) {
  return isImportTTypeSectionCompleted(item);
}

export function isImportTTypeOocCompleted(item: FreightForward) {
  return isImportTTypeSectionCompleted(item);
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
    case "todaysTask":
      return !dispatched && isImportTransportCompleted(item);
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
    todaysTask: records.filter((item) =>
      matchesImportBoeOutCard(item, "todaysTask")
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
  const nos = getImportTTypeEntries(item)
    .map((entry) => entry.boeNo.trim())
    .filter(Boolean);
  if (nos.length) return nos.join(", ");
  const value = item.importTTypeBoeNo?.trim();
  return value || "—";
}

export function getTTypeBoeDateDisplay(item: FreightForward) {
  const dates = getImportTTypeEntries(item)
    .map((entry) => entry.boeDate.trim())
    .filter(Boolean);
  if (dates.length) return dates.join(", ");
  return item.importTTypeBoeDate?.trim() || "—";
}

export function createEmptyTTypeEntry(): ImportTTypeEntry {
  return {
    id: `tt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    boeNo: "",
    boeDate: "",
    weight: "",
    packages: "",
    statuses: [],
    completed: false,
  };
}

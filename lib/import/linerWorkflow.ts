import {
  FreightForward,
  ImportDoStatus,
  ImportIgmStatus,
  ImportMovementStatus,
  ImportWorkflowSection,
} from "@/types/freightForward";
import { isEtaInNext7Days } from "@/lib/freightForward/statusBalance";
import { isImportJobNumber } from "@/lib/freightForward/generateJobNumber";

export type ImportLinerCard =
  | "inProcess"
  | "next7Days"
  | "movement"
  | "igm"
  | "do"
  | "completed";

/** IMP* jobs or any job flagged for Import. */
export function isImportWorklistJob(item: FreightForward) {
  if (item.isDeleted) return false;
  if (item.useForImport) return true;
  return isImportJobNumber(item.jobNumber);
}

export function getImportStageRemark(
  item: FreightForward,
  section: ImportWorkflowSection
) {
  if (section === "movement") return item.importMovementRemark ?? "";
  if (section === "igm") return item.importIgmRemark ?? "";
  return item.importDoRemark ?? "";
}

export function isImportStagePending(
  item: FreightForward,
  section: ImportWorkflowSection
) {
  if (section === "movement") return getImportMovementStatus(item) === "pending";
  if (section === "igm") return getImportIgmStatus(item) === "pending";
  return getImportDoStatus(item) === "pending";
}

export function isImportDoCompleted(item: FreightForward) {
  const status = item.importDoStatus;
  return status === "received" || status === "eod";
}

/** Stages completed out of Movement / IGM / DO (0–3). */
export function getImportCompletionCount(item: FreightForward) {
  return [
    getImportMovementStatus(item) === "completed",
    getImportIgmStatus(item) === "posted",
    isImportDoCompleted(item),
  ].filter(Boolean).length;
}

/** FF statusTimeline.momentum is the authoritative Movement completed signal. */
export function getImportMovementStatus(
  item: FreightForward
): ImportMovementStatus {
  if ((item.statusTimeline ?? []).some((entry) => entry.status === "momentum")) {
    return "completed";
  }
  if (item.importMovementStatus === "accepted") return "accepted";
  if (item.importMovementStatus === "completed") return "completed";
  return "pending";
}

export function getImportIgmStatus(item: FreightForward): ImportIgmStatus {
  return item.importIgmStatus ?? "pending";
}

export function getImportDoStatus(item: FreightForward): ImportDoStatus {
  if (item.importDoStatus === "eod") return "received";
  return item.importDoStatus ?? "pending";
}

export function isImportLinerCompleted(item: FreightForward) {
  return (
    getImportMovementStatus(item) === "completed" &&
    getImportIgmStatus(item) === "posted" &&
    isImportDoCompleted(item)
  );
}

export function canUpdateImportIgm(item: FreightForward) {
  return getImportMovementStatus(item) === "completed";
}

export function canUpdateImportDo(item: FreightForward) {
  return getImportIgmStatus(item) === "posted";
}

export function matchesImportLinerCard(
  item: FreightForward,
  card: ImportLinerCard
) {
  const completed = isImportLinerCompleted(item);
  switch (card) {
    case "inProcess":
      return !completed;
    case "next7Days":
      return !completed && isEtaInNext7Days(item.eta);
    case "movement":
      return getImportMovementStatus(item) !== "completed";
    case "igm":
      return getImportIgmStatus(item) !== "posted";
    case "do":
      return !isImportDoCompleted(item);
    case "completed":
      return completed;
  }
}

export function getInwardBoeNoDisplay(item: FreightForward) {
  const value = item.inwardBoeNo?.trim();
  return value || "—";
}

export function computeImportLinerCounts(records: FreightForward[]) {
  const completed = records.filter(isImportLinerCompleted).length;
  return {
    inProcess: records.length - completed,
    next7Days: records.filter((item) =>
      matchesImportLinerCard(item, "next7Days")
    ).length,
    movement: records.filter((item) =>
      matchesImportLinerCard(item, "movement")
    ).length,
    igm: records.filter((item) => matchesImportLinerCard(item, "igm")).length,
    do: records.filter((item) => matchesImportLinerCard(item, "do")).length,
    completed,
    incomplete: records.length - completed,
  };
}

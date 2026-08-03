import {
  FreightForward,
  ImportDoStatus,
  ImportIgmStatus,
  ImportMovementStatus,
} from "@/types/freightForward";
import { isEtaInNext7Days } from "@/lib/freightForward/statusBalance";

export type ImportLinerCard =
  | "inProcess"
  | "next7Days"
  | "movement"
  | "igm"
  | "do"
  | "completed";

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
  return item.importDoStatus ?? "pending";
}

export function isImportLinerCompleted(item: FreightForward) {
  return (
    getImportMovementStatus(item) === "completed" &&
    getImportIgmStatus(item) === "posted" &&
    getImportDoStatus(item) === "eod"
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
      return getImportDoStatus(item) !== "eod";
    case "completed":
      return completed;
  }
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

import { FreightForward, FreightForwardStatus } from "@/types/freightForward";

export type BalanceCardFilter =
  | "inProcess"
  | "next7Days"
  | "momentum"
  | "split_manifest"
  | "billing"
  | "receivable"
  | "payable"
  | "completed";

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getNext7DayEtaRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + 7);
  return {
    from: formatLocalDate(today),
    to: formatLocalDate(end),
  };
}

/** True when ETA (YYYY-MM-DD) falls from today through the next 7 days (local time). */
export function isEtaInNext7Days(eta?: string | null) {
  if (!eta?.trim()) return false;
  const etaDate = eta.trim().slice(0, 10);
  const { from, to } = getNext7DayEtaRange();
  return etaDate >= from && etaDate <= to;
}

export function hasStatusInTimeline(
  item: FreightForward,
  status: FreightForwardStatus
) {
  return (item.statusTimeline ?? []).some((entry) => entry.status === status);
}

/** Records that have not yet been updated to this workflow status. */
export function isStatusPending(
  item: FreightForward,
  status: FreightForwardStatus
) {
  return !hasStatusInTimeline(item, status);
}

export function matchesBalanceCard(
  item: FreightForward,
  activeCard: BalanceCardFilter
) {
  switch (activeCard) {
    case "inProcess":
      return item.status === "in_process";
    case "momentum":
      return isStatusPending(item, "momentum");
    case "split_manifest":
      return isStatusPending(item, "split_manifest");
    case "billing":
      return isStatusPending(item, "billing");
    case "receivable":
      return isStatusPending(item, "receivable");
    case "payable":
      return isStatusPending(item, "payable");
    case "completed":
      return hasStatusInTimeline(item, "completed");
    case "next7Days":
      return (
        isEtaInNext7Days(item.eta) && !hasStatusInTimeline(item, "completed")
      );
    default:
      return true;
  }
}

/** Card counts: workflow steps count pending records; Completed counts updated records. */
export function computeBalanceCounts(records: FreightForward[]) {
  return {
    inProcess: records.filter((item) => matchesBalanceCard(item, "inProcess")).length,
    next7Days: records.filter((item) => matchesBalanceCard(item, "next7Days")).length,
    momentum: records.filter((item) => matchesBalanceCard(item, "momentum")).length,
    split_manifest: records.filter((item) =>
      matchesBalanceCard(item, "split_manifest")
    ).length,
    billing: records.filter((item) => matchesBalanceCard(item, "billing")).length,
    receivable: records.filter((item) => matchesBalanceCard(item, "receivable"))
      .length,
    payable: records.filter((item) => matchesBalanceCard(item, "payable")).length,
    completed: records.filter((item) => hasStatusInTimeline(item, "completed"))
      .length,
  };
}

export function usesBalanceCardFilter(
  activeCard?: BalanceCardFilter | null
): activeCard is BalanceCardFilter {
  if (!activeCard) return false;
  return activeCard !== "inProcess";
}

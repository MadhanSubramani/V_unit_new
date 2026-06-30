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
      return isStatusPending(item, "completed");
    case "next7Days": {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const next7 = new Date(today);
      next7.setDate(today.getDate() + 7);
      const eta = item.eta;
      if (!eta) return false;
      return (
        isStatusPending(item, "completed") &&
        eta >= today.toISOString().slice(0, 10) &&
        eta <= next7.toISOString().slice(0, 10)
      );
    }
    default:
      return true;
  }
}

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
    completed: records.filter((item) => matchesBalanceCard(item, "completed"))
      .length,
  };
}

export function usesBalanceCardFilter(
  activeCard?: BalanceCardFilter | null
): activeCard is BalanceCardFilter {
  if (!activeCard) return false;
  return activeCard !== "inProcess" && activeCard !== "next7Days";
}

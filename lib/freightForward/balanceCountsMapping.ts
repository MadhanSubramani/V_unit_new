import { FreightForwardCounts } from "@/types/freightForwardCounts";
import { computeBalanceCounts } from "@/lib/freightForward/statusBalance";

export function balanceCountsToStatsDoc(
  counts: ReturnType<typeof computeBalanceCounts>
): Omit<FreightForwardCounts, "updatedAt"> {
  return {
    inProcess: counts.inProcess,
    next7Days: counts.next7Days,
    movement: counts.momentum,
    splitManifest: counts.split_manifest,
    completedCount: counts.completed,
    incompleteCount: counts.incomplete,
    pendingBilling: counts.billing,
    pendingReceivable: counts.receivable,
    pendingPayable: counts.payable,
  };
}

export function statsDocToBalanceCounts(data: FreightForwardCounts) {
  return {
    inProcess: data.inProcess ?? 0,
    next7Days: data.next7Days ?? 0,
    momentum: data.movement ?? 0,
    split_manifest: data.splitManifest ?? 0,
    billing: data.pendingBilling ?? 0,
    receivable: data.pendingReceivable ?? 0,
    payable: data.pendingPayable ?? 0,
    completed: data.completedCount ?? 0,
    incomplete: data.incompleteCount ?? 0,
  };
}

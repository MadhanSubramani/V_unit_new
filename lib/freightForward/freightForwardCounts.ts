import {
  collection,
  doc,
  getCountFromServer,
  getDocFromServer,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FreightForwardCounts,
  FreightForwardCountsKey,
} from "@/types/freightForwardCounts";
import { FreightForward } from "@/types/freightForward";
import {
  getNext7DayEtaRange,
  hasStatusInTimeline,
  isStatusPending,
  matchesBalanceCard,
} from "@/lib/freightForward/statusBalance";
import {
  balanceCountsToStatsDoc,
  statsDocToBalanceCounts,
} from "@/lib/freightForward/balanceCountsMapping";

export { balanceCountsToStatsDoc, statsDocToBalanceCounts } from "@/lib/freightForward/balanceCountsMapping";

export const FREIGHT_FORWARD_COUNTS_PATH = {
  collection: "stats",
  id: "freightForwardCounts",
} as const;

const COUNT_KEYS: FreightForwardCountsKey[] = [
  "inProcess",
  "next7Days",
  "movement",
  "splitManifest",
  "completedCount",
  "incompleteCount",
  "pendingBilling",
  "pendingReceivable",
  "pendingPayable",
];

/** @deprecated Counters are auto-used when the stats doc exists; flag kept for compatibility. */
export function isFreightForwardCounterDashboardEnabled() {
  return process.env.NEXT_PUBLIC_FF_USE_COUNTER_DASHBOARD !== "false";
}

function zeroContributions(): Record<FreightForwardCountsKey, number> {
  return {
    inProcess: 0,
    next7Days: 0,
    movement: 0,
    splitManifest: 0,
    completedCount: 0,
    incompleteCount: 0,
    pendingBilling: 0,
    pendingReceivable: 0,
    pendingPayable: 0,
  };
}

/** Per-record bucket contributions (0 or 1 each), aligned with computeBalanceCounts. */
export function freightForwardRecordContributions(
  item: FreightForward
): Record<FreightForwardCountsKey, number> {
  if (item.isDeleted) {
    return zeroContributions();
  }

  const completed = hasStatusInTimeline(item, "completed");

  return {
    inProcess: item.status === "in_process" ? 1 : 0,
    next7Days: matchesBalanceCard(item, "next7Days") ? 1 : 0,
    movement: matchesBalanceCard(item, "momentum") ? 1 : 0,
    splitManifest: matchesBalanceCard(item, "split_manifest") ? 1 : 0,
    completedCount: completed ? 1 : 0,
    incompleteCount: completed ? 0 : 1,
    pendingBilling: isStatusPending(item, "billing") ? 1 : 0,
    pendingReceivable: isStatusPending(item, "receivable") ? 1 : 0,
    pendingPayable: isStatusPending(item, "payable") ? 1 : 0,
  };
}

export function freightForwardCountsDelta(
  before: FreightForward | null,
  after: FreightForward | null
): Partial<Record<FreightForwardCountsKey, number>> {
  const prev = before ? freightForwardRecordContributions(before) : zeroContributions();
  const next = after ? freightForwardRecordContributions(after) : zeroContributions();
  const delta: Partial<Record<FreightForwardCountsKey, number>> = {};

  for (const key of COUNT_KEYS) {
    const change = next[key] - prev[key];
    if (change !== 0) {
      delta[key] = change;
    }
  }

  return delta;
}

export async function applyFreightForwardCountsDelta(
  delta: Partial<Record<FreightForwardCountsKey, number>>
) {
  if (Object.keys(delta).length === 0) {
    return;
  }

  const ref = doc(db, FREIGHT_FORWARD_COUNTS_PATH.collection, FREIGHT_FORWARD_COUNTS_PATH.id);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const current = snap.exists()
      ? (snap.data() as FreightForwardCounts)
      : ({} as FreightForwardCounts);

    const patch: Record<string, number | ReturnType<typeof serverTimestamp>> = {
      updatedAt: serverTimestamp(),
    };

    for (const key of COUNT_KEYS) {
      const change = delta[key];
      if (change === undefined || change === 0) continue;
      const base = typeof current[key] === "number" ? current[key] : 0;
      patch[key] = Math.max(0, base + change);
    }

    transaction.set(ref, patch, { merge: true });
  });
}

/**
 * Updates stats/freightForwardCounts from before/after job snapshots.
 * Never throws — failures are logged only.
 */
export function syncFreightForwardCounts(
  before: FreightForward | null,
  after: FreightForward | null
) {
  const delta = freightForwardCountsDelta(before, after);
  if (Object.keys(delta).length === 0) {
    return Promise.resolve();
  }

  return applyFreightForwardCountsDelta(delta).catch((error) => {
    console.error("[freightForwardCounts] Failed to update dashboard counters:", error);
  });
}

/** Live next-7-days count so the stored counter does not drift by calendar day. */
export async function countNext7DaysFromServer(): Promise<number | null> {
  try {
    const { from, to } = getNext7DayEtaRange();
    const ref = collection(db, "freightForward");
    const snap = await getCountFromServer(
      query(
        ref,
        where("workflowCompleted", "==", false),
        where("etaSort", ">=", from),
        where("etaSort", "<=", to)
      )
    );
    return snap.data().count;
  } catch (error) {
    console.warn("[freightForwardCounts] Live next7Days count failed:", error);
    return null;
  }
}

/** Returns null when the stats doc is missing (caller should fall back / seed). */
export async function getFreightForwardCardCountsFromCounters() {
  const ref = doc(db, FREIGHT_FORWARD_COUNTS_PATH.collection, FREIGHT_FORWARD_COUNTS_PATH.id);
  const snap = await getDocFromServer(ref);

  if (!snap.exists()) {
    return null;
  }

  const counts = statsDocToBalanceCounts(snap.data() as FreightForwardCounts);
  const liveNext7 = await countNext7DaysFromServer();
  if (liveNext7 !== null) {
    counts.next7Days = liveNext7;
  }
  return counts;
}

export async function seedFreightForwardCountsDoc(
  counts: ReturnType<typeof statsDocToBalanceCounts>
) {
  const ref = doc(db, FREIGHT_FORWARD_COUNTS_PATH.collection, FREIGHT_FORWARD_COUNTS_PATH.id);
  await setDoc(
    ref,
    {
      ...balanceCountsToStatsDoc(counts),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

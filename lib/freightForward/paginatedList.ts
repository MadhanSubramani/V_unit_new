import {
  collection,
  DocumentSnapshot,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  QueryConstraint,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FreightForward, FreightForwardStatus } from "@/types/freightForward";
import { normalizeEtaSort } from "@/lib/freightForward/etaSort";
import {
  BalanceCardFilter,
  computeBalanceCounts,
  getNext7DayEtaRange,
  isStatusPending,
  matchesBalanceCard,
} from "@/lib/freightForward/statusBalance";
import { FreightSortDir, FreightSortKey, requiresClientNaturalSort, sortFreightRecords } from "@/lib/freightForward/sortRecords";
import { matchesFreightSearch } from "@/lib/freightForward/searchFields";

const REF = () => collection(db, "freightForward");

const CLIENT_FETCH_MAX = 5000;
const CLIENT_CACHE_TTL_MS = 30_000;

export interface FreightListRequest {
  activeCard?: BalanceCardFilter | null;
  activeStatus?: string | null;
  etaFrom?: string;
  etaTo?: string;
  searchField?: string;
  searchValue?: string;
  sortKey: FreightSortKey;
  sortDir: FreightSortDir;
  pageSize: number;
  pageIndex: number;
  cursor?: DocumentSnapshot | null;
}

export interface FreightListPage {
  items: FreightForward[];
  lastDoc: DocumentSnapshot | null;
  total: number;
  mode: "server" | "client";
}

let clientRecordsCache: {
  records: FreightForward[];
  expires: number;
} | null = null;
let clientFetchPromise: Promise<FreightForward[]> | null = null;

export function invalidateFreightForwardListCache() {
  clientRecordsCache = null;
  clientFetchPromise = null;
}

function docToRecord(docSnap: DocumentSnapshot): FreightForward {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<FreightForward, "id">),
  };
}

function isFirestoreIndexError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const message = String((error as { message?: string }).message ?? "");
  return (
    code === "failed-precondition" ||
    message.includes("requires an index") ||
    message.includes("currently building")
  );
}

function buildFilterConstraints(
  activeCard?: BalanceCardFilter | null,
  activeStatus?: string | null,
  etaFrom?: string,
  etaTo?: string
): { constraints: QueryConstraint[]; hasEtaRange: boolean } {
  const constraints: QueryConstraint[] = [];
  let hasEtaRange = false;

  if (activeStatus === "billing") {
    constraints.push(where("pendingBilling", "==", true));
  } else if (activeStatus === "receivable") {
    constraints.push(where("pendingReceivable", "==", true));
  } else if (activeStatus === "payable") {
    constraints.push(where("pendingPayable", "==", true));
  } else if (activeCard === "inProcess") {
    constraints.push(where("status", "==", "in_process"));
  } else if (activeCard === "completed") {
    constraints.push(where("workflowCompleted", "==", true));
  } else if (activeCard === "momentum") {
    constraints.push(where("pendingMomentum", "==", true));
  } else if (activeCard === "split_manifest") {
    constraints.push(where("pendingSplitManifest", "==", true));
  } else if (activeCard === "billing") {
    constraints.push(where("pendingBilling", "==", true));
  } else if (activeCard === "receivable") {
    constraints.push(where("pendingReceivable", "==", true));
  } else if (activeCard === "payable") {
    constraints.push(where("pendingPayable", "==", true));
  } else if (activeCard === "next7Days") {
    const { from, to } = getNext7DayEtaRange();
    constraints.push(where("workflowCompleted", "==", false));
    constraints.push(where("etaSort", ">=", from));
    constraints.push(where("etaSort", "<=", to));
    hasEtaRange = true;
  }

  if (activeCard !== "next7Days") {
    if (etaFrom) {
      constraints.push(where("etaSort", ">=", etaFrom));
      hasEtaRange = true;
    }
    if (etaTo) {
      constraints.push(where("etaSort", "<=", etaTo));
      hasEtaRange = true;
    }
  }

  return { constraints, hasEtaRange };
}

function buildOrderConstraints(
  sortKey: FreightSortKey,
  sortDir: FreightSortDir,
  hasEtaRange: boolean
): QueryConstraint[] {
  const dir = sortDir === "asc" ? "asc" : "desc";

  if (hasEtaRange) {
    if (sortKey === "jobNumber") {
      return [orderBy("etaSort", "asc"), orderBy("jobNumber", dir)];
    }
    if (sortKey === "ezRefNumber") {
      return [orderBy("etaSort", "asc"), orderBy("ezRefNumber", dir)];
    }
    if (sortKey === "createdAt") {
      return [orderBy("etaSort", "asc"), orderBy("createdAt", dir)];
    }
    return [orderBy("etaSort", dir), orderBy("createdAt", "desc")];
  }

  if (sortKey === "jobNumber") {
    return [orderBy("jobNumber", dir)];
  }
  if (sortKey === "ezRefNumber") {
    return [orderBy("ezRefNumber", dir)];
  }
  if (sortKey === "createdAt") {
    return [orderBy("createdAt", dir)];
  }

  return [orderBy("etaSort", dir), orderBy("createdAt", "desc")];
}

function matchesEtaRange(
  item: FreightForward,
  etaFrom?: string,
  etaTo?: string
): boolean {
  const eta = item.etaSort ?? normalizeEtaSort(item.eta);
  if (etaFrom && eta < etaFrom) return false;
  if (etaTo && eta > etaTo) return false;
  return true;
}

function filterRecordsForRequest(
  records: FreightForward[],
  request: FreightListRequest
): FreightForward[] {
  let filtered = records.filter((item) => !item.isDeleted);

  if (request.activeStatus) {
    filtered = filtered.filter((item) =>
      isStatusPending(item, request.activeStatus as FreightForwardStatus)
    );
  } else if (request.activeCard) {
    filtered = filtered.filter((item) =>
      matchesBalanceCard(item, request.activeCard as BalanceCardFilter)
    );
  }

  if (request.etaFrom || request.etaTo) {
    filtered = filtered.filter((item) =>
      matchesEtaRange(item, request.etaFrom, request.etaTo)
    );
  }

  if (request.searchValue?.trim()) {
    filtered = filtered.filter((item) =>
      matchesFreightSearch(item, request.searchValue!, request.searchField)
    );
  }

  return sortFreightRecords(filtered, request.sortKey, request.sortDir);
}

async function fetchAllRecordsForClient(): Promise<FreightForward[]> {
  const now = Date.now();
  if (clientRecordsCache && clientRecordsCache.expires > now) {
    return clientRecordsCache.records;
  }

  if (clientFetchPromise) {
    return clientFetchPromise;
  }

  clientFetchPromise = (async () => {
    const ref = REF();
    try {
      const snap = await getDocs(query(ref, limit(CLIENT_FETCH_MAX)));
      const records = sortFreightRecords(
        snap.docs.map(docToRecord),
        "createdAt",
        "desc"
      );
      clientRecordsCache = {
        records,
        expires: Date.now() + CLIENT_CACHE_TTL_MS,
      };
      return records;
    } catch (error) {
      if (!isFirestoreIndexError(error)) throw error;
      const snap = await getDocs(query(ref, limit(CLIENT_FETCH_MAX)));
      const records = snap.docs.map(docToRecord);
      clientRecordsCache = {
        records,
        expires: Date.now() + CLIENT_CACHE_TTL_MS,
      };
      return records;
    } finally {
      clientFetchPromise = null;
    }
  })();

  return clientFetchPromise;
}

async function fetchClientListPage(
  request: FreightListRequest
): Promise<FreightListPage> {
  const all = await fetchAllRecordsForClient();
  const filtered = filterRecordsForRequest(all, request);

  return {
    items: filtered.slice(
      request.pageIndex * request.pageSize,
      (request.pageIndex + 1) * request.pageSize
    ),
    lastDoc: null,
    total: filtered.length,
    mode: "client",
  };
}

async function fetchServerListPage(
  request: FreightListRequest
): Promise<FreightListPage> {
  const ref = REF();
  const { constraints: filterConstraints, hasEtaRange } = buildFilterConstraints(
    request.activeCard,
    request.activeStatus,
    request.etaFrom,
    request.etaTo
  );
  const orderConstraints = buildOrderConstraints(
    request.sortKey,
    request.sortDir,
    hasEtaRange
  );

  const countSnap = await getCountFromServer(query(ref, ...filterConstraints));
  const total = countSnap.data().count;

  const paginationConstraints: QueryConstraint[] = [
    ...orderConstraints,
    ...(request.cursor ? [startAfter(request.cursor)] : []),
    limit(request.pageSize),
  ];

  const snap = await getDocs(
    query(ref, ...filterConstraints, ...paginationConstraints)
  );

  return {
    items: snap.docs.map(docToRecord).filter((item) => !item.isDeleted),
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
    total,
    mode: "server",
  };
}

async function resolveListPage(
  request: FreightListRequest
): Promise<FreightListPage> {
  const serverResult = await fetchServerListPage(request);

  if (serverResult.items.length > 0) {
    return serverResult;
  }

  if (serverResult.total === 0) {
    return serverResult;
  }

  const clientResult = await fetchClientListPage(request);
  if (clientResult.total > 0) {
    console.warn(
      "Freight list using client mode (legacy records may lack index fields)."
    );
    return clientResult;
  }

  return serverResult;
}

export async function getFreightForwardPaginated(
  request: FreightListRequest
): Promise<FreightListPage> {
  // FF No / EZ No must use client natural-number sort (VO1, VO2… VO10; FF01, FF02…).
  if (request.searchValue?.trim() || requiresClientNaturalSort(request.sortKey)) {
    return fetchClientListPage(request);
  }

  try {
    return await resolveListPage(request);
  } catch (error) {
    if (!isFirestoreIndexError(error)) throw error;
    console.warn(
      "Freight list falling back to client mode (index missing or building).",
      error
    );
    return fetchClientListPage(request);
  }
}

async function countWithFallback(
  constraints: QueryConstraint[],
  fallback: () => Promise<number>
): Promise<number> {
  try {
    const snap = await getCountFromServer(query(REF(), ...constraints));
    return snap.data().count;
  } catch (error) {
    if (!isFirestoreIndexError(error)) throw error;
    return fallback();
  }
}

export async function getFreightForwardCardCountsFromServer() {
  const { from, to } = getNext7DayEtaRange();

  let clientRecords: FreightForward[] | null = null;
  const clientCount = async (pick: (counts: ReturnType<typeof computeBalanceCounts>) => number) => {
    if (!clientRecords) {
      clientRecords = await fetchAllRecordsForClient();
    }
    return pick(computeBalanceCounts(clientRecords.filter((item) => !item.isDeleted)));
  };

  try {
    const [
      inProcess,
      next7Days,
      momentum,
      split_manifest,
      billing,
      receivable,
      payable,
      completed,
    ] = await Promise.all([
      countWithFallback([where("status", "==", "in_process")], () =>
        clientCount((c) => c.inProcess)
      ),
      countWithFallback(
        [
          where("workflowCompleted", "==", false),
          where("etaSort", ">=", from),
          where("etaSort", "<=", to),
        ],
        () => clientCount((c) => c.next7Days)
      ),
      countWithFallback([where("pendingMomentum", "==", true)], () =>
        clientCount((c) => c.momentum)
      ),
      countWithFallback([where("pendingSplitManifest", "==", true)], () =>
        clientCount((c) => c.split_manifest)
      ),
      countWithFallback([where("pendingBilling", "==", true)], () =>
        clientCount((c) => c.billing)
      ),
      countWithFallback([where("pendingReceivable", "==", true)], () =>
        clientCount((c) => c.receivable)
      ),
      countWithFallback([where("pendingPayable", "==", true)], () =>
        clientCount((c) => c.payable)
      ),
      countWithFallback([where("workflowCompleted", "==", true)], () =>
        clientCount((c) => c.completed)
      ),
    ]);

    return {
      inProcess,
      next7Days,
      momentum,
      split_manifest,
      billing,
      receivable,
      payable,
      completed,
    };
  } catch (error) {
    if (!isFirestoreIndexError(error)) throw error;
    const records = (await fetchAllRecordsForClient()).filter((item) => !item.isDeleted);
    return computeBalanceCounts(records);
  }
}

export { normalizeEtaSort };

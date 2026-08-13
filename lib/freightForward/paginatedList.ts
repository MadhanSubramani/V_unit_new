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
import {
  fetchAllFreightForwardRecords,
  invalidateImportLinerCache,
} from "@/lib/freightForward/chunkedFetch";
import { buildFreightSearchIndex } from "@/lib/freightForward/searchIndex";
import { isImportJobNumber } from "@/lib/freightForward/generateJobNumber";
import { computePipelineFlags } from "@/lib/freightForward/pipelineFlags";

const REF = () => collection(db, "freightForward");

const CLIENT_CACHE_TTL_MS = 120_000;
/** When soft-deleted rows shrink a server page, over-fetch up to this multiple. */
const SERVER_PAGE_FETCH_MULTIPLIER = 3;

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
  invalidateImportLinerCache();
}

function docToRecord(docSnap: DocumentSnapshot): FreightForward {
  const item = {
    id: docSnap.id,
    ...(docSnap.data() as Omit<FreightForward, "id">),
  } as FreightForward;
  return hydrateFreightRecord(item);
}

/** Timeline is the source of truth; pending* flags can drift after manual DB edits. */
function hydrateFreightRecord(item: FreightForward): FreightForward {
  return {
    ...item,
    ...(item.searchText ? {} : buildFreightSearchIndex(item)),
    ...computePipelineFlags(item.statusTimeline),
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
  let filtered = records.filter(
    (item) => !item.isDeleted && !isImportJobNumber(item.jobNumber)
  );

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
    try {
      // Chunked full scan — no silent 5000 ceiling; preserves search/sort UX.
      // Hydrate missing search* fields in memory (legacy docs) for faster filters.
      const records = (await fetchAllFreightForwardRecords()).map(
        hydrateFreightRecord
      );
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

  // Soft-deleted docs are still in server totals until indexes include isDeleted.
  // Over-fetch and skip deleted so pages stay full without changing UI.
  const activeItems: FreightForward[] = [];
  let lastDoc: DocumentSnapshot | null = request.cursor ?? null;
  let guard = 0;
  const maxFetches = SERVER_PAGE_FETCH_MULTIPLIER;

  while (activeItems.length < request.pageSize && guard < maxFetches) {
    guard += 1;
    const fetchSize = Math.max(
      request.pageSize,
      (request.pageSize - activeItems.length) * 2
    );
    const paginationConstraints: QueryConstraint[] = [
      ...orderConstraints,
      ...(lastDoc ? [startAfter(lastDoc)] : []),
      limit(fetchSize),
    ];

    const snap = await getDocs(
      query(ref, ...filterConstraints, ...paginationConstraints)
    );
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      lastDoc = docSnap;
      const record = docToRecord(docSnap);
      if (record.isDeleted || isImportJobNumber(record.jobNumber)) continue;
      activeItems.push(record);
      if (activeItems.length >= request.pageSize) break;
    }

    if (snap.docs.length < fetchSize) break;
  }

  return {
    items: activeItems.slice(0, request.pageSize),
    lastDoc,
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
  // Always use the same active-FF filter as the tiles (exclude trash + IMP*).
  // Server collection counts include those docs, which made list total
  // (e.g. 55) disagree with completed + incomplete (e.g. 26 + 27 = 53).
  return fetchClientListPage(request);
}

export async function getFreightForwardCardCountsFromServer() {
  // Always derive counts from active (non-deleted) records using the same
  // timeline rules as the list filters. Server count queries alone can include
  // trashed jobs and miss legacy docs without pending*/workflowCompleted flags.
  const records = (await fetchAllRecordsForClient()).filter(
    (item) => !item.isDeleted && !isImportJobNumber(item.jobNumber)
  );
  return computeBalanceCounts(records);
}

export { normalizeEtaSort };

import { db } from "../firebase";
import {
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  QueryConstraint,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { FreightForward, FreightForwardFormData, FreightForwardStatus } from "@/types/freightForward";
import {
  ensureFreightForwardCounterSeeded,
  formatFreightJobNumber,
  FREIGHT_COUNTER_DOC,
} from "./generateJobNumber";
import { computePipelineFlags } from "./pipelineFlags";
import { normalizeEtaSort } from "./etaSort";
import {
  getFreightForwardCardCountsFromServer,
  getFreightForwardPaginated,
  invalidateFreightForwardListCache,
} from "./paginatedList";
import {
  getFreightForwardCardCountsFromCounters,
  isFreightForwardCounterDashboardEnabled,
  syncFreightForwardCounts,
} from "./freightForwardCounts";
import { usesBalanceCardFilter } from "./statusBalance";
import { sortFreightRecords } from "./sortRecords";

const REF = () => collection(db, "freightForward");

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

/** Firestore rejects `undefined` at any depth (including inside arrays). */
function stripUndefinedDeep(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Timestamp || value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value
      .map(stripUndefinedDeep)
      .filter((item) => item !== undefined);
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, entry]) => [key, stripUndefinedDeep(entry)] as const)
        .filter(([, entry]) => entry !== undefined)
    );
  }
  return value;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return stripUndefinedDeep(obj) as Partial<T>;
}

export { usesBalanceCardFilter };
export {
  getFreightForwardPaginated,
  invalidateFreightForwardListCache,
  type FreightListPage,
  type FreightListRequest,
} from "./paginatedList";

// ── Card counts (server-side count queries or stats doc) ─────────────────
export async function getFreightForwardCardCounts() {
  if (isFreightForwardCounterDashboardEnabled()) {
    return getFreightForwardCardCountsFromCounters();
  }
  return getFreightForwardCardCountsFromServer();
}

export { getFreightForwardCardCountsFromCounters } from "./freightForwardCounts";

// ── Client-side text search helper (used only when search is active) ───────
export async function getFreightForwardSearch({
  activeCard,
  etaFrom,
  etaTo,
  searchField,
  searchValue,
}: {
  activeCard?: import("./statusBalance").BalanceCardFilter | null;
  etaFrom?: string;
  etaTo?: string;
  searchField: string;
  searchValue: string;
}) {
  const result = await getFreightForwardPaginated({
    activeCard,
    etaFrom,
    etaTo,
    searchField,
    searchValue,
    sortKey: "eta",
    sortDir: "asc",
    pageSize: 2000,
    pageIndex: 0,
  });
  return result.items;
}

// ── CRUD ───────────────────────────────────────────────────────────────────
export async function createFreightForward(
  data: FreightForwardFormData,
  createdBy: string
) {
  await ensureFreightForwardCounterSeeded();

  const { jobNumber: _ignored, ...recordData } = data;
  const timeline = [
    {
      status: "in_process",
      updatedBy: createdBy,
      updatedAt: Timestamp.now(),
    },
  ];
  const flags = computePipelineFlags(timeline);

  const newDocRef = doc(collection(db, "freightForward"));
  const counterRef = doc(db, "counters", FREIGHT_COUNTER_DOC);

  const jobNumber = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const lastSeq = counterSnap.exists() ? (counterSnap.data().lastSeq as number) : 0;
    const next = lastSeq + 1;
    const allocated = formatFreightJobNumber(next);

    transaction.set(counterRef, { lastSeq: next }, { merge: true });
    transaction.set(
      newDocRef,
      stripUndefinedDeep({
        ...recordData,
        jobNumber: allocated,
        etaSort: normalizeEtaSort(data.eta),
        ...flags,
        status: data.status ?? "in_process",
        statusTimeline: timeline,
        createdBy,
        updatedBy: createdBy,
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }) as Record<string, unknown>
    );

    return allocated;
  });

  invalidateFreightForwardListCache();

  const createdRecord: FreightForward = {
    id: newDocRef.id,
    ...(stripUndefinedDeep({
      ...recordData,
      jobNumber,
      etaSort: normalizeEtaSort(data.eta),
      ...flags,
      status: data.status ?? "in_process",
      statusTimeline: timeline,
      createdBy,
      updatedBy: createdBy,
      isDeleted: false,
    }) as Omit<FreightForward, "id">),
  };
  await syncFreightForwardCounts(null, createdRecord);

  return { id: newDocRef.id, jobNumber };
}

export async function updateFreightForward(
  id: string,
  data: Partial<FreightForwardFormData>,
  updatedBy: string
) {
  const docRef = doc(db, "freightForward", id);
  const beforeSnap = await getDoc(docRef);
  const beforeRecord = beforeSnap.exists()
    ? ({ id: beforeSnap.id, ...(beforeSnap.data() as Omit<FreightForward, "id">) } as FreightForward)
    : null;

  const patch: Record<string, unknown> = {
    ...data,
    updatedBy,
    updatedAt: serverTimestamp(),
  };

  if (data.eta !== undefined) {
    patch.etaSort = normalizeEtaSort(data.eta);
  }

  const cleaned: Record<string, unknown> = stripUndefined(patch);

  // When switching CFS ↔ SEZ, clear the unused field. Omitting it leaves the
  // old value in Firestore, so view/list keep showing the previous location.
  // Apply deleteField after stripUndefined so the sentinel is not corrupted.
  if (data.locationType === "cfs") {
    cleaned.cfs = data.cfs ?? deleteField();
    cleaned.sez = deleteField();
  } else if (data.locationType === "sez") {
    cleaned.sez = data.sez ?? deleteField();
    cleaned.cfs = deleteField();
  }

  await updateDoc(docRef, cleaned);
  invalidateFreightForwardListCache();

  if (beforeRecord) {
    const afterRecord: FreightForward = {
      ...beforeRecord,
      ...data,
      id,
      updatedBy,
    };
    if (data.eta !== undefined) {
      afterRecord.etaSort = normalizeEtaSort(data.eta);
    }
    if (data.locationType === "cfs") {
      afterRecord.cfs = data.cfs ?? beforeRecord.cfs;
      afterRecord.sez = undefined;
    } else if (data.locationType === "sez") {
      afterRecord.sez = data.sez ?? beforeRecord.sez;
      afterRecord.cfs = undefined;
    }
    await syncFreightForwardCounts(beforeRecord, afterRecord);
  }
}

export async function updateWorkflowStatus(
  id: string,
  nextStatus: FreightForwardStatus,
  updatedBy: string
) {
  const docRef = doc(db, "freightForward", id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;

  const beforeRecord = {
    id: snap.id,
    ...(snap.data() as Omit<FreightForward, "id">),
  } as FreightForward;

  const existing = snap.data();
  const newEntry = {
    status: nextStatus,
    updatedBy,
    updatedAt: Timestamp.now(),
  };
  const timeline = [...(existing.statusTimeline ?? []), newEntry];
  const flags = computePipelineFlags(timeline);

  await updateDoc(docRef, {
    status: nextStatus,
    updatedBy,
    updatedAt: serverTimestamp(),
    ...flags,
    statusTimeline: arrayUnion(newEntry),
  });
  invalidateFreightForwardListCache();

  const afterRecord: FreightForward = {
    ...beforeRecord,
    status: nextStatus,
    statusTimeline: timeline,
    updatedBy,
    ...flags,
  };
  await syncFreightForwardCounts(beforeRecord, afterRecord);
}

export async function getFreightForwardById(id: string) {
  const snap = await getDoc(doc(db, "freightForward", id));
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...(snap.data() as FreightForward),
  };
}

export async function getFreightForwardForExport(etaFrom: string, etaTo: string) {
  const ref = REF();
  const constraints: QueryConstraint[] = [];
  if (etaFrom) constraints.push(where("etaSort", ">=", etaFrom));
  if (etaTo) constraints.push(where("etaSort", "<=", etaTo));
  const snap = await getDocs(query(ref, ...constraints, orderBy("etaSort", "asc")));
  return snap.docs
    .map((d) => ({
      id: d.id,
      ...(d.data() as Omit<FreightForward, "id">),
    }))
    .filter((item) => !item.isDeleted);
}

/** Active (non-deleted) jobs whose vessel name matches (case-insensitive, exact trim). */
export async function findFreightByVesselName(vesselName: string) {
  const needle = vesselName.trim().toLowerCase();
  if (!needle) return [] as FreightForward[];

  const snap = await getDocs(query(REF(), limit(5000)));
  return snap.docs
    .map(
      (d) =>
        ({
          id: d.id,
          ...(d.data() as Omit<FreightForward, "id">),
        }) as FreightForward
    )
    .filter(
      (item) =>
        !item.isDeleted &&
        (item.vesselName ?? "").trim().toLowerCase() === needle
    )
    .sort((a, b) => (a.jobNumber ?? "").localeCompare(b.jobNumber ?? ""));
}

/** Set the same ETA on every active job with this vessel name. */
export async function updateEtaByVesselName(
  vesselName: string,
  eta: string,
  updatedBy: string
) {
  const matches = await findFreightByVesselName(vesselName);
  if (!matches.length) return { updated: 0 };

  const etaValue = eta.trim().slice(0, 10);

  for (const item of matches) {
    if (!item.id) continue;
    await updateFreightForward(
      item.id,
      { eta: etaValue } as Partial<FreightForwardFormData>,
      updatedBy
    );
  }

  return { updated: matches.length };
}

/** Soft-delete: hide from main list; keep data for Trash. */
export async function softDeleteFreightForward(id: string, deletedBy: string) {
  const docRef = doc(db, "freightForward", id);
  const beforeSnap = await getDoc(docRef);
  const beforeRecord = beforeSnap.exists()
    ? ({ id: beforeSnap.id, ...(beforeSnap.data() as Omit<FreightForward, "id">) } as FreightForward)
    : null;

  await updateDoc(docRef, {
    isDeleted: true,
    deletedBy,
    deletedAt: serverTimestamp(),
    updatedBy: deletedBy,
    updatedAt: serverTimestamp(),
  });
  invalidateFreightForwardListCache();

  if (beforeRecord) {
    const afterRecord: FreightForward = { ...beforeRecord, isDeleted: true, deletedBy };
    await syncFreightForwardCounts(beforeRecord, afterRecord);
  }
}

/** Recover soft-deleted jobs back to the main list. */
export async function restoreFreightForwards(ids: string[], restoredBy: string) {
  await Promise.all(
    ids.map(async (id) => {
      const docRef = doc(db, "freightForward", id);
      const beforeSnap = await getDoc(docRef);
      const beforeRecord = beforeSnap.exists()
        ? ({ id: beforeSnap.id, ...(beforeSnap.data() as Omit<FreightForward, "id">) } as FreightForward)
        : null;

      await updateDoc(docRef, {
        isDeleted: false,
        deletedBy: deleteField(),
        deletedAt: deleteField(),
        updatedBy: restoredBy,
        updatedAt: serverTimestamp(),
      });

      if (beforeRecord) {
        const afterRecord: FreightForward = {
          ...beforeRecord,
          isDeleted: false,
          deletedBy: undefined,
          deletedAt: undefined,
          updatedBy: restoredBy,
        };
        await syncFreightForwardCounts(beforeRecord, afterRecord);
      }
    })
  );
  invalidateFreightForwardListCache();
}

export async function getTrashedFreightForwards(): Promise<FreightForward[]> {
  try {
    const snap = await getDocs(
      query(REF(), where("isDeleted", "==", true), orderBy("deletedAt", "desc"))
    );
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<FreightForward, "id">),
    }));
  } catch {
    // Fallback when deletedAt index is missing.
    const snap = await getDocs(query(REF(), where("isDeleted", "==", true)));
    return snap.docs
      .map((d) => ({
        id: d.id,
        ...(d.data() as Omit<FreightForward, "id">),
      }))
      .sort((a, b) => {
        const timeA =
          a.deletedAt &&
          typeof a.deletedAt === "object" &&
          a.deletedAt !== null &&
          "toMillis" in a.deletedAt
            ? (a.deletedAt as { toMillis: () => number }).toMillis()
            : 0;
        const timeB =
          b.deletedAt &&
          typeof b.deletedAt === "object" &&
          b.deletedAt !== null &&
          "toMillis" in b.deletedAt
            ? (b.deletedAt as { toMillis: () => number }).toMillis()
            : 0;
        return timeB - timeA;
      });
  }
}

/** Permanently delete docs and attached Storage files. */
export async function permanentlyDeleteFreightForwards(ids: string[]) {
  const { deleteFreightForwardStorageFiles } = await import("./deleteStorage");

  for (const id of ids) {
    const docRef = doc(db, "freightForward", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) continue;
    const beforeRecord = {
      id: snap.id,
      ...(snap.data() as Omit<FreightForward, "id">),
    } as FreightForward;
    const item = beforeRecord;
    await deleteFreightForwardStorageFiles(item);
    await deleteDoc(docRef);
    await syncFreightForwardCounts(beforeRecord, null);
  }

  invalidateFreightForwardListCache();
}

/** @deprecated use softDeleteFreightForward — kept for compatibility */
export async function deleteFreightForward(id: string) {
  await softDeleteFreightForward(id, "unknown");
}

// Legacy helpers — prefer getFreightForwardPaginated
export async function getFreightForwardByStatus(status: string) {
  const result = await getFreightForwardPaginated({
    activeStatus: status,
    sortKey: "eta",
    sortDir: "asc",
    pageSize: 2000,
    pageIndex: 0,
  });
  return sortFreightRecords(result.items, "eta", "asc");
}

import { db } from "../firebase";
import {
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  QueryConstraint,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  FreightForward,
  FreightForwardDocument,
  FreightForwardFormData,
  FreightForwardStatus,
  ImportDoStatus,
  ImportIgmStatus,
  ImportMovementStatus,
  ImportWorkflowSection,
  ImportWorkflowTimelineEntry,
} from "@/types/freightForward";
import {
  ensureFreightForwardCounterSeeded,
  ensureImportLinerCounterSeeded,
  formatFreightJobNumber,
  formatImportJobNumber,
  FREIGHT_COUNTER_DOC,
  IMPORT_COUNTER_DOC,
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
  seedFreightForwardCountsDoc,
  syncFreightForwardCounts,
} from "./freightForwardCounts";
import { usesBalanceCardFilter } from "./statusBalance";
import { sortFreightRecords } from "./sortRecords";
import { fetchAllImportLinerRecords, fetchAllFreightForwardRecords } from "./chunkedFetch";
import { buildFreightSearchIndex } from "./searchIndex";
import {
  canUpdateImportDo,
  canUpdateImportIgm,
  getImportDoStatus,
  getImportIgmStatus,
  getImportMovementStatus,
  isImportLinerCompleted,
  isImportWorklistJob,
} from "@/lib/import/linerWorkflow";

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
    try {
      const fromCounters = await getFreightForwardCardCountsFromCounters();
      if (fromCounters) return fromCounters;
    } catch (error) {
      console.warn(
        "[freightForwardCounts] Counter read failed; falling back to scan.",
        error
      );
    }
  }

  const counted = await getFreightForwardCardCountsFromServer();
  // Auto-seed once so later loads stay O(1). Never block the UI on seed failure.
  void seedFreightForwardCountsDoc(counted).catch((error) => {
    console.warn("[freightForwardCounts] Auto-seed failed:", error);
  });
  return counted;
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
  const importDefaults = data.useForImport
    ? {
        useForImport: true,
        createdFrom: data.createdFrom ?? ("freight_forward" as const),
        importMovementStatus:
          data.importMovementStatus ?? ("pending" as const),
        importIgmStatus: data.importIgmStatus ?? ("pending" as const),
        importDoStatus: data.importDoStatus ?? ("pending" as const),
        importCompleted: false,
      }
    : {
        createdFrom: data.createdFrom ?? ("freight_forward" as const),
      };

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
        ...importDefaults,
        ...buildFreightSearchIndex({ ...recordData, jobNumber: allocated }),
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
      ...importDefaults,
      ...buildFreightSearchIndex({ ...recordData, jobNumber }),
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

/**
 * Creates an Import-originated job on the shared freightForward collection
 * with IMP001-style numbering. Appears in Import Liner and FF job list.
 */
export async function createImportLinerJob(
  data: FreightForwardFormData,
  createdBy: string
) {
  await ensureImportLinerCounterSeeded();

  const { jobNumber: _ignored, ...recordData } = data;
  const timeline = [
    {
      status: "in_process",
      updatedBy: createdBy,
      updatedAt: Timestamp.now(),
    },
  ];
  const flags = computePipelineFlags(timeline);
  const importDefaults = {
    useForImport: true,
    createdFrom: "import" as const,
    importMovementStatus:
      data.importMovementStatus ?? ("pending" as const),
    importIgmStatus: data.importIgmStatus ?? ("pending" as const),
    importDoStatus: data.importDoStatus ?? ("pending" as const),
    importCompleted: false,
  };

  const newDocRef = doc(collection(db, "freightForward"));
  const counterRef = doc(db, "counters", IMPORT_COUNTER_DOC);

  const jobNumber = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const lastSeq = counterSnap.exists()
      ? (counterSnap.data().lastSeq as number)
      : 0;
    const next = lastSeq + 1;
    const allocated = formatImportJobNumber(next);

    transaction.set(counterRef, { lastSeq: next }, { merge: true });
    transaction.set(
      newDocRef,
      stripUndefinedDeep({
        ...recordData,
        jobNumber: allocated,
        etaSort: normalizeEtaSort(data.eta),
        ...flags,
        ...importDefaults,
        ...buildFreightSearchIndex({ ...recordData, jobNumber: allocated }),
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
      ...importDefaults,
      ...buildFreightSearchIndex({ ...recordData, jobNumber }),
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

  if (data.useForImport === true && !beforeRecord?.useForImport) {
    patch.importMovementStatus = beforeRecord
      ? getImportMovementStatus(beforeRecord)
      : "pending";
    patch.importIgmStatus = beforeRecord
      ? getImportIgmStatus(beforeRecord)
      : "pending";
    patch.importDoStatus = beforeRecord
      ? getImportDoStatus(beforeRecord)
      : "pending";
    patch.importCompleted = beforeRecord
      ? isImportLinerCompleted(beforeRecord)
      : false;
  }

  const mergedForSearch: FreightForward = {
    ...(beforeRecord ?? ({} as FreightForward)),
    ...data,
    jobNumber: data.jobNumber ?? beforeRecord?.jobNumber,
  };
  Object.assign(patch, buildFreightSearchIndex(mergedForSearch));

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
  const shouldSyncImportMovement =
    nextStatus === "momentum" &&
    beforeRecord.useForImport &&
    getImportMovementStatus(beforeRecord) !== "completed";
  const importEntry = shouldSyncImportMovement
    ? {
        section: "movement" as const,
        status: "completed" as const,
        updatedBy,
        updatedAt: Timestamp.now(),
      }
    : null;
  const importPatch = shouldSyncImportMovement
    ? {
        importMovementStatus: "completed" as const,
        importCompleted:
          getImportIgmStatus(beforeRecord) === "posted" &&
          getImportDoStatus(beforeRecord) === "eod",
        ...(importEntry
          ? { importWorkflowTimeline: arrayUnion(importEntry) }
          : {}),
      }
    : {};

  await updateDoc(docRef, {
    status: nextStatus,
    updatedBy,
    updatedAt: serverTimestamp(),
    ...flags,
    ...importPatch,
    statusTimeline: arrayUnion(newEntry),
  });
  invalidateFreightForwardListCache();

  const afterRecord: FreightForward = {
    ...beforeRecord,
    status: nextStatus,
    statusTimeline: timeline,
    updatedBy,
    ...flags,
    ...(shouldSyncImportMovement
      ? {
          importMovementStatus: "completed" as const,
          importCompleted:
            getImportIgmStatus(beforeRecord) === "posted" &&
            getImportDoStatus(beforeRecord) === "eod",
          importWorkflowTimeline: importEntry
            ? [...(beforeRecord.importWorkflowTimeline ?? []), importEntry]
            : beforeRecord.importWorkflowTimeline,
        }
      : {}),
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

export async function getImportLinerRecords() {
  const records = await fetchAllImportLinerRecords();
  return records.sort((a, b) => {
    const etaCompare = normalizeEtaSort(a.eta).localeCompare(
      normalizeEtaSort(b.eta)
    );
    return etaCompare || (a.jobNumber ?? "").localeCompare(b.jobNumber ?? "");
  });
}

type ImportLinerStatus =
  | ImportMovementStatus
  | ImportIgmStatus
  | ImportDoStatus;

function isValidImportStatus(
  section: ImportWorkflowSection,
  status: ImportLinerStatus
) {
  if (section === "movement") {
    return ["pending", "accepted", "completed"].includes(status);
  }
  if (section === "igm") {
    return ["pending", "posted"].includes(status);
  }
  return ["pending", "received", "eod"].includes(status);
}

/**
 * Updates an Import Liner stage on the shared Freight Forward document.
 * Movement=completed also completes the FF Movement stage, preserving one source of truth.
 */
export async function updateImportLinerStage(
  id: string,
  section: ImportWorkflowSection,
  status: ImportLinerStatus,
  updatedBy: string
) {
  if (!isValidImportStatus(section, status)) {
    throw new Error(`Invalid ${section} status: ${status}`);
  }

  const docRef = doc(db, "freightForward", id);
  const result = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) throw new Error("Freight Forward job not found.");

    const before = {
      id: snap.id,
      ...(snap.data() as Omit<FreightForward, "id">),
    } as FreightForward;
    if (!before.useForImport || before.isDeleted) {
      throw new Error("This job is not active in Import Liner.");
    }

    const movementBefore = getImportMovementStatus(before);
    const igmBefore = getImportIgmStatus(before);
    const doBefore = getImportDoStatus(before);
    const currentStatus =
      section === "movement"
        ? movementBefore
        : section === "igm"
          ? igmBefore
          : doBefore;

    if (currentStatus === status) {
      return { before, after: before };
    }

    if (section === "igm" && !canUpdateImportIgm(before)) {
      throw new Error("Complete Movement before updating IGM.");
    }
    if (section === "do" && !canUpdateImportDo(before)) {
      throw new Error("Post IGM before updating DO.");
    }

    const now = Timestamp.now();
    const importEntry =
      section === "movement"
        ? {
            section: "movement" as const,
            status: status as ImportMovementStatus,
            updatedBy,
            updatedAt: now,
          }
        : section === "igm"
          ? {
              section: "igm" as const,
              status: status as ImportIgmStatus,
              updatedBy,
              updatedAt: now,
            }
          : {
              section: "do" as const,
              status: status as ImportDoStatus,
              updatedBy,
              updatedAt: now,
            };
    const nextMovement =
      section === "movement" ? (status as ImportMovementStatus) : movementBefore;
    let nextIgm =
      section === "igm" ? (status as ImportIgmStatus) : igmBefore;
    let nextDo = section === "do" ? (status as ImportDoStatus) : doBefore;
    const importEntries: ImportWorkflowTimelineEntry[] = [importEntry];

    if (section === "movement" && nextMovement !== "completed") {
      if (nextIgm !== "pending") {
        nextIgm = "pending";
        importEntries.push({
          section: "igm",
          status: "pending",
          updatedBy,
          updatedAt: now,
        });
      }
      if (nextDo !== "pending") {
        nextDo = "pending";
        importEntries.push({
          section: "do",
          status: "pending",
          updatedBy,
          updatedAt: now,
        });
      }
    } else if (section === "igm" && nextIgm !== "posted" && nextDo !== "pending") {
      nextDo = "pending";
      importEntries.push({
        section: "do",
        status: "pending",
        updatedBy,
        updatedAt: now,
      });
    }

    const importCompleted =
      nextMovement === "completed" &&
      nextIgm === "posted" &&
      nextDo === "eod";

    const patch: Record<string, unknown> = {
      importMovementStatus: nextMovement,
      importIgmStatus: nextIgm,
      importDoStatus: nextDo,
      importCompleted,
      importWorkflowTimeline: [
        ...(before.importWorkflowTimeline ?? []),
        ...importEntries,
      ],
      updatedBy,
      updatedAt: serverTimestamp(),
    };

    let nextTimeline = before.statusTimeline ?? [];
    if (section === "movement") {
      if (
        status === "completed" &&
        !nextTimeline.some((entry) => entry.status === "momentum")
      ) {
        nextTimeline = [
          ...nextTimeline,
          {
            status: "momentum" as const,
            updatedBy,
            updatedAt: now,
          },
        ];
      } else if (status !== "completed") {
        nextTimeline = nextTimeline.filter((entry) => entry.status !== "momentum");
      }

      const latestFreightStatus =
        nextTimeline.length > 0
          ? (nextTimeline[nextTimeline.length - 1].status as FreightForwardStatus)
          : ("in_process" as const);
      Object.assign(patch, computePipelineFlags(nextTimeline), {
        status:
          status === "completed" && before.status === "in_process"
            ? "momentum"
            : status !== "completed" && before.status === "momentum"
              ? latestFreightStatus
              : before.status,
        statusTimeline: nextTimeline,
      });
    }

    transaction.update(docRef, patch);

    const after: FreightForward = {
      ...before,
      importMovementStatus: nextMovement,
      importIgmStatus: nextIgm,
      importDoStatus: nextDo,
      importCompleted,
      importWorkflowTimeline: [
        ...(before.importWorkflowTimeline ?? []),
        ...importEntries,
      ],
      updatedBy,
      status: (patch.status as FreightForwardStatus | undefined) ?? before.status,
      statusTimeline: nextTimeline,
      ...computePipelineFlags(nextTimeline),
    };
    return { before, after };
  });

  invalidateFreightForwardListCache();
  if (result.before !== result.after) {
    await syncFreightForwardCounts(result.before, result.after);
  }
  return result.after;
}

export async function updateImportLinerRemark(
  id: string,
  section: ImportWorkflowSection,
  remark: string,
  updatedBy: string
) {
  const docRef = doc(db, "freightForward", id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error("Freight Forward job not found.");

  const before = {
    id: snap.id,
    ...(snap.data() as Omit<FreightForward, "id">),
  } as FreightForward;
  if (!before.useForImport || before.isDeleted) {
    throw new Error("This job is not active in Import Liner.");
  }

  const field =
    section === "movement"
      ? "importMovementRemark"
      : section === "igm"
        ? "importIgmRemark"
        : "importDoRemark";

  await updateDoc(docRef, {
    [field]: remark.trim(),
    updatedBy,
    updatedAt: serverTimestamp(),
  });
  invalidateFreightForwardListCache();

  return {
    ...before,
    [field]: remark.trim(),
    updatedBy,
  } as FreightForward;
}

export async function appendImportOtherDocuments(
  id: string,
  documents: FreightForwardDocument[],
  updatedBy: string
) {
  if (!documents.length) {
    const existing = await getFreightForwardById(id);
    if (!existing) throw new Error("Freight Forward job not found.");
    return existing;
  }

  const docRef = doc(db, "freightForward", id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error("Freight Forward job not found.");

  const before = {
    id: snap.id,
    ...(snap.data() as Omit<FreightForward, "id">),
  } as FreightForward;
  if (before.isDeleted) throw new Error("This job is in trash.");

  const otherDocuments = [...(before.otherDocuments ?? []), ...documents];
  await updateDoc(docRef, {
    otherDocuments,
    updatedBy,
    updatedAt: serverTimestamp(),
  });
  invalidateFreightForwardListCache();

  return { ...before, otherDocuments, updatedBy };
}

/** Import worklist / ETA scope: IMP* or useForImport jobs. */
export async function findImportJobsByVesselName(vesselName: string) {
  const needle = vesselName.trim().toLowerCase();
  if (!needle) return [] as FreightForward[];

  const records = await fetchAllFreightForwardRecords();
  return records
    .filter(
      (item) =>
        isImportWorklistJob(item) &&
        (item.vesselName ?? "").trim().toLowerCase() === needle
    )
    .sort((a, b) => (a.jobNumber ?? "").localeCompare(b.jobNumber ?? ""));
}

export async function updateImportEtaByVesselName(
  vesselName: string,
  eta: string,
  updatedBy: string
) {
  const matches = await findImportJobsByVesselName(vesselName);
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

  const records = await fetchAllFreightForwardRecords();
  return records
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

export async function getTrashedImportLinerRecords(): Promise<FreightForward[]> {
  const trashed = await getTrashedFreightForwards();
  return trashed.filter((item) => item.useForImport);
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

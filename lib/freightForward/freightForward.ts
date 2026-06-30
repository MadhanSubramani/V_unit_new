import { db } from "../firebase";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  QueryConstraint,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { FreightForward, FreightForwardFormData, FreightForwardStatus } from "@/types/freightForward";
import { generateJobNumber } from "./generateJobNumber";
import { computePipelineFlags } from "./pipelineFlags";
import { normalizeEtaSort } from "./etaSort";
import {
  getFreightForwardCardCountsFromServer,
  getFreightForwardPaginated,
} from "./paginatedList";
import { usesBalanceCardFilter } from "./statusBalance";
import { sortFreightRecords } from "./sortRecords";

const REF = () => collection(db, "freightForward");

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

export { usesBalanceCardFilter };
export {
  getFreightForwardPaginated,
  type FreightListPage,
  type FreightListRequest,
} from "./paginatedList";

// ── Card counts (server-side count queries) ────────────────────────────────
export async function getFreightForwardCardCounts() {
  return getFreightForwardCardCountsFromServer();
}

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
  const jobNumber = data.jobNumber?.trim() || (await generateJobNumber());
  const timeline = [
    {
      status: "in_process",
      updatedBy: createdBy,
      updatedAt: Timestamp.now(),
    },
  ];
  const flags = computePipelineFlags(timeline);

  return addDoc(REF(), {
    ...stripUndefined({
      ...data,
      jobNumber,
      etaSort: normalizeEtaSort(data.eta),
      ...flags,
      status: data.status ?? "in_process",
      statusTimeline: timeline,
      createdBy,
      updatedBy: createdBy,
    } as Record<string, unknown>),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateFreightForward(
  id: string,
  data: Partial<FreightForwardFormData>,
  updatedBy: string
) {
  const patch: Record<string, unknown> = {
    ...data,
    updatedBy,
    updatedAt: serverTimestamp(),
  };

  if (data.eta !== undefined) {
    patch.etaSort = normalizeEtaSort(data.eta);
  }

  await updateDoc(doc(db, "freightForward", id), stripUndefined(patch));
}

export async function updateWorkflowStatus(
  id: string,
  nextStatus: FreightForwardStatus,
  updatedBy: string
) {
  const snap = await getDoc(doc(db, "freightForward", id));
  if (!snap.exists()) return;

  const existing = snap.data();
  const newEntry = {
    status: nextStatus,
    updatedBy,
    updatedAt: Timestamp.now(),
  };
  const timeline = [...(existing.statusTimeline ?? []), newEntry];
  const flags = computePipelineFlags(timeline);

  await updateDoc(doc(db, "freightForward", id), {
    status: nextStatus,
    updatedBy,
    updatedAt: serverTimestamp(),
    ...flags,
    statusTimeline: arrayUnion(newEntry),
  });
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
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<FreightForward, "id">),
  }));
}

export async function deleteFreightForward(id: string) {
  await deleteDoc(doc(db, "freightForward", id));
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

import { db } from "../firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  QueryConstraint,
  serverTimestamp,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  DocumentSnapshot,
  arrayUnion,
  getDoc
} from "firebase/firestore";
import { FreightForward, FreightForwardFormData, FreightForwardStatus } from "@/types/freightForward";
import { generateJobNumber } from "./generateJobNumber";
import {
  BalanceCardFilter,
  computeBalanceCounts,
  isStatusPending,
  matchesBalanceCard,
  usesBalanceCardFilter,
} from "./statusBalance";

const REF = () => collection(db, "freightForward");

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

async function fetchAllFreightForward(etaFrom?: string, etaTo?: string) {
  const ref = REF();
  const constraints: QueryConstraint[] = [];
  if (etaFrom) constraints.push(where("eta", ">=", etaFrom));
  if (etaTo) constraints.push(where("eta", "<=", etaTo));
  const snap = await getDocs(query(ref, ...constraints, orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<FreightForward, "id">),
  }));
}

// ── Card counts ────────────────────────────────────────────────────────────
// Counts reflect records that have not yet been updated to each workflow status.
export async function getFreightForwardCardCounts() {
  const records = await fetchAllFreightForward();
  return computeBalanceCounts(records);
}

export async function getFreightForwardFilteredList({
  activeCard,
  etaFrom,
  etaTo,
}: {
  activeCard?: BalanceCardFilter | null;
  etaFrom?: string;
  etaTo?: string;
}) {
  const records = await fetchAllFreightForward(etaFrom, etaTo);
  if (!activeCard) return records;
  return records.filter((item) => matchesBalanceCard(item, activeCard));
}

export { usesBalanceCardFilter };

// ── Server-side filtered + paginated list ──────────────────────────────────
export interface FreightForwardQueryOptions {
  /** Card filter — maps to a status constraint (or pipeline balance) */
  activeCard?:
    | "inProcess"
    | "next7Days"
    | "momentum"
    | "split_manifest"
    | "billing"
    | "receivable"
    | "payable"
    | "completed"
    | null;
  /** ETA date range from the date filter */
  etaFrom?: string;
  etaTo?: string;
  /** Page size */
  pageSize?: number;
  /** Cursor doc from the previous page (for keyset pagination) */
  cursor?: DocumentSnapshot | null;
}

export interface FreightForwardPage {
  items: FreightForward[];
  /** Pass back to the next call as `cursor` to get the next page */
  lastDoc: DocumentSnapshot | null;
  /** Total count matching the current filter constraints (excluding text search) */
  total: number;
}

export async function getFreightForwardPage({
  activeCard,
  etaFrom,
  etaTo,
  pageSize = 10,
  cursor = null,
}: FreightForwardQueryOptions): Promise<FreightForwardPage> {
  const ref = REF();
  const constraints: QueryConstraint[] = [];

  // ── Card filter → server constraints ──────────────────────────────────
  if (activeCard === "inProcess") {
    constraints.push(where("status", "==", "in_process"));
  } else if (activeCard === "completed") {
    constraints.push(where("status", "==", "completed"));
  } else if (activeCard === "next7Days") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next7 = new Date(today);
    next7.setDate(today.getDate() + 7);
    constraints.push(where("status", "!=", "completed"));
    constraints.push(where("eta", ">=", today.toISOString().slice(0, 10)));
    constraints.push(where("eta", "<=", next7.toISOString().slice(0, 10)));
  }

  // ── ETA date range (from the date picker) ────────────────────────────
  if (etaFrom) constraints.push(where("eta", ">=", etaFrom));
  if (etaTo) constraints.push(where("eta", "<=", etaTo));

  // ── Total count for this filter set (no limit/cursor) ─────────────────
  const countSnap = await getCountFromServer(query(ref, ...constraints));
  const total = countSnap.data().count;

  // ── Ordered + paginated fetch ─────────────────────────────────────────
  // Note: if you filter on `eta` (next7Days or date range) Firestore requires
  // an index on (status, eta). For the other cards we order by createdAt.
  const needsEtaOrder =
    activeCard === "next7Days" || (!activeCard && (etaFrom || etaTo));

  const orderConstraint = needsEtaOrder
    ? orderBy("eta", "asc")
    : orderBy("createdAt", "desc");

  const paginationConstraints: QueryConstraint[] = [
    orderConstraint,
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize),
  ];

  const snap = await getDocs(query(ref, ...constraints, ...paginationConstraints));

  const items = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<FreightForward, "id">),
  }));

  return {
    items,
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
    total,
  };
}

// ── Client-side text search (falls back to full fetch) ─────────────────────
// Firestore has no native full-text search. When a search term is active we
// fetch all docs matching the current card/date constraints and filter in JS.
export async function getFreightForwardSearch({
  activeCard,
  etaFrom,
  etaTo,
  searchField,
  searchValue,
}: {
  activeCard?: FreightForwardQueryOptions["activeCard"];
  etaFrom?: string;
  etaTo?: string;
  searchField: string;
  searchValue: string;
}): Promise<FreightForward[]> {
  const ref = REF();
  const constraints: QueryConstraint[] = [];

  if (activeCard === "inProcess") constraints.push(where("status", "==", "in_process"));
  else if (activeCard === "next7Days") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next7 = new Date(today);
    next7.setDate(today.getDate() + 7);
    constraints.push(where("status", "!=", "completed"));
    constraints.push(where("eta", ">=", today.toISOString().slice(0, 10)));
    constraints.push(where("eta", "<=", next7.toISOString().slice(0, 10)));
  }

  if (etaFrom) constraints.push(where("eta", ">=", etaFrom));
  if (etaTo) constraints.push(where("eta", "<=", etaTo));

  const snap = await getDocs(query(ref, ...constraints));
  const all = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<FreightForward, "id">),
  }));

  const q = searchValue.trim().toLowerCase();
  const cardFiltered =
    activeCard && usesBalanceCardFilter(activeCard)
      ? all.filter((item) => matchesBalanceCard(item, activeCard))
      : all;

  return cardFiltered.filter((item) => {
    if (!q) return true;
    const val = (item as unknown as Record<string, unknown>)[searchField];
    return typeof val === "string" && val.toLowerCase().includes(q);
  });
}

export async function getFreightForwardPendingStatus(status: FreightForwardStatus) {
  const records = await fetchAllFreightForward();
  return records.filter((item) => isStatusPending(item, status));
}

export async function getFreightForwardByStatus(status: string) {
  return getFreightForwardPendingStatus(status as FreightForwardStatus);
}

// ── CRUD ───────────────────────────────────────────────────────────────────
export async function createFreightForward(
  data: FreightForwardFormData,
  createdBy: string
) {
  const jobNumber = data.jobNumber?.trim() || (await generateJobNumber());
  return addDoc(REF(), {
    ...stripUndefined({
      ...data,
      jobNumber,
      status: data.status ?? "in_process",
      statusTimeline: [
        {
          status: "in_process",
          updatedBy: createdBy,
          updatedAt: Timestamp.now(),
        },
      ],
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
  await updateDoc(doc(db, "freightForward", id), {
    ...stripUndefined(data as Record<string, unknown>),
    updatedBy,
    updatedAt: serverTimestamp(),
  });
}

export async function updateWorkflowStatus(
  id: string,
  nextStatus: FreightForwardStatus,
  updatedBy: string
) {
  await updateDoc(doc(db, "freightForward", id), {
    status: nextStatus,
    updatedBy,
    updatedAt: serverTimestamp(),
    statusTimeline: arrayUnion({
      status: nextStatus,
      updatedBy,
      updatedAt: new Date(),
    }),
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
  if (etaFrom) constraints.push(where("eta", ">=", etaFrom));
  if (etaTo) constraints.push(where("eta", "<=", etaTo));
  const snap = await getDocs(query(ref, ...constraints));
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<FreightForward, "id">),
  }));
}

export async function deleteFreightForward(id: string) {
  await deleteDoc(doc(db, "freightForward", id));
}
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
} from "firebase/firestore";
import { FreightForward, FreightForwardFormData } from "@/types/freightForward";

const REF = () => collection(db, "freightForward");

// ── Card counts ────────────────────────────────────────────────────────────
// Uses getCountFromServer so no documents are transferred — just integer counts.
export async function getFreightForwardCardCounts() {
  const ref = REF();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next7 = new Date(today);
  next7.setDate(today.getDate() + 7);

  const [inProcess, momentum, splitManifest, completed, next7Days] = await Promise.all([
    // inProcess = everything that is NOT completed
    getCountFromServer(query(ref, where("status", "==", "in_process"))),
    getCountFromServer(query(ref, where("status", "==", "momentum"))),
    getCountFromServer(query(ref, where("status", "==", "split_manifest"))),
    getCountFromServer(query(ref, where("status", "==", "completed"))),
    // next7Days = not completed AND eta within today..today+7
    getCountFromServer(
      query(
        ref,
        where("status", "!=", "completed"),
        where("eta", ">=", today.toISOString().slice(0, 10)),
        where("eta", "<=", next7.toISOString().slice(0, 10)),
        orderBy("status"),
        orderBy("eta")
      )
    ),
  ]);

  return {
    inProcess: inProcess.data().count,
    momentum: momentum.data().count,
    split_manifest: splitManifest.data().count,
    completed: completed.data().count,
    next7Days: next7Days.data().count,
  };
}

// ── Server-side filtered + paginated list ──────────────────────────────────
export interface FreightForwardQueryOptions {
  /** Card filter — maps to a status constraint (or next7Days date range) */
  activeCard?: "inProcess" | "next7Days" | "momentum" | "split_manifest" | "completed" | null;
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
  } else if (activeCard === "momentum") {
    constraints.push(where("status", "==", "momentum"));
  } else if (activeCard === "split_manifest") {
    constraints.push(where("status", "==", "split_manifest"));
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
  else if (activeCard === "completed") constraints.push(where("status", "==", "completed"));
  else if (activeCard === "momentum") constraints.push(where("status", "==", "momentum"));
  else if (activeCard === "split_manifest") constraints.push(where("status", "==", "split_manifest"));
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
  return all.filter((item) => {
    const val = (item as unknown as Record<string, unknown>)[searchField];
    return typeof val === "string" && val.toLowerCase().includes(q);
  });
}

export async function getFreightForwardByStatus(status: string) {
  const q = query(
    collection(db, "freightForward"),
    where("status", "==", status)
  );

  const snap = await getDocs(q);

  return snap.docs.map(d => ({
    id: d.id,
    ...(d.data() as Omit<FreightForward, "id">),
  }));
}

// ── CRUD ───────────────────────────────────────────────────────────────────
export async function createFreightForward(
  data: FreightForwardFormData,
  createdBy: string
) {
  return addDoc(REF(), {
    ...data,
    status: data.status ?? "in_process",
    createdBy,
    updatedBy: createdBy,
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
    ...data,
    updatedBy,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFreightForward(id: string) {
  await deleteDoc(doc(db, "freightForward", id));
}
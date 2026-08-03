import {
  collection,
  DocumentData,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  QueryConstraint,
  QueryDocumentSnapshot,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FreightForward } from "@/types/freightForward";
import { buildFreightSearchIndex } from "@/lib/freightForward/searchIndex";

const REF = () => collection(db, "freightForward");

/** Chunk size for full-collection / filtered scans. Keeps each read bounded. */
export const FREIGHT_CHUNK_SIZE = 500;

function docToRecord(
  docSnap: QueryDocumentSnapshot<DocumentData>
): FreightForward {
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

async function fetchChunksWithConstraints(
  constraints: QueryConstraint[],
  chunkSize: number
): Promise<FreightForward[]> {
  const records: FreightForward[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;

  for (;;) {
    const pageConstraints: QueryConstraint[] = [
      ...constraints,
      ...(cursor ? [startAfter(cursor)] : []),
      limit(chunkSize),
    ];
    const snap = await getDocs(query(REF(), ...pageConstraints));
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      records.push(docToRecord(docSnap));
    }

    if (snap.docs.length < chunkSize) break;
    cursor = snap.docs[snap.docs.length - 1] ?? null;
    if (!cursor) break;
  }

  return records;
}

/**
 * Reads a freightForward query in chunks until exhausted.
 * Replaces silent `limit(5000)` ceilings without changing caller UX.
 */
export async function fetchFreightForwardChunks(
  extraConstraints: QueryConstraint[] = [],
  options?: { chunkSize?: number }
): Promise<FreightForward[]> {
  const chunkSize = options?.chunkSize ?? FREIGHT_CHUNK_SIZE;
  const ordered = [...extraConstraints, orderBy(documentId())];
  return fetchChunksWithConstraints(ordered, chunkSize);
}

/** Active (non-deleted) import-flagged jobs, chunked + short TTL cache. */
let importLinerCache: {
  records: FreightForward[];
  expires: number;
} | null = null;
let importLinerFetchPromise: Promise<FreightForward[]> | null = null;
const IMPORT_CACHE_TTL_MS = 120_000;

export function invalidateImportLinerCache() {
  importLinerCache = null;
  importLinerFetchPromise = null;
}

export async function fetchAllImportLinerRecords(): Promise<FreightForward[]> {
  const now = Date.now();
  if (importLinerCache && importLinerCache.expires > now) {
    return importLinerCache.records;
  }
  if (importLinerFetchPromise) return importLinerFetchPromise;

  importLinerFetchPromise = (async () => {
    try {
      let records: FreightForward[];
      try {
        records = (
          await fetchFreightForwardChunks([where("useForImport", "==", true)])
        ).filter((item) => !item.isDeleted);
      } catch (error) {
        if (!isFirestoreIndexError(error)) throw error;
        console.warn(
          "Import liner chunked fetch falling back to full scan (index missing).",
          error
        );
        const all = await fetchAllFreightForwardRecords();
        records = all.filter((item) => item.useForImport && !item.isDeleted);
      }
      importLinerCache = {
        records: records.map((item) =>
          item.searchText ? item : { ...item, ...buildFreightSearchIndex(item) }
        ),
        expires: Date.now() + IMPORT_CACHE_TTL_MS,
      };
      return importLinerCache.records;
    } finally {
      importLinerFetchPromise = null;
    }
  })();

  return importLinerFetchPromise;
}

/** All freightForward docs in chunks (used by client list/search fallback). */
export async function fetchAllFreightForwardRecords(): Promise<FreightForward[]> {
  return fetchFreightForwardChunks([]);
}

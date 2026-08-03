import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const FREIGHT_JOB_NUMBER_PREFIX = "FF0";
export const FREIGHT_COUNTER_DOC = "freightForward";

export const IMPORT_JOB_NUMBER_PREFIX = "IMP";
export const IMPORT_COUNTER_DOC = "importLiner";

function parseJobSeq(jobNumber?: string, prefix = FREIGHT_JOB_NUMBER_PREFIX): number {
  if (!jobNumber?.startsWith(prefix)) return 0;
  const seq = parseInt(jobNumber.slice(prefix.length), 10);
  return Number.isNaN(seq) ? 0 : seq;
}

let freightSeedPromise: Promise<void> | null = null;
let importSeedPromise: Promise<void> | null = null;

/** One-time seed from existing records when the counter doc is missing. */
export async function ensureFreightForwardCounterSeeded() {
  const counterRef = doc(db, "counters", FREIGHT_COUNTER_DOC);
  const existing = await getDoc(counterRef);
  if (existing.exists()) return;

  if (!freightSeedPromise) {
    freightSeedPromise = (async () => {
      const snapshot = await getDocs(collection(db, "freightForward"));
      let maxSeq = 0;
      for (const docSnap of snapshot.docs) {
        maxSeq = Math.max(
          maxSeq,
          parseJobSeq(docSnap.data().jobNumber as string | undefined)
        );
      }
      await setDoc(counterRef, { lastSeq: maxSeq }, { merge: true });
    })().finally(() => {
      freightSeedPromise = null;
    });
  }

  await freightSeedPromise;
}

/** Seed Import job counter from existing IMP* jobNumbers on freightForward. */
export async function ensureImportLinerCounterSeeded() {
  const counterRef = doc(db, "counters", IMPORT_COUNTER_DOC);
  const existing = await getDoc(counterRef);
  if (existing.exists()) return;

  if (!importSeedPromise) {
    importSeedPromise = (async () => {
      const snapshot = await getDocs(collection(db, "freightForward"));
      let maxSeq = 0;
      for (const docSnap of snapshot.docs) {
        maxSeq = Math.max(
          maxSeq,
          parseJobSeq(
            docSnap.data().jobNumber as string | undefined,
            IMPORT_JOB_NUMBER_PREFIX
          )
        );
      }
      await setDoc(counterRef, { lastSeq: maxSeq }, { merge: true });
    })().finally(() => {
      importSeedPromise = null;
    });
  }

  await importSeedPromise;
}

export function formatFreightJobNumber(seq: number): string {
  return `${FREIGHT_JOB_NUMBER_PREFIX}${seq}`;
}

export function formatImportJobNumber(seq: number): string {
  return `${IMPORT_JOB_NUMBER_PREFIX}${String(seq).padStart(3, "0")}`;
}

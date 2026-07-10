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

function parseJobSeq(jobNumber?: string): number {
  if (!jobNumber?.startsWith(FREIGHT_JOB_NUMBER_PREFIX)) return 0;
  const seq = parseInt(jobNumber.slice(FREIGHT_JOB_NUMBER_PREFIX.length), 10);
  return Number.isNaN(seq) ? 0 : seq;
}

let seedPromise: Promise<void> | null = null;

/** One-time seed from existing records when the counter doc is missing. */
export async function ensureFreightForwardCounterSeeded() {
  const counterRef = doc(db, "counters", FREIGHT_COUNTER_DOC);
  const existing = await getDoc(counterRef);
  if (existing.exists()) return;

  if (!seedPromise) {
    seedPromise = (async () => {
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
      seedPromise = null;
    });
  }

  await seedPromise;
}

export function formatFreightJobNumber(seq: number): string {
  return `${FREIGHT_JOB_NUMBER_PREFIX}${seq}`;
}

import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const JOB_NUMBER_PREFIX = "FF0";
const COUNTER_DOC = "freightForward";

function parseJobSeq(jobNumber?: string): number {
  if (!jobNumber?.startsWith(JOB_NUMBER_PREFIX)) return 0;
  const seq = parseInt(jobNumber.slice(JOB_NUMBER_PREFIX.length), 10);
  return Number.isNaN(seq) ? 0 : seq;
}

let seedPromise: Promise<void> | null = null;

async function seedCounterIfMissing() {
  const counterRef = doc(db, "counters", COUNTER_DOC);
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

export async function generateJobNumber(): Promise<string> {
  await seedCounterIfMissing();

  const counterRef = doc(db, "counters", COUNTER_DOC);
  const seq = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const lastSeq = snap.exists() ? (snap.data().lastSeq as number) : 0;
    const next = lastSeq + 1;
    transaction.set(counterRef, { lastSeq: next }, { merge: true });
    return next;
  });

  return `${JOB_NUMBER_PREFIX}${seq}`;
}

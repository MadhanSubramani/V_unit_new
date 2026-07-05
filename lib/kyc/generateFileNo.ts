import { doc, getDoc, runTransaction, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getKyc } from "@/lib/kyc/getKyc";

const COUNTER_DOC = "kyc";

let seedPromise: Promise<void> | null = null;

async function seedKycCounterIfMissing() {
  const counterRef = doc(db, "counters", COUNTER_DOC);
  const existing = await getDoc(counterRef);
  if (existing.exists()) return;

  if (!seedPromise) {
    seedPromise = (async () => {
      const records = await getKyc();
      await setDoc(counterRef, { lastSeq: records.length }, { merge: true });
    })().finally(() => {
      seedPromise = null;
    });
  }

  await seedPromise;
}

export async function generateFileNo(): Promise<string> {
  await seedKycCounterIfMissing();

  const counterRef = doc(db, "counters", COUNTER_DOC);
  const seq = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const lastSeq = snap.exists() ? (snap.data().lastSeq as number) : 0;
    const next = lastSeq + 1;
    transaction.set(counterRef, { lastSeq: next }, { merge: true });
    return next;
  });

  return `KYC-${String(seq).padStart(5, "0")}`;
}

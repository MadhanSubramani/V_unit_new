/**
 * One-off: seed stats/freightForwardCounts from all active Freight Forward jobs.
 *
 * Usage (from project root, with .env.local present):
 *   npm run seed:ff-counts
 */

import "./loadEnvLocal";

import { initializeApp } from "firebase/app";
import {
  collection,
  doc,
  documentId,
  getDocsFromServer,
  initializeFirestore,
  limit,
  memoryLocalCache,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  type DocumentSnapshot,
  type QuerySnapshot,
  type DocumentData,
} from "firebase/firestore";
import { balanceCountsToStatsDoc } from "../lib/freightForward/balanceCountsMapping";
import { computeBalanceCounts } from "../lib/freightForward/statusBalance";
import { IMPORT_JOB_NUMBER_PREFIX } from "../lib/freightForward/generateJobNumber";
import type { FreightForward } from "../types/freightForward";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value?.trim())
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(
    `Missing Firebase config (${missing.join(", ")}). Check .env.local in the project root.`
  );
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { localCache: memoryLocalCache() });

async function fetchAllFreightForwardRecords(): Promise<FreightForward[]> {
  const ref = collection(db, "freightForward");
  const records: FreightForward[] = [];
  let cursor: DocumentSnapshot | null = null;

  while (true) {
    let snap: QuerySnapshot<DocumentData>;
    if (cursor) {
      snap = await getDocsFromServer(
        query(ref, orderBy(documentId()), startAfter(cursor), limit(500))
      );
    } else {
      snap = await getDocsFromServer(query(ref, orderBy(documentId()), limit(500)));
    }

    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      records.push({
        id: docSnap.id,
        ...(docSnap.data() as Omit<FreightForward, "id">),
      });
    }

    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < 500) break;
  }

  return records.filter(
    (item) =>
      !item.isDeleted &&
      !(item.jobNumber ?? "").startsWith(IMPORT_JOB_NUMBER_PREFIX)
  );
}

async function main() {
  console.log(`Loading Freight Forward records (project: ${firebaseConfig.projectId})...`);
  const records = await fetchAllFreightForwardRecords();
  console.log(`Active records: ${records.length}`);

  const counts = computeBalanceCounts(records);
  const payload = balanceCountsToStatsDoc(counts);

  const statsRef = doc(db, "stats", "freightForwardCounts");
  await setDoc(statsRef, {
    ...payload,
    updatedAt: serverTimestamp(),
  });

  console.log("Seeded stats/freightForwardCounts:");
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});

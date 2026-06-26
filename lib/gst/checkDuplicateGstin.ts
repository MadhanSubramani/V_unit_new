import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export async function checkDuplicateGstin(
  gstin: string
) {
  const q = query(
    collection(db, "kyc"),
    where("gstin", "==", gstin)
  );

  const snapshot = await getDocs(q);

  return !snapshot.empty;
}
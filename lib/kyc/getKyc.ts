import {
  collection,
  getDocs,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { Kyc } from "@/types/kyc";

export async function getKyc(): Promise<Kyc[]> {
  const snapshot = await getDocs(collection(db, "kyc"));

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Kyc, "id">),
  }));
}
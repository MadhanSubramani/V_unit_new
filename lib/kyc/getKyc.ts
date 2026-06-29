import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Kyc } from "@/types/kyc";
import { normalizeKyc } from "@/lib/kyc/normalizeKyc";

export async function getKyc(): Promise<Kyc[]> {
  const snapshot = await getDocs(collection(db, "kyc"));
  return snapshot.docs.map((doc) =>
    normalizeKyc({ id: doc.id, ...doc.data() })
  );
}

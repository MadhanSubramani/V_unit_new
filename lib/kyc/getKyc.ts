import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Kyc } from "@/types/kyc";
import { normalizeKyc } from "@/lib/kyc/normalizeKyc";
import { cacheKeys, lookupCache } from "@/lib/cache/memoryCache";

async function fetchKycFromFirestore(): Promise<Kyc[]> {
  const snapshot = await getDocs(collection(db, "kyc"));
  return snapshot.docs.map((docSnap) =>
    normalizeKyc({ id: docSnap.id, ...docSnap.data() })
  );
}

export async function getKyc(): Promise<Kyc[]> {
  return lookupCache.get(cacheKeys.kyc, fetchKycFromFirestore) as Promise<Kyc[]>;
}

export function invalidateKycCache() {
  lookupCache.invalidate(cacheKeys.kyc);
}

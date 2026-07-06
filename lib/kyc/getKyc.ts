import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Kyc } from "@/types/kyc";
import { normalizeKyc } from "@/lib/kyc/normalizeKyc";
import { sortKycByFileNoAsc } from "@/lib/kyc/sortKycByFileNo";
import { cacheKeys, lookupCache } from "@/lib/cache/memoryCache";

async function fetchKycFromFirestore(): Promise<Kyc[]> {
  const snapshot = await getDocs(collection(db, "kyc"));
  const records = snapshot.docs.map((docSnap) =>
    normalizeKyc({ id: docSnap.id, ...docSnap.data() })
  );
  return sortKycByFileNoAsc(records);
}

export async function getKyc(): Promise<Kyc[]> {
  return lookupCache.get(cacheKeys.kyc, fetchKycFromFirestore) as Promise<Kyc[]>;
}

export function invalidateKycCache() {
  lookupCache.invalidate(cacheKeys.kyc);
}

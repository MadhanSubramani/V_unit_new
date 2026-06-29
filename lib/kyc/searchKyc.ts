import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Kyc } from "@/types/kyc";
import { normalizeKyc } from "@/lib/kyc/normalizeKyc";

export async function searchKyc(searchTerm: string): Promise<Kyc[]> {
  const snapshot = await getDocs(collection(db, "kyc"));
  const term = searchTerm.trim().toLowerCase();

  return snapshot.docs
    .map((doc) => normalizeKyc({ id: doc.id, ...doc.data() }))
    .filter(
      (item) =>
        item.companyName.toLowerCase().includes(term) ||
        item.gstin.toLowerCase().includes(term) ||
        (item.fileNo ?? "").toLowerCase().includes(term) ||
        (item.loiNo ?? "").toLowerCase().includes(term)
    );
}

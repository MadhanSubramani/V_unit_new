import { collection, getDocs } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { Kyc } from "@/types/kyc";

export async function searchKyc(
  searchTerm: string
): Promise<Kyc[]> {
  const snapshot = await getDocs(collection(db, "kyc"));

  const term = searchTerm.trim().toLowerCase();

  const results: Kyc[] = snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Kyc, "id">),
    }))
    .filter((item) => {
      return (
        item.companyName.toLowerCase().includes(term) ||
        item.gstin.toLowerCase().includes(term)
      );
    });

  return results;
}
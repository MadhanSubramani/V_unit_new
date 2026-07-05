import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Kyc } from "@/types/kyc";
import { getKyc } from "@/lib/kyc/getKyc";

export async function searchKyc(searchTerm: string): Promise<Kyc[]> {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return getKyc();

  const all = await getKyc();
  return all.filter(
    (item) =>
      item.companyName.toLowerCase().includes(term) ||
      item.gstin.toLowerCase().includes(term) ||
      (item.fileNo ?? "").toLowerCase().includes(term) ||
      (item.loiNo ?? "").toLowerCase().includes(term)
  );
}

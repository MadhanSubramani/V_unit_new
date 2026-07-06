import { getKyc } from "@/lib/kyc/getKyc";
import { sortKycByFileNoAsc } from "@/lib/kyc/sortKycByFileNo";
import { Kyc } from "@/types/kyc";

export async function searchKyc(searchTerm: string): Promise<Kyc[]> {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return getKyc();

  const all = await getKyc();
  return sortKycByFileNoAsc(
    all.filter(
      (item) =>
        item.companyName.toLowerCase().includes(term) ||
        item.gstin.toLowerCase().includes(term) ||
        (item.fileNo ?? "").toLowerCase().includes(term) ||
        (item.loiNo ?? "").toLowerCase().includes(term)
    )
  );
}

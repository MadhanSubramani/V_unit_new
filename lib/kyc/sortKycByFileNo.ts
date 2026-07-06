import { Kyc } from "@/types/kyc";

/** Ascending order: KYC-00001, KYC-00002, … */
export function sortKycByFileNoAsc(records: Kyc[]): Kyc[] {
  return [...records].sort((a, b) => {
    const fileA = a.fileNo?.trim() ?? "";
    const fileB = b.fileNo?.trim() ?? "";
    if (!fileA && !fileB) return 0;
    if (!fileA) return 1;
    if (!fileB) return -1;
    return fileA.localeCompare(fileB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

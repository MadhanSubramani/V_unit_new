/** Normalized ETA for Firestore orderBy (missing ETA sorts last). */
export function normalizeEtaSort(eta?: string | null): string {
  const trimmed = eta?.trim().slice(0, 10);
  return trimmed || "9999-12-31";
}

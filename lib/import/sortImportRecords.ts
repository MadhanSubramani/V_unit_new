import { FreightForward } from "@/types/freightForward";
import {
  FreightSortDir,
  sortFreightRecords,
} from "@/lib/freightForward/sortRecords";

export type ImportSortKey = "jobNumber" | "eta";
export type ImportSortDir = FreightSortDir;

export function sortImportRecords(
  records: FreightForward[],
  sortKey: ImportSortKey,
  sortDir: ImportSortDir
) {
  return sortFreightRecords(records, sortKey, sortDir);
}

export function toggleImportSort(
  currentKey: ImportSortKey,
  currentDir: ImportSortDir,
  nextKey: ImportSortKey
): { sortKey: ImportSortKey; sortDir: ImportSortDir } {
  if (currentKey !== nextKey) {
    return { sortKey: nextKey, sortDir: "asc" };
  }
  return {
    sortKey: nextKey,
    sortDir: currentDir === "asc" ? "desc" : "asc",
  };
}

import { FreightForward } from "@/types/freightForward";

export type FreightSortKey = "createdAt" | "eta";
export type FreightSortDir = "asc" | "desc";

export const FREIGHT_SORT_DROPDOWN_OPTIONS: {
  value: `${FreightSortKey}:${FreightSortDir}`;
  label: string;
}[] = [
  { value: "eta:asc", label: "ETA (Earliest first)" },
  { value: "eta:desc", label: "ETA (Latest first)" },
  { value: "createdAt:desc", label: "Created (Newest first)" },
  { value: "createdAt:asc", label: "Created (Oldest first)" },
];

function getCreatedTime(value: unknown): number {
  if (!value) return 0;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(String(value)).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function sortFreightRecords(
  records: FreightForward[],
  sortKey: FreightSortKey = "eta",
  sortDir: FreightSortDir = "asc"
): FreightForward[] {
  return [...records].sort((a, b) => {
    let compare = 0;

    if (sortKey === "createdAt") {
      compare = getCreatedTime(a.createdAt) - getCreatedTime(b.createdAt);
    } else {
      const etaA = a.eta?.trim() || "9999-12-31";
      const etaB = b.eta?.trim() || "9999-12-31";
      compare = etaA.localeCompare(etaB);
    }

    if (compare === 0) {
      compare = getCreatedTime(b.createdAt) - getCreatedTime(a.createdAt);
    }

    return sortDir === "asc" ? compare : -compare;
  });
}

export function parseFreightSortValue(value: string): {
  sortKey: FreightSortKey;
  sortDir: FreightSortDir;
} {
  const [key, dir] = value.split(":");
  if (key === "createdAt" && (dir === "asc" || dir === "desc")) {
    return { sortKey: "createdAt", sortDir: dir };
  }
  return { sortKey: "eta", sortDir: dir === "desc" ? "desc" : "asc" };
}

import { FreightForward } from "@/types/freightForward";
import { normalizeEtaSort } from "@/lib/freightForward/etaSort";

export type FreightSortKey = "jobNumber" | "ezRefNumber" | "eta" | "createdAt";
export type FreightSortDir = "asc" | "desc";

/** FF/EZ style IDs need client numeric sort; Firestore string order is wrong (FF010 before FF02). */
export function requiresClientNaturalSort(sortKey: FreightSortKey): boolean {
  return sortKey === "jobNumber" || sortKey === "ezRefNumber";
}

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

/** Pull the last number in a code: FF01 → 1, FF010 → 10, VO2 → 2, VO10 → 10. */
function extractTrailingNumber(value?: string | null): number | null {
  const match = value?.trim().match(/(\d+)\s*$/);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isNaN(num) ? null : num;
}

function compareCodedNumber(a?: string | null, b?: string | null): number {
  const numA = extractTrailingNumber(a);
  const numB = extractTrailingNumber(b);

  if (numA !== null && numB !== null && numA !== numB) {
    return numA - numB;
  }
  if (numA !== null && numB === null) return -1;
  if (numA === null && numB !== null) return 1;

  return (a?.trim() || "").localeCompare(b?.trim() || "", undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function compareEtaDate(a?: string | null, b?: string | null): number {
  const etaA = normalizeEtaSort(a);
  const etaB = normalizeEtaSort(b);
  return etaA.localeCompare(etaB);
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
    } else if (sortKey === "jobNumber") {
      compare = compareCodedNumber(a.jobNumber, b.jobNumber);
    } else if (sortKey === "ezRefNumber") {
      compare = compareCodedNumber(a.ezRefNumber, b.ezRefNumber);
    } else {
      compare = compareEtaDate(a.eta, b.eta);
    }

    if (compare === 0) {
      compare = getCreatedTime(b.createdAt) - getCreatedTime(a.createdAt);
    }

    return sortDir === "asc" ? compare : -compare;
  });
}

import { FreightForward } from "@/types/freightForward";
import { fetchAllFreightForwardRecords } from "@/lib/freightForward/chunkedFetch";

function norm(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function collectHblNumbers(item: {
  hbl?: string;
  hblEntries?: { number?: string }[];
}) {
  const fromEntries = (item.hblEntries ?? [])
    .map((entry) => norm(entry.number))
    .filter(Boolean);
  const fromString = (item.hbl ?? "")
    .split(",")
    .map((value) => norm(value))
    .filter(Boolean);
  return Array.from(new Set([...fromEntries, ...fromString]));
}

export async function findDuplicateBlConflict(input: {
  mbl?: string;
  hbl?: string;
  hblEntries?: { number?: string }[];
  excludeId?: string;
}): Promise<string | null> {
  const mbl = norm(input.mbl);
  const hbls = new Set(collectHblNumbers(input));
  if (!mbl && !hbls.size) return null;

  const records = await fetchAllFreightForwardRecords();
  for (const row of records as FreightForward[]) {
    if (row.isDeleted) continue;
    if (input.excludeId && row.id === input.excludeId) continue;
    if (mbl && norm(row.mbl) === mbl) {
      return `MBL already exists in job ${row.jobNumber || "—"}.`;
    }
    const existing = collectHblNumbers(row);
    const hit = existing.find((number) => hbls.has(number));
    if (hit) {
      return `HBL already exists in job ${row.jobNumber || "—"}.`;
    }
  }
  return null;
}

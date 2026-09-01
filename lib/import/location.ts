import { FreightForward } from "@/types/freightForward";
import { Cfs } from "@/types/cfs";
import { Sez } from "@/types/sez";

/** Resolve stored CFS/SEZ value to master code (never show name in tables). */
export function resolveImportLocationCode(
  item: FreightForward,
  cfsList: Cfs[] = [],
  sezList: Sez[] = []
) {
  const locationType =
    item.locationType ?? (item.sez && !item.cfs ? "sez" : "cfs");

  if (locationType === "sez") {
    const stored = item.sez?.trim() ?? "";
    if (!stored) return "—";
    const match = sezList.find(
      (entry) => entry.code === stored || entry.name === stored
    );
    if (match) return match.code;
    return stored.split(/\s*[-–|]\s*/)[0]?.trim() || stored;
  }

  const stored = item.cfs?.trim() ?? "";
  if (!stored) return "—";
  const match = cfsList.find(
    (entry) => entry.code === stored || entry.name === stored
  );
  if (match) return match.code;
  return stored.split(/\s*[-–|]\s*/)[0]?.trim() || stored;
}

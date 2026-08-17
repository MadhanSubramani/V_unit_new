import { FreightForward } from "@/types/freightForward";
import { getContainersFromRecord } from "@/lib/freightForward/containers";

/** Searchable fields aligned with the freight-forward table columns. */
export const FREIGHT_SEARCH_FIELDS = [
  { label: "All columns", value: "all" },
  { label: "FF No", value: "jobNumber" },
  { label: "EZ No", value: "ezRefNumber" },
  { label: "BL Type", value: "blType" },
  { label: "Agent", value: "agent" },
  { label: "Trade Terms", value: "tradeTerms" },
  { label: "Vessel Name", value: "vesselName" },
  { label: "ETA", value: "eta" },
  { label: "Location", value: "location" },
  { label: "Consignee", value: "consignmentName" },
  { label: "Client", value: "clientName" },
  { label: "Inward BOE No", value: "inwardBoeNo" },
  { label: "MBL", value: "mbl" },
  { label: "HBL", value: "hbl" },
  { label: "Cont No", value: "containerNumber" },
] as const;

export type FreightSearchField =
  (typeof FREIGHT_SEARCH_FIELDS)[number]["value"];

function getLocationSearchValue(item: FreightForward): string {
  return [item.cfs, item.sez].filter(Boolean).join(" ");
}

function getContainerSearchValue(item: FreightForward): string {
  return getContainersFromRecord(item)
    .map((c) =>
      [c.containerNumber, c.containerSize, c.containerType]
        .filter(Boolean)
        .join(" ")
    )
    .join(" ");
}

function getFieldSearchText(
  item: FreightForward,
  field: FreightSearchField | string
): string {
  switch (field) {
    case "all":
      return [
        item.jobNumber,
        item.ezRefNumber,
        item.blType,
        item.agent,
        item.tradeTerms,
        item.vesselName,
        item.eta,
        getLocationSearchValue(item),
        item.consignmentName,
        item.clientName,
        item.inwardBoeNo,
        item.mbl,
        item.hbl,
        getContainerSearchValue(item),
        item.liner,
        item.pol,
        item.pod,
      ]
        .filter(Boolean)
        .join(" ");
    case "location":
      return getLocationSearchValue(item);
    case "containerNumber":
      return getContainerSearchValue(item);
    default: {
      const val = (item as unknown as Record<string, unknown>)[field];
      return typeof val === "string" ? val : "";
    }
  }
}

export function matchesFreightSearch(
  item: FreightForward,
  searchValue: string,
  searchField?: string
): boolean {
  const q = searchValue.trim().toLowerCase();
  if (!q) return true;

  const field = (searchField?.trim() || "all") as FreightSearchField | string;

  // Prefer precomputed searchText / field indexes when present (faster at scale).
  if (field === "all" && item.searchText) {
    return item.searchText.includes(q);
  }

  const indexed: Record<string, string | undefined> = {
    jobNumber: item.searchJobNumber,
    ezRefNumber: item.searchEzRef,
    mbl: item.searchMbl,
    hbl: item.searchHbl,
    vesselName: item.searchVessel,
    consignmentName: item.searchConsignee,
    clientName: item.searchClient,
    agent: item.searchAgent,
    containerNumber: item.searchContainer,
  };
  if (indexed[field]) {
    return indexed[field]!.includes(q);
  }

  return getFieldSearchText(item, field).toLowerCase().includes(q);
}

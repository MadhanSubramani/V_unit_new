import { FreightContainer, FreightForward } from "@/types/freightForward";
import { getContainersFromRecord } from "@/lib/freightForward/containers";

export type FreightSearchIndex = {
  searchText: string;
  searchJobNumber: string;
  searchMbl: string;
  searchHbl: string;
  searchEzRef: string;
  searchVessel: string;
  searchConsignee: string;
  searchClient: string;
  searchAgent: string;
  searchContainer: string;
};

function norm(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function containerSearchText(
  item: Pick<
    FreightForward,
    "containers" | "containerNumber" | "containerSize" | "containerType"
  >
): string {
  return getContainersFromRecord(item)
    .map((c: FreightContainer) =>
      [c.containerNumber, c.containerSize, c.containerType]
        .filter(Boolean)
        .join(" ")
    )
    .join(" ");
}

/** Normalized search fields written on create/update for faster filtering and prefix queries. */
export function buildFreightSearchIndex(
  item: Partial<FreightForward> & {
    jobNumber?: string;
    mbl?: string;
    hbl?: string;
  }
): FreightSearchIndex {
  const searchJobNumber = norm(item.jobNumber);
  const searchMbl = norm(item.mbl);
  const searchHbl = norm(item.hbl);
  const searchEzRef = norm(item.ezRefNumber);
  const searchVessel = norm(item.vesselName);
  const searchConsignee = norm(item.consignmentName);
  const searchClient = norm(item.clientName);
  const searchAgent = norm(item.agent);
  const searchContainer = norm(containerSearchText(item as FreightForward));

  const searchText = [
    searchJobNumber,
    searchEzRef,
    norm(item.blType),
    searchAgent,
    norm(item.tradeTerms),
    searchVessel,
    norm(item.eta),
    norm(item.cfs),
    norm(item.sez),
    searchConsignee,
    searchClient,
    searchMbl,
    searchHbl,
    searchContainer,
    norm(item.inwardBoeNo),
    norm(item.liner),
    norm(item.pol),
    norm(item.pod),
  ]
    .filter(Boolean)
    .join(" ");

  return {
    searchText,
    searchJobNumber,
    searchMbl,
    searchHbl,
    searchEzRef,
    searchVessel,
    searchConsignee,
    searchClient,
    searchAgent,
    searchContainer,
  };
}

/** Maps UI search field → Firestore indexed lowercase field. */
export const SERVER_SEARCH_FIELD_MAP: Record<string, keyof FreightSearchIndex> = {
  jobNumber: "searchJobNumber",
  ezRefNumber: "searchEzRef",
  mbl: "searchMbl",
  hbl: "searchHbl",
  vesselName: "searchVessel",
  consignmentName: "searchConsignee",
  clientName: "searchClient",
  agent: "searchAgent",
  containerNumber: "searchContainer",
};

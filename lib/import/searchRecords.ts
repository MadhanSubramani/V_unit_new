import { FreightForward } from "@/types/freightForward";
import { formatContainersDisplay } from "@/lib/freightForward/containers";
import { normalizeEtaSort } from "@/lib/freightForward/etaSort";
import {
  getImportDoEmptyDisplay,
  getImportDoPortDisplay,
  getImportDoStatusLabel,
  getInwardBoeNoDisplay,
} from "@/lib/import/linerWorkflow";
import { getTTypeBoeNoDisplay } from "@/lib/import/boeOutWorkflow";
import { getImportCurrentStatus } from "@/lib/import/currentStatus";
import type { ImportModuleKey } from "@/lib/import/permissions";

function push(values: unknown[], target: string[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    target.push(String(value));
  }
}

export function buildImportSearchHaystack(
  item: FreightForward,
  module?: ImportModuleKey
): string {
  const parts: string[] = [];

  push(
    [
      item.jobNumber,
      item.ezRefNumber,
      item.consignmentName,
      item.clientName,
      item.mbl,
      item.hbl,
      item.vesselName,
      item.liner,
      item.agent,
      item.blType,
      item.tradeTerms,
      item.pol,
      item.pod,
      item.containerNumber,
      item.containerSize,
      item.containerType,
      item.inwardBoeNo,
      item.importTTypeBoeNo,
      item.importTransporter,
      item.importVehicleNo,
      item.eta,
      item.etaSort,
      normalizeEtaSort(item.eta),
      item.cfs,
      item.sez,
      item.locationType,
      formatContainersDisplay(item),
      getImportDoStatusLabel(item),
      getImportDoPortDisplay(item),
      getImportDoEmptyDisplay(item),
      getInwardBoeNoDisplay(item),
      getTTypeBoeNoDisplay(item),
      item.importMovementRemark,
      item.importIgmRemark,
      item.importDoRemark,
      item.importMovementStatus,
      item.importIgmStatus,
      item.importDoStatus,
      item.importBoeFilingStatus,
      item.importBoeClearanceStatus,
      item.importBoeOutInwardOccStatus,
      item.importTTypeBoeClearanceStatus,
      item.importBoeOutDutyStatus,
      item.importPortDirection,
      item.importCfsReached,
      item.importAccountsBillingStatus,
      item.importAccountsPaymentStatus,
    ],
    parts
  );

  if (module) {
    parts.push(getImportCurrentStatus(item, module));
  }

  (item.containers ?? []).forEach((container) => {
    push(
      [
        container.containerNumber,
        container.containerSize,
        container.containerType,
      ],
      parts
    );
  });

  return parts.join(" ").toLowerCase();
}

export function matchesImportSearch(
  item: FreightForward,
  query: string,
  module?: ImportModuleKey
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return buildImportSearchHaystack(item, module).includes(needle);
}

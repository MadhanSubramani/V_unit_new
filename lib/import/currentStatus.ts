import { FreightForward } from "@/types/freightForward";
import {
  getImportDoStatus,
  getImportIgmStatus,
  getImportMovementStatus,
  isImportDoCompleted,
  isImportLinerCompleted,
} from "@/lib/import/linerWorkflow";
import {
  getBoeFilingStatus,
  isBoeChecklistComplete,
  isImportBoeInCompleted,
} from "@/lib/import/boeInWorkflow";
import {
  canUnlockImportEwaySection,
  getImportBoeOutDutyStatus,
  getImportBoeOutInwardOccStatus,
  isImportBoeOutDispatched,
  isImportTTypeBoeSaved,
} from "@/lib/import/boeOutWorkflow";
import {
  isImportTransportCompleted,
} from "@/lib/import/transportWorkflow";
import {
  getImportAccountsBillingStatus,
  getImportAccountsPaymentStatus,
  isImportAccountsCompleted,
} from "@/lib/import/accountsWorkflow";
import type { ImportModuleKey } from "@/lib/import/permissions";

export function getImportLinerCurrentStatus(item: FreightForward) {
  if (isImportLinerCompleted(item)) return "Liner Complete";
  if (isImportDoCompleted(item)) return "DO Received";
  if (getImportIgmStatus(item) === "posted") return "IGM Posted";
  if (getImportMovementStatus(item) === "completed") return "Movement Complete";
  if (getImportMovementStatus(item) === "accepted") return "Movement Accepted";
  return "Movement Pending";
}

export function getImportZtypeCurrentStatus(item: FreightForward) {
  if (isImportBoeInCompleted(item)) {
    return item.importBoeClearanceStatus === "open"
      ? "Inward Open Saved"
      : "Inward RMS Complete";
  }
  if (item.inwardBoeNo?.trim() && item.importBoeClearanceStatus === "open") {
    return "Inward Open Saved";
  }
  if (getBoeFilingStatus(item) === "filed") return "BOE Filed";
  if (isBoeChecklistComplete(item)) return "Checklist Complete";
  return "Checklist Pending";
}

export function getImportTransportCurrentStatus(item: FreightForward) {
  if (isImportTransportCompleted(item)) return "Transport Complete";
  if (item.importCfsReached === "reached") return "CFS Reached";
  if (item.importPortDirection === "port_out") return "Port Out";
  if (item.importPortDirection === "port_in") return "Port In";
  if (item.importVehicleNo?.trim()) return "Vehicle Assigned";
  return "Transport Pending";
}

export function getImportTtypeCurrentStatus(item: FreightForward) {
  if (isImportBoeOutDispatched(item)) return "Dispatched";
  if (canUnlockImportEwaySection(item)) return "E Waybill Pending";
  const duty = getImportBoeOutDutyStatus(item);
  if (duty === "final") return "Duty Final";
  if (duty === "paid") return "Duty Paid";
  if (isImportTTypeBoeSaved(item)) return "T Type Saved";
  if (getImportBoeOutInwardOccStatus(item) === "occ") return "Inward OOC";
  return "Inward OOC Pending";
}

export function getImportAccountsCurrentStatus(item: FreightForward) {
  if (isImportAccountsCompleted(item)) return "Accounts Complete";
  if (getImportAccountsPaymentStatus(item) === "received") return "Payment Received";
  if (getImportAccountsBillingStatus(item) === "completed") return "Billing Complete";
  return "Billing Pending";
}

export function getImportWorklistCurrentStatus(item: FreightForward) {
  if (isImportLinerCompleted(item)) return "Liner Complete";
  return getImportLinerCurrentStatus(item);
}

export function getImportCurrentStatus(
  item: FreightForward,
  module: ImportModuleKey
) {
  switch (module) {
    case "liner":
      return getImportLinerCurrentStatus(item);
    case "ztype":
      return getImportZtypeCurrentStatus(item);
    case "transport":
      return getImportTransportCurrentStatus(item);
    case "ttype":
      return getImportTtypeCurrentStatus(item);
    case "accounts":
      return getImportAccountsCurrentStatus(item);
    case "worklist":
      return getImportWorklistCurrentStatus(item);
    default:
      return getImportLinerCurrentStatus(item);
  }
}

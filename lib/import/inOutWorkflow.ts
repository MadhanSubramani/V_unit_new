import { FreightForward } from "@/types/freightForward";
import { getContainersFromRecord } from "@/lib/freightForward/containers";
import {
  getTTypeBoeDateDisplay,
  getTTypeBoeNoDisplay,
  isImportTTypeBoeSaved,
  isImportTTypeSectionCompleted,
} from "@/lib/import/boeOutWorkflow";
import { formatEzDate } from "@/lib/import/hbl";
import { isImportWorklistJob } from "@/lib/import/linerWorkflow";
import { getImportTruckDetails } from "@/lib/import/transportWorkflow";

export type ImportInOutCard = "pending" | "ewayDone" | "dispatched";

export function canTakeInOutAction(item: FreightForward) {
  return isImportTTypeBoeSaved(item) || isImportTTypeSectionCompleted(item);
}

export function matchesImportInOutCard(item: FreightForward, card: ImportInOutCard) {
  switch (card) {
    case "dispatched":
      return item.importBoeOutCompleted === true;
    case "ewayDone":
      return item.importEwayBill === "yes" || item.importEwayBill === "no";
    case "pending":
      return canTakeInOutAction(item) && !item.importEwayBill;
  }
}

export function computeImportInOutCounts(records: FreightForward[]) {
  const actionable = records.filter(canTakeInOutAction);
  return {
    pending: actionable.filter((item) => matchesImportInOutCard(item, "pending")).length,
    ewayDone: actionable.filter((item) => matchesImportInOutCard(item, "ewayDone")).length,
    dispatched: actionable.filter((item) => matchesImportInOutCard(item, "dispatched"))
      .length,
  };
}

export function getImportInOutRecords(records: FreightForward[]) {
  return records.filter((item) => isImportWorklistJob(item) && canTakeInOutAction(item));
}

export function missingDeliveryChallanFields(item: FreightForward) {
  const truck = getImportTruckDetails(item)[0];
  const missing: string[] = [];
  const tNo = getTTypeBoeNoDisplay(item);
  const tDate = getTTypeBoeDateDisplay(item);
  const containers = getContainersFromRecord(item)
    .map((row) => row.containerNumber)
    .filter(Boolean);
  const packages = (item.importTTypeEntries ?? [])
    .map((entry) => entry.packages?.trim())
    .filter(Boolean)
    .join(", ");

  if (!item.consignmentName?.trim()) missing.push("Consignee name");
  if (!item.importDoAddress?.trim()) missing.push("Consignee / DO address");
  if (!item.jobNumber?.trim()) missing.push("Job / DC number");
  if (!item.inwardBoeNo?.trim()) missing.push("Z type BE No");
  if (!item.inwardBoeDate?.trim()) missing.push("Z type BE Date");
  if (!tNo || tNo === "—") missing.push("T type BE No");
  if (!tDate || tDate === "—") missing.push("T type BE Date");
  if (!item.importInOutDocType) missing.push("Doc type (DTA / Zone to Zone / Export)");
  if (!item.importInOutLorryType?.trim()) missing.push("Lorry type");
  if (!(truck?.importTransporter ?? item.importTransporter)?.trim()) {
    missing.push("Transport name");
  }
  if (!(truck?.importVehicleNo ?? item.importVehicleNo)?.trim()) {
    missing.push("Vehicle No");
  }
  if (!(truck?.importDriverName ?? item.importDriverName)?.trim()) {
    missing.push("Driver name");
  }
  if (!(truck?.importDriverPhone ?? item.importDriverPhone)?.trim()) {
    missing.push("Phone No");
  }
  if (!item.clientName?.trim()) missing.push("Client name");
  if (!item.importDoName?.trim()) missing.push("DO name");
  if (!item.importDoNumber?.trim()) missing.push("DO / Client number");
  if (!item.importDoPlaceOfDelivery?.trim()) missing.push("Place of delivery");
  if (!item.ezRefNumber?.trim()) missing.push("EZ Ref");
  if (!item.ezDate?.trim() && !formatEzDate(item)) missing.push("EZ Date");
  if (!item.importEwayBill) missing.push("E waybill (Yes / No)");
  if (!item.descriptionOfGoods?.trim()) missing.push("Description of goods");
  if (!packages) missing.push("No. of packages");
  if (!containers.length && !item.containerNumber?.trim()) {
    missing.push("Container No");
  }
  return missing;
}

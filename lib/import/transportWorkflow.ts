import { FreightForward, ImportTruckDetail, ImportVehicleChange } from "@/types/freightForward";
import { getBoeFilingStatus, isImportBoeInCompleted } from "@/lib/import/boeInWorkflow";
import { isImportWorklistJob } from "@/lib/import/linerWorkflow";
import { getContainersFromRecord } from "@/lib/freightForward/containers";
import { getShipmentMode } from "@/lib/import/hbl";

export type ImportTransportCard =
  | "incomplete"
  | "completed"
  | "boeFiled"
  | "boeUnfiled";

export function isImportTransportCompleted(item: FreightForward) {
  return item.importTransportCompleted === true;
}

export function canTakeTransportAction(item: FreightForward) {
  return isImportBoeInCompleted(item);
}

export function isTransportBoeUnfiled(item: FreightForward) {
  return getBoeFilingStatus(item) === "unfiled";
}

export function matchesImportTransportCard(
  item: FreightForward,
  card: ImportTransportCard
) {
  const filed = getBoeFilingStatus(item) === "filed";
  const transportCompleted = isImportTransportCompleted(item);
  const unfiled = isTransportBoeUnfiled(item);

  switch (card) {
    case "completed":
      return transportCompleted;
    case "incomplete":
      return !transportCompleted;
    case "boeFiled":
      return filed && !transportCompleted;
    case "boeUnfiled":
      return unfiled;
  }
}

/** Non–BOE-unfiled cards hide unfiled jobs from the table. */
export function excludeTransportBoeUnfiledFromList(
  item: FreightForward,
  activeCard: ImportTransportCard | null
) {
  if (activeCard === "boeUnfiled") return false;
  return isTransportBoeUnfiled(item);
}

export function computeImportTransportCounts(records: FreightForward[]) {
  const completed = records.filter(isImportTransportCompleted).length;
  return {
    completed,
    incomplete: records.filter((item) =>
      matchesImportTransportCard(item, "incomplete")
    ).length,
    boeFiled: records.filter((item) =>
      matchesImportTransportCard(item, "boeFiled")
    ).length,
    boeUnfiled: records.filter((item) =>
      matchesImportTransportCard(item, "boeUnfiled")
    ).length,
  };
}

/** All Import jobs — actions stay locked until Z type BE is completed. */
export function getImportTransportRecords(records: FreightForward[]) {
  return records.filter(isImportWorklistJob);
}

export function getImportTruckSlotCount(item: FreightForward) {
  if (getShipmentMode(item) === "air") return 1;
  const count = getContainersFromRecord(item).length;
  return Math.max(1, count);
}

export function emptyTruckDetail(containerNumber = ""): ImportTruckDetail {
  return {
    containerNumber,
    importTransporter: "",
    importTruckStash: false,
    importVehicleNo: "",
    importDriverName: "",
    importDriverPhone: "",
    importScanningEnabled: false,
    importScanningResult: undefined,
  };
}

export function getImportTruckDetails(item: FreightForward): ImportTruckDetail[] {
  const count = getImportTruckSlotCount(item);
  const containers = getContainersFromRecord(item);
  const stored = item.importTruckDetails ?? [];
  const legacy: ImportTruckDetail = {
    containerNumber: containers[0]?.containerNumber ?? "",
    importTransporter: item.importTransporter ?? "",
    importTruckStash: item.importTruckStash ?? false,
    importVehicleNo: item.importVehicleNo ?? "",
    importDriverName: item.importDriverName ?? "",
    importDriverPhone: item.importDriverPhone ?? "",
    importScanningEnabled: item.importScanningEnabled ?? false,
    importScanningResult: item.importScanningResult,
  };

  return Array.from({ length: count }, (_, index) => {
    const containerNumber = containers[index]?.containerNumber ?? "";
    const fromStore = stored[index];
    if (fromStore) {
      return {
        ...emptyTruckDetail(containerNumber),
        ...fromStore,
        containerNumber: fromStore.containerNumber || containerNumber,
      };
    }
    if (index === 0 && !stored.length) return { ...legacy, containerNumber };
    return emptyTruckDetail(containerNumber);
  });
}

export function getImportVehicleChanges(item: FreightForward): ImportVehicleChange[] {
  const trucks = getImportTruckDetails(item);
  const stored = item.importBoeOutVehicleChanges ?? [];
  if (stored.length) {
    return trucks.map((truck, index) => ({
      containerNumber: truck.containerNumber ?? "",
      oldTransporter: stored[index]?.oldTransporter ?? truck.importTransporter ?? "",
      oldVehicleNo: stored[index]?.oldVehicleNo ?? truck.importVehicleNo ?? "",
      oldDriverName: stored[index]?.oldDriverName ?? truck.importDriverName ?? "",
      oldDriverPhone: stored[index]?.oldDriverPhone ?? truck.importDriverPhone ?? "",
      newTransporter: stored[index]?.newTransporter ?? "",
      newVehicleNo: stored[index]?.newVehicleNo ?? "",
      newDriverName: stored[index]?.newDriverName ?? "",
      newDriverPhone: stored[index]?.newDriverPhone ?? "",
    }));
  }
  if (!item.importBoeOutVehicleChanged) {
    return trucks.map((truck) => ({
      containerNumber: truck.containerNumber ?? "",
      oldTransporter: truck.importTransporter ?? "",
      oldVehicleNo: truck.importVehicleNo ?? "",
      oldDriverName: truck.importDriverName ?? "",
      oldDriverPhone: truck.importDriverPhone ?? "",
      newTransporter: "",
      newVehicleNo: "",
      newDriverName: "",
      newDriverPhone: "",
    }));
  }
  return trucks.map((truck, index) =>
    index === 0
      ? {
          containerNumber: truck.containerNumber ?? "",
          oldTransporter: item.importBoeOutOldTransporter ?? truck.importTransporter ?? "",
          oldVehicleNo: item.importBoeOutOldVehicleNo ?? truck.importVehicleNo ?? "",
          oldDriverName: item.importBoeOutOldDriverName ?? truck.importDriverName ?? "",
          oldDriverPhone: item.importBoeOutOldDriverPhone ?? truck.importDriverPhone ?? "",
          newTransporter: item.importBoeOutNewTransporter ?? "",
          newVehicleNo: item.importBoeOutNewVehicleNo ?? "",
          newDriverName: item.importBoeOutNewDriverName ?? "",
          newDriverPhone: item.importBoeOutNewDriverPhone ?? "",
        }
      : {
          containerNumber: truck.containerNumber ?? "",
          oldTransporter: truck.importTransporter ?? "",
          oldVehicleNo: truck.importVehicleNo ?? "",
          oldDriverName: truck.importDriverName ?? "",
          oldDriverPhone: truck.importDriverPhone ?? "",
          newTransporter: "",
          newVehicleNo: "",
          newDriverName: "",
          newDriverPhone: "",
        }
  );
}

export function isVehicleChangeComplete(change: ImportVehicleChange) {
  return Boolean(
    change.newTransporter?.trim() &&
      change.newVehicleNo?.trim() &&
      change.newDriverName?.trim() &&
      change.newDriverPhone?.trim()
  );
}

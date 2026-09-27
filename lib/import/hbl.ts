import {
  FreightForward,
  FreightForwardDocument,
  ImportHblEntry,
  ImportShipmentMode,
} from "@/types/freightForward";

export function todayIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatEzDate(item: FreightForward) {
  const stored = item.ezDate?.trim();
  if (stored) return stored;
  const created = item.createdAt;
  if (
    created &&
    typeof created === "object" &&
    "toDate" in created &&
    typeof (created as { toDate: () => Date }).toDate === "function"
  ) {
    return (created as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  if (created instanceof Date) return created.toISOString().slice(0, 10);
  return "";
}

export function getShipmentMode(item: Pick<FreightForward, "shipmentMode">) {
  return item.shipmentMode === "air" ? "air" : "sea";
}

export function getLoadType(item: Pick<FreightForward, "loadType">) {
  return item.loadType === "fcl" ? "fcl" : "lcl";
}

export function masterBlLabel(mode: ImportShipmentMode) {
  return mode === "air" ? "MAWBL" : "MBL";
}

export function houseBlLabel(mode: ImportShipmentMode) {
  return mode === "air" ? "HAWBL" : "HBL";
}

export function getHblEntries(
  item: Pick<FreightForward, "hblEntries" | "hbl" | "hblUrl" | "hblDocs">
): ImportHblEntry[] {
  if (item.hblEntries?.length) {
    return item.hblEntries.map((entry) => ({
      number: entry.number?.trim() ?? "",
      file: entry.file,
    }));
  }
  const docs = item.hblDocs?.length
    ? item.hblDocs
    : item.hblUrl
      ? [item.hblUrl]
      : [];
  const numbers = (item.hbl ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!numbers.length && !docs.length) return [];
  if (!numbers.length) {
    return docs.map((file) => ({ number: "", file }));
  }
  return numbers.map((number, index) => ({
    number,
    file: docs[index],
  }));
}

export function formatHblDisplay(item: FreightForward) {
  const numbers = getHblEntries(item)
    .map((entry) => entry.number.trim())
    .filter(Boolean);
  if (numbers.length) return numbers.join(", ");
  return item.hbl?.trim() || "—";
}

export function serializeHblEntries(entries: ImportHblEntry[]) {
  const cleaned = entries
    .map((entry) => ({
      number: entry.number.trim(),
      file: entry.file,
    }))
    .filter((entry) => entry.number || entry.file);
  return {
    hblEntries: cleaned,
    hbl: cleaned.map((entry) => entry.number).filter(Boolean).join(", "),
    hblUrl: cleaned[0]?.file as FreightForwardDocument | undefined,
    hblDocs: cleaned
      .map((entry) => entry.file)
      .filter((file): file is FreightForwardDocument => Boolean(file)),
  };
}

import { FreightForward } from "@/types/freightForward";
import { formatEzDate } from "@/lib/import/hbl";
import { getTTypeBoeDateDisplay } from "@/lib/import/boeOutWorkflow";

export type ImportDateField =
  | "eta"
  | "ezDate"
  | "inwardBoeDate"
  | "tTypeBoeDate"
  | "doPort"
  | "doEmpty";

export const IMPORT_DATE_FIELD_OPTIONS: {
  value: ImportDateField;
  label: string;
}[] = [
  { value: "eta", label: "ETA" },
  { value: "ezDate", label: "EZ Date" },
  { value: "inwardBoeDate", label: "Z type BE Date" },
  { value: "tTypeBoeDate", label: "T type BE Date" },
  { value: "doPort", label: "Port validity" },
  { value: "doEmpty", label: "Empty validity" },
];

export function getImportDateFieldValue(
  item: FreightForward,
  field: ImportDateField = "eta"
) {
  switch (field) {
    case "ezDate":
      return formatEzDate(item).slice(0, 10);
    case "inwardBoeDate":
      return (item.inwardBoeDate ?? "").slice(0, 10);
    case "tTypeBoeDate": {
      const value = getTTypeBoeDateDisplay(item);
      return value === "—" ? "" : value.slice(0, 10);
    }
    case "doPort":
      return (item.importDoPostValidity ?? "").slice(0, 10);
    case "doEmpty":
      return (item.importDoEmptyValidity ?? "").slice(0, 10);
    default:
      return (item.eta ?? item.etaSort ?? "").slice(0, 10);
  }
}

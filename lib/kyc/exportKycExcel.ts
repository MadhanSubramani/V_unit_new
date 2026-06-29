import * as XLSX from "xlsx";
import { Kyc } from "@/types/kyc";

const EXPORT_COLUMNS: { key: keyof Kyc | "branchAddressesJoined"; header: string }[] = [
  { key: "fileNo", header: "File No" },
  { key: "gstin", header: "GSTIN" },
  { key: "companyName", header: "Company Name" },
  { key: "billingAddress", header: "Billing Address" },
  { key: "branchAddressesJoined", header: "Branch Addresses" },
  { key: "pan", header: "PAN" },
  { key: "iec", header: "IEC" },
  { key: "adCode", header: "AD Code" },
  { key: "loiNo", header: "LOI No" },
  { key: "loiDate", header: "LOI Date" },
  { key: "email", header: "Email" },
  { key: "phone", header: "Phone" },
];

export function exportKycToExcel(records: Kyc[]) {
  const rows = records.map((kyc) => {
    const row: Record<string, string> = {};
    for (const col of EXPORT_COLUMNS) {
      if (col.key === "branchAddressesJoined") {
        row[col.header] = (kyc.branchAddresses ?? []).join("; ");
      } else {
        row[col.header] = String(kyc[col.key as keyof Kyc] ?? "");
      }
    }
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "KYC");

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `kyc-export-${date}.xlsx`);
}

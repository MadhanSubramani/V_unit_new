import { jsPDF } from "jspdf";
import { FreightForward } from "@/types/freightForward";
import { Kyc } from "@/types/kyc";
import { sumExpenseItems } from "@/lib/freightForward/amounts";

const COMPANY = {
  name: "V UNIT LOGISTICS INDIA PRIVATE LIMITED",
  address: "2ND FLOOR, 77/1 EAST MADHA CHURCH STREET, ROYAPURAM,",
  city: "CHENNAI,600013, TAMIL NADU,INDIA.",
  phone: "PH: 9345949514",
  email: "EMAIL: ACCTS.INMAA@VUNITLOGISTICS.COM",
  gstin: "33AAJCV5466B1ZD",
  pan: "AAJCV5466B",
};

export interface ProformaInput {
  exWorksGstPercent: number;
  blFeeGstPercent: number;
  blFee: number;
  rupeePerDollar: number;
}

interface ChargeRow {
  sno: number;
  description: string;
  currency: "USD" | "INR";
  unitAmount: number;
  roe: number;
  taxableInr: number;
  cgstRate: number;
  sgstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  totalInr: number;
}

function formatInr(value: number) {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(d: Date) {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function splitGst(gstPercent: number) {
  const half = gstPercent / 2;
  return { cgstRate: half, sgstRate: half };
}

function buildChargeRows(
  record: FreightForward,
  input: ProformaInput
): ChargeRow[] {
  const rows: ChargeRow[] = [];
  const totalExWorksUsd = sumExpenseItems(record.exWorks);

  if (totalExWorksUsd > 0) {
    const { cgstRate, sgstRate } = splitGst(input.exWorksGstPercent);
    const taxableInr = totalExWorksUsd * input.rupeePerDollar;
    const cgstAmount = (taxableInr * cgstRate) / 100;
    const sgstAmount = (taxableInr * sgstRate) / 100;

    rows.push({
      sno: 1,
      description: "TOTAL EX WORKS",
      currency: "USD",
      unitAmount: totalExWorksUsd,
      roe: input.rupeePerDollar,
      taxableInr,
      cgstRate,
      sgstRate,
      cgstAmount,
      sgstAmount,
      totalInr: taxableInr + cgstAmount + sgstAmount,
    });
  }

  if (input.blFee > 0) {
    const { cgstRate, sgstRate } = splitGst(input.blFeeGstPercent);
    const taxableInr = input.blFee;
    const cgstAmount = (taxableInr * cgstRate) / 100;
    const sgstAmount = (taxableInr * sgstRate) / 100;

    rows.push({
      sno: rows.length + 1,
      description: "BL FEE",
      currency: "INR",
      unitAmount: input.blFee,
      roe: 1,
      taxableInr,
      cgstRate,
      sgstRate,
      cgstAmount,
      sgstAmount,
      totalInr: taxableInr + cgstAmount + sgstAmount,
    });
  }

  return rows;
}

function findKycForConsignee(kycList: Kyc[], consignmentName: string): Kyc | undefined {
  const normalized = consignmentName.trim().toLowerCase();
  return kycList.find(
    (k) => k.companyName.trim().toLowerCase() === normalized
  );
}

export function generateProformaPdf(
  record: FreightForward,
  kycList: Kyc[],
  input: ProformaInput
) {
  const kyc = findKycForConsignee(kycList, record.consignmentName);
  const rows = buildChargeRows(record, input);
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(COMPANY.name, margin, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(COMPANY.address, margin, y);
  y += 10;
  doc.text(COMPANY.city, margin, y);
  y += 10;
  doc.text(`${COMPANY.phone}  ${COMPANY.email}`, margin, y);
  y += 10;
  doc.text(`GSTIN : ${COMPANY.gstin}`, margin, y);
  y += 10;
  doc.text(`PAN : ${COMPANY.pan}`, margin, y);
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("PROFORMA", pageWidth / 2, y, { align: "center" });
  y += 16;

  if (record.jobNumber) {
    doc.setFontSize(10);
    doc.text(`Job Number : ${record.jobNumber}`, pageWidth / 2, y, {
      align: "center",
    });
    y += 14;
  }

  const leftX = margin;
  const rightX = pageWidth / 2 + 10;
  const today = formatDate(new Date());

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const consigneeLines = kyc
    ? [kyc.companyName, ...kyc.billingAddress.split("\n").filter(Boolean)]
    : [record.consignmentName];

  doc.setFont("helvetica", "bold");
  doc.text("Consignee", leftX, y);
  doc.setFont("helvetica", "normal");
  consigneeLines.forEach((line, i) => {
    doc.text(line, leftX, y + 12 + i * 10);
  });

  y += consigneeLines.length * 10 + 20;

  if (kyc?.gstin) {
    doc.text(`GSTIN : ${kyc.gstin}`, leftX, y);
    y += 12;
  }

  doc.text(`Invoice Date : ${today}`, leftX, y);
  doc.text(`Master Number : ${record.mbl || "—"}`, rightX, y);
  y += 12;
  doc.text(`House Number : ${record.hbl || "—"}`, rightX, y);
  y += 12;
  doc.text(`Container No. : ${record.containerNumber || "—"}`, leftX, y);
  doc.text(`Container Size : ${record.containerSize || "—"}`, rightX, y);
  y += 12;
  doc.text(`Container Type : ${record.containerType || "—"}`, leftX, y);
  doc.text(`Vessel Name : ${record.vesselName || "—"}`, rightX, y);
  y += 12;
  doc.text(`Port of Origin : ${record.pol || "—"}`, leftX, y);
  doc.text(`Final Destination : ${record.pod || "—"}`, rightX, y);
  y += 18;

  const colX = {
    sno: margin,
    desc: margin + 28,
    curr: margin + 200,
    unit: margin + 235,
    roe: margin + 300,
    taxable: margin + 350,
    cgstR: margin + 415,
    cgstA: margin + 450,
    sgstR: margin + 495,
    sgstA: margin + 530,
    total: margin + 575,
  };

  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, pageWidth - margin * 2, 16, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("S.No", colX.sno, y + 11);
  doc.text("Charges Details", colX.desc, y + 11);
  doc.text("Curr", colX.curr, y + 11);
  doc.text("Amt", colX.unit, y + 11);
  doc.text("ROE", colX.roe, y + 11);
  doc.text("Taxable", colX.taxable, y + 11);
  doc.text("CGST%", colX.cgstR, y + 11);
  doc.text("CGST", colX.cgstA, y + 11);
  doc.text("SGST%", colX.sgstR, y + 11);
  doc.text("SGST", colX.sgstA, y + 11);
  doc.text("Total", colX.total, y + 11);
  y += 20;

  doc.setFont("helvetica", "normal");
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let grandTotal = 0;

  rows.forEach((row) => {
    doc.text(String(row.sno), colX.sno, y);
    doc.text(row.description, colX.desc, y);
    doc.text(row.currency, colX.curr, y);
    doc.text(formatInr(row.unitAmount), colX.unit, y);
    doc.text(formatInr(row.roe), colX.roe, y);
    doc.text(formatInr(row.taxableInr), colX.taxable, y);
    doc.text(`${row.cgstRate.toFixed(2)}%`, colX.cgstR, y);
    doc.text(formatInr(row.cgstAmount), colX.cgstA, y);
    doc.text(`${row.sgstRate.toFixed(2)}%`, colX.sgstR, y);
    doc.text(formatInr(row.sgstAmount), colX.sgstA, y);
    doc.text(formatInr(row.totalInr), colX.total, y);

    totalTaxable += row.taxableInr;
    totalCgst += row.cgstAmount;
    totalSgst += row.sgstAmount;
    grandTotal += row.totalInr;
    y += 14;
  });

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Total", colX.taxable - 30, y);
  doc.text(formatInr(totalTaxable), colX.taxable, y);
  doc.text(formatInr(totalCgst), colX.cgstA, y);
  doc.text(formatInr(totalSgst), colX.sgstA, y);
  doc.text(formatInr(grandTotal), colX.total, y);
  y += 40;

  const sigX = pageWidth - margin - 180;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("FOR V UNIT LOGISTICS INDIA PRIVATE LIMITED", sigX, y, {
    align: "left",
  });
  y += 50;
  doc.text("AUTHORISED SIGNATURE", sigX + 20, y);

  const jobPart = record.jobNumber?.replace(/\s/g, "_") ?? "proforma";
  const consigneePart = record.consignmentName
    .replace(/[^\w]+/g, "_")
    .slice(0, 24);
  const filename = `PROFORMA_${consigneePart}_${jobPart}_${Date.now()}.pdf`;
  doc.save(filename);
}

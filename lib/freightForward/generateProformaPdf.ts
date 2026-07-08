import { jsPDF } from "jspdf";
import { FreightForward } from "@/types/freightForward";
import { Kyc } from "@/types/kyc";
import { parseAmount, sumExpenseItems } from "@/lib/freightForward/amounts";
import { getTotalOceanFreight } from "@/lib/freightForward/containers";

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
  oceanFreightGstPercent: number;
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

async function loadRasterImageDataUrl(
  path: string,
  size = 128
): Promise<string> {
  const res = await fetch(path);
  const contentType = res.headers.get("content-type") ?? "";

  if (path.endsWith(".svg") || contentType.includes("svg")) {
    const svgText = await res.text();
    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(img, 0, 0, size, size);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function buildChargeRows(
  record: FreightForward,
  input: ProformaInput
): ChargeRow[] {
  const rows: ChargeRow[] = [];
  const totalExWorksUsd = sumExpenseItems(record.exWorks);
  const oceanFreightUsd = getTotalOceanFreight(record);

  if (totalExWorksUsd > 0) {
    const { cgstRate, sgstRate } = splitGst(input.exWorksGstPercent);
    const taxableInr = totalExWorksUsd * input.rupeePerDollar;
    const cgstAmount = (taxableInr * cgstRate) / 100;
    const sgstAmount = (taxableInr * sgstRate) / 100;

    rows.push({
      sno: rows.length + 1,
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

  if (oceanFreightUsd > 0) {
    const { cgstRate, sgstRate } = splitGst(input.oceanFreightGstPercent);
    const taxableInr = oceanFreightUsd * input.rupeePerDollar;
    const cgstAmount = (taxableInr * cgstRate) / 100;
    const sgstAmount = (taxableInr * sgstRate) / 100;

    rows.push({
      sno: rows.length + 1,
      description: "OCEAN FREIGHT",
      currency: "USD",
      unitAmount: oceanFreightUsd,
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

export async function generateProformaPdf(
  record: FreightForward,
  kycList: Kyc[],
  input: ProformaInput
) {
  const kyc = findKycForConsignee(kycList, record.consignmentName);
  const rows = buildChargeRows(record, input);
  const [logoData, stampData] = await Promise.all([
    loadRasterImageDataUrl("/v-unit-logo.svg", 128),
    loadRasterImageDataUrl("/v-unit-stamp.png", 256),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 36;

  doc.addImage(logoData, "PNG", margin, y, 48, 48);

  const headerX = margin + 58;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(COMPANY.name, headerX, y + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(COMPANY.address, headerX, y + 22);
  doc.text(COMPANY.city, headerX, y + 32);
  doc.text(`${COMPANY.phone}  ${COMPANY.email}`, headerX, y + 42);
  doc.text(`GSTIN : ${COMPANY.gstin}`, headerX, y + 52);
  doc.text(`PAN : ${COMPANY.pan}`, headerX, y + 62);

  y += 78;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("FREIGHT CERTIFICATE", pageWidth / 2, y, { align: "center" });
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
  if (record.blType) {
    doc.text(`BL Type : ${record.blType}`, leftX, y);
    y += 12;
  }
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
  y += 36;

  const sigX = pageWidth - margin - 200;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("FOR V UNIT LOGISTICS INDIA PRIVATE LIMITED", sigX, y, {
    align: "left",
  });
  y += 16;

  doc.addImage(stampData, "PNG", sigX + 24, y, 72, 72);
  y += 80;

  doc.text("AUTHORISED SIGNATURE", sigX + 20, y);

  const jobPart = record.jobNumber?.replace(/\s/g, "_") ?? "certificate";
  const consigneePart = record.consignmentName
    .replace(/[^\w]+/g, "_")
    .slice(0, 24);
  const filename = `FREIGHT_CERTIFICATE_${consigneePart}_${jobPart}_${Date.now()}.pdf`;
  doc.save(filename);
}

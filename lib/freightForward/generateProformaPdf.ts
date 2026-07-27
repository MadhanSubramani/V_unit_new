import { jsPDF } from "jspdf";
import { FreightForward } from "@/types/freightForward";
import { Kyc } from "@/types/kyc";
import { parseAmount, sumExpenseItems, getRecordProfitLoss } from "@/lib/freightForward/amounts";
import {
  getContainerCount,
  getContainersFromRecord,
  getOceanFreightPerContainer,
  getTotalOceanFreight,
} from "@/lib/freightForward/containers";

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

const BANK_DETAILS = {
  accountName: "V UNIT LOGISTICS INDIA PRIVATE LIMITED",
  accountNo: "259600802609",
  ifsc: "INDB0000167",
  bank: "INDUSIND BANK",
  address: "Rajaji Salai,Chennai",
};

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones ? `${TENS[tens]} ${ONES[ones]}` : TENS[tens];
}

function threeDigitsToWords(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  if (hundred && rest) {
    return `${ONES[hundred]} Hundred ${twoDigitsToWords(rest)}`;
  }
  if (hundred) return `${ONES[hundred]} Hundred`;
  return twoDigitsToWords(rest);
}

function integerToIndianWords(n: number): string {
  if (n === 0) return "Zero";

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = n % 1000;
  const parts: string[] = [];

  if (crore) parts.push(`${threeDigitsToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitsToWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitsToWords(hundred));

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function amountToWordsInr(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);

  let words = `Rupees ${integerToIndianWords(rupees)}`;
  if (paise > 0) {
    words += ` and ${integerToIndianWords(paise)} Paise`;
  }
  return `${words} Only`;
}

function formatUsd(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
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
  const baseOceanFreightUsd = getTotalOceanFreight(record);

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

  if (baseOceanFreightUsd > 0) {
    const containerCount = getContainerCount(record);
    const basePerContainer = getOceanFreightPerContainer(record) ?? 0;
    const profit = getRecordProfitLoss(record);
    const profitPerContainer =
      profit > 0 ? profit / containerCount : 0;
    const displayPerContainer = basePerContainer + profitPerContainer;
    const oceanFreightUsd = displayPerContainer * containerCount;

    const { cgstRate, sgstRate } = splitGst(input.oceanFreightGstPercent);
    const taxableInr = oceanFreightUsd * input.rupeePerDollar;
    const cgstAmount = (taxableInr * cgstRate) / 100;
    const sgstAmount = (taxableInr * sgstRate) / 100;
    const oceanDetail = `(${containerCount} container${containerCount === 1 ? "" : "s"} × $${formatUsd(displayPerContainer)})`;

    rows.push({
      sno: rows.length + 1,
      description: `OCEAN FREIGHT\n${oceanDetail}`,
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

  const containers = getContainersFromRecord(record);
  const containerNumbers =
    containers
      .map((c) => c.containerNumber)
      .filter(Boolean)
      .join(", ") || "—";

  doc.text(`Invoice Date : ${today}`, leftX, y);
  doc.text(`Master Number : ${record.mbl || "—"}`, rightX, y);
  y += 12;
  doc.text(`House Number : ${record.hbl || "—"}`, rightX, y);
  y += 12;
  doc.text(`Container No. : ${containerNumbers}`, leftX, y);
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
  y += 30;

  doc.setFont("helvetica", "normal");
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let grandTotal = 0;

  rows.forEach((row) => {
    const descLines = row.description.split("\n");
    doc.text(String(row.sno), colX.sno, y);
    doc.text(descLines[0], colX.desc, y);
    if (descLines[1]) {
      doc.setFontSize(6);
      doc.text(descLines[1], colX.desc, y + 8);
      doc.setFontSize(7);
    }
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
    y += descLines[1] ? 22 : 14;
  });

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Total", colX.taxable - 30, y);
  doc.text(formatInr(totalTaxable), colX.taxable, y);
  doc.text(formatInr(totalCgst), colX.cgstA, y);
  doc.text(formatInr(totalSgst), colX.sgstA, y);
  doc.text(formatInr(grandTotal), colX.total, y);
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Total in Words :", margin, y);
  doc.setFont("helvetica", "normal");
  const amountWords = amountToWordsInr(grandTotal);
  const wordLines = doc.splitTextToSize(amountWords, pageWidth - margin * 2 - 70);
  doc.text(wordLines, margin + 70, y);
  y += wordLines.length * 10 + 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Bank Details", margin, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const bankLines = [
    `A/C Name : ${BANK_DETAILS.accountName}`,
    `A/C No : ${BANK_DETAILS.accountNo}`,
    `IFSC : ${BANK_DETAILS.ifsc}`,
    `Bank : ${BANK_DETAILS.bank}`,
    `Address : ${BANK_DETAILS.address}`,
  ];
  bankLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 11;
  });
  y += 16;

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

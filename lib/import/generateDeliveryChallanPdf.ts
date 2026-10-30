import { jsPDF } from "jspdf";
import { FreightForward } from "@/types/freightForward";
import { getContainersFromRecord } from "@/lib/freightForward/containers";
import { formatEzDate } from "@/lib/import/hbl";
import { getTTypeBoeDateDisplay, getTTypeBoeNoDisplay } from "@/lib/import/boeOutWorkflow";
import { getImportTruckDetails } from "@/lib/import/transportWorkflow";

const COMPANY = {
  name: "V UNIT Logistics India Private Limited",
  address:
    "No. SG-5, J. Matadee - FTWZ, Mannur, Valarpuram Village, Sriperumbudur, Kanchipuram District - 602105",
  gst: "GST No:33AAJCV5466B2ZC",
  contact: "CONTACT  :+91 9600802609 / +91 9003440231",
};

function todayParts() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return {
    date: `${dd}.${mm}.${now.getFullYear()}`,
    time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    year: String(now.getFullYear()),
  };
}

export async function generateDeliveryChallanPdf(item: FreightForward) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 12;
  let y = 14;
  const truck = getImportTruckDetails(item)[0];
  const now = todayParts();
  const containers = getContainersFromRecord(item)
    .map((row) => row.containerNumber)
    .filter(Boolean)
    .join(", ");
  const packages = (item.importTTypeEntries ?? [])
    .map((entry) => entry.packages?.trim())
    .filter(Boolean)
    .join(", ");
  const tNo = getTTypeBoeNoDisplay(item);
  const tDate = getTTypeBoeDateDisplay(item);
  const consigneeAddress = [
    item.consignmentName,
    item.importDoAddress,
    item.importDoName ? `Client: ${item.importDoName}` : "",
    item.importDoNumber ? `Client No: ${item.importDoNumber}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(COMPANY.name, pageW / 2, y, { align: "center" });
  y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(COMPANY.address, pageW / 2, y, { align: "center", maxWidth: pageW - 24 });
  y += 8;
  pdf.text(`${COMPANY.gst}   ${COMPANY.contact}`, pageW / 2, y, { align: "center" });
  y += 8;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("GATE PASS / DELIVERY CHALLAN", pageW / 2, y, { align: "center" });
  y += 8;

  const leftX = margin;
  const rightX = 118;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text("CONSIGNEE NAME & ADDRESS", leftX, y);
  pdf.setFont("helvetica", "normal");
  const addressLines = pdf.splitTextToSize(consigneeAddress || "—", 90);
  pdf.text(addressLines, leftX, y + 5);

  const meta = [
    ["DC No.", `JMFTWZ/${now.year}/${item.jobNumber || "—"}`],
    ["Gate Out Date", now.date],
    ["Z - BOE No. & Date", `${item.inwardBoeNo || "—"} / ${item.inwardBoeDate || "—"}`],
    ["T - BOE No. & Date", `${tNo === "—" ? "—" : tNo} / ${tDate === "—" ? "—" : tDate}`],
    ["Doc Type", item.importInOutDocType || "—"],
    ["Lorry Type", item.importInOutLorryType || "—"],
    ["Client Name", item.clientName || "—"],
    ["Client Number", item.importDoNumber || "—"],
    ["Place of Delivery", item.importDoPlaceOfDelivery || "—"],
    ["EZ Ref / Date", `${item.ezRefNumber || "—"} / ${formatEzDate(item) || "—"}`],
  ];
  meta.forEach((row, index) => {
    const rowY = y + index * 5;
    pdf.setFont("helvetica", "bold");
    pdf.text(row[0], rightX, rowY);
    pdf.setFont("helvetica", "normal");
    pdf.text(row[1], rightX + 38, rowY);
  });

  y += Math.max(addressLines.length * 4 + 8, meta.length * 5 + 4);
  pdf.setFont("helvetica", "bold");
  pdf.text(
    `Transport Name: ${truck?.importTransporter || item.importTransporter || "—"}`,
    leftX,
    y
  );
  y += 5;
  pdf.text(`Vehicle No.: ${truck?.importVehicleNo || item.importVehicleNo || "—"}`, leftX, y);
  y += 5;
  pdf.text(`Driver Name: ${truck?.importDriverName || item.importDriverName || "—"}`, leftX, y);
  y += 5;
  pdf.text(`Phone No.: ${truck?.importDriverPhone || item.importDriverPhone || "—"}`, leftX, y);
  y += 8;

  pdf.setFont("helvetica", "normal");
  pdf.text("Dear Sir/Madam,", leftX, y);
  y += 5;
  pdf.text(
    "We hereby deliver the following goods to you. Kindly acknowledge receipt of the same.",
    leftX,
    y,
    { maxWidth: pageW - margin * 2 }
  );
  y += 10;

  const cols = [
    { x: leftX, w: 16, h: "Sl. No." },
    { x: leftX + 16, w: 62, h: "Description" },
    { x: leftX + 78, w: 32, h: "No. of Packages" },
    { x: leftX + 110, w: 42, h: "Container No." },
    { x: leftX + 152, w: 34, h: "Remarks" },
  ];
  pdf.setFillColor(245, 245, 245);
  pdf.rect(leftX, y - 4, pageW - margin * 2, 8, "F");
  pdf.setFont("helvetica", "bold");
  cols.forEach((col) => pdf.text(col.h, col.x + 1, y));
  y += 8;
  pdf.setFont("helvetica", "normal");
  pdf.text("1", cols[0].x + 1, y);
  pdf.text(item.descriptionOfGoods || "—", cols[1].x + 1, y, { maxWidth: cols[1].w - 2 });
  pdf.text(packages || "—", cols[2].x + 1, y);
  pdf.text(containers || item.containerNumber || "—", cols[3].x + 1, y, {
    maxWidth: cols[3].w - 2,
  });
  pdf.text(item.importEwayBill === "yes" ? "E-way Yes" : item.importEwayBill === "no" ? "E-way No" : "", cols[4].x + 1, y);

  y += 28;
  pdf.text("Received the packages as stated above", leftX, y);
  pdf.setFont("helvetica", "bold");
  pdf.text("For V UNIT Logistics India Private Limited", rightX, y);
  y += 12;
  pdf.setFont("helvetica", "normal");
  pdf.text("Receiver Signature: __________________", leftX, y);
  pdf.text("Authorized Signatory", rightX, y);
  y += 8;
  pdf.text("Date: __________________", leftX, y);
  y += 8;
  pdf.text(`Time: ${now.time}`, leftX, y);

  const fileName = `${item.jobNumber || "import"}-delivery-challan.pdf`;
  pdf.save(fileName);
}

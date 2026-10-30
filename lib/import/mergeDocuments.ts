"use client";

import { FreightForward, FreightForwardDocument } from "@/types/freightForward";
import { collectJobDocuments } from "@/lib/import/collectJobDocuments";
import { fetchDocumentBytes } from "@/lib/import/fetchDocumentBytes";
import {
  bytesToBlob,
  looksLikePdf,
  openPdfInNewTab,
  sanitizeDownloadFileName,
  triggerBrowserDownload,
} from "@/lib/import/blobDownload";
import { mergeImportDocumentsClient } from "@/lib/import/clientDocumentMerge";
import { zipStoredFile } from "@/lib/import/zipBytes";

export type DownloadFormat = "pdf" | "zip";

export function getImportJobDocuments(item: FreightForward) {
  return collectJobDocuments(item);
}

async function deliverPdf(bytes: Uint8Array, fileName: string, format: DownloadFormat) {
  const pdfName = sanitizeDownloadFileName(fileName);
  if (format === "zip") {
    const zipName = pdfName.replace(/\.pdf$/i, ".zip");
    const zipped = zipStoredFile(pdfName, bytes);
    await triggerBrowserDownload(
      bytesToBlob(zipped, "application/zip"),
      zipName
    );
    return;
  }
  openPdfInNewTab(bytes, pdfName);
}

export async function downloadImportDocument(
  doc: FreightForwardDocument,
  format: DownloadFormat = "pdf"
) {
  if (format === "zip") {
    const pdfBytes = await mergeImportDocumentsClient([doc]);
    await deliverPdf(pdfBytes, doc.name?.trim() || "document.pdf", "zip");
    return;
  }

  const bytes = await fetchDocumentBytes(doc);
  const lower = `${doc.name ?? ""} ${doc.url}`.toLowerCase();
  const isPdf = lower.includes(".pdf") || looksLikePdf(bytes);

  if (isPdf) {
    openPdfInNewTab(bytes, doc.name?.trim() || "document.pdf");
    return;
  }

  await triggerBrowserDownload(
    bytesToBlob(bytes, "application/octet-stream"),
    doc.name?.trim() || "document"
  );
}

/** Merge documents, then open the PDF for printing or download it as a ZIP. */
export async function downloadMergedImportDocuments(
  item: FreightForward,
  jobLabel?: string,
  documents = collectJobDocuments(item),
  format: DownloadFormat = "pdf"
) {
  if (!documents.length) {
    throw new Error("No documents available to download.");
  }

  const pdfBytes = await mergeImportDocumentsClient(documents);
  const fileName = `${jobLabel || item.jobNumber || "import"}-documents.pdf`;
  await deliverPdf(pdfBytes, fileName, format);
}

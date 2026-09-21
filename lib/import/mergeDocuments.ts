"use client";

import { FreightForward, FreightForwardDocument } from "@/types/freightForward";
import { collectJobDocuments } from "@/lib/import/collectJobDocuments";
import { fetchDocumentBytes } from "@/lib/import/fetchDocumentBytes";
import {
  bytesToBlob,
  looksLikePdf,
  savePdfBytes,
  triggerBrowserDownload,
} from "@/lib/import/blobDownload";
import { mergeImportDocumentsClient } from "@/lib/import/clientDocumentMerge";

export function getImportJobDocuments(item: FreightForward) {
  return collectJobDocuments(item);
}

export async function downloadImportDocument(doc: FreightForwardDocument) {
  const bytes = await fetchDocumentBytes(doc);
  const lower = `${doc.name ?? ""} ${doc.url}`.toLowerCase();
  const isPdf = lower.includes(".pdf") || looksLikePdf(bytes);

  if (isPdf) {
    await savePdfBytes(bytes, doc.name?.trim() || "document.pdf");
    return;
  }

  await triggerBrowserDownload(
    bytesToBlob(bytes, "application/octet-stream"),
    doc.name?.trim() || "document"
  );
}

/** Merge and download in the browser — works on Firebase static hosting (no API routes). */
export async function downloadMergedImportDocuments(
  item: FreightForward,
  jobLabel?: string
) {
  const documents = collectJobDocuments(item);
  if (!documents.length) {
    throw new Error("No documents available to download.");
  }

  const pdfBytes = await mergeImportDocumentsClient(documents);
  const fileName = `${jobLabel || item.jobNumber || "import"}-documents.pdf`;
  await savePdfBytes(pdfBytes, fileName);
}

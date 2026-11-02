"use client";

import { FreightForward, FreightForwardDocument } from "@/types/freightForward";
import {
  buildZipEntryPaths,
  collectJobDocuments,
} from "@/lib/import/collectJobDocuments";
import { fetchDocumentBytes } from "@/lib/import/fetchDocumentBytes";
import {
  bytesToBlob,
  openPdfInNewTab,
  openUrlInNewTab,
  sanitizeDownloadFileName,
  triggerBrowserDownload,
} from "@/lib/import/blobDownload";
import { mergeImportDocumentsClient } from "@/lib/import/clientDocumentMerge";
import { zipStoredFiles } from "@/lib/import/zipBytes";

export type DownloadFormat = "pdf" | "zip";

export function getImportJobDocuments(item: FreightForward) {
  return collectJobDocuments(item);
}

/** Open the file URL in a new tab (view / download from the browser), like KYC. */
export function downloadImportDocument(doc: FreightForwardDocument) {
  openUrlInNewTab(doc.url);
}

async function downloadDocumentsAsZip(
  item: FreightForward,
  documents: FreightForwardDocument[],
  jobLabel?: string
) {
  const folder = sanitizeDownloadFileName(
    `${jobLabel || item.jobNumber || "import"}-documents`,
    "import-documents"
  ).replace(/\.pdf$/i, "");
  const entries = buildZipEntryPaths(documents, folder);
  const files: { path: string; data: Uint8Array }[] = [];

  for (const entry of entries) {
    try {
      const bytes = await fetchDocumentBytes(entry.doc);
      if (bytes.length) files.push({ path: entry.path, data: bytes });
    } catch {
      // Skip files that fail to fetch; continue with the rest.
    }
  }

  if (!files.length) {
    throw new Error("Unable to download documents for ZIP.");
  }

  const zipped = zipStoredFiles(files);
  await triggerBrowserDownload(
    bytesToBlob(zipped, "application/zip"),
    `${folder}.zip`
  );
}

/** Merge to PDF for print, or ZIP original files inside one folder. */
export async function downloadMergedImportDocuments(
  item: FreightForward,
  jobLabel?: string,
  documents = collectJobDocuments(item),
  format: DownloadFormat = "pdf"
) {
  if (!documents.length) {
    throw new Error("No documents available to download.");
  }

  if (format === "zip") {
    await downloadDocumentsAsZip(item, documents, jobLabel);
    return;
  }

  const pdfBytes = await mergeImportDocumentsClient(documents);
  const fileName = `${jobLabel || item.jobNumber || "import"}-documents.pdf`;
  openPdfInNewTab(pdfBytes, fileName);
}

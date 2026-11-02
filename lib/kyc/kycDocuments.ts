"use client";

import { Kyc, KycDocument } from "@/types/kyc";
import { normalizeDocArray } from "@/lib/kyc/normalizeKyc";
import { mergeImportDocumentsClient } from "@/lib/import/clientDocumentMerge";
import { DownloadFormat } from "@/lib/import/mergeDocuments";
import {
  bytesToBlob,
  openPdfInNewTab,
  openUrlInNewTab,
  sanitizeDownloadFileName,
  triggerBrowserDownload,
} from "@/lib/import/blobDownload";
import { uniqueAttachmentName } from "@/lib/import/attachments";
import { fetchDocumentBytes } from "@/lib/import/fetchDocumentBytes";
import { zipStoredFiles } from "@/lib/import/zipBytes";

export function collectKycDocuments(kyc: Kyc): KycDocument[] {
  const docs: KycDocument[] = [];
  const push = (doc?: KycDocument) => {
    if (doc?.url) docs.push(doc);
  };

  normalizeDocArray(kyc.supportingDocuments).forEach(push);
  push(kyc.gstinDocument);
  push(kyc.panDocument);
  push(kyc.iecDocument);
  push(kyc.adCodeDocument);
  push(kyc.loiDocument);
  normalizeDocArray(kyc.directorAadhar).forEach(push);
  normalizeDocArray(kyc.directorPan).forEach(push);

  const seen = new Set<string>();
  return docs.filter((doc) => {
    if (seen.has(doc.url)) return false;
    seen.add(doc.url);
    return true;
  });
}

export async function downloadMergedKycDocuments(
  kyc: Kyc,
  format: DownloadFormat = "pdf"
) {
  const documents = collectKycDocuments(kyc);
  if (!documents.length) {
    throw new Error("No documents available to download.");
  }

  const label = (kyc.fileNo || kyc.companyName || "kyc")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .trim();

  if (format === "zip") {
    const folder = sanitizeDownloadFileName(
      `${label}-documents`,
      "kyc-documents"
    ).replace(/\.pdf$/i, "");
    const used = new Set<string>();
    const files: { path: string; data: Uint8Array }[] = [];
    for (const [index, doc] of documents.entries()) {
      try {
        const bytes = await fetchDocumentBytes(doc);
        if (!bytes.length) continue;
        files.push({
          path: `${folder}/${uniqueAttachmentName(doc.name, used, `document-${index + 1}`)}`,
          data: bytes,
        });
      } catch {
        // Skip failed files.
      }
    }
    if (!files.length) {
      throw new Error("Unable to download documents for ZIP.");
    }
    await triggerBrowserDownload(
      bytesToBlob(zipStoredFiles(files), "application/zip"),
      `${folder}.zip`
    );
    return;
  }

  const pdfBytes = await mergeImportDocumentsClient(documents);
  openPdfInNewTab(pdfBytes, sanitizeDownloadFileName(`${label}-documents.pdf`));
}

/** Open the file URL in a new tab so the user can view and download it there. */
export function downloadKycDocument(doc: KycDocument) {
  openUrlInNewTab(doc.url);
}

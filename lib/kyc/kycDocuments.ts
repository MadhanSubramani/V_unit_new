"use client";

import { Kyc, KycDocument } from "@/types/kyc";
import { normalizeDocArray } from "@/lib/kyc/normalizeKyc";
import { mergeImportDocumentsClient } from "@/lib/import/clientDocumentMerge";
import { DownloadFormat } from "@/lib/import/mergeDocuments";
import {
  bytesToBlob,
  openPdfInNewTab,
  sanitizeDownloadFileName,
  triggerBrowserDownload,
} from "@/lib/import/blobDownload";
import { zipStoredFile } from "@/lib/import/zipBytes";

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

  const pdfBytes = await mergeImportDocumentsClient(documents);
  const label = (kyc.fileNo || kyc.companyName || "kyc")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .trim();
  const pdfName = sanitizeDownloadFileName(`${label}-documents.pdf`);
  if (format === "zip") {
    const zipName = pdfName.replace(/\.pdf$/i, ".zip");
    await triggerBrowserDownload(
      bytesToBlob(zipStoredFile(pdfName, pdfBytes), "application/zip"),
      zipName
    );
    return;
  }
  openPdfInNewTab(pdfBytes, pdfName);
}

export async function downloadKycDocument(doc: KycDocument, format: DownloadFormat) {
  if (format === "zip") {
    const pdfBytes = await mergeImportDocumentsClient([doc]);
    const pdfName = sanitizeDownloadFileName(doc.name || "document.pdf");
    const zipName = pdfName.replace(/\.pdf$/i, ".zip");
    await triggerBrowserDownload(
      bytesToBlob(zipStoredFile(pdfName, pdfBytes), "application/zip"),
      zipName
    );
    return;
  }
  try {
    const pdfBytes = await mergeImportDocumentsClient([doc]);
    openPdfInNewTab(
      pdfBytes,
      sanitizeDownloadFileName(doc.name || "document.pdf")
    );
  } catch {
    window.open(doc.url, "_blank");
  }
}

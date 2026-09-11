"use client";

import { Kyc, KycDocument } from "@/types/kyc";
import { normalizeDocArray } from "@/lib/kyc/normalizeKyc";
import { mergeImportDocumentsClient } from "@/lib/import/clientDocumentMerge";
import { savePdfBytes } from "@/lib/import/blobDownload";

export function collectKycDocuments(kyc: Kyc): KycDocument[] {
  const docs: KycDocument[] = [];
  const push = (doc?: KycDocument) => {
    if (doc?.url) docs.push(doc);
  };

  push(kyc.gstinDocument);
  push(kyc.panDocument);
  push(kyc.iecDocument);
  push(kyc.adCodeDocument);
  push(kyc.loiDocument);
  normalizeDocArray(kyc.directorAadhar).forEach(push);
  normalizeDocArray(kyc.directorPan).forEach(push);
  normalizeDocArray(kyc.supportingDocuments).forEach(push);

  const seen = new Set<string>();
  return docs.filter((doc) => {
    if (seen.has(doc.url)) return false;
    seen.add(doc.url);
    return true;
  });
}

export async function downloadMergedKycDocuments(kyc: Kyc) {
  const documents = collectKycDocuments(kyc);
  if (!documents.length) {
    throw new Error("No documents available to download.");
  }

  const pdfBytes = await mergeImportDocumentsClient(documents);
  const label = (kyc.fileNo || kyc.companyName || "kyc")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .trim();
  await savePdfBytes(pdfBytes, `${label}-documents.pdf`);
}

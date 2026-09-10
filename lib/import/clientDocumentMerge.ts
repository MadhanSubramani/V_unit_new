"use client";

import { PDFDocument } from "pdf-lib";
import { FreightForwardDocument } from "@/types/freightForward";
import { fetchDocumentBytes } from "@/lib/import/fetchDocumentBytes";
import { looksLikePdf } from "@/lib/import/blobDownload";

function isPdf(url: string, name?: string) {
  const target = `${name ?? ""} ${url}`.toLowerCase();
  return target.includes(".pdf");
}

function isPng(url: string, name?: string) {
  const target = `${name ?? ""} ${url}`.toLowerCase();
  return target.includes(".png");
}

function isImage(url: string, name?: string) {
  const target = `${name ?? ""} ${url}`.toLowerCase();
  return /\.(png|jpe?g|webp|gif)(\?|$)/.test(target);
}

export async function mergeImportDocumentsClient(
  documents: FreightForwardDocument[]
) {
  const merged = await PDFDocument.create();
  const failures: string[] = [];

  for (const doc of documents) {
    const label = doc.name?.trim() || "document";
    try {
      const bytes = await fetchDocumentBytes(doc);
      if (!bytes.length) {
        throw new Error("Empty file");
      }

      const pdfCandidate = isPdf(doc.url, doc.name) || looksLikePdf(bytes);
      if (pdfCandidate) {
        const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
        continue;
      }

      if (isImage(doc.url, doc.name)) {
        const page = merged.addPage([595, 842]);
        const embedded = isPng(doc.url, doc.name)
          ? await merged.embedPng(bytes)
          : await merged.embedJpg(bytes);
        const scale = Math.min(
          page.getWidth() / embedded.width,
          page.getHeight() / embedded.height
        );
        const width = embedded.width * scale;
        const height = embedded.height * scale;
        page.drawImage(embedded, {
          x: (page.getWidth() - width) / 2,
          y: (page.getHeight() - height) / 2,
          width,
          height,
        });
        continue;
      }

      failures.push(label);
    } catch (error) {
      failures.push(
        error instanceof Error ? error.message : `${label}: Failed to fetch`
      );
    }
  }

  if (merged.getPageCount() === 0) {
    throw new Error(
      failures.length
        ? `Unable to merge documents: ${failures.join("; ")}`
        : "No supported documents could be merged."
    );
  }

  const pdfBytes = await merged.save({ useObjectStreams: false });
  const copy = new Uint8Array(pdfBytes.length);
  copy.set(pdfBytes);

  if (!looksLikePdf(copy)) {
    throw new Error("Merged file is not a valid PDF.");
  }

  return copy;
}

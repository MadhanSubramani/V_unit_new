import { PDFDocument } from "pdf-lib";
import { FreightForward, FreightForwardDocument } from "@/types/freightForward";

function collectJobDocuments(item: FreightForward): FreightForwardDocument[] {
  const docs: FreightForwardDocument[] = [];
  const push = (doc?: FreightForwardDocument) => {
    if (doc?.url) docs.push(doc);
  };
  push(item.mblUrl);
  push(item.hblUrl);
  (item.mblDocs ?? []).forEach(push);
  (item.hblDocs ?? []).forEach(push);
  (item.otherDocuments ?? []).forEach(push);
  const seen = new Set<string>();
  return docs.filter((doc) => {
    if (seen.has(doc.url)) return false;
    seen.add(doc.url);
    return true;
  });
}

export function getImportJobDocuments(item: FreightForward) {
  return collectJobDocuments(item);
}

function isPdf(url: string, name?: string) {
  const target = `${name ?? ""} ${url}`.toLowerCase();
  return target.includes(".pdf");
}

function isImage(url: string, name?: string) {
  const target = `${name ?? ""} ${url}`.toLowerCase();
  return /\.(png|jpe?g|webp|gif)(\?|$)/.test(target);
}

async function mergeDocumentsClient(documents: FreightForwardDocument[]) {
  const merged = await PDFDocument.create();
  const failures: string[] = [];

  for (const doc of documents) {
    try {
      const response = await fetch(doc.url);
      if (!response.ok) {
        failures.push(doc.name || doc.url);
        continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());

      if (isPdf(doc.url, doc.name)) {
        const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
        continue;
      }

      if (isImage(doc.url, doc.name)) {
        const page = merged.addPage([595, 842]);
        const lower = `${doc.name ?? ""} ${doc.url}`.toLowerCase();
        const embedded = lower.includes(".png") || lower.includes(".webp")
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

      failures.push(doc.name || doc.url);
    } catch {
      failures.push(doc.name || doc.url);
    }
  }

  if (merged.getPageCount() === 0) {
    throw new Error(
      failures.length
        ? `Unable to merge documents: ${failures.join(", ")}`
        : "No supported documents could be merged."
    );
  }

  return merged.save();
}

export async function downloadImportDocument(doc: FreightForwardDocument) {
  const response = await fetch(doc.url);
  if (!response.ok) {
    throw new Error("Unable to download file.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = doc.name?.trim() || "document";
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadMergedImportDocuments(
  item: FreightForward,
  jobLabel?: string
) {
  const documents = collectJobDocuments(item);
  if (!documents.length) {
    throw new Error("No documents available to download.");
  }

  const pdfBytes = await mergeDocumentsClient(documents);
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${jobLabel || item.jobNumber || "import"}-documents.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

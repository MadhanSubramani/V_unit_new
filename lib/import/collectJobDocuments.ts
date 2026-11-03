import { FreightForward, FreightForwardDocument } from "@/types/freightForward";
import { getHblEntries } from "@/lib/import/hbl";
import {
  normalizeAttachments,
  uniqueAttachmentName,
} from "@/lib/import/attachments";
import { getImportTruckDetails } from "@/lib/import/transportWorkflow";

function push(
  docs: FreightForwardDocument[],
  doc?: FreightForwardDocument | null
) {
  if (doc?.url) docs.push(doc);
}

function pushAll(
  docs: FreightForwardDocument[],
  value: FreightForwardDocument | FreightForwardDocument[] | null | undefined
) {
  normalizeAttachments(value).forEach((doc) => push(docs, doc));
}

function dedupe(docs: FreightForwardDocument[]) {
  const seen = new Set<string>();
  return docs.filter((doc) => {
    if (seen.has(doc.url)) return false;
    seen.add(doc.url);
    return true;
  });
}

function withFallbackName(doc: FreightForwardDocument, fallback: string) {
  return {
    ...doc,
    name: doc.name?.trim() || fallback,
  };
}

/**
 * Download-all order:
 * IGM, INVOICE, PACKING LIST, MBL, HBL, OTHER SUPPORTING DOCS,
 * DO INVOICE, Z-CHECKLIST, Ewaybill, Z BE, T BE, DISPATCH ADVICE, TAX INVOICE
 * (+ remaining section files after).
 */
export function collectJobDocuments(item: FreightForward): FreightForwardDocument[] {
  const docs: FreightForwardDocument[] = [];

  normalizeAttachments(item.importIgmAttachment).forEach((doc, index) =>
    push(docs, withFallbackName(doc, `IGM${index ? `-${index + 1}` : ""}`))
  );
  normalizeAttachments(item.importCommercialInvoiceAttachment).forEach((doc, index) =>
    push(docs, withFallbackName(doc, `INVOICE${index ? `-${index + 1}` : ""}`))
  );
  normalizeAttachments(item.importPackingListAttachment).forEach((doc, index) =>
    push(docs, withFallbackName(doc, `PACKING LIST${index ? `-${index + 1}` : ""}`))
  );

  push(docs, item.mblUrl ? withFallbackName(item.mblUrl, "MBL") : undefined);
  (item.mblDocs ?? []).forEach((doc, index) =>
    push(docs, withFallbackName(doc, `MBL-${index + 1}`))
  );

  push(docs, item.hblUrl ? withFallbackName(item.hblUrl, "HBL") : undefined);
  (item.hblDocs ?? []).forEach((doc, index) =>
    push(docs, withFallbackName(doc, `HBL-${index + 1}`))
  );
  getHblEntries(item).forEach((entry, index) =>
    push(docs, entry.file ? withFallbackName(entry.file, `HBL-${index + 1}`) : undefined)
  );

  normalizeAttachments(item.importZtypeOtherAttachments).forEach((doc, index) =>
    push(
      docs,
      withFallbackName(doc, `OTHER DOCS${index ? `-${index + 1}` : ""}`)
    )
  );
  (item.otherDocuments ?? []).forEach((doc, index) =>
    push(docs, withFallbackName(doc, `OTHER SUPPORTING DOCS-${index + 1}`))
  );

  normalizeAttachments(item.importDoInvoiceAttachment).forEach((doc, index) =>
    push(docs, withFallbackName(doc, `DO INVOICE${index ? `-${index + 1}` : ""}`))
  );
  normalizeAttachments(item.importBoeChecklistAttachment).forEach((doc, index) =>
    push(docs, withFallbackName(doc, `Z-CHECKLIST${index ? `-${index + 1}` : ""}`))
  );
  normalizeAttachments(item.importEwayBillAttachment).forEach((doc, index) =>
    push(docs, withFallbackName(doc, `Ewaybill${index ? `-${index + 1}` : ""}`))
  );
  normalizeAttachments(item.importInwardBoeAttachment).forEach((doc, index) =>
    push(docs, withFallbackName(doc, `Z BE${index ? `-${index + 1}` : ""}`))
  );
  normalizeAttachments(item.importTTypeBoeAttachment).forEach((doc, index) =>
    push(docs, withFallbackName(doc, `T BE${index ? `-${index + 1}` : ""}`))
  );
  normalizeAttachments(item.importDispatchAdviceAttachment).forEach((doc, index) =>
    push(
      docs,
      withFallbackName(doc, `DISPATCH ADVICE${index ? `-${index + 1}` : ""}`)
    )
  );
  normalizeAttachments(item.importAccountsTaxInvoiceAttachment).forEach((doc, index) =>
    push(docs, withFallbackName(doc, `TAX INVOICE${index ? `-${index + 1}` : ""}`))
  );

  // Remaining section files (kept after the required download order).
  pushAll(docs, item.importDoPortAttachment);
  pushAll(docs, item.importDoEmptyAttachment);
  pushAll(docs, item.importOccAttachment);
  getImportTruckDetails(item).forEach((truck) =>
    pushAll(docs, truck.importTruckStashAttachment)
  );

  return dedupe(docs);
}

/**
 * CMFC download / merge order:
 * IGM, INVOICE, PACKING LIST, MBL, HBL, OTHER DOCS (ztype other docs)
 */
export function collectCmfcPrintDocuments(item: FreightForward): FreightForwardDocument[] {
  const docs: FreightForwardDocument[] = [];

  normalizeAttachments(item.importIgmAttachment).forEach((doc, index) =>
    push(docs, withFallbackName(doc, `IGM${index ? `-${index + 1}` : ""}`))
  );
  normalizeAttachments(item.importCommercialInvoiceAttachment).forEach((doc, index) =>
    push(docs, withFallbackName(doc, `INVOICE${index ? `-${index + 1}` : ""}`))
  );
  normalizeAttachments(item.importPackingListAttachment).forEach((doc, index) =>
    push(docs, withFallbackName(doc, `PACKING LIST${index ? `-${index + 1}` : ""}`))
  );

  push(docs, item.mblUrl ? withFallbackName(item.mblUrl, "MBL") : undefined);
  (item.mblDocs ?? []).forEach((doc, index) =>
    push(docs, withFallbackName(doc, `MBL-${index + 1}`))
  );

  push(docs, item.hblUrl ? withFallbackName(item.hblUrl, "HBL") : undefined);
  (item.hblDocs ?? []).forEach((doc, index) =>
    push(docs, withFallbackName(doc, `HBL-${index + 1}`))
  );
  getHblEntries(item).forEach((entry, index) =>
    push(docs, entry.file ? withFallbackName(entry.file, `HBL-${index + 1}`) : undefined)
  );

  normalizeAttachments(item.importZtypeOtherAttachments).forEach((doc, index) =>
    push(
      docs,
      withFallbackName(doc, `OTHER DOCS${index ? `-${index + 1}` : ""}`)
    )
  );

  return dedupe(docs);
}

export function buildZipEntryPaths(
  documents: FreightForwardDocument[],
  folderName: string
) {
  const used = new Set<string>();
  return documents.map((doc, index) => ({
    doc,
    path: `${folderName}/${uniqueAttachmentName(doc.name, used, `document-${index + 1}`)}`,
  }));
}

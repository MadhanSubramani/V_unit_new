import { FreightForward, FreightForwardDocument } from "@/types/freightForward";
import { getHblEntries } from "@/lib/import/hbl";

function push(
  docs: FreightForwardDocument[],
  doc?: FreightForwardDocument | null
) {
  if (doc?.url) docs.push(doc);
}

export function collectJobDocuments(item: FreightForward): FreightForwardDocument[] {
  const docs: FreightForwardDocument[] = [];
  push(docs, item.importIgmAttachment);
  push(docs, item.mblUrl);
  (item.mblDocs ?? []).forEach((doc) => push(docs, doc));
  push(docs, item.hblUrl);
  (item.hblDocs ?? []).forEach((doc) => push(docs, doc));
  getHblEntries(item).forEach((entry) => push(docs, entry.file));
  push(docs, item.importBoeChecklistAttachment);
  push(docs, item.importCommercialInvoiceAttachment);
  push(docs, item.importPackingListAttachment);
  push(docs, item.importInwardBoeAttachment);
  push(docs, item.importOccAttachment);
  push(docs, item.importTTypeBoeAttachment);
  push(docs, item.importDoInvoiceAttachment);
  (item.otherDocuments ?? []).forEach((doc) => push(docs, doc));

  const seen = new Set<string>();
  return docs.filter((doc) => {
    if (seen.has(doc.url)) return false;
    seen.add(doc.url);
    return true;
  });
}

export function collectCmfcPrintDocuments(item: FreightForward): FreightForwardDocument[] {
  const docs: FreightForwardDocument[] = [];
  push(docs, item.importIgmAttachment);
  push(docs, item.mblUrl);
  (item.mblDocs ?? []).forEach((doc) => push(docs, doc));
  push(docs, item.hblUrl);
  (item.hblDocs ?? []).forEach((doc) => push(docs, doc));
  getHblEntries(item).forEach((entry) => push(docs, entry.file));
  push(docs, item.importCommercialInvoiceAttachment);
  push(docs, item.importPackingListAttachment);
  (item.otherDocuments ?? []).forEach((doc) => push(docs, doc));
  const seen = new Set<string>();
  return docs.filter((doc) => {
    if (seen.has(doc.url)) return false;
    seen.add(doc.url);
    return true;
  });
}

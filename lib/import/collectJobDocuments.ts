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
  push(docs, item.importDoPortAttachment);
  push(docs, item.importDoEmptyAttachment);
  push(docs, item.importBoeChecklistAttachment);
  (item.otherDocuments ?? []).forEach((doc) => push(docs, doc));

  const seen = new Set<string>();
  return docs.filter((doc) => {
    if (seen.has(doc.url)) return false;
    seen.add(doc.url);
    return true;
  });
}

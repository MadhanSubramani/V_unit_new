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

export async function downloadMergedImportDocuments(
  item: FreightForward,
  jobLabel?: string
) {
  const documents = collectJobDocuments(item);
  if (!documents.length) {
    throw new Error("No documents available to download.");
  }

  const response = await fetch("/api/import/merge-documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error ?? "Unable to merge documents.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${jobLabel || item.jobNumber || "import"}-documents.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

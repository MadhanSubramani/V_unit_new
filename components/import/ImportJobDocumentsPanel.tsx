"use client";

import { useState } from "react";
import ImportDocumentLink from "@/components/import/ImportDocumentLink";
import {
  downloadMergedImportDocuments,
  getImportJobDocuments,
} from "@/lib/import/mergeDocuments";
import { FreightForward } from "@/types/freightForward";

export default function ImportJobDocumentsPanel({
  item,
}: {
  item: FreightForward;
}) {
  const documents = getImportJobDocuments(item);

  return (
    <div className="border-t border-zinc-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Documents
        </p>
        <DocumentsDownloadAll item={item} disabled={!documents.length} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {documents.length === 0 ? (
          <p className="text-[11px] text-zinc-400">No documents uploaded.</p>
        ) : (
          documents.map((doc, index) => (
            <ImportDocumentLink
              key={`${doc.url}-${index}`}
              label={doc.name || `Document ${index + 1}`}
              doc={doc}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DocumentsDownloadAll({
  item,
  disabled,
}: {
  item: FreightForward;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleDownload = async (event: React.MouseEvent) => {
    event.stopPropagation();
    setBusy(true);
    setError("");
    try {
      await downloadMergedImportDocuments(item);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to download documents."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-right" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        disabled={busy || disabled}
        onClick={(event) => void handleDownload(event)}
        className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
      >
        {busy ? "Preparing..." : "Download all"}
      </button>
      {error && <p className="mt-1 text-[10px] text-red-500">{error}</p>}
    </div>
  );
}

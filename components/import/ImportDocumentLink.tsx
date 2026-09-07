"use client";

import { useState } from "react";
import { FreightForwardDocument } from "@/types/freightForward";
import { downloadImportDocument } from "@/lib/import/mergeDocuments";

export default function ImportDocumentLink({
  label,
  doc,
}: {
  label: string;
  doc?: FreightForwardDocument;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!doc?.url) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-[11px] text-zinc-400">
        {label}: not uploaded
      </div>
    );
  }

  const handleClick = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setBusy(true);
    setError("");
    try {
      await downloadImportDocument(doc);
    } catch {
      window.open(doc.url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={(event) => void handleClick(event)}
      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-[11px] font-medium text-zinc-800 transition hover:bg-white disabled:opacity-50"
    >
      <span className="block text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <span className="mt-0.5 block truncate">
        {busy ? "Downloading..." : doc.name || "Download file"}
      </span>
      {error && <span className="mt-1 block text-[10px] text-red-500">{error}</span>}
    </button>
  );
}

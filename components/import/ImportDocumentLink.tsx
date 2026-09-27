"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";
import { FreightForwardDocument } from "@/types/freightForward";
import { downloadImportDocument } from "@/lib/import/mergeDocuments";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

export default function ImportDocumentLink({
  label,
  doc,
  variant = "full",
  onRemove,
  removeDisabled,
}: {
  label: string;
  doc?: FreightForwardDocument;
  variant?: "full" | "icon";
  onRemove?: () => void;
  removeDisabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!doc?.url) {
    if (variant === "icon") return null;
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

  const removeButton = onRemove ? (
    <button
      type="button"
      disabled={busy || removeDisabled}
      title="Remove file"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setConfirmRemove(true);
      }}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40"
    >
      <X size={12} />
    </button>
  ) : null;

  const dialog = (
    <ConfirmDialog
      open={confirmRemove}
      title={`Remove ${label}`}
      message="Remove this file and delete it from storage so a new file can be uploaded in its place?"
      confirmLabel="Remove"
      onCancel={() => setConfirmRemove(false)}
      onConfirm={() => {
        setConfirmRemove(false);
        onRemove?.();
      }}
    />
  );

  if (variant === "icon") {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          disabled={busy}
          title={busy ? "Downloading..." : `${label}: ${doc.name || "Download"}`}
          onClick={(event) => void handleClick(event)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
        >
          <Download size={14} />
        </button>
        {removeButton}
        {dialog}
      </span>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={(event) => void handleClick(event)}
        className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-[11px] font-medium text-zinc-800 transition hover:bg-white disabled:opacity-50"
      >
        <span className="block text-[10px] uppercase tracking-wide text-zinc-500">
          {label}
        </span>
        <span className="mt-0.5 block truncate">
          {busy ? "Downloading..." : doc.name || "Download file"}
        </span>
        {error && <span className="mt-1 block text-[10px] text-red-500">{error}</span>}
      </button>
      {removeButton}
      {dialog}
    </div>
  );
}

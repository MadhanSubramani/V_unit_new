"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import ImportDocumentLink from "@/components/import/ImportDocumentLink";
import FileInputWithClip from "@/components/import/FileInputWithClip";
import {
  downloadMergedImportDocuments,
  getImportJobDocuments,
} from "@/lib/import/mergeDocuments";
import {
  appendImportOtherDocuments,
  setImportOtherDocuments,
} from "@/lib/freightForward/freightForward";
import { uploadDocument } from "@/lib/kyc/uploadDocument";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { deleteStorageFileByUrl } from "@/lib/freightForward/deleteStorage";
import { FreightForward, FreightForwardDocument } from "@/types/freightForward";

export default function ImportJobDocumentsPanel({
  item,
  canManage = false,
  username = "Unknown",
  onUpdated,
}: {
  item: FreightForward;
  canManage?: boolean;
  username?: string;
  onUpdated?: (item: FreightForward) => void;
}) {
  const documents = getImportJobDocuments(item);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
  const supporting = item.otherDocuments ?? [];

  const addDoc = async () => {
    if (!item.id || !name.trim() || !file) return;
    setBusy(true);
    setError("");
    try {
      const uploaded = await uploadDocument(file, "freight-forward/other-documents");
      const updated = await appendImportOtherDocuments(
        item.id,
        [{ name: name.trim(), url: uploaded.url }],
        username
      );
      setName("");
      setFile(null);
      onUpdated?.(updated);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Unable to add document.");
    } finally {
      setBusy(false);
    }
  };

  const removeSupporting = async (index: number) => {
    if (!item.id) return;
    const target = supporting[index];
    setBusy(true);
    setError("");
    try {
      await deleteStorageFileByUrl(target?.url);
      const next = supporting.filter((_, i) => i !== index);
      const updated = await setImportOtherDocuments(item.id, next, username);
      onUpdated?.(updated);
    } catch (removeError) {
      setError(
        removeError instanceof Error ? removeError.message : "Unable to delete document."
      );
    } finally {
      setBusy(false);
      setConfirmIndex(null);
    }
  };

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

      {canManage && (
        <div
          className="mt-3 space-y-2 rounded-xl border border-zinc-200 p-3"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Supporting documents
          </p>
          {supporting.map((doc, index) => (
            <div key={`${doc.url}-${index}`} className="flex items-center justify-between gap-2">
              <ImportDocumentLink label={doc.name || `Document ${index + 1}`} doc={doc} />
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmIndex(index)}
                className="rounded-lg border border-zinc-200 p-1 text-zinc-500"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Document name"
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-[11px]"
            />
            <button
              type="button"
              onClick={() => void addDoc()}
              disabled={busy || !name.trim() || !file}
              className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
            >
              <Plus size={12} />
              Add
            </button>
          </div>
          <FileInputWithClip onChange={setFile} disabled={busy} />
          {error && <p className="text-[10px] text-red-500">{error}</p>}
        </div>
      )}
      <ConfirmDialog
        open={confirmIndex !== null}
        title="Remove supporting document"
        message="Remove this document from the job and delete the file from storage?"
        confirmLabel="Remove"
        onCancel={() => setConfirmIndex(null)}
        onConfirm={() => {
          if (confirmIndex !== null) void removeSupporting(confirmIndex);
        }}
      />
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

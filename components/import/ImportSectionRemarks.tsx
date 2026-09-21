"use client";

import { useState } from "react";
import { ImportFreeRemark } from "@/types/freightForward";
import { formatImportAuditDate } from "@/lib/import/auditDisplay";

export default function ImportSectionRemarks({
  title = "Remarks",
  remarks,
  busy,
  canAct,
  onAdd,
}: {
  title?: string;
  remarks: ImportFreeRemark[];
  busy: boolean;
  canAct: boolean;
  onAdd: (text: string) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState("");

  return (
    <div
      className="mt-3 space-y-2"
      onClick={(event) => event.stopPropagation()}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      {canAct && (
        <div className="flex gap-2">
          <textarea
            value={draft}
            disabled={busy}
            rows={2}
            placeholder="Add remark..."
            onChange={(event) => setDraft(event.target.value)}
            className="min-w-0 flex-1 resize-none rounded-lg border border-zinc-200 px-2.5 py-2 text-[11px] outline-none focus:border-zinc-500"
          />
          <button
            type="button"
            disabled={busy || !draft.trim()}
            onClick={async () => {
              const text = draft.trim();
              if (!text) return;
              await onAdd(text);
              setDraft("");
            }}
            className="self-end rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
          >
            +
          </button>
        </div>
      )}
      {remarks.length === 0 ? (
        <p className="text-[11px] text-zinc-400">No remarks yet.</p>
      ) : (
        remarks.map((entry, index) => (
          <div
            key={`${entry.updatedAt ?? index}-${index}`}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-[11px]"
          >
            <p className="font-medium text-zinc-800">{entry.text}</p>
            <p className="mt-0.5 text-zinc-500">
              {entry.updatedBy} · {formatImportAuditDate(entry.updatedAt)}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

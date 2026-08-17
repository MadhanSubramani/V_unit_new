"use client";

import { ImportAuditStamp } from "@/types/freightForward";
import { formatImportAuditDate } from "@/lib/import/auditDisplay";

export default function ImportAuditLine({
  audit,
  emptyLabel = "No update yet.",
}: {
  audit?: ImportAuditStamp;
  emptyLabel?: string;
}) {
  if (!audit?.updatedBy) {
    return <p className="mt-3 text-[11px] text-zinc-400">{emptyLabel}</p>;
  }

  return (
    <div className="mt-3 border-t border-zinc-200/70 pt-3 text-[11px] text-zinc-500">
      <p>
        Updated by{" "}
        <span className="font-medium text-zinc-800">{audit.updatedBy}</span>
      </p>
      <p className="mt-0.5 text-zinc-400">
        {formatImportAuditDate(audit.updatedAt)}
      </p>
    </div>
  );
}

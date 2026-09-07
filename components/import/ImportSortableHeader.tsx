"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ImportSortDir, ImportSortKey } from "@/lib/import/sortImportRecords";

export default function ImportSortableHeader({
  label,
  sortKey,
  activeSortKey,
  sortDir,
  onSort,
  className = "px-3 py-3 font-semibold",
}: {
  label: string;
  sortKey: ImportSortKey;
  activeSortKey: ImportSortKey;
  sortDir: ImportSortDir;
  onSort: (key: ImportSortKey) => void;
  className?: string;
}) {
  const active = activeSortKey === sortKey;
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-zinc-800"
      >
        {label}
        <Icon size={12} className={active ? "text-zinc-900" : "text-zinc-400"} />
      </button>
    </th>
  );
}

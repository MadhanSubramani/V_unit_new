"use client";

import { useMemo } from "react";
import { FreightForward } from "@/types/freightForward";
import { getImportCurrentStatus } from "@/lib/import/currentStatus";
import type { ImportModuleKey } from "@/types/importRoles";
import { matchesImportSearch } from "@/lib/import/searchRecords";
import {
  ImportSortDir,
  ImportSortKey,
  sortImportRecords,
} from "@/lib/import/sortImportRecords";

export function useImportTableRows<T extends FreightForward>({
  records,
  module,
  search,
  page,
  pageSize = 10,
  sortKey,
  sortDir,
  activeCard,
  matchesCard,
  excludeFromList,
}: {
  records: T[];
  module: ImportModuleKey;
  search: string;
  page: number;
  pageSize?: number;
  sortKey: ImportSortKey;
  sortDir: ImportSortDir;
  activeCard?: string | null;
  matchesCard?: (item: T, card: string) => boolean;
  excludeFromList?: (item: T, activeCard: string | null) => boolean;
}) {
  return useMemo(() => {
    let list = records.filter((item) => {
      if (excludeFromList?.(item, activeCard ?? null)) return false;
      if (activeCard && matchesCard && !matchesCard(item, activeCard)) return false;
      return matchesImportSearch(item, search, module);
    });
    list = sortImportRecords(list, sortKey, sortDir) as T[];
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    const visibleRows = list.slice(page * pageSize, (page + 1) * pageSize);
    return { filtered: list, totalPages, visibleRows };
  }, [
    records,
    module,
    search,
    page,
    pageSize,
    sortKey,
    sortDir,
    activeCard,
    matchesCard,
    excludeFromList,
  ]);
}

export function ImportCurrentStatusCell({
  item,
  module,
  width = 130,
}: {
  item: FreightForward;
  module: ImportModuleKey;
  width?: number;
}) {
  const label = getImportCurrentStatus(item, module);
  const completed = label === "Completed";
  return (
    <td className="px-3 py-3">
      <span
        className={`inline-block max-w-[130px] truncate rounded-full px-2 py-0.5 text-[10px] font-medium ${
          completed
            ? "bg-zinc-900 font-semibold text-white"
            : "bg-zinc-100 text-zinc-700"
        }`}
        style={{ maxWidth: width }}
        title={label}
      >
        {label}
      </span>
    </td>
  );
}

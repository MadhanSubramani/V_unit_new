"use client";

import { FreightForward } from "@/types/freightForward";
import { formatEzDate } from "@/lib/import/hbl";

export function ImportEzCell({
  item,
  width = 105,
}: {
  item: FreightForward;
  width?: number;
}) {
  const ezDate = formatEzDate(item);
  return (
    <td className="px-3 py-3">
      <span className="block truncate font-medium text-zinc-800" style={{ maxWidth: width }}>
        {item.ezRefNumber || "—"}
      </span>
      <span className="mt-0.5 block truncate text-[10px] text-zinc-400">
        {ezDate || "—"}
      </span>
    </td>
  );
}

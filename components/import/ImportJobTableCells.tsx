"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FreightForward } from "@/types/freightForward";

export function importLocationLabel(item: FreightForward) {
  return item.locationType === "sez"
    ? item.sez || "—"
    : item.cfs || item.sez || "—";
}

export function ImportTableCell({
  value,
  width = 150,
  className = "",
}: {
  value: unknown;
  width?: number;
  className?: string;
}) {
  const text = String(value || "—");
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [tooltip, setTooltip] = useState<{ left: number; top: number } | null>(
    null
  );

  const showTooltip = (cell: HTMLElement) => {
    const content = textRef.current;
    if (text === "—" || !content) return;
    if (content.scrollWidth - content.clientWidth < 1) return;

    const rect = cell.getBoundingClientRect();
    const tooltipWidth = Math.min(320, window.innerWidth - 16);
    setTooltip({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - tooltipWidth - 8)),
      top: rect.bottom + 6,
    });
  };

  return (
    <td
      className={`px-3 py-3 ${className}`}
      onMouseEnter={(event) => showTooltip(event.currentTarget)}
      onMouseLeave={() => setTooltip(null)}
    >
      <span
        ref={textRef}
        className="block truncate whitespace-nowrap"
        style={{ maxWidth: width }}
      >
        {text}
      </span>
      {tooltip &&
        createPortal(
          <span
            className="pointer-events-none fixed z-[9999] max-w-80 whitespace-normal break-words rounded-md bg-zinc-950 px-2.5 py-1.5 text-[11px] leading-4 text-white shadow-lg"
            style={{ left: tooltip.left, top: tooltip.top }}
          >
            {text}
          </span>,
          document.body
        )}
    </td>
  );
}

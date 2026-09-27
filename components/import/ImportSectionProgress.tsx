"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import {
  ImportProgressDetail,
  ImportProgressStep,
} from "@/lib/import/sectionProgress";

export default function ImportSectionProgress({
  steps,
}: {
  steps: ImportProgressStep[];
}) {
  const done = steps.filter((step) => step.complete).length;

  return (
    <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Module status
        </p>
        <p className="text-[10px] font-medium text-zinc-500">
          {done} / {steps.length} modules complete
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step) => (
          <StatusTile key={step.key} step={step} />
        ))}
      </div>
    </div>
  );
}

function StatusTile({ step }: { step: ImportProgressStep }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ bottom: 0, left: 0, maxHeight: 320 });

  const clearClose = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 340;
    let left = rect.left;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }
    const gap = 10;
    const maxHeight = Math.max(160, rect.top - gap - 12);
    clearClose();
    setCoords({
      bottom: window.innerHeight - rect.top + gap,
      left,
      maxHeight,
    });
    setOpen(true);
  };

  const hideSoon = () => {
    clearClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  };

  useEffect(() => () => clearClose(), []);

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        className={`rounded-lg border px-2.5 py-2 ${
          step.complete
            ? "border-zinc-300 bg-white"
            : "border-dashed border-zinc-200 bg-zinc-50"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
              step.complete
                ? "bg-zinc-900 text-white"
                : "border border-zinc-300 bg-white"
            }`}
          >
            {step.complete ? <Check size={10} strokeWidth={3} /> : null}
          </span>
          <p className="text-[11px] font-semibold text-zinc-800">{step.label}</p>
        </div>
        <p
          className={`mt-1 text-[10px] font-medium ${
            step.complete ? "text-zinc-800" : "text-zinc-500"
          }`}
        >
          {step.complete ? "Completed" : "Pending"}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-zinc-600">
          Last updated by{" "}
          <span className="font-medium text-zinc-800">
            {step.updatedBy || "—"}
          </span>
        </p>
        <p className="truncate text-[10px] text-zinc-400">{step.updatedAtLabel}</p>
      </div>
      {open ? (
        <StatusHoverCard
          step={step}
          bottom={coords.bottom}
          left={coords.left}
          maxHeight={coords.maxHeight}
          onEnter={() => {
            clearClose();
            setOpen(true);
          }}
          onLeave={hideSoon}
        />
      ) : null}
    </>
  );
}

function StatusHoverCard({
  step,
  bottom,
  left,
  maxHeight,
  onEnter,
  onLeave,
}: {
  step: ImportProgressStep;
  bottom: number;
  left: number;
  maxHeight: number;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        position: "fixed",
        bottom,
        left,
        width: 340,
        maxHeight,
        zIndex: 80,
      }}
      className="overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3 shadow-xl"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-zinc-900">{step.label}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            step.complete
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {step.complete ? "Completed" : "Pending"}
        </span>
      </div>
      <div className="space-y-2">
        {(step.details ?? []).map((row, index) => (
          <DetailRow key={`${row.label}-${index}`} row={row} />
        ))}
      </div>
    </div>,
    document.body
  );
}

function DetailRow({ row }: { row: ImportProgressDetail }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-2.5 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {row.label}
      </p>
      <p className="mt-0.5 break-words text-[11px] font-medium text-zinc-800">
        {row.value}
      </p>
      {(row.updatedBy || row.updatedAtLabel) && (
        <p className="mt-0.5 text-[10px] text-zinc-500">
          {row.updatedBy ? (
            <>
              Updated by{" "}
              <span className="font-medium text-zinc-700">{row.updatedBy}</span>
            </>
          ) : null}
          {row.updatedBy && row.updatedAtLabel ? " · " : null}
          {row.updatedAtLabel}
        </p>
      )}
    </div>
  );
}

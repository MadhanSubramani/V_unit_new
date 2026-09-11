"use client";

import { Check } from "lucide-react";
import { ImportProgressStep } from "@/lib/import/sectionProgress";

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
          <div
            key={step.key}
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
              {step.complete ? "Completed" : "Not completed"}
            </p>
            {step.complete && (
              <>
                <p className="mt-0.5 truncate text-[10px] text-zinc-600">
                  Last updated by{" "}
                  <span className="font-medium text-zinc-800">
                    {step.updatedBy || "—"}
                  </span>
                </p>
                <p className="truncate text-[10px] text-zinc-400">
                  {step.updatedAtLabel}
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

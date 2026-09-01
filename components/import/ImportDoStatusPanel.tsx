"use client";

import { FreightForward } from "@/types/freightForward";
import {
  formatImportDoDate,
  getImportDoStatus,
  isImportDoCompleted,
} from "@/lib/import/linerWorkflow";

export default function ImportDoStatusPanel({ item }: { item: FreightForward }) {
  const doStatus = getImportDoStatus(item);
  const received = isImportDoCompleted(item);

  return (
    <section className="border-t border-zinc-200 bg-zinc-50/50 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        DO status
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
            received
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {doStatus === "received" ? "Received" : "Pending"}
        </span>
        {received && (
          <>
            <div>
              <span className="text-zinc-500">Empty validity: </span>
              <span className="font-medium text-zinc-800">
                {formatImportDoDate(item.importDoEmptyValidity)}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Port validity: </span>
              <span className="font-medium text-zinc-800">
                {formatImportDoDate(item.importDoPostValidity)}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

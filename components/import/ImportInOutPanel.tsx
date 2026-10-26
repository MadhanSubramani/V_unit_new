"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import ImportAuditLine from "@/components/import/ImportAuditLine";
import ImportJobDocumentsPanel from "@/components/import/ImportJobDocumentsPanel";
import ImportSectionRemarks from "@/components/import/ImportSectionRemarks";
import {
  addImportSectionRemark,
  updateImportEwayBill,
  updateImportInOutMeta,
} from "@/lib/freightForward/freightForward";
import { generateDeliveryChallanPdf } from "@/lib/import/generateDeliveryChallanPdf";
import { missingDeliveryChallanFields } from "@/lib/import/inOutWorkflow";
import {
  FreightForward,
  ImportInOutDocType,
  ImportYesNo,
} from "@/types/freightForward";

const LORRY_TYPES = ["40", "20", "Closed Truck", "Open Truck"];
const DOC_TYPES: ImportInOutDocType[] = ["DTA", "ZONE TO ZONE", "EXPORT"];

export default function ImportInOutPanel({
  item,
  busy,
  canAct,
  username,
  onBusy,
  onError,
  onUpdated,
  showDocuments = true,
}: {
  item: FreightForward;
  busy: boolean;
  canAct: boolean;
  username: string;
  onBusy: (id: string | null) => void;
  onError: (message: string) => void;
  onUpdated: (item: FreightForward) => void;
  showDocuments?: boolean;
}) {
  const [missing, setMissing] = useState<string[] | null>(null);

  const run = async (task: () => Promise<FreightForward>) => {
    onBusy(item.id ?? null);
    onError("");
    try {
      onUpdated(await task());
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Unable to update In & Out."
      );
    } finally {
      onBusy(null);
    }
  };

  const tryChallan = () => {
    const gaps = missingDeliveryChallanFields(item);
    if (gaps.length) {
      setMissing(gaps);
      return;
    }
    void generateDeliveryChallanPdf(item);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">
        {item.jobNumber} — In & Out
      </h3>
      <dl className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">DO name</dt>
          <dd className="font-medium">{item.importDoName || "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">DO number</dt>
          <dd className="font-medium">{item.importDoNumber || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">DO address</dt>
          <dd className="font-medium">{item.importDoAddress || "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Place of delivery</dt>
          <dd className="font-medium">{item.importDoPlaceOfDelivery || "—"}</dd>
        </div>
      </dl>
      <div
        className="mt-3 space-y-2 text-xs"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="font-medium text-zinc-700">E waybill</p>
        <div className="flex gap-4">
          {(["yes", "no"] as ImportYesNo[]).map((value) => (
            <label
              key={value}
              className="inline-flex items-center gap-1.5 capitalize"
            >
              <input
                type="radio"
                name={`eway-${item.id}`}
                checked={item.importEwayBill === value}
                disabled={busy || !canAct}
                onChange={() =>
                  void run(() => updateImportEwayBill(item.id!, value, username))
                }
              />
              {value}
            </label>
          ))}
        </div>
        <label className="block">
          <span className="font-medium text-zinc-700">Doc type</span>
          <select
            value={item.importInOutDocType ?? ""}
            disabled={busy || !canAct}
            onChange={(event) =>
              void run(() =>
                updateImportInOutMeta(
                  item.id!,
                  {
                    docType: event.target.value,
                    lorryType: item.importInOutLorryType,
                  },
                  username
                )
              )
            }
            className="mt-1 w-full max-w-xs rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px]"
          >
            <option value="">Select</option>
            {DOC_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-medium text-zinc-700">Lorry type</span>
          <select
            value={item.importInOutLorryType ?? ""}
            disabled={busy || !canAct}
            onChange={(event) =>
              void run(() =>
                updateImportInOutMeta(
                  item.id!,
                  {
                    docType: item.importInOutDocType,
                    lorryType: event.target.value,
                  },
                  username
                )
              )
            }
            className="mt-1 w-full max-w-xs rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px]"
          >
            <option value="">Select</option>
            {LORRY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={tryChallan}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
        >
          Generate delivery challan
        </button>
      </div>
      <ImportAuditLine audit={item.importEwayBillAudit} />
      <ImportSectionRemarks
        remarks={item.importInOutRemarks ?? []}
        busy={busy}
        canAct={canAct}
        onAdd={(text) =>
          addImportSectionRemark(item.id!, "inout", text, username).then(
            onUpdated
          )
        }
      />
      {showDocuments ? (
        <ImportJobDocumentsPanel
          item={item}
          canManage={canAct}
          username={username}
          onUpdated={onUpdated}
        />
      ) : null}
      <ConfirmDialog
        open={!!missing}
        title="Missing delivery challan particulars"
        message="Fill these fields before generating the delivery challan."
        items={missing ?? []}
        confirmLabel="Close"
        variant="default"
        hideCancel
        onCancel={() => setMissing(null)}
        onConfirm={() => setMissing(null)}
      />
    </div>
  );
}

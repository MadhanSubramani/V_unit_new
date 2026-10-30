"use client";

import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import ImportAuditLine from "@/components/import/ImportAuditLine";
import ImportJobDocumentsPanel from "@/components/import/ImportJobDocumentsPanel";
import ImportSectionRemarks from "@/components/import/ImportSectionRemarks";
import {
  addImportSectionRemark,
  changeImportBoeOutVehicle,
  dispatchImportBoeOut,
  updateImportBoeOutNewVehicle,
  updateImportEwayBill,
  updateImportInOutMeta,
} from "@/lib/freightForward/freightForward";
import { generateDeliveryChallanPdf } from "@/lib/import/generateDeliveryChallanPdf";
import { missingDeliveryChallanFields } from "@/lib/import/inOutWorkflow";
import {
  canUnlockImportEwaySection,
  isImportBoeOutDispatched,
} from "@/lib/import/boeOutWorkflow";
import {
  getImportTruckDetails,
  getImportVehicleChanges,
  isVehicleChangeComplete,
} from "@/lib/import/transportWorkflow";
import {
  FreightForward,
  ImportInOutDocType,
  ImportVehicleChange,
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
  showDispatch = false,
}: {
  item: FreightForward;
  busy: boolean;
  canAct: boolean;
  username: string;
  onBusy: (id: string | null) => void;
  onError: (message: string) => void;
  onUpdated: (item: FreightForward) => void;
  showDocuments?: boolean;
  showDispatch?: boolean;
}) {
  const [missing, setMissing] = useState<string[] | null>(null);
  const [vehicleChanges, setVehicleChanges] = useState<ImportVehicleChange[]>(() =>
    getImportVehicleChanges(item)
  );
  const dutyFinal = canUnlockImportEwaySection(item);
  const dispatched = isImportBoeOutDispatched(item);
  const trucks = getImportTruckDetails(item);

  useEffect(() => {
    setVehicleChanges(getImportVehicleChanges(item));
  }, [item]);

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
          <dt className="text-zinc-500">Client name</dt>
          <dd className="font-medium">{item.importDoName || "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Client number</dt>
          <dd className="font-medium">{item.importDoNumber || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">Delivery address</dt>
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

        {showDispatch && (
          <div className="space-y-3 border-t border-zinc-200 pt-3">
            <p className="font-medium text-zinc-700">Transport / vehicle</p>
            {!dutyFinal ? (
              <p className="text-[11px] text-zinc-500">
                Mark duty as Final before vehicle change or dispatch.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {trucks.map((truck, index) => (
                    <div key={index}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Transport {index + 1}
                        {truck.containerNumber ? ` — ${truck.containerNumber}` : ""}
                      </p>
                      <dl className="mt-1 grid gap-1 text-[11px] text-zinc-700 sm:grid-cols-2">
                        <div>
                          <dt className="text-zinc-500">Transporter</dt>
                          <dd className="font-medium">
                            {truck.importTransporter?.trim() || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">Vehicle No</dt>
                          <dd className="font-medium">
                            {truck.importVehicleNo?.trim() || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">Driver</dt>
                          <dd className="font-medium">
                            {truck.importDriverName?.trim() || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">Phone</dt>
                          <dd className="font-medium">
                            {truck.importDriverPhone?.trim() || "—"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>

                {!item.importBoeOutVehicleChanged && canAct && !dispatched && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(() => changeImportBoeOutVehicle(item.id!, username))
                    }
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[10px] font-semibold text-zinc-700"
                  >
                    Change of vehicle
                  </button>
                )}

                {item.importBoeOutVehicleChanged && (
                  <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
                    <ImportAuditLine audit={item.importBoeOutVehicleChangeAudit} />
                    {vehicleChanges.map((change, index) => (
                      <div
                        key={index}
                        className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Vehicle {index + 1}
                          {change.containerNumber
                            ? ` — ${change.containerNumber}`
                            : ""}
                        </p>
                        <dl className="grid gap-1 text-[11px] text-zinc-700 sm:grid-cols-2">
                          <div>
                            <dt className="text-zinc-500">Old transporter</dt>
                            <dd className="font-medium">
                              {change.oldTransporter || "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-zinc-500">Old vehicle</dt>
                            <dd className="font-medium">
                              {change.oldVehicleNo || "—"}
                            </dd>
                          </div>
                        </dl>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="block text-xs sm:col-span-2">
                            <span className="font-medium text-zinc-700">
                              New transporter
                            </span>
                            <input
                              value={change.newTransporter ?? ""}
                              disabled={busy || !canAct || dispatched}
                              onChange={(event) =>
                                setVehicleChanges((current) =>
                                  current.map((row, i) =>
                                    i === index
                                      ? {
                                          ...row,
                                          newTransporter: event.target.value,
                                        }
                                      : row
                                  )
                                )
                              }
                              className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                            />
                          </label>
                          <label className="block text-xs">
                            <span className="font-medium text-zinc-700">
                              New vehicle No
                            </span>
                            <input
                              value={change.newVehicleNo ?? ""}
                              disabled={busy || !canAct || dispatched}
                              onChange={(event) =>
                                setVehicleChanges((current) =>
                                  current.map((row, i) =>
                                    i === index
                                      ? {
                                          ...row,
                                          newVehicleNo:
                                            event.target.value.toUpperCase(),
                                        }
                                      : row
                                  )
                                )
                              }
                              className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                            />
                          </label>
                          <label className="block text-xs">
                            <span className="font-medium text-zinc-700">
                              New driver
                            </span>
                            <input
                              value={change.newDriverName ?? ""}
                              disabled={busy || !canAct || dispatched}
                              onChange={(event) =>
                                setVehicleChanges((current) =>
                                  current.map((row, i) =>
                                    i === index
                                      ? {
                                          ...row,
                                          newDriverName: event.target.value,
                                        }
                                      : row
                                  )
                                )
                              }
                              className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                            />
                          </label>
                          <label className="block text-xs sm:col-span-2">
                            <span className="font-medium text-zinc-700">Ph no</span>
                            <input
                              value={change.newDriverPhone ?? ""}
                              disabled={busy || !canAct || dispatched}
                              onChange={(event) =>
                                setVehicleChanges((current) =>
                                  current.map((row, i) =>
                                    i === index
                                      ? {
                                          ...row,
                                          newDriverPhone: event.target.value
                                            .replace(/\D/g, "")
                                            .slice(0, 10),
                                        }
                                      : row
                                  )
                                )
                              }
                              placeholder="10 digits"
                              className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-500"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                    {canAct && !dispatched && (
                      <button
                        type="button"
                        disabled={
                          busy || !vehicleChanges.every(isVehicleChangeComplete)
                        }
                        onClick={() =>
                          void run(() =>
                            updateImportBoeOutNewVehicle(
                              item.id!,
                              vehicleChanges,
                              username
                            )
                          )
                        }
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[10px] font-semibold text-zinc-700 disabled:opacity-40"
                      >
                        Save new vehicles
                      </button>
                    )}
                  </div>
                )}

                <div className="border-t border-zinc-200 pt-3">
                  <p className="font-medium text-zinc-700">Dispatch</p>
                  {dispatched ? (
                    <p className="mt-2 text-[11px] font-medium text-zinc-700">
                      Dispatched
                    </p>
                  ) : canAct ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(() => dispatchImportBoeOut(item.id!, username))
                      }
                      className="mt-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
                    >
                      Dispatch
                    </button>
                  ) : (
                    <p className="mt-2 text-[11px] text-zinc-500">
                      Dispatch is pending.
                    </p>
                  )}
                  <ImportAuditLine
                    audit={item.importBoeOutDispatchAudit}
                    byLabel="Dispatched by"
                    emptyLabel="Not dispatched yet."
                  />
                </div>
              </>
            )}
          </div>
        )}
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

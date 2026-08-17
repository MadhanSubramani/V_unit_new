"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import FileInputWithClip from "@/components/import/FileInputWithClip";
import {
  appendImportOtherDocuments,
  updateFreightForward,
} from "@/lib/freightForward/freightForward";
import {
  emptyContainer,
  getContainersFromRecord,
  normalizeContainerNumber,
  validateFreightContainers,
} from "@/lib/freightForward/containers";
import { getCfsList } from "@/lib/cfs/cfs";
import { getSezList } from "@/lib/sez/sez";
import { getConfigByCategory } from "@/lib/configurations/configurations";
import { getKyc } from "@/lib/kyc/getKyc";
import { uploadDocument } from "@/lib/kyc/uploadDocument";
import { Cfs } from "@/types/cfs";
import { ConfigItem } from "@/types/configuration";
import {
  FreightContainer,
  FreightForward,
  FreightForwardDocument,
  FreightForwardFormData,
} from "@/types/freightForward";
import { Kyc } from "@/types/kyc";
import { Sez } from "@/types/sez";

type OtherDocDraft = {
  name: string;
  file: File | null;
};

type Props = {
  item: FreightForward;
  mode?: "edit" | "view";
  onClose: () => void;
  onSaved: (updated: FreightForward) => void;
  username: string;
};

export default function ImportJobEditDrawer({
  item,
  mode = "edit",
  onClose,
  onSaved,
  username,
}: Props) {
  const readOnly = mode === "view";
  const [form, setForm] = useState<Partial<FreightForwardFormData>>({
    ezRefNumber: item.ezRefNumber ?? "",
    consignmentName: item.consignmentName ?? "",
    clientName: item.clientName ?? "",
    tradeTerms: item.tradeTerms ?? "",
    blType: item.blType ?? "",
    mbl: item.mbl ?? "",
    hbl: item.hbl ?? "",
    vesselName: item.vesselName ?? "",
    eta: item.eta ?? "",
    locationType: item.locationType ?? "cfs",
    cfs: item.cfs ?? "",
    sez: item.sez ?? "",
    containers: getContainersFromRecord(item),
    containerNumber: item.containerNumber ?? "",
    liner: item.liner ?? "",
    agent: item.agent ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [mblFile, setMblFile] = useState<File | null>(null);
  const [hblFile, setHblFile] = useState<File | null>(null);
  const [mblDoc, setMblDoc] = useState<FreightForwardDocument | undefined>(
    item.mblUrl
  );
  const [hblDoc, setHblDoc] = useState<FreightForwardDocument | undefined>(
    item.hblUrl
  );
  const [otherDocs, setOtherDocs] = useState<OtherDocDraft[]>([
    { name: "", file: null },
  ]);

  const [cfsList, setCfsList] = useState<Cfs[]>([]);
  const [sezList, setSezList] = useState<Sez[]>([]);
  const [blTypes, setBlTypes] = useState<ConfigItem[]>([]);
  const [tradeTermsList, setTradeTermsList] = useState<ConfigItem[]>([]);
  const [containerSizes, setContainerSizes] = useState<ConfigItem[]>([]);
  const [containerTypes, setContainerTypes] = useState<ConfigItem[]>([]);
  const [kycList, setKycList] = useState<Kyc[]>([]);

  useEffect(() => {
    setMblFile(null);
    setHblFile(null);
    setMblDoc(item.mblUrl);
    setHblDoc(item.hblUrl);
  }, [item]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      getCfsList(),
      getSezList(),
      getConfigByCategory("bl_type"),
      getConfigByCategory("trade_terms"),
      getConfigByCategory("container_size"),
      getConfigByCategory("container_type"),
      getKyc(),
    ]).then(
      ([cfs, sez, blTypeItems, tradeTerms, sizes, types, kyc]) => {
        if (!active) return;
        setCfsList(cfs);
        setSezList(sez);
        setBlTypes(blTypeItems);
        setTradeTermsList(tradeTerms);
        setContainerSizes(sizes);
        setContainerTypes(types);
        setKycList(kyc);
      }
    );
    return () => {
      active = false;
    };
  }, []);

  const fieldClass = (key: string) =>
    `w-full rounded-xl border px-3 py-2 text-xs outline-none transition focus:ring-2 ${
      readOnly ? "cursor-default bg-zinc-50 text-zinc-700 " : ""
    }${
      errors[key]
        ? "border-red-400 focus:ring-red-100"
        : "border-zinc-200 focus:border-zinc-500 focus:ring-zinc-200"
    }`;

  const clearError = (key: string) => {
    if (!errors[key]) return;
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const containers = (() => {
    const items = getContainersFromRecord({
      containers: form.containers,
      containerNumber: form.containerNumber ?? "",
    });
    return items.length ? items : [emptyContainer()];
  })();

  const setContainerError = (index: number, value: string) => {
    const key = `containers.${index}.containerNumber`;
    const number = normalizeContainerNumber(value);
    setErrors((current) => {
      const next = { ...current };
      if (!number) {
        delete next[key];
        return next;
      }
      const fromList = validateFreightContainers(
        containers.map((item, i) =>
          i === index ? { ...item, containerNumber: number } : item
        )
      )[key];
      if (fromList) next[key] = fromList;
      else delete next[key];
      return next;
    });
  };

  const updateContainer = (
    index: number,
    field: keyof FreightContainer,
    value: string
  ) => {
    const items = [...containers];
    items[index] = {
      ...items[index],
      [field]:
        field === "containerNumber"
          ? normalizeContainerNumber(value).slice(0, 11)
          : value,
    };
    setForm({
      ...form,
      containers: items,
      containerNumber: items[0]?.containerNumber ?? "",
      containerSize: items[0]?.containerSize ?? "",
      containerType: items[0]?.containerType ?? "",
    });
    if (field === "containerNumber") setContainerError(index, value);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.consignmentName?.trim()) {
      next.consignmentName = "Consignee is required.";
    }
    if (!form.mbl?.trim()) next.mbl = "MBL is required.";
    if (!form.hbl?.trim()) next.hbl = "HBL is required.";
    if (!form.eta?.trim()) next.eta = "ETA is required.";
    if (form.locationType === "cfs" && !form.cfs?.trim()) {
      next.location = "CFS is required.";
    }
    if (form.locationType === "sez" && !form.sez?.trim()) {
      next.location = "SEZ is required.";
    }
    Object.assign(next, validateFreightContainers(containers));
    otherDocs.forEach((doc, index) => {
      if (doc.file && !doc.name.trim()) {
        next[`otherDocs.${index}`] = "Document name is required.";
      }
      if (doc.name.trim() && !doc.file) {
        next[`otherDocs.${index}`] = "Document file is required.";
      }
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (readOnly || !item.id || !validate()) return;
    setSaving(true);
    try {
      const uploadIfNeeded = async (
        file: File | null,
        folder: string,
        existing?: FreightForwardDocument
      ) => {
        if (!file) return existing;
        return uploadDocument(file, folder);
      };

      const [mblUrl, hblUrl] = await Promise.all([
        uploadIfNeeded(mblFile, "freight-forward/mbl", mblDoc),
        uploadIfNeeded(hblFile, "freight-forward/hbl", hblDoc),
      ]);

      const payload: Partial<FreightForwardFormData> = {
        ezRefNumber: form.ezRefNumber?.trim() ?? "",
        consignmentName: form.consignmentName!.trim(),
        clientName: form.clientName?.trim() ?? "",
        tradeTerms: form.tradeTerms ?? "",
        blType: form.blType ?? "",
        mbl: form.mbl!.trim(),
        hbl: form.hbl!.trim(),
        vesselName: form.vesselName?.trim() ?? "",
        eta: form.eta!.trim(),
        locationType: form.locationType ?? "cfs",
        cfs: form.cfs ?? "",
        sez: form.sez ?? "",
        containers: containers.map((entry) => ({
          ...entry,
          containerNumber: normalizeContainerNumber(entry.containerNumber),
        })),
        containerNumber: normalizeContainerNumber(
          containers[0]?.containerNumber
        ),
        containerSize: containers[0]?.containerSize ?? "",
        containerType: containers[0]?.containerType ?? "",
        liner: form.liner?.trim() ?? "",
        agent: form.agent?.trim() ?? "",
        mblUrl,
        hblUrl,
      };

      await updateFreightForward(item.id, payload, username || "Unknown");

      const uploaded: FreightForwardDocument[] = [];
      for (const draft of otherDocs) {
        if (!draft.name.trim() || !draft.file) continue;
        const file = await uploadDocument(
          draft.file,
          "freight-forward/other-documents"
        );
        uploaded.push({ name: draft.name.trim(), url: file.url });
      }

      let otherDocuments = item.otherDocuments ?? [];
      if (uploaded.length) {
        const updated = await appendImportOtherDocuments(
          item.id,
          uploaded,
          username || "Unknown"
        );
        otherDocuments = updated.otherDocuments ?? otherDocuments;
      }

      onSaved({
        ...item,
        ...payload,
        mblUrl,
        hblUrl,
        otherDocuments,
        updatedBy: username || "Unknown",
      });
      onClose();
    } catch (error) {
      console.error(error);
      setErrors({ form: "Unable to update job. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 z-[71] flex h-screen w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              {readOnly ? "View Import Job" : "Edit Import Job"}
            </h2>
            <p className="text-xs text-zinc-500">
              {item.jobNumber || "Job"} —{" "}
              {readOnly
                ? "shipment details and documents."
                : "update shipment details and documents."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-zinc-100"
          >
            <X size={18} />
          </button>
        </div>

        <div
          className={`min-h-0 flex-1 space-y-4 overflow-y-auto p-5 ${
            readOnly
              ? "[&_button]:pointer-events-none [&_input]:pointer-events-none [&_select]:pointer-events-none [&_textarea]:pointer-events-none [&_a]:pointer-events-auto"
              : ""
          }`}
        >
          {errors.form && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {errors.form}
            </p>
          )}

          <label className="block space-y-1.5 text-xs">
            <span className="font-medium text-zinc-700">Job No</span>
            <input
              disabled
              value={item.jobNumber || "—"}
              className={`${fieldClass("jobNumber")} cursor-not-allowed bg-zinc-100`}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5 text-xs">
              <span className="font-medium text-zinc-700">EZ No</span>
              <input
                value={form.ezRefNumber ?? ""}
                onChange={(e) =>
                  setForm({ ...form, ezRefNumber: e.target.value })
                }
                className={fieldClass("ezRefNumber")}
              />
            </label>
            <label className="block space-y-1.5 text-xs">
              <span className="font-medium text-zinc-700">BL Type</span>
              <select
                value={form.blType ?? ""}
                onChange={(e) => setForm({ ...form, blType: e.target.value })}
                className={fieldClass("blType")}
              >
                <option value="">Select</option>
                {blTypes.map((entry) => (
                  <option key={entry.id} value={entry.value}>
                    {entry.value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5 text-xs">
              <span className="font-medium text-zinc-700">Trade Terms</span>
              <select
                value={form.tradeTerms ?? ""}
                onChange={(e) =>
                  setForm({ ...form, tradeTerms: e.target.value })
                }
                className={fieldClass("tradeTerms")}
              >
                <option value="">Select</option>
                {tradeTermsList.map((entry) => (
                  <option key={entry.id} value={entry.value}>
                    {entry.value}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-xs">
              <span className="font-medium text-zinc-700">
                ETA <span className="text-red-500">*</span>
              </span>
              <input
                type="date"
                value={form.eta ?? ""}
                onChange={(e) => {
                  setForm({ ...form, eta: e.target.value });
                  clearError("eta");
                }}
                className={fieldClass("eta")}
              />
              {errors.eta && (
                <span className="text-[11px] text-red-500">{errors.eta}</span>
              )}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5 text-xs">
              <span className="font-medium text-zinc-700">Vessel</span>
              <input
                value={form.vesselName ?? ""}
                onChange={(e) =>
                  setForm({ ...form, vesselName: e.target.value })
                }
                className={fieldClass("vesselName")}
              />
            </label>
            <label className="block space-y-1.5 text-xs">
              <span className="font-medium text-zinc-700">Liner</span>
              <input
                value={form.liner ?? ""}
                onChange={(e) => setForm({ ...form, liner: e.target.value })}
                className={fieldClass("liner")}
              />
            </label>
          </div>

          <div className="space-y-1.5 text-xs">
            <span className="font-medium text-zinc-700">Location</span>
            <div className="flex gap-3">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={form.locationType === "cfs"}
                  onChange={() =>
                    setForm({ ...form, locationType: "cfs", sez: "" })
                  }
                />
                CFS
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={form.locationType === "sez"}
                  onChange={() =>
                    setForm({ ...form, locationType: "sez", cfs: "" })
                  }
                />
                SEZ
              </label>
            </div>
            {form.locationType === "cfs" ? (
              <select
                value={form.cfs ?? ""}
                onChange={(e) => {
                  setForm({ ...form, cfs: e.target.value });
                  clearError("location");
                }}
                className={fieldClass("location")}
              >
                <option value="">Select CFS</option>
                {cfsList.map((entry) => (
                  <option key={entry.id} value={entry.name}>
                    {entry.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={form.sez ?? ""}
                onChange={(e) => {
                  setForm({ ...form, sez: e.target.value });
                  clearError("location");
                }}
                className={fieldClass("location")}
              >
                <option value="">Select SEZ</option>
                {sezList.map((entry) => (
                  <option key={entry.id} value={entry.name}>
                    {entry.name}
                  </option>
                ))}
              </select>
            )}
            {errors.location && (
              <span className="text-[11px] text-red-500">{errors.location}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5 text-xs">
              <span className="font-medium text-zinc-700">
                Consignee <span className="text-red-500">*</span>
              </span>
              <select
                value={form.consignmentName ?? ""}
                onChange={(e) => {
                  setForm({ ...form, consignmentName: e.target.value });
                  clearError("consignmentName");
                }}
                className={fieldClass("consignmentName")}
              >
                <option value="">Select</option>
                {kycList.map((entry) => (
                  <option key={entry.id} value={entry.companyName}>
                    {entry.companyName}
                  </option>
                ))}
              </select>
              {errors.consignmentName && (
                <span className="text-[11px] text-red-500">
                  {errors.consignmentName}
                </span>
              )}
            </label>
            <label className="block space-y-1.5 text-xs">
              <span className="font-medium text-zinc-700">Client</span>
              <input
                value={form.clientName ?? ""}
                onChange={(e) =>
                  setForm({ ...form, clientName: e.target.value })
                }
                className={fieldClass("clientName")}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 text-xs">
              <span className="font-medium text-zinc-700">
                MBL <span className="text-red-500">*</span>
              </span>
              <input
                value={form.mbl ?? ""}
                onChange={(e) => {
                  setForm({ ...form, mbl: e.target.value });
                  clearError("mbl");
                }}
                className={fieldClass("mbl")}
              />
              <DocumentSlot
                label="MBL Document"
                doc={mblDoc}
                file={mblFile}
                readOnly={readOnly}
                onFileChange={(file) => {
                  setMblFile(file);
                  if (file) setMblDoc(undefined);
                }}
                onClearExisting={() => setMblDoc(undefined)}
              />
              {errors.mbl && (
                <span className="text-[11px] text-red-500">{errors.mbl}</span>
              )}
            </div>
            <div className="space-y-1.5 text-xs">
              <span className="font-medium text-zinc-700">
                HBL <span className="text-red-500">*</span>
              </span>
              <input
                value={form.hbl ?? ""}
                onChange={(e) => {
                  setForm({ ...form, hbl: e.target.value });
                  clearError("hbl");
                }}
                className={fieldClass("hbl")}
              />
              <DocumentSlot
                label="HBL Document"
                doc={hblDoc}
                file={hblFile}
                readOnly={readOnly}
                onFileChange={(file) => {
                  setHblFile(file);
                  if (file) setHblDoc(undefined);
                }}
                onClearExisting={() => setHblDoc(undefined)}
              />
              {errors.hbl && (
                <span className="text-[11px] text-red-500">{errors.hbl}</span>
              )}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-700">
                Containers <span className="text-red-500">*</span>
              </p>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      containers: [...containers, emptyContainer()],
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-[11px] text-zinc-600"
                >
                  <Plus size={12} />
                  Add
                </button>
              )}
            </div>
            {containers.map((entry, index) => (
              <div key={index} className="space-y-1">
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={entry.containerNumber}
                    placeholder="ABCD1234567"
                    maxLength={11}
                    onChange={(e) =>
                      updateContainer(index, "containerNumber", e.target.value)
                    }
                    onBlur={() =>
                      setContainerError(index, entry.containerNumber)
                    }
                    className={fieldClass(`containers.${index}.containerNumber`)}
                  />
                  <select
                    value={entry.containerSize ?? ""}
                    onChange={(e) =>
                      updateContainer(index, "containerSize", e.target.value)
                    }
                    className={fieldClass("containerSize")}
                  >
                    <option value="">Size</option>
                    {containerSizes.map((size) => (
                      <option key={size.id} value={size.value}>
                        {size.value}
                      </option>
                    ))}
                  </select>
                  <select
                    value={entry.containerType ?? ""}
                    onChange={(e) =>
                      updateContainer(index, "containerType", e.target.value)
                    }
                    className={fieldClass("containerType")}
                  >
                    <option value="">Type</option>
                    {containerTypes.map((type) => (
                      <option key={type.id} value={type.value}>
                        {type.value}
                      </option>
                    ))}
                  </select>
                </div>
                {errors[`containers.${index}.containerNumber`] && (
                  <p className="text-[11px] text-red-500">
                    {errors[`containers.${index}.containerNumber`]}
                  </p>
                )}
              </div>
            ))}
          </div>

          {(item.otherDocuments ?? []).length > 0 && (
            <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
              <p className="text-xs font-medium text-zinc-700">
                Existing other documents
              </p>
              {(item.otherDocuments ?? []).map((doc, index) => (
                <a
                  key={`${doc.url}-${index}`}
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-[11px] text-zinc-700 underline"
                >
                  {doc.name || `Document ${index + 1}`}
                </a>
              ))}
            </div>
          )}

          {!readOnly && (
            <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-700">
                  Add other documents
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setOtherDocs([...otherDocs, { name: "", file: null }])
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-[11px] text-zinc-600"
                >
                  <Plus size={12} />
                  Add Document
                </button>
              </div>
              {otherDocs.map((doc, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex gap-2">
                    <input
                      value={doc.name}
                      placeholder="Document name"
                      onChange={(e) => {
                        const next = [...otherDocs];
                        next[index] = { ...next[index], name: e.target.value };
                        setOtherDocs(next);
                        clearError(`otherDocs.${index}`);
                      }}
                      className={fieldClass(`otherDocs.${index}`)}
                    />
                    {otherDocs.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setOtherDocs(otherDocs.filter((_, i) => i !== index))
                        }
                        className="rounded-lg border border-zinc-200 px-2 text-zinc-500"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <FileInputWithClip
                    onChange={(file) => {
                      const next = [...otherDocs];
                      next[index] = {
                        ...next[index],
                        file,
                      };
                      setOtherDocs(next);
                      clearError(`otherDocs.${index}`);
                    }}
                  />
                  {errors[`otherDocs.${index}`] && (
                    <span className="text-[11px] text-red-500">
                      {errors[`otherDocs.${index}`]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-xs"
          >
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function DocumentSlot({
  label,
  doc,
  file,
  readOnly,
  onFileChange,
  onClearExisting,
}: {
  label: string;
  doc?: FreightForwardDocument;
  file: File | null;
  readOnly: boolean;
  onFileChange: (file: File | null) => void;
  onClearExisting: () => void;
}) {
  if (doc?.url) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2">
        <p className="text-[10px] uppercase tracking-wide text-zinc-500">
          {label}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <a
            href={doc.url}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate text-[11px] font-medium text-zinc-800 underline"
          >
            {doc.name || "View file"}
          </a>
          {!readOnly && (
            <button
              type="button"
              onClick={onClearExisting}
              className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
              title="Remove document"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (readOnly) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 px-2.5 py-2 text-[11px] text-zinc-400">
        {label}: not uploaded
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <FileInputWithClip
        disabled={readOnly}
        onChange={onFileChange}
      />
      {file && (
        <p className="truncate text-[11px] text-zinc-600">{file.name}</p>
      )}
    </div>
  );
}

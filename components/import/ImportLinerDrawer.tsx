"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { createImportLinerJob } from "@/lib/freightForward/freightForward";
import {
  emptyContainer,
  getContainersFromRecord,
} from "@/lib/freightForward/containers";
import { getCfsList } from "@/lib/cfs/cfs";
import { getSezList } from "@/lib/sez/sez";
import { getConfigByCategory } from "@/lib/configurations/configurations";
import { getKyc } from "@/lib/kyc/getKyc";
import { uploadDocument } from "@/lib/kyc/uploadDocument";
import { Cfs } from "@/types/cfs";
import { ConfigItem } from "@/types/configuration";
import {
  CONTAINER_NUMBER_REGEX,
  FreightContainer,
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
  onClose: () => void;
  onSaved: () => void;
  username: string;
};

const emptyForm = (): Partial<FreightForwardFormData> => ({
  ezRefNumber: "",
  consignmentName: "",
  clientName: "",
  tradeTerms: "",
  blType: "",
  mbl: "",
  hbl: "",
  vesselName: "",
  eta: "",
  locationType: "cfs",
  cfs: "",
  sez: "",
  containers: [emptyContainer()],
  containerNumber: "",
  status: "in_process",
  useForImport: true,
  createdFrom: "import",
});

export default function ImportLinerDrawer({
  onClose,
  onSaved,
  username,
}: Props) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [mblFile, setMblFile] = useState<File | null>(null);
  const [hblFile, setHblFile] = useState<File | null>(null);
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

  const containers = getContainersFromRecord({
    containers: form.containers,
    containerNumber: form.containerNumber ?? "",
  });

  const updateContainer = (
    index: number,
    field: keyof FreightContainer,
    value: string
  ) => {
    const items = [...containers];
    items[index] = {
      ...items[index],
      [field]: field === "containerNumber" ? value.toUpperCase() : value,
    };
    setForm({
      ...form,
      containers: items,
      containerNumber: items[0]?.containerNumber ?? "",
      containerSize: items[0]?.containerSize ?? "",
      containerType: items[0]?.containerType ?? "",
    });
    clearError(`containers.${index}.containerNumber`);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.consignmentName?.trim()) {
      next.consignmentName = "Consignee is required.";
    }
    if (!form.mbl?.trim()) next.mbl = "MBL is required.";
    if (!form.hbl?.trim()) next.hbl = "HBL is required.";
    if (!mblFile) next.mblFile = "MBL file is required.";
    if (!hblFile) next.hblFile = "HBL file is required.";
    if (!form.eta?.trim()) next.eta = "ETA is required.";
    if (form.locationType === "cfs" && !form.cfs?.trim()) {
      next.location = "CFS is required.";
    }
    if (form.locationType === "sez" && !form.sez?.trim()) {
      next.location = "SEZ is required.";
    }
    containers.forEach((item, index) => {
      if (!item.containerNumber?.trim()) {
        next[`containers.${index}.containerNumber`] =
          "Container number is required.";
      } else if (!CONTAINER_NUMBER_REGEX.test(item.containerNumber.trim())) {
        next[`containers.${index}.containerNumber`] =
          "Invalid container number.";
      }
    });
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
    if (!validate()) return;
    setSaving(true);
    try {
      const [mblUrl, hblUrl] = await Promise.all([
        uploadDocument(mblFile!, "freight-forward/mbl"),
        uploadDocument(hblFile!, "freight-forward/hbl"),
      ]);

      const otherDocuments: FreightForwardDocument[] = [];
      for (const draft of otherDocs) {
        if (!draft.name.trim() || !draft.file) continue;
        const uploaded = await uploadDocument(
          draft.file,
          "freight-forward/other-documents"
        );
        otherDocuments.push({
          name: draft.name.trim(),
          url: uploaded.url,
        });
      }

      const payload: FreightForwardFormData = {
        ...(form as FreightForwardFormData),
        consignmentName: form.consignmentName!.trim(),
        mbl: form.mbl!.trim(),
        hbl: form.hbl!.trim(),
        containerNumber: containers[0]?.containerNumber ?? "",
        containers,
        mblUrl,
        hblUrl,
        otherDocuments,
        useForImport: true,
        createdFrom: "import",
        status: "in_process",
        importMovementStatus: "pending",
        importIgmStatus: "pending",
        importDoStatus: "pending",
        importCompleted: false,
      };

      await createImportLinerJob(payload, username || "Unknown");
      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      setErrors({ form: "Unable to create Import job. Please try again." });
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
              Add Import Job
            </h2>
            <p className="text-xs text-zinc-500">
              Creates IMP001-style job shared with Freight Forward.
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {errors.form && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {errors.form}
            </p>
          )}

          <label className="block space-y-1.5 text-xs">
            <span className="font-medium text-zinc-700">Job No</span>
            <input
              disabled
              value="Auto (IMP001…)"
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
                {blTypes.map((item) => (
                  <option key={item.id} value={item.value}>
                    {item.value}
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
                {tradeTermsList.map((item) => (
                  <option key={item.id} value={item.value}>
                    {item.value}
                  </option>
                ))}
              </select>
            </label>
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
          </div>

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

          <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
            <p className="text-xs font-medium text-zinc-700">
              Location <span className="text-red-500">*</span>
            </p>
            <div className="flex gap-3 text-xs">
              {(["cfs", "sez"] as const).map((type) => (
                <label key={type} className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={form.locationType === type}
                    onChange={() =>
                      setForm({
                        ...form,
                        locationType: type,
                        cfs: "",
                        sez: "",
                      })
                    }
                  />
                  {type.toUpperCase()}
                </label>
              ))}
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
                {cfsList.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
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
                {sezList.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
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
                {kycList.map((item) => (
                  <option key={item.id} value={item.companyName}>
                    {item.companyName}
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
              <select
                value={form.clientName ?? ""}
                onChange={(e) =>
                  setForm({ ...form, clientName: e.target.value })
                }
                className={fieldClass("clientName")}
              >
                <option value="">Select</option>
                {kycList.map((item) => (
                  <option key={item.id} value={item.companyName}>
                    {item.companyName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5 text-xs">
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
              <input
                type="file"
                onChange={(e) => {
                  setMblFile(e.target.files?.[0] ?? null);
                  clearError("mblFile");
                }}
                className="text-[11px]"
              />
              {(errors.mbl || errors.mblFile) && (
                <span className="text-[11px] text-red-500">
                  {errors.mbl || errors.mblFile}
                </span>
              )}
            </label>
            <label className="block space-y-1.5 text-xs">
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
              <input
                type="file"
                onChange={(e) => {
                  setHblFile(e.target.files?.[0] ?? null);
                  clearError("hblFile");
                }}
                className="text-[11px]"
              />
              {(errors.hbl || errors.hblFile) && (
                <span className="text-[11px] text-red-500">
                  {errors.hbl || errors.hblFile}
                </span>
              )}
            </label>
          </div>

          <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-700">Containers</p>
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
            </div>
            {containers.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-2">
                <input
                  value={item.containerNumber}
                  placeholder="Container No"
                  onChange={(e) =>
                    updateContainer(index, "containerNumber", e.target.value)
                  }
                  className={fieldClass(`containers.${index}.containerNumber`)}
                />
                <select
                  value={item.containerSize ?? ""}
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
                  value={item.containerType ?? ""}
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
            ))}
          </div>

          <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-700">Documents</p>
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
                <input
                  type="file"
                  onChange={(e) => {
                    const next = [...otherDocs];
                    next[index] = {
                      ...next[index],
                      file: e.target.files?.[0] ?? null,
                    };
                    setOtherDocs(next);
                    clearError(`otherDocs.${index}`);
                  }}
                  className="text-[11px]"
                />
                {errors[`otherDocs.${index}`] && (
                  <span className="text-[11px] text-red-500">
                    {errors[`otherDocs.${index}`]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
          >
            {saving ? "Saving..." : "Create Import Job"}
          </button>
        </div>
      </div>
    </>
  );
}

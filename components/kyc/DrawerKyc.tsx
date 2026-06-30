"use client";

import { useEffect, useRef, useState } from "react";
import { X, UploadCloud, Paperclip, Plus, Download } from "lucide-react";
import { Kyc, KycDocument } from "@/types/kyc";
import { addKyc } from "@/lib/kyc/createKyc";
import { updateKyc } from "@/lib/kyc/updateKyc";
import { uploadDocument } from "@/lib/kyc/uploadDocument";
import { checkDuplicateGstin } from "@/lib/gst/checkDuplicateGstin";
import { getGstinDetails } from "@/lib/gst/getGstinDetails";
import { parseGstActiveStatus, isGstActive } from "@/lib/gst/parseGstStatus";
import { generateFileNo } from "@/lib/kyc/generateFileNo";
import { normalizeDocArray } from "@/lib/kyc/normalizeKyc";
import { buildKycFirestoreData } from "@/lib/kyc/buildKycPayload";

interface Props {
  open: boolean;
  onClose: () => void;
  selected?: Kyc | null;
  onSaved: () => void;
}

type FormErrors = Partial<Record<string, string>> & { form?: string };

export default function KycDrawer({ open, onClose, selected, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingGST, setLoadingGST] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [gstin, setGstin] = useState("");
  const [gstStatus, setGstStatus] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [branchAddresses, setBranchAddresses] = useState<string[]>([""]);
  const [pan, setPan] = useState("");
  const [iec, setIec] = useState("");
  const [adCode, setAdCode] = useState("");
  const [loiNo, setLoiNo] = useState("");
  const [loiDate, setLoiDate] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [gstinFile, setGstinFile] = useState<File | null>(null);
  const [panFile, setPanFile] = useState<File | null>(null);
  const [iecFile, setIecFile] = useState<File | null>(null);
  const [adCodeFile, setAdCodeFile] = useState<File | null>(null);
  const [loiFile, setLoiFile] = useState<File | null>(null);
  const [directorAadharFiles, setDirectorAadharFiles] = useState<File[]>([]);
  const [directorPanFiles, setDirectorPanFiles] = useState<File[]>([]);
  const [supportingDocs, setSupportingDocs] = useState<File[]>([]);

  const [existingGstinDoc, setExistingGstinDoc] = useState<KycDocument | undefined>();
  const [existingPanDoc, setExistingPanDoc] = useState<KycDocument | undefined>();
  const [existingIecDoc, setExistingIecDoc] = useState<KycDocument | undefined>();
  const [existingAdCodeDoc, setExistingAdCodeDoc] = useState<KycDocument | undefined>();
  const [existingLoiDoc, setExistingLoiDoc] = useState<KycDocument | undefined>();
  const [existingAadharDocs, setExistingAadharDocs] = useState<KycDocument[]>([]);
  const [existingPanDocs, setExistingPanDocs] = useState<KycDocument[]>([]);
  const [existingSupportingDocs, setExistingSupportingDocs] = useState<KycDocument[]>([]);

  useEffect(() => {
    if (!open) return;
    if (!selected) {
      resetForm();
      return;
    }

    setGstin(selected.gstin);
    setGstStatus(selected.gstStatus ?? null);
    setCompanyName(selected.companyName);
    setBillingAddress(selected.billingAddress);
    setBranchAddresses(
      selected.branchAddresses?.length ? selected.branchAddresses : [""]
    );
    setPan(selected.pan);
    setIec(selected.iec);
    setAdCode(selected.adCode);
    setLoiNo(selected.loiNo);
    setLoiDate(selected.loiDate);
    setEmail(selected.email);
    setPhone(selected.phone);

    setExistingGstinDoc(selected.gstinDocument);
    setExistingPanDoc(selected.panDocument);
    setExistingIecDoc(selected.iecDocument);
    setExistingAdCodeDoc(selected.adCodeDocument);
    setExistingLoiDoc(selected.loiDocument);
    setExistingAadharDocs(normalizeDocArray(selected.directorAadhar));
    setExistingPanDocs(normalizeDocArray(selected.directorPan));
    setExistingSupportingDocs(normalizeDocArray(selected.supportingDocuments));

    setGstinFile(null);
    setPanFile(null);
    setIecFile(null);
    setAdCodeFile(null);
    setLoiFile(null);
    setDirectorAadharFiles([]);
    setDirectorPanFiles([]);
    setSupportingDocs([]);
    setErrors({});
  }, [selected, open]);

  const fieldClass = (hasError: boolean) =>
    `w-full rounded-xl border px-3 py-2 text-xs outline-none transition focus:ring-2 ${
      hasError
        ? "border-red-400 focus:ring-red-100"
        : "border-zinc-200 focus:border-zinc-500 focus:ring-zinc-200"
    }`;

  const clearError = (key: string) => {
    if (errors[key]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[key];
        return next;
      });
    }
  };

  const fetchGSTDetails = async (gst: string) => {
    if (gst.length !== 15) return;
    setLoadingGST(true);
    setErrors((e) => ({ ...e, gstin: undefined, form: undefined }));

    try {
      const exists = await checkDuplicateGstin(gst);
      if (exists && selected?.gstin !== gst) {
        setErrors((e) => ({ ...e, gstin: "KYC already completed for this GSTIN." }));
        setGstin("");
        return;
      }

      const response = await getGstinDetails(gst);
      if (!response.flag) {
        setErrors((e) => ({ ...e, gstin: "Invalid GSTIN." }));
        return;
      }

      const data = response.data;
      setCompanyName(data.tradeNam || data.lgnm);
      setBillingAddress(data.pradr?.adr ?? "");
      setGstStatus(parseGstActiveStatus(data as Record<string, unknown>));

      const branches = Array.isArray(data.adadr)
        ? data.adadr.map((item: { adr?: string }) => item.adr ?? "").filter(Boolean)
        : [];
      setBranchAddresses(branches.length ? branches : [""]);

      setPan(gst.substring(2, 12));
    } catch {
      setErrors((e) => ({
        ...e,
        form: "Unable to fetch GST details. Please try again.",
      }));
    } finally {
      setLoadingGST(false);
    }
  };

  const validate = (): boolean => {
    const next: FormErrors = {};

    if (!gstin.trim()) next.gstin = "GSTIN is required.";
    else if (gstin.length !== 15) next.gstin = "GSTIN must be 15 characters.";

    if (!companyName.trim()) next.companyName = "Company name is required.";
    if (!billingAddress.trim()) next.billingAddress = "Billing address is required.";

    if (!email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Enter a valid email address.";

    if (!phone.trim()) next.phone = "Phone is required.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const uploadIfNeeded = async (file: File | null, folder: string) => {
    if (!file) return undefined;
    return uploadDocument(file, folder);
  };

  const handleSave = async () => {
    setErrors((e) => ({ ...e, form: undefined }));
    if (!validate()) return;

    try {
      setLoading(true);

      const gstinDocument =
        (await uploadIfNeeded(gstinFile, "kyc/gstin")) ?? existingGstinDoc;
      const panDocument =
        (await uploadIfNeeded(panFile, "kyc/pan")) ?? existingPanDoc;
      const iecDocument =
        (await uploadIfNeeded(iecFile, "kyc/iec")) ?? existingIecDoc;
      const adCodeDocument =
        (await uploadIfNeeded(adCodeFile, "kyc/ad-code")) ?? existingAdCodeDoc;
      const loiDocument =
        (await uploadIfNeeded(loiFile, "kyc/loi")) ?? existingLoiDoc;

      const newAadhar = await Promise.all(
        directorAadharFiles.map((f) => uploadDocument(f, "kyc/director-aadhar"))
      );
      const newPan = await Promise.all(
        directorPanFiles.map((f) => uploadDocument(f, "kyc/director-pan"))
      );
      const newSupporting = await Promise.all(
        supportingDocs.map((f) => uploadDocument(f, "kyc/supporting-documents"))
      );

      const fileNo = selected?.fileNo ?? (await generateFileNo());

      const payload = buildKycFirestoreData({
        fileNo,
        gstin,
        gstStatus,
        gstinDocument,
        companyName,
        billingAddress,
        branchAddresses: branchAddresses.map((b) => b.trim()).filter(Boolean),
        pan,
        panDocument,
        iec,
        iecDocument,
        adCode,
        adCodeDocument,
        loiNo,
        loiDate,
        loiDocument,
        email,
        phone,
        directorAadhar: [...existingAadharDocs, ...newAadhar],
        directorPan: [...existingPanDocs, ...newPan],
        supportingDocuments: [...existingSupportingDocs, ...newSupporting],
      });

      if (selected?.id) {
        await updateKyc(selected.id, payload);
      } else {
        await addKyc(payload);
      }

      resetForm();
      onSaved();
      onClose();
    } catch (error) {
      console.error("Save KYC error:", error);
      setErrors((e) => ({ ...e, form: "Unable to save KYC. Please try again." }));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setGstin("");
    setGstStatus(null);
    setCompanyName("");
    setBillingAddress("");
    setBranchAddresses([""]);
    setPan("");
    setIec("");
    setAdCode("");
    setLoiNo("");
    setLoiDate("");
    setEmail("");
    setPhone("");
    setGstinFile(null);
    setPanFile(null);
    setIecFile(null);
    setAdCodeFile(null);
    setLoiFile(null);
    setDirectorAadharFiles([]);
    setDirectorPanFiles([]);
    setSupportingDocs([]);
    setExistingGstinDoc(undefined);
    setExistingPanDoc(undefined);
    setExistingIecDoc(undefined);
    setExistingAdCodeDoc(undefined);
    setExistingLoiDoc(undefined);
    setExistingAadharDocs([]);
    setExistingPanDocs([]);
    setExistingSupportingDocs([]);
    setErrors({});
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed right-0 top-0 z-50 h-screen w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              {selected ? "Edit KYC" : "Add KYC"}
            </h2>
            <p className="text-xs text-zinc-500">Company KYC Information</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {errors.form && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {errors.form}
            </div>
          )}

          <FieldWithFile
            label="GSTIN"
            valueRequired
            value={gstin}
            onChange={(v) => {
              setGstin(v.toUpperCase());
              clearError("gstin");
              if (v.length === 15) fetchGSTDetails(v.toUpperCase());
            }}
            maxLength={15}
            loading={loadingGST}
            file={gstinFile}
            existingFile={existingGstinDoc}
            onFileChange={(f) => {
              setGstinFile(f);
              if (f) setExistingGstinDoc(undefined);
            }}
            onRemoveExisting={() => setExistingGstinDoc(undefined)}
            error={errors.gstin}
          />

          {gstStatus && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500">GST Status</span>
              <GstStatusChip status={gstStatus} />
            </div>
          )}

          <Field label="Company Name" required error={errors.companyName}>
            <input
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                clearError("companyName");
              }}
              className={fieldClass(!!errors.companyName)}
            />
          </Field>

          <Field label="Billing Address" required error={errors.billingAddress}>
            <textarea
              rows={3}
              value={billingAddress}
              onChange={(e) => {
                setBillingAddress(e.target.value);
                clearError("billingAddress");
              }}
              className={fieldClass(!!errors.billingAddress)}
            />
          </Field>

          <Field label="Branch Address" error={errors.branchAddresses}>
            <p className="mb-2 text-[10px] text-zinc-400">Optional</p>
            <div className="space-y-2">
              {branchAddresses.map((addr, index) => (
                <div key={index} className="flex gap-2">
                  <textarea
                    rows={2}
                    value={addr}
                    onChange={(e) => {
                      const next = [...branchAddresses];
                      next[index] = e.target.value;
                      setBranchAddresses(next);
                      clearError("branchAddresses");
                    }}
                    placeholder={`Branch address ${index + 1}`}
                    className={fieldClass(!!errors.branchAddresses)}
                  />
                  {branchAddresses.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setBranchAddresses(branchAddresses.filter((_, i) => i !== index))
                      }
                      className="shrink-0 rounded-lg border border-zinc-200 px-2 text-zinc-500 hover:bg-zinc-100"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setBranchAddresses([...branchAddresses, ""])}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                <Plus size={14} />
                Add Branch
              </button>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <FieldWithFile
              label="PAN"
              value={pan}
              onChange={(v) => {
                setPan(v.toUpperCase());
                clearError("pan");
              }}
              file={panFile}
              existingFile={existingPanDoc}
              onFileChange={(f) => {
                setPanFile(f);
                if (f) setExistingPanDoc(undefined);
              }}
              onRemoveExisting={() => setExistingPanDoc(undefined)}
              error={errors.pan}
            />

            <FieldWithFile
              label="IEC"
              value={iec}
              onChange={(v) => {
                setIec(v);
                clearError("iec");
              }}
              file={iecFile}
              existingFile={existingIecDoc}
              onFileChange={(f) => {
                setIecFile(f);
                if (f) setExistingIecDoc(undefined);
              }}
              onRemoveExisting={() => setExistingIecDoc(undefined)}
              error={errors.iec}
            />
          </div>

          <FieldWithFile
            label="AD Code"
            value={adCode}
            onChange={(v) => {
              setAdCode(v);
              clearError("adCode");
            }}
            file={adCodeFile}
            existingFile={existingAdCodeDoc}
            onFileChange={(f) => {
              setAdCodeFile(f);
              if (f) setExistingAdCodeDoc(undefined);
            }}
            onRemoveExisting={() => setExistingAdCodeDoc(undefined)}
            error={errors.adCode}
          />

          <div className="grid grid-cols-2 gap-4">
            <Field label="LOI No" error={errors.loiNo}>
              <input
                value={loiNo}
                onChange={(e) => {
                  setLoiNo(e.target.value);
                  clearError("loiNo");
                }}
                className={fieldClass(!!errors.loiNo)}
              />
            </Field>
            <Field label="LOI Date" error={errors.loiDate}>
              <input
                type="date"
                value={loiDate}
                onChange={(e) => {
                  setLoiDate(e.target.value);
                  clearError("loiDate");
                }}
                className={fieldClass(!!errors.loiDate)}
              />
            </Field>
          </div>

          <SingleFileField
            label="LOI Document"
            file={loiFile}
            existingFile={existingLoiDoc}
            onFileChange={(f) => {
              setLoiFile(f);
              if (f) setExistingLoiDoc(undefined);
              clearError("loiDocument");
            }}
            onRemoveExisting={() => setExistingLoiDoc(undefined)}
            error={errors.loiDocument}
          />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email" required error={errors.email}>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError("email");
                }}
                className={fieldClass(!!errors.email)}
              />
            </Field>
            <Field label="Phone" required error={errors.phone}>
              <input
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearError("phone");
                }}
                className={fieldClass(!!errors.phone)}
              />
            </Field>
          </div>

          <MultiFileField
            label="Director Aadhaar"
            files={directorAadharFiles}
            existingFiles={existingAadharDocs}
            onFilesAdd={(added) => {
              setDirectorAadharFiles((prev) => [...prev, ...added]);
              clearError("directorAadhar");
            }}
            onFileRemove={(index) =>
              setDirectorAadharFiles((prev) => prev.filter((_, i) => i !== index))
            }
            onExistingRemove={(index) =>
              setExistingAadharDocs((prev) => prev.filter((_, i) => i !== index))
            }
            error={errors.directorAadhar}
          />

          <MultiFileField
            label="Director PAN"
            files={directorPanFiles}
            existingFiles={existingPanDocs}
            onFilesAdd={(added) => {
              setDirectorPanFiles((prev) => [...prev, ...added]);
              clearError("directorPan");
            }}
            onFileRemove={(index) =>
              setDirectorPanFiles((prev) => prev.filter((_, i) => i !== index))
            }
            onExistingRemove={(index) =>
              setExistingPanDocs((prev) => prev.filter((_, i) => i !== index))
            }
            error={errors.directorPan}
          />

          <MultiFileField
            label="Other Supporting Documents"
            files={supportingDocs}
            existingFiles={existingSupportingDocs}
            onFilesAdd={(added) => setSupportingDocs((prev) => [...prev, ...added])}
            onFileRemove={(index) =>
              setSupportingDocs((prev) => prev.filter((_, i) => i !== index))
            }
            onExistingRemove={(index) =>
              setExistingSupportingDocs((prev) => prev.filter((_, i) => i !== index))
            }
          />

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={onClose}
              className="rounded-xl border border-zinc-200 px-5 py-2 text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

function FileChip({
  name,
  onRemove,
  onDownload,
}: {
  name: string;
  onRemove?: () => void;
  onDownload?: () => void;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-700">
      <span className="truncate">{name}</span>
      {onDownload && (
        <button type="button" onClick={onDownload} className="shrink-0 text-zinc-500 hover:text-zinc-900">
          <Download size={12} />
        </button>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} className="shrink-0 text-zinc-400 hover:text-red-500">
          <X size={12} />
        </button>
      )}
    </span>
  );
}

function FieldWithFile({
  label,
  valueRequired,
  value,
  onChange,
  maxLength,
  loading,
  file,
  existingFile,
  onFileChange,
  onRemoveExisting,
  error,
}: {
  label: string;
  valueRequired?: boolean;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  loading?: boolean;
  file: File | null;
  existingFile?: KycDocument;
  onFileChange: (file: File | null) => void;
  onRemoveExisting?: () => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasError = !!error;

  return (
    <div>
      <Field label={label} required={valueRequired} error={error}>
        <div className="relative flex gap-2">
          <input
            value={value}
            maxLength={maxLength}
            onChange={(e) => onChange(e.target.value)}
            className={`flex-1 rounded-xl border px-3 py-2 text-xs outline-none transition focus:ring-2 ${
              hasError
                ? "border-red-400 focus:ring-red-100"
                : "border-zinc-200 focus:border-zinc-500 focus:ring-zinc-200"
            }`}
          />
          {loading && (
            <div className="absolute right-12 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
            </div>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="shrink-0 rounded-xl border border-zinc-200 px-2.5 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            title="Upload document (optional)"
          >
            <Paperclip size={16} />
          </button>
          <input
            ref={inputRef}
            hidden
            type="file"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </div>
      </Field>
      <p className="mt-1 text-[10px] text-zinc-400">Document upload is optional</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {file && (
          <FileChip name={file.name} onRemove={() => onFileChange(null)} />
        )}
        {existingFile && !file && (
          <FileChip
            name={existingFile.name}
            onDownload={() => window.open(existingFile.url, "_blank")}
            onRemove={onRemoveExisting}
          />
        )}
      </div>
    </div>
  );
}

function SingleFileField({
  label,
  required,
  file,
  existingFile,
  onFileChange,
  onRemoveExisting,
  error,
}: {
  label: string;
  required?: boolean;
  file: File | null;
  existingFile?: KycDocument;
  onFileChange: (file: File | null) => void;
  onRemoveExisting?: () => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Field label={label} required={required} error={error}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 transition hover:border-zinc-400 ${
          error ? "border-red-400 bg-red-50/50" : "border-zinc-300"
        }`}
      >
        <Paperclip size={18} className={error ? "text-red-400" : "text-zinc-500"} />
        <span className="text-xs text-zinc-600">
          {file?.name || existingFile?.name || "Choose file"}
        </span>
      </button>
      <input
        ref={inputRef}
        hidden
        type="file"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {file && <FileChip name={file.name} onRemove={() => onFileChange(null)} />}
        {existingFile && !file && (
          <FileChip
            name={existingFile.name}
            onDownload={() => window.open(existingFile.url, "_blank")}
            onRemove={onRemoveExisting}
          />
        )}
      </div>
    </Field>
  );
}

function GstStatusChip({ status }: { status: string }) {
  const active = isGstActive(status);
  const isActive = active === true;
  const isInactive = active === false;

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
        isActive
          ? "bg-emerald-100 text-emerald-800"
          : isInactive
            ? "bg-red-100 text-red-700"
            : "bg-zinc-100 text-zinc-700"
      }`}
    >
      {isActive ? "GST Active" : isInactive ? "GST Inactive" : status}
    </span>
  );
}

function MultiFileField({
  label,
  required,
  files,
  existingFiles,
  onFilesAdd,
  onFileRemove,
  onExistingRemove,
  error,
}: {
  label: string;
  required?: boolean;
  files: File[];
  existingFiles: KycDocument[];
  onFilesAdd: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  onExistingRemove: (index: number) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Field label={label} required={required} error={error}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 transition hover:border-zinc-400 ${
          error ? "border-red-400 bg-red-50/50" : "border-zinc-300"
        }`}
      >
        <UploadCloud size={18} className={error ? "text-red-400" : "text-zinc-500"} />
        <span className="text-xs text-zinc-600">Choose files</span>
      </button>
      <input
        ref={inputRef}
        hidden
        multiple
        type="file"
        onChange={(e) => {
          if (e.target.files?.length) onFilesAdd(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {existingFiles.map((doc, i) => (
          <FileChip
            key={`existing-${doc.url}-${i}`}
            name={doc.name}
            onDownload={() => window.open(doc.url, "_blank")}
            onRemove={() => onExistingRemove(i)}
          />
        ))}
        {files.map((file, i) => (
          <FileChip key={`new-${file.name}-${i}`} name={file.name} onRemove={() => onFileRemove(i)} />
        ))}
      </div>
    </Field>
  );
}

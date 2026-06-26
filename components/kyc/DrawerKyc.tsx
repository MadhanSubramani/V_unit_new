"use client";

import { useEffect, useState } from "react";
import { X, UploadCloud } from "lucide-react";
import { Kyc } from "@/types/kyc";
import { addKyc } from "@/lib/kyc/createKyc";
import { updateKyc } from "@/lib/kyc/updateKyc";
import { uploadDocument } from "@/lib/kyc/uploadDocument";
import { checkDuplicateGstin } from "@/lib/gst/checkDuplicateGstin";
import { getGstinDetails } from "@/lib/gst/getGstinDetails";

interface Props {
  open: boolean;
  onClose: () => void;
  selected?: Kyc | null;
  onSaved: () => void;
}

type FormErrors = {
  gstin?: string;
  companyName?: string;
  billingAddress?: string;
  deliveryAddress?: string;
  pan?: string;
  iec?: string;
  adCode?: string;
  email?: string;
  phone?: string;
  directorAadhar?: string;
  directorPan?: string;
  loi?: string;
  form?: string;
};

export default function KycDrawer({ open, onClose, selected, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingGST, setLoadingGST] = useState(false);
  const [gstin, setGstin] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [pan, setPan] = useState("");
  const [iec, setIec] = useState("");
  const [adCode, setAdCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [directorAadhar, setDirectorAadhar] = useState<File | null>(null);
  const [directorPan, setDirectorPan] = useState<File | null>(null);
  const [loi, setLoi] = useState<File | null>(null);
  const [supportingDocs, setSupportingDocs] = useState<File[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!selected) {
      resetForm();
      return;
    }
    setGstin(selected.gstin);
    setCompanyName(selected.companyName);
    setBillingAddress(selected.billingAddress);
    setDeliveryAddress(selected.deliveryAddress);
    setPan(selected.pan);
    setIec(selected.iec);
    setAdCode(selected.adCode);
    setEmail(selected.email);
    setPhone(selected.phone);
    setErrors({});
  }, [selected, open]);

  const fieldClass = (hasError: boolean) =>
    `w-full rounded-xl border px-3 py-2 text-xs outline-none transition focus:ring-2 ${
      hasError
        ? "border-red-400 focus:ring-red-100"
        : "border-zinc-200 focus:border-zinc-500 focus:ring-zinc-200"
    }`;

  const fetchGSTDetails = async (gst: string) => {
    if (gst.length !== 15) return;
    setLoadingGST(true);
    setErrors((e) => ({ ...e, gstin: undefined, form: undefined }));

    try {
      const exists = await checkDuplicateGstin(gst);
      if (exists && selected?.gstin !== gst) {
        setErrors((e) => ({
          ...e,
          gstin: "KYC already completed for this GSTIN.",
        }));
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
      setBillingAddress(data.pradr.adr);
      setDeliveryAddress(data.pradr.adr);
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
    if (!deliveryAddress.trim()) next.deliveryAddress = "Delivery address is required.";
    if (!pan.trim()) next.pan = "PAN is required.";
    if (!iec.trim()) next.iec = "IEC is required.";
    if (!adCode.trim()) next.adCode = "AD Code is required.";

    if (!email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Enter a valid email address.";

    if (!phone.trim()) next.phone = "Phone is required.";

    if (!selected?.directorAadhar && !directorAadhar)
      next.directorAadhar = "Director Aadhaar is required.";
    if (!selected?.directorPan && !directorPan)
      next.directorPan = "Director PAN is required.";
    if (!selected?.loi && !loi) next.loi = "LOI is required.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    setErrors((e) => ({ ...e, form: undefined }));
    if (!validate()) return;

    try {
      setLoading(true);

      let directorAadharData = selected?.directorAadhar;
      let directorPanData = selected?.directorPan;
      let loiData = selected?.loi;
      let supportingDocsData = selected?.supportingDocuments ?? [];

      if (directorAadhar) {
        directorAadharData = await uploadDocument(directorAadhar, "kyc/director-aadhar");
      }
      if (directorPan) {
        directorPanData = await uploadDocument(directorPan, "kyc/director-pan");
      }
      if (loi) {
        loiData = await uploadDocument(loi, "kyc/loi");
      }
      if (supportingDocs.length > 0) {
        supportingDocsData = [];
        for (const file of supportingDocs) {
          const uploaded = await uploadDocument(file, "kyc/supporting-documents");
          supportingDocsData.push(uploaded);
        }
      }

      const payload = {
        gstin,
        companyName,
        billingAddress,
        deliveryAddress,
        pan,
        iec,
        adCode,
        email,
        phone,
        directorAadhar: directorAadharData,
        directorPan: directorPanData,
        loi: loiData,
        supportingDocuments: supportingDocsData,
      };

      if (selected?.id) {
        await updateKyc(selected.id, payload);
      } else {
        await addKyc(payload);
      }

      resetForm();
      onSaved();
      onClose();
    } catch {
      setErrors((e) => ({
        ...e,
        form: "Unable to save KYC. Please try again.",
      }));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setGstin("");
    setCompanyName("");
    setBillingAddress("");
    setDeliveryAddress("");
    setPan("");
    setIec("");
    setAdCode("");
    setEmail("");
    setPhone("");
    setDirectorAadhar(null);
    setDirectorPan(null);
    setLoi(null);
    setSupportingDocs([]);
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

          <Field label="GSTIN" required error={errors.gstin}>
            <div className="relative">
              <input
                value={gstin}
                maxLength={15}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  setGstin(value);
                  if (errors.gstin) setErrors({ ...errors, gstin: undefined });
                  if (value.length === 15) fetchGSTDetails(value);
                }}
                className={fieldClass(!!errors.gstin)}
              />
              {loadingGST && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
                </div>
              )}
            </div>
          </Field>

          <Field label="Company Name" required error={errors.companyName}>
            <input
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                if (errors.companyName) setErrors({ ...errors, companyName: undefined });
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
                if (errors.billingAddress) setErrors({ ...errors, billingAddress: undefined });
              }}
              className={fieldClass(!!errors.billingAddress)}
            />
          </Field>

          <Field label="Delivery Address" required error={errors.deliveryAddress}>
            <textarea
              rows={3}
              value={deliveryAddress}
              onChange={(e) => {
                setDeliveryAddress(e.target.value);
                if (errors.deliveryAddress) setErrors({ ...errors, deliveryAddress: undefined });
              }}
              className={fieldClass(!!errors.deliveryAddress)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="PAN" required error={errors.pan}>
              <input
                value={pan}
                onChange={(e) => {
                  setPan(e.target.value);
                  if (errors.pan) setErrors({ ...errors, pan: undefined });
                }}
                className={fieldClass(!!errors.pan)}
              />
            </Field>
            <Field label="IEC" required error={errors.iec}>
              <input
                value={iec}
                onChange={(e) => {
                  setIec(e.target.value);
                  if (errors.iec) setErrors({ ...errors, iec: undefined });
                }}
                className={fieldClass(!!errors.iec)}
              />
            </Field>
          </div>

          <Field label="AD Code" required error={errors.adCode}>
            <input
              value={adCode}
              onChange={(e) => {
                setAdCode(e.target.value);
                if (errors.adCode) setErrors({ ...errors, adCode: undefined });
              }}
              className={fieldClass(!!errors.adCode)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email" required error={errors.email}>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: undefined });
                }}
                className={fieldClass(!!errors.email)}
              />
            </Field>
            <Field label="Phone" required error={errors.phone}>
              <input
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors({ ...errors, phone: undefined });
                }}
                className={fieldClass(!!errors.phone)}
              />
            </Field>
          </div>

          <UploadField
            title="Director Aadhaar"
            required
            file={directorAadhar}
            error={errors.directorAadhar}
            setFile={(file) => {
              setDirectorAadhar(file);
              if (errors.directorAadhar) setErrors({ ...errors, directorAadhar: undefined });
            }}
          />

          <UploadField
            title="Director PAN"
            required
            file={directorPan}
            error={errors.directorPan}
            setFile={(file) => {
              setDirectorPan(file);
              if (errors.directorPan) setErrors({ ...errors, directorPan: undefined });
            }}
          />

          <UploadField
            title="LOI"
            required
            file={loi}
            error={errors.loi}
            setFile={(file) => {
              setLoi(file);
              if (errors.loi) setErrors({ ...errors, loi: undefined });
            }}
          />

          <MultiUploadField files={supportingDocs} setFiles={setSupportingDocs} />

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

function UploadField({
  title,
  required,
  file,
  error,
  setFile,
}: {
  title: string;
  required?: boolean;
  file: File | null;
  error?: string;
  setFile: (file: File | null) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-zinc-700">
        {title} {required && <span className="text-red-500">*</span>}
      </label>
      <label
        className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 transition hover:border-zinc-400 ${
          error ? "border-red-400 bg-red-50/50" : "border-zinc-300"
        }`}
      >
        <UploadCloud size={18} className={error ? "text-red-400" : "text-zinc-500"} />
        <span className="text-xs text-zinc-600">{file ? file.name : "Choose File"}</span>
        <input
          hidden
          type="file"
          onChange={(e) => {
            if (e.target.files) setFile(e.target.files[0]);
          }}
        />
      </label>
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

function MultiUploadField({
  files,
  setFiles,
}: {
  files: File[];
  setFiles: (files: File[]) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-zinc-700">
        Other Supporting Documents
      </label>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-zinc-300 p-4 hover:border-zinc-400">
        <UploadCloud size={18} />
        <span className="text-xs text-zinc-600">Select Files</span>
        <input
          hidden
          multiple
          type="file"
          onChange={(e) => {
            if (!e.target.files) return;
            setFiles(Array.from(e.target.files));
          }}
        />
      </label>
      {files.length > 0 && (
        <div className="mt-2 space-y-1">
          {files.map((file) => (
            <p key={file.name} className="text-[11px] text-zinc-500">
              {file.name}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

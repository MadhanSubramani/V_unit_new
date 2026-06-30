"use client";

import { X, Download } from "lucide-react";
import { Kyc, KycDocument } from "@/types/kyc";
import { normalizeDocArray } from "@/lib/kyc/normalizeKyc";
import { isGstActive } from "@/lib/gst/parseGstStatus";

interface Props {
  open: boolean;
  onClose: () => void;
  kyc?: Kyc | null;
}

export default function KycViewDrawer({ open, onClose, kyc }: Props) {
  if (!open || !kyc) return null;

  const aadharDocs = normalizeDocArray(kyc.directorAadhar);
  const panDocs = normalizeDocArray(kyc.directorPan);
  const supportingDocs = normalizeDocArray(kyc.supportingDocuments);

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />

      <div className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">KYC Details</h2>
            <p className="text-xs text-zinc-500">View company information</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-5">
            <Info title="File No" value={kyc.fileNo} />
            <Info title="Company Name" value={kyc.companyName} />
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <FieldWithDoc label="GSTIN" value={kyc.gstin} doc={kyc.gstinDocument} />
              {kyc.gstStatus && (
                <div className="mt-2 flex items-center gap-2">
                  <GstStatusChip status={kyc.gstStatus} />
                </div>
              )}
            </div>
            <InfoBlock title="Billing Address" value={kyc.billingAddress} full />

            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">Branch Addresses</p>
              {kyc.branchAddresses?.length ? (
                <div className="space-y-2">
                  {kyc.branchAddresses.map((addr, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800"
                    >
                      {addr}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyValue />
              )}
            </div>

            <div className="grid grid-cols-2 gap-5">
              <FieldWithDoc label="PAN" value={kyc.pan} doc={kyc.panDocument} />
              <FieldWithDoc label="IEC" value={kyc.iec} doc={kyc.iecDocument} />
            </div>

            <FieldWithDoc label="AD Code" value={kyc.adCode} doc={kyc.adCodeDocument} />

            <div className="grid grid-cols-2 gap-5">
              <Info title="LOI No" value={kyc.loiNo} />
              <Info title="LOI Date" value={kyc.loiDate} />
            </div>

            <FieldWithDoc label="LOI Document" doc={kyc.loiDocument} />

            <div className="grid grid-cols-2 gap-5">
              <Info title="Email" value={kyc.email} />
              <Info title="Phone" value={kyc.phone} />
            </div>

            <MultiDocField label="Director Aadhaar" docs={aadharDocs} />
            <MultiDocField label="Director PAN" docs={panDocs} />
            <MultiDocField label="Supporting Documents" docs={supportingDocs} />
          </div>
        </div>
      </div>
    </>
  );
}

function Info({ title, value }: { title: string; value?: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-zinc-500">{title}</p>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800">
        {value || "-"}
      </div>
    </div>
  );
}

function InfoBlock({
  title,
  value,
  full,
}: {
  title: string;
  value?: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="mb-1 text-xs font-medium text-zinc-500">{title}</p>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800">
        {value || "-"}
      </div>
    </div>
  );
}

function EmptyValue() {
  return (
    <div className="rounded-xl border border-dashed border-zinc-200 px-3 py-2 text-xs text-zinc-400">
      No data
    </div>
  );
}

function FileChip({ name, onDownload }: { name: string; onDownload: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-700">
      <span className="truncate">{name}</span>
      <button type="button" onClick={onDownload} className="shrink-0 text-zinc-500 hover:text-zinc-900">
        <Download size={12} />
      </button>
    </span>
  );
}

function FieldWithDoc({
  label,
  value,
  doc,
}: {
  label: string;
  value?: string;
  doc?: KycDocument;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-zinc-500">{label}</p>
      {value !== undefined && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800">
          {value || "-"}
        </div>
      )}
      {doc ? (
        <div className={value !== undefined ? "mt-2" : ""}>
          <FileChip name={doc.name} onDownload={() => window.open(doc.url, "_blank")} />
        </div>
      ) : (
        <p className={`${value !== undefined ? "mt-1.5" : ""} text-[11px] text-zinc-400`}>
          No file uploaded
        </p>
      )}
    </div>
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

function MultiDocField({ label, docs }: { label: string; docs: KycDocument[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-zinc-500">{label}</p>
      {docs.length ? (
        <div className="flex flex-wrap gap-1.5">
          {docs.map((doc, i) => (
            <FileChip
              key={`${doc.url}-${i}`}
              name={doc.name}
              onDownload={() => window.open(doc.url, "_blank")}
            />
          ))}
        </div>
      ) : (
        <EmptyValue />
      )}
    </div>
  );
}

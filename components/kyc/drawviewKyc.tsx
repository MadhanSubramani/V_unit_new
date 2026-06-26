"use client";

import { X, Download, FileText } from "lucide-react";
import { Kyc } from "@/types/kyc";

interface Props {
  open: boolean;
  onClose: () => void;
  kyc?: Kyc | null;
}

export default function KycViewDrawer({
  open,
  onClose,
  kyc,
}: Props) {
  if (!open || !kyc) return null;

  const FileItem = ({
    title,
    file,
  }: {
    title: string;
    file?: {
      name: string;
      url: string;
    };
  }) => (
    <div className="space-y-2">
      <p className="text-xs font-medium text-zinc-500">{title}</p>

      {file ? (
        <button
          onClick={() => window.open(file.url, "_blank")}
          className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm transition hover:bg-zinc-100"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <FileText size={16} className="text-zinc-500" />

            <span className="truncate">{file.name}</span>
          </div>

          <Download size={15} />
        </button>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-200 px-3 py-2 text-xs text-zinc-400">
          No file uploaded
        </div>
      )}
    </div>
  );

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
      />

      <div className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-2xl flex-col bg-white shadow-2xl">

        {/* Header */}

        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">
              KYC Details
            </h2>

            <p className="text-xs text-zinc-500">
              View company information
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-zinc-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          <div className="grid grid-cols-2 gap-5">

            <Info title="GSTIN" value={kyc.gstin} />
            <Info title="Company Name" value={kyc.companyName} />

            <Info
              title="Billing Address"
              value={kyc.billingAddress}
            />

            <Info
              title="Delivery Address"
              value={kyc.deliveryAddress}
            />

            <Info title="PAN" value={kyc.pan} />
            <Info title="IEC" value={kyc.iec} />

            <Info title="AD Code" value={kyc.adCode} />
            <Info title="Email" value={kyc.email} />

            <Info title="Phone" value={kyc.phone} />

          </div>

          <div className="mt-8 space-y-5">

            <FileItem
              title="Director Aadhaar"
              file={kyc.directorAadhar}
            />

            <FileItem
              title="Director PAN"
              file={kyc.directorPan}
            />

            <FileItem
              title="LOI"
              file={kyc.loi}
            />

            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-500">
                Supporting Documents
              </p>

              {kyc.supportingDocuments?.length ? (
                <div className="space-y-2">

                  {kyc.supportingDocuments.map(
                    (file: any, index: number) => (
                      <button
                        key={index}
                        onClick={() =>
                          window.open(file.url, "_blank")
                        }
                        className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm hover:bg-zinc-100"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText
                            size={16}
                            className="text-zinc-500"
                          />

                          <span className="truncate">
                            {file.name}
                          </span>
                        </div>

                        <Download size={15} />
                      </button>
                    )
                  )}

                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-200 px-3 py-2 text-xs text-zinc-400">
                  No supporting documents
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

function Info({
  title,
  value,
}: {
  title: string;
  value?: string;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-zinc-500">
        {title}
      </p>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
        {value || "-"}
      </div>
    </div>
  );
}
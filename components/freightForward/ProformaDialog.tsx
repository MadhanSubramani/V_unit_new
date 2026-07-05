"use client";

import { useState } from "react";
import { FreightForward } from "@/types/freightForward";
import { Kyc } from "@/types/kyc";
import type { ProformaInput } from "@/lib/freightForward/generateProformaPdf";

interface ProformaDialogProps {
  open: boolean;
  record: FreightForward;
  kycList: Kyc[];
  onClose: () => void;
}

export default function ProformaDialog({
  open,
  record,
  kycList,
  onClose,
}: ProformaDialogProps) {
  const [exWorksGstPercent, setExWorksGstPercent] = useState("5");
  const [oceanFreightGstPercent, setOceanFreightGstPercent] = useState("5");
  const [blFeeGstPercent, setBlFeeGstPercent] = useState("18");
  const [blFee, setBlFee] = useState("");
  const [rupeePerDollar, setRupeePerDollar] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  if (!open) return null;

  const handleGenerate = async () => {
    setError("");
    const exGst = Number(exWorksGstPercent);
    const oceanGst = Number(oceanFreightGstPercent);
    const blGst = Number(blFeeGstPercent);
    const blFeeNum = Number(blFee);
    const roe = Number(rupeePerDollar);

    if (
      Number.isNaN(exGst) ||
      exGst < 0 ||
      Number.isNaN(oceanGst) ||
      oceanGst < 0 ||
      Number.isNaN(blGst) ||
      blGst < 0 ||
      Number.isNaN(blFeeNum) ||
      blFeeNum < 0 ||
      Number.isNaN(roe) ||
      roe <= 0
    ) {
      setError("Please enter valid GST percentages, BL fee, and rupee value per dollar.");
      return;
    }

    const input: ProformaInput = {
      exWorksGstPercent: exGst,
      oceanFreightGstPercent: oceanGst,
      blFeeGstPercent: blGst,
      blFee: blFeeNum,
      rupeePerDollar: roe,
    };

    setGenerating(true);
    try {
      const { generateProformaPdf } = await import(
        "@/lib/freightForward/generateProformaPdf"
      );
      await generateProformaPdf(record, kycList, input);
      onClose();
    } catch {
      setError("Unable to generate freight certificate. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-zinc-900">Freight Certificate Generation</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Enter GST rates and conversion for {record.consignmentName}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">
              GST % on Total Ex Works
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={exWorksGstPercent}
              onChange={(e) => setExWorksGstPercent(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">
              GST % on Ocean Freight
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={oceanFreightGstPercent}
              onChange={(e) => setOceanFreightGstPercent(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
            <p className="mt-1 text-[10px] text-zinc-400">
              Ocean freight amount is taken from the record (${record.oceanFreight ?? 0})
            </p>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">
              GST % on BL Fee
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={blFeeGstPercent}
              onChange={(e) => setBlFeeGstPercent(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">
              BL Fee (INR)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={blFee}
              onChange={(e) => setBlFee(e.target.value)}
              placeholder="4500"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">
              Rupee Value per Dollar
            </label>
            <input
              type="number"
              min="0"
              step="0.0001"
              value={rupeePerDollar}
              onChange={(e) => setRupeePerDollar(e.target.value)}
              placeholder="96.50"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-[11px] text-red-500">{error}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-xl bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {generating ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}

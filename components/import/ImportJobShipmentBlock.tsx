"use client";

import { Plus, X } from "lucide-react";
import FileInputWithClip from "@/components/import/FileInputWithClip";
import {
  FreightContainer,
  FreightForwardDocument,
  ImportLoadType,
  ImportShipmentMode,
} from "@/types/freightForward";
import { ConfigItem } from "@/types/configuration";
import { houseBlLabel, masterBlLabel } from "@/lib/import/hbl";
import { emptyContainer } from "@/lib/freightForward/containers";

export type HblDraft = {
  number: string;
  file: File | null;
  existing?: FreightForwardDocument;
};

export function ImportJobShipmentBlock({
  mode,
  loadType,
  mbl,
  mblFile,
  mblDoc,
  hblDrafts,
  containers,
  containerSizes,
  containerTypes,
  errors,
  fieldClass,
  readOnly,
  requireMblFile,
  onModeChange,
  onLoadTypeChange,
  onMblChange,
  onMblFileChange,
  onClearMblDoc,
  onHblChange,
  onAddHbl,
  onRemoveHbl,
  onClearHblFile,
  onContainerChange,
  onAddContainer,
  onRemoveContainer,
  onContainerBlur,
}: {
  mode: ImportShipmentMode;
  loadType: ImportLoadType;
  mbl: string;
  mblFile: File | null;
  mblDoc?: FreightForwardDocument;
  hblDrafts: HblDraft[];
  containers: FreightContainer[];
  containerSizes: ConfigItem[];
  containerTypes: ConfigItem[];
  errors: Record<string, string>;
  fieldClass: (key: string) => string;
  readOnly?: boolean;
  requireMblFile?: boolean;
  onModeChange: (mode: ImportShipmentMode) => void;
  onLoadTypeChange: (loadType: ImportLoadType) => void;
  onMblChange: (value: string) => void;
  onMblFileChange: (file: File | null) => void;
  onClearMblDoc?: () => void;
  onHblChange: (index: number, next: HblDraft) => void;
  onAddHbl: () => void;
  onRemoveHbl: (index: number) => void;
  onClearHblFile?: (index: number) => void;
  onContainerChange: (
    index: number,
    field: keyof FreightContainer,
    value: string
  ) => void;
  onAddContainer: () => void;
  onRemoveContainer: (index: number) => void;
  onContainerBlur: (index: number, value: string) => void;
}) {
  const mblLabel = masterBlLabel(mode);
  const hblLabel = houseBlLabel(mode);

  return (
    <>
      <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
        <p className="text-xs font-medium text-zinc-700">Mode</p>
        <div className="flex gap-4 text-xs">
          {(["sea", "air"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 capitalize">
              <input
                type="radio"
                checked={mode === value}
                disabled={readOnly}
                onChange={() => onModeChange(value)}
              />
              {value}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        <span className="font-medium text-zinc-700">
          {mblLabel} <span className="text-red-500">*</span>
        </span>
        <input
          value={mbl}
          disabled={readOnly}
          onChange={(event) => onMblChange(event.target.value)}
          className={fieldClass("mbl")}
        />
        {!readOnly && (
          <FileInputWithClip onChange={onMblFileChange} />
        )}
        {mblDoc && (
          <div className="flex items-center justify-between text-[11px] text-zinc-600">
            <a href={mblDoc.url} target="_blank" rel="noreferrer" className="underline">
              {mblDoc.name || "Current file"}
            </a>
            {onClearMblDoc && !readOnly && (
              <button type="button" onClick={onClearMblDoc} className="text-zinc-400">
                <X size={12} />
              </button>
            )}
          </div>
        )}
        {mblFile && (
          <p className="text-[11px] text-zinc-500">{mblFile.name}</p>
        )}
        {(errors.mbl || (requireMblFile && errors.mblFile)) && (
          <span className="text-[11px] text-red-500">
            {errors.mbl || errors.mblFile}
          </span>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
        <p className="text-xs font-medium text-zinc-700">Load type</p>
        <div className="flex gap-4 text-xs">
          {(["lcl", "fcl"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 uppercase">
              <input
                type="radio"
                checked={loadType === value || (value === "lcl" && loadType === "icl")}
                disabled={readOnly}
                onChange={() => onLoadTypeChange(value)}
              />
              {value}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-zinc-700">{hblLabel}</p>
          {!readOnly && (
            <button
              type="button"
              onClick={onAddHbl}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-[11px] text-zinc-600"
            >
              <Plus size={12} />
              Add
            </button>
          )}
        </div>
        {hblDrafts.length === 0 && (
          <p className="text-[11px] text-zinc-400">
            Optional. Add one or more {hblLabel} numbers and files.
          </p>
        )}
        {hblDrafts.map((draft, index) => (
          <div key={index} className="space-y-1 rounded-lg border border-zinc-100 p-2">
            <div className="flex gap-2">
              <input
                value={draft.number}
                disabled={readOnly}
                placeholder={`${hblLabel} number`}
                onChange={(event) =>
                  onHblChange(index, { ...draft, number: event.target.value })
                }
                className={fieldClass(`hbl.${index}`)}
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onRemoveHbl(index)}
                  className="rounded-lg border border-zinc-200 px-2 text-zinc-500"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {!readOnly && (
              <FileInputWithClip
                onChange={(file) => onHblChange(index, { ...draft, file })}
              />
            )}
            {draft.existing && (
              <div className="flex items-center gap-2">
                <a
                  href={draft.existing.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block min-w-0 flex-1 truncate text-[11px] underline"
                >
                  {draft.existing.name || "Current file"}
                </a>
                {onClearHblFile && !readOnly && (
                  <button
                    type="button"
                    title="Remove file"
                    onClick={() => onClearHblFile(index)}
                    className="rounded-lg border border-zinc-200 p-1 text-zinc-500"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
            {draft.file && (
              <p className="text-[11px] text-zinc-500">{draft.file.name}</p>
            )}
          </div>
        ))}
      </div>

      {mode !== "air" && (
        <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-700">
              Containers <span className="text-red-500">*</span>
            </p>
            {!readOnly && (
              <button
                type="button"
                onClick={onAddContainer}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-[11px] text-zinc-600"
              >
                <Plus size={12} />
                Add
              </button>
            )}
          </div>
          {containers.map((item, index) => (
            <div key={index} className="space-y-1">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <input
                  value={item.containerNumber}
                  placeholder="ABCD1234567"
                  maxLength={11}
                  disabled={readOnly}
                  onChange={(event) =>
                    onContainerChange(index, "containerNumber", event.target.value)
                  }
                  onBlur={() => onContainerBlur(index, item.containerNumber)}
                  className={fieldClass(`containers.${index}.containerNumber`)}
                />
                <select
                  value={item.containerSize ?? ""}
                  disabled={readOnly}
                  onChange={(event) =>
                    onContainerChange(index, "containerSize", event.target.value)
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
                  disabled={readOnly}
                  onChange={(event) =>
                    onContainerChange(index, "containerType", event.target.value)
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
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onRemoveContainer(index)}
                    className="rounded-lg border border-zinc-200 px-2 text-zinc-500"
                    title="Remove container"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {errors[`containers.${index}.containerNumber`] && (
                <p className="text-[11px] text-red-500">
                  {errors[`containers.${index}.containerNumber`]}
                </p>
              )}
            </div>
          ))}
          {containers.length === 0 && (
            <button
              type="button"
              onClick={onAddContainer}
              className="text-[11px] text-zinc-500 underline"
            >
              Add a container
            </button>
          )}
        </div>
      )}
    </>
  );
}

export function emptyHblDraft(): HblDraft {
  return { number: "", file: null };
}

export { emptyContainer };

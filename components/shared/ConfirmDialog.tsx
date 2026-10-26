"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  items?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  items,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  variant = "danger",
  hideCancel = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <p className="mt-2 text-xs text-zinc-500">{message}</p>
        {items?.length ? (
          <ul className="mt-3 max-h-56 list-disc space-y-1 overflow-auto pl-5 text-xs text-zinc-800">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          {!hideCancel && (
            <button
              onClick={onCancel}
              className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium text-white ${
              variant === "danger"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-zinc-900 hover:bg-zinc-800"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

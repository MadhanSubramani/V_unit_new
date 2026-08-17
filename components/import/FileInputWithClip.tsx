"use client";

import { Paperclip } from "lucide-react";

export default function FileInputWithClip({
  onChange,
  disabled,
}: {
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Paperclip size={14} className="shrink-0 text-zinc-500" />
      <input
        type="file"
        disabled={disabled}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="min-w-0 flex-1 text-[11px] file:mr-2"
      />
    </div>
  );
}

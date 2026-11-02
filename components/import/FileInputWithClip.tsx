"use client";

import { Paperclip } from "lucide-react";

export default function FileInputWithClip({
  onChange,
  disabled,
  multiple = false,
}: {
  onChange: (file: File | null) => void;
  disabled?: boolean;
  multiple?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Paperclip size={14} className="shrink-0 text-zinc-500" />
      <input
        type="file"
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          const files = e.target.files;
          if (!files?.length) {
            onChange(null);
            return;
          }
          // Call once per selected file so multi-upload appends each file.
          Array.from(files).forEach((file) => onChange(file));
          e.target.value = "";
        }}
        className="min-w-0 flex-1 text-[11px] file:mr-2"
      />
    </div>
  );
}

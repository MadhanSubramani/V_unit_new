"use client";

import { useMemo, useState } from "react";

export default function ConfigTypeahead({
  value,
  options,
  onChange,
  disabled,
  placeholder = "Type to search",
  className,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const needle = value.trim().toLowerCase();
    if (!needle) return options.slice(0, 12);
    return options
      .filter((option) => option.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [options, value]);

  return (
    <div className="relative">
      <input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      />
      {open && !disabled && filtered.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 text-xs shadow-lg">
          {filtered.map((option) => (
            <li key={option}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left hover:bg-zinc-50"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

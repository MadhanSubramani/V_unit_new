"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  value: string;
  onSearch: (value: string) => void;
}

export default function KycSearch({
  value,
  onSearch,
}: Props) {
  const [search, setSearch] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(search.trim());
    }, 400);

    return () => clearTimeout(timer);
  }, [search, onSearch]);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  return (
    <div className="relative w-full max-w-md">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
      />

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search Company, GSTIN or Phone..."
        className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-10 text-sm outline-none transition-all placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
      />

      {search && (
        <button
          onClick={() => setSearch("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
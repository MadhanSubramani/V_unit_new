"use client";

import type { ReactElement } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { DownloadFormat } from "@/lib/import/mergeDocuments";

export default function DownloadFormatMenu({
  trigger,
  disabled,
  onSelect,
}: {
  trigger: ReactElement;
  disabled?: boolean;
  onSelect: (format: DownloadFormat) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        {trigger}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-[80] w-36 rounded-xl border border-zinc-200 bg-white p-1 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <DropdownMenu.Item
            onSelect={() => onSelect("pdf")}
            className="cursor-pointer rounded-lg px-3 py-2 text-xs outline-none hover:bg-zinc-100"
          >
            PDF
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => onSelect("zip")}
            className="cursor-pointer rounded-lg px-3 py-2 text-xs outline-none hover:bg-zinc-100"
          >
            ZIP
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

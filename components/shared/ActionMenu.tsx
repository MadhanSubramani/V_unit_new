"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface ActionMenuProps {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ActionMenu({ onView, onEdit, onDelete }: ActionMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900">
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={5}
          className="z-50 w-40 rounded-xl border border-zinc-200 bg-white p-1 shadow-xl"
        >
          <DropdownMenu.Item
            onClick={onView}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs outline-none hover:bg-zinc-100"
          >
            <Eye size={14} />
            View
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onClick={onEdit}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs outline-none hover:bg-zinc-100"
          >
            <Pencil size={14} />
            Edit
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onClick={onDelete}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-600 outline-none hover:bg-red-50"
          >
            <Trash2 size={14} />
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

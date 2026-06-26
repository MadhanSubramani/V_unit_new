"use client";

import { MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Kyc } from "@/types/kyc";

interface Props {
  data: Kyc[];

  onView: (item: Kyc) => void;
  onEdit: (item: Kyc) => void;
  onDelete: (id: string) => void;
}

export default function KycTable({
  data,
  onView,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-[11px] uppercase tracking-wide text-zinc-500">
            <th className="px-4 py-3">GSTIN</th>
            <th className="px-4 py-3">Company Name</th>
            <th className="px-4 py-3">Billing Address</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3 text-center">Actions</th>
          </tr>
        </thead>

        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-10 text-center text-zinc-400"
              >
                No KYC records found
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={item.id}
                className="border-t border-zinc-100 hover:bg-zinc-50"
              >
                <td className="px-4 py-3 text-zinc-700">
                  {item.gstin}
                </td>

                <td className="px-4 py-3 font-medium text-zinc-800">
                  {item.companyName}
                </td>

                <td className="px-4 py-3">
                  <div
                    title={item.billingAddress}
                    className="max-w-[220px] truncate text-zinc-600"
                  >
                    {item.billingAddress}
                  </div>
                </td>

                <td className="px-4 py-3 text-zinc-600">
                  {item.email}
                </td>

                <td className="px-4 py-3 text-zinc-600">
                  {item.phone}
                </td>

                <td className="px-4 py-3 text-center">
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100">
                        <MoreHorizontal size={16} />
                      </button>
                    </DropdownMenu.Trigger>

                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        sideOffset={5}
                        align="end"
                        className="z-50 min-w-[150px] rounded-xl border border-zinc-200 bg-white p-1 shadow-xl"
                      >
                        <DropdownMenu.Item
                          onClick={() => onView(item)}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-xs outline-none hover:bg-zinc-100"
                        >
                          <Eye size={14} />
                          View
                        </DropdownMenu.Item>

                        <DropdownMenu.Item
                          onClick={() => onEdit(item)}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-xs outline-none hover:bg-zinc-100"
                        >
                          <Pencil size={14} />
                          Edit
                        </DropdownMenu.Item>

                        <DropdownMenu.Item
                          onClick={() => onDelete(item.id!)}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-xs text-red-600 outline-none hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                          Delete
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
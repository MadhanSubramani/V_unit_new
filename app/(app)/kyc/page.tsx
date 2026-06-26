"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import ModuleHeader from "@/components/ModuleHeader";

import KycDrawer from "@/components/kyc/DrawerKyc";
import KycViewDrawer from "@/components/kyc/drawviewKyc";
import KycPagination from "@/components/kyc/pageKyc";
import KycSearch from "@/components/kyc/searchKyc";

import { Kyc } from "@/types/kyc";

import { getKyc } from "@/lib/kyc/getKyc";
import { searchKyc } from "@/lib/kyc/searchKyc";
import { deleteKyc } from "@/lib/kyc/deleteKyc";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

const PAGE_SIZE = 10;

export default function KycPage() {
  const [loading, setLoading] = useState(true);

  const [kycList, setKycList] = useState<Kyc[]>([]);

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);

  const [viewOpen, setViewOpen] = useState(false);

  const [selected, setSelected] = useState<Kyc | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);

    try {
      let data: Kyc[];

      if (search.trim()) {
        data = await searchKyc(search.trim());
      } else {
        data = await getKyc();
      }

      setKycList(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [search]);

  const totalPages = Math.ceil(
    kycList.length / PAGE_SIZE
  );

  const currentData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return kycList.slice(start, start + PAGE_SIZE);
  }, [kycList, page]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteKyc(deleteId);
    setDeleteId(null);
    loadData();
  };

  const openAddDrawer = () => {
    setSelected(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (item: Kyc) => {
    setSelected(item);
    setDrawerOpen(true);
  };

  const openViewDrawer = (item: Kyc) => {
    setSelected(item);
    setViewOpen(true);
  };

  return (<>
  <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
    <ModuleHeader
      title="KYC"
      description="Manage customer KYC information and documents."
    />

    <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <KycSearch
        value={search}
        onSearch={(value) => {
          setPage(1);
          setSearch(value);
        }}
      />

      <button
        onClick={openAddDrawer}
        className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800"
      >
        <Plus size={16} />
        Add KYC
      </button>
    </div>

    <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Company Name
              </th>

              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                GSTIN
              </th>

              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Billing Address
              </th>

              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Email
              </th>

              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Phone
              </th>

              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 text-center text-zinc-500"
                >
                  Loading...
                </td>
              </tr>
            ) : currentData.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 text-center text-zinc-400"
                >
                  No KYC records found.
                </td>
              </tr>
            ) : (
              currentData.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-zinc-100 hover:bg-zinc-50"
                >
                  <td className="px-4 py-3 font-medium text-zinc-800">
                    {item.companyName}
                  </td>

                  <td className="px-4 py-3 text-zinc-600">
                    {item.gstin}
                  </td>

                  <td className="px-4 py-3">
                    <div
                      title={item.billingAddress}
                      className="max-w-[260px] truncate text-zinc-600"
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
        onClick={() => openViewDrawer(item)}
        className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-zinc-100"
      >
        <Eye size={14} />
        View
      </DropdownMenu.Item>

      <DropdownMenu.Item
        onClick={() => openEditDrawer(item)}
        className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-zinc-100"
      >
        <Pencil size={14} />
        Edit
      </DropdownMenu.Item>

      <DropdownMenu.Item
        onClick={() => setDeleteId(item.id!)}
        className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 outline-none hover:bg-red-50"
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
    </div>
        <div className="mt-5">
      <KycPagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  </div>

  <KycDrawer
    open={drawerOpen}
    onClose={() => setDrawerOpen(false)}
    selected={selected}
    onSaved={() => {
      loadData();
      setDrawerOpen(false);
    }}
  />

<KycViewDrawer
  open={viewOpen}
  onClose={() => setViewOpen(false)}
  kyc={selected}
/>

<ConfirmDialog
  open={!!deleteId}
  title="Delete KYC"
  message="Are you sure you want to delete this KYC record?"
  onCancel={() => setDeleteId(null)}
  onConfirm={handleDelete}
/>
</>
);
}
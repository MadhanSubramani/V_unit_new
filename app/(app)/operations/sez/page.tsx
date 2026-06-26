"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import ModuleHeader from "@/components/ModuleHeader";
import ActionMenu from "@/components/shared/ActionMenu";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { Sez } from "@/types/sez";
import { createSez, deleteSez, getSezList, updateSez } from "@/lib/sez/sez";

type FormErrors = Partial<Record<"name" | "code", string>>;

const emptyForm = { name: "", code: "" };

export default function SezMasterPage() {
  const [list, setList] = useState<Sez[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<Sez | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const load = async () => {
    setLoading(true);
    try {
      setList(await getSezList());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (item) =>
        item.name?.toLowerCase().includes(q) ||
        item.code?.toLowerCase().includes(q)
    );
  }, [list, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = filtered.slice((page - 1) * pageSize, page * pageSize);

  const fieldClass = (key: keyof typeof emptyForm) =>
    `w-full rounded-xl border px-3 py-2 text-xs outline-none transition focus:ring-2 ${
      errors[key]
        ? "border-red-400 focus:ring-red-100"
        : "border-zinc-200 focus:border-zinc-500 focus:ring-zinc-200"
    }`;

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.name.trim()) next.name = "Name is required.";
    if (!form.code.trim()) next.code = "Code is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const openAdd = () => {
    setSelected(null);
    setForm(emptyForm);
    setErrors({});
    setSubmitError("");
    setDrawerOpen(true);
  };

  const openEdit = (item: Sez) => {
    setSelected(item);
    setForm({ name: item.name, code: item.code });
    setErrors({});
    setSubmitError("");
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    setSubmitError("");
    if (!validate()) return;
    setSaving(true);
    try {
      if (selected?.id) {
        await updateSez(selected.id, form);
      } else {
        await createSez(form);
      }
      setDrawerOpen(false);
      setSelected(null);
      setForm(emptyForm);
      await load();
    } catch {
      setSubmitError("Unable to save SEZ record. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteSez(deleteId);
    setDeleteId(null);
    await load();
  };

  return (
    <>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <ModuleHeader
          title="SEZ Master"
          description="Manage SEZ names and codes."
        />

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="text"
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 md:max-w-sm"
          />
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800"
          >
            <Plus size={14} />
            Add SEZ
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-slate-50">
                  {["Name", "Code", "Actions"].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 ${
                        h === "Actions" ? "text-center" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-zinc-500">
                      Loading...
                    </td>
                  </tr>
                ) : current.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-zinc-400">
                      No SEZ records found.
                    </td>
                  </tr>
                ) : (
                  current.map((item) => (
                    <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-800">{item.name}</td>
                      <td className="px-4 py-3 text-zinc-600">{item.code}</td>
                      <td className="px-4 py-3 text-center">
                        <ActionMenu
                          onView={() => {
                            setSelected(item);
                            setViewOpen(true);
                          }}
                          onEdit={() => openEdit(item)}
                          onDelete={() => setDeleteId(item.id!)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-1.5">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-2 py-1.5 text-xs text-zinc-500">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <div
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-5">
          <h2 className="text-sm font-semibold text-zinc-900">
            {selected ? "Edit SEZ" : "Add SEZ"}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">All fields are mandatory.</p>

          {submitError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {submitError}
            </div>
          )}

          <div className="mt-4 space-y-3">
            {(["name", "code"] as const).map((key) => (
              <div key={key}>
                <label className="mb-1 block text-[11px] font-medium capitalize text-zinc-600">
                  {key} <span className="text-red-500">*</span>
                </label>
                <input
                  value={form[key]}
                  onChange={(e) => {
                    setForm({ ...form, [key]: e.target.value });
                    if (errors[key]) setErrors({ ...errors, [key]: undefined });
                  }}
                  className={fieldClass(key)}
                />
                {errors[key] && (
                  <p className="mt-1 text-[11px] text-red-500">{errors[key]}</p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setDrawerOpen(false)}
              className="flex-1 rounded-xl border border-zinc-200 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl bg-zinc-900 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      {viewOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-zinc-900">SEZ Details</h3>
            <div className="mt-3 space-y-1.5 text-xs text-zinc-600">
              <p><span className="font-medium text-zinc-800">Name:</span> {selected.name}</p>
              <p><span className="font-medium text-zinc-800">Code:</span> {selected.code}</p>
            </div>
            <button
              onClick={() => setViewOpen(false)}
              className="mt-5 w-full rounded-xl bg-zinc-900 py-2 text-xs font-medium text-white hover:bg-zinc-800"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete SEZ"
        message="Are you sure you want to delete this SEZ record?"
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}

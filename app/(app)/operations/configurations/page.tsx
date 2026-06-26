"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X, Check } from "lucide-react";
import ModuleHeader from "@/components/ModuleHeader";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  CONFIG_CATEGORIES,
  ConfigCategory,
  ConfigItem,
} from "@/types/configuration";
import {
  createConfig,
  deleteConfig,
  getConfigByCategory,
  updateConfig,
} from "@/lib/configurations/configurations";

export default function ConfigurationsPage() {
  const [activeCategory, setActiveCategory] = useState<ConfigCategory>("container_type");
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState("");
  const [newError, setNewError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async (category: ConfigCategory) => {
    setLoading(true);
    try {
      setItems(await getConfigByCategory(category));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(activeCategory);
    setNewValue("");
    setNewError("");
    setEditId(null);
  }, [activeCategory]);

  const handleAdd = async () => {
    setNewError("");
    if (!newValue.trim()) {
      setNewError("Value is required.");
      return;
    }
    if (items.some((i) => i.value.toLowerCase() === newValue.trim().toLowerCase())) {
      setNewError("This value already exists.");
      return;
    }
    setSaving(true);
    try {
      await createConfig({ category: activeCategory, value: newValue.trim() });
      setNewValue("");
      await load(activeCategory);
    } catch {
      setNewError("Unable to add value. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setEditError("");
    if (!editValue.trim()) {
      setEditError("Value is required.");
      return;
    }
    setSaving(true);
    try {
      await updateConfig(id, editValue.trim());
      setEditId(null);
      setEditValue("");
      await load(activeCategory);
    } catch {
      setEditError("Unable to update value. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteConfig(deleteId);
    setDeleteId(null);
    await load(activeCategory);
  };

  const activeLabel =
    CONFIG_CATEGORIES.find((c) => c.key === activeCategory)?.label ?? "";

  return (
    <>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <ModuleHeader
          title="Configurations"
          description="Manage dropdown values for container type, size, and payment type."
        />

        <div className="mt-5 flex flex-wrap gap-2">
          {CONFIG_CATEGORIES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                activeCategory === key
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-zinc-200 p-4">
          <h3 className="text-xs font-semibold text-zinc-800">{activeLabel}</h3>

          <div className="mt-3 flex gap-2">
            <input
              value={newValue}
              onChange={(e) => {
                setNewValue(e.target.value);
                if (newError) setNewError("");
              }}
              placeholder={`Add ${activeLabel.toLowerCase()}...`}
              className={`flex-1 rounded-xl border px-3 py-2 text-xs outline-none focus:ring-2 ${
                newError
                  ? "border-red-400 focus:ring-red-100"
                  : "border-zinc-200 focus:border-zinc-500 focus:ring-zinc-200"
              }`}
            />
            <button
              onClick={handleAdd}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
          {newError && <p className="mt-1 text-[11px] text-red-500">{newError}</p>}

          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Value
                  </th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={2} className="py-8 text-center text-zinc-500">
                      Loading...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-8 text-center text-zinc-400">
                      No values configured yet.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="px-4 py-2.5">
                        {editId === item.id ? (
                          <div>
                            <input
                              value={editValue}
                              onChange={(e) => {
                                setEditValue(e.target.value);
                                if (editError) setEditError("");
                              }}
                              className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none focus:ring-2 ${
                                editError
                                  ? "border-red-400 focus:ring-red-100"
                                  : "border-zinc-200 focus:border-zinc-500 focus:ring-zinc-200"
                              }`}
                            />
                            {editError && (
                              <p className="mt-1 text-[11px] text-red-500">{editError}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-700">{item.value}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          {editId === item.id ? (
                            <>
                              <button
                                onClick={() => handleUpdate(item.id!)}
                                className="rounded-lg p-1.5 text-green-600 hover:bg-green-50"
                                title="Save"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setEditId(null);
                                  setEditValue("");
                                  setEditError("");
                                }}
                                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
                                title="Cancel"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditId(item.id!);
                                  setEditValue(item.value);
                                  setEditError("");
                                }}
                                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => setDeleteId(item.id!)}
                                className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Configuration"
        message="Are you sure you want to delete this value?"
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}

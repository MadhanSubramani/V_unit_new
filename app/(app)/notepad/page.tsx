"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import ModuleHeader from "@/components/ModuleHeader";
import NotepadDrawer from "@/components/notepad/NotepadDrawer";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { deleteNotepad, getNotepads } from "@/lib/notepad/notepad";
import { Notepad } from "@/types/notepad";

export default function NotepadPage() {
  const [notes, setNotes] = useState<Notepad[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Notepad | null>(null);
  const [startNew, setStartNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const data = await getNotepads();
      setNotes(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  const openNote = (note: Notepad) => {
    setSelected(note);
    setStartNew(false);
    setDrawerOpen(true);
  };

  const openNew = () => {
    setSelected(null);
    setStartNew(true);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelected(null);
    setStartNew(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteNotepad(deleteId);
    setDeleteId(null);
    await loadNotes();
  };

  const preview = (content: string) => {
    const line = content.trim().split("\n")[0] ?? "";
    if (!line) return "—";
    return line.length > 80 ? `${line.slice(0, 80)}…` : line;
  };

  return (
    <>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <ModuleHeader
          title="Notepad"
          description="Create and manage notes. Open a note in the editor drawer on the right."
        />

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800"
          >
            <Plus size={16} />
            New Note
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Header
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Preview
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Created By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Updated By
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-zinc-500">
                      Loading...
                    </td>
                  </tr>
                ) : notes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-zinc-400">
                      No notes found. Click &quot;New Note&quot; to create one.
                    </td>
                  </tr>
                ) : (
                  notes.map((note) => (
                    <tr
                      key={note.id}
                      className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50"
                      onClick={() => openNote(note)}
                    >
                      <td className="px-4 py-3 font-medium text-zinc-800">
                        {note.header || "Untitled"}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-zinc-500">
                        {preview(note.content ?? "")}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {note.createdBy || "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {note.updatedBy || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center justify-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => openNote(note)}
                            className="rounded-lg border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-100"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(note.id!)}
                            className="rounded-lg border border-zinc-200 p-1.5 text-red-500 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
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

      <NotepadDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        initialNote={selected}
        startNew={startNew}
        onSaved={loadNotes}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete note"
        message="Are you sure you want to delete this note? This cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}

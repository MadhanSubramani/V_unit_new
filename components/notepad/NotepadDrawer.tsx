"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsDown,
  Pin,
  Save,
  X,
} from "lucide-react";
import {
  createNotepad,
  deleteNotepad,
  updateNotepad,
} from "@/lib/notepad/notepad";
import { Notepad } from "@/types/notepad";

type TabState = {
  id?: string;
  header: string;
  content: string;
  createdBy?: string;
  updatedBy?: string;
  dirty: boolean;
  saving: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initialNote?: Notepad | null;
  startNew?: boolean;
  onSaved?: () => void;
};

function toTab(note: Notepad): TabState {
  return {
    id: note.id,
    header: note.header || "Untitled",
    content: note.content ?? "",
    createdBy: note.createdBy,
    updatedBy: note.updatedBy,
    dirty: false,
    saving: false,
  };
}

function emptyTab(): TabState {
  return {
    header: "Untitled",
    content: "",
    dirty: false,
    saving: false,
  };
}

export default function NotepadDrawer({
  open,
  onClose,
  initialNote,
  startNew = false,
  onSaved,
}: Props) {
  const [tabs, setTabs] = useState<TabState[]>([emptyTab()]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [user, setUser] = useState<{ username?: string } | null>(null);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [pinnedTabs, setPinnedTabs] = useState<Set<number>>(new Set());

  const tabBarRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeTab = tabs[activeIndex];

  const lineCount = useMemo(() => {
    const lines = (activeTab?.content ?? "").split("\n").length;
    return Math.max(lines, 1);
  }, [activeTab?.content]);

  useEffect(() => {
    const stored = sessionStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (!open) return;
    if (startNew) {
      setTabs([emptyTab()]);
      setActiveIndex(0);
    } else if (initialNote) {
      setTabs([toTab(initialNote)]);
      setActiveIndex(0);
    }
    setRenamingIndex(null);
    setPinnedTabs(new Set());
  }, [open, initialNote, startNew]);

  const persistTab = useCallback(
    async (index: number) => {
      const tab = tabs[index];
      if (!tab) return;

      const username = user?.username ?? "unknown";

      setTabs((prev) =>
        prev.map((t, i) => (i === index ? { ...t, saving: true } : t))
      );

      try {
        if (tab.id) {
          await updateNotepad(
            tab.id,
            { header: tab.header, content: tab.content },
            username
          );
          setTabs((prev) =>
            prev.map((t, i) =>
              i === index
                ? { ...t, dirty: false, saving: false, updatedBy: username }
                : t
            )
          );
        } else {
          const ref = await createNotepad(
            { header: tab.header, content: tab.content },
            username
          );
          setTabs((prev) =>
            prev.map((t, i) =>
              i === index
                ? {
                    ...t,
                    id: ref.id,
                    dirty: false,
                    saving: false,
                    createdBy: username,
                    updatedBy: username,
                  }
                : t
            )
          );
        }
        onSaved?.();
      } catch {
        setTabs((prev) =>
          prev.map((t, i) => (i === index ? { ...t, saving: false } : t))
        );
      }
    },
    [tabs, user?.username, onSaved]
  );

  const updateTabHeader = (index: number, header: string) => {
    setTabs((prev) =>
      prev.map((tab, i) =>
        i === index ? { ...tab, header, dirty: true } : tab
      )
    );
  };

  const updateActiveContent = (content: string) => {
    setTabs((prev) =>
      prev.map((tab, i) =>
        i === activeIndex ? { ...tab, content, dirty: true } : tab
      )
    );
  };

  const addTab = () => {
    setTabs((prev) => {
      const next = [...prev, emptyTab()];
      setActiveIndex(next.length - 1);
      return next;
    });
  };

  const closeTab = (index: number) => {
    if (tabs.length === 1) {
      onClose();
      return;
    }

    setTabs((prev) => prev.filter((_, i) => i !== index));
    setPinnedTabs((prev) => {
      const updated = new Set<number>();
      prev.forEach((i) => {
        if (i < index) updated.add(i);
        else if (i > index) updated.add(i - 1);
      });
      return updated;
    });
    setActiveIndex((prev) => {
      if (prev > index) return prev - 1;
      if (prev === index) return Math.max(0, index - 1);
      return prev;
    });
  };

  const scrollTabs = (dir: -1 | 1) => {
    const el = tabBarRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 120, behavior: "smooth" });
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[min(100vw,920px)] flex-col border-l border-[#b0b0b0] bg-[#f0f0f0] shadow-2xl">
        <div className="flex h-8 shrink-0 items-stretch border-b border-[#b0b0b0] bg-[#e8e8e8]">
          <div
            ref={tabBarRef}
            className="flex min-w-0 flex-1 items-stretch overflow-x-auto scrollbar-none"
            style={{ scrollbarWidth: "none" }}
          >
            {tabs.map((tab, index) => {
              const active = index === activeIndex;
              return (
                <div
                  key={tab.id ?? `local-${index}`}
                  role="tab"
                  tabIndex={0}
                  aria-selected={active}
                  onClick={() => setActiveIndex(index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveIndex(index);
                    }
                  }}
                  className={`group flex max-w-[180px] shrink-0 cursor-pointer items-center gap-1 border-r border-[#c8c8c8] px-2 text-[11px] transition-colors ${
                    active
                      ? "border-t-2 border-t-[#e8a317] bg-white text-[#1a1a1a]"
                      : "border-t-2 border-t-transparent bg-[#e8e8e8] text-[#333] hover:bg-[#ececec]"
                  }`}
                >
                  <Save
                    size={12}
                    className={`shrink-0 ${
                      tab.dirty ? "text-[#2563eb]" : "text-[#6b9bd1]"
                    }`}
                  />
                  {renamingIndex === index ? (
                    <input
                      autoFocus
                      value={tab.header}
                      onChange={(e) => updateTabHeader(index, e.target.value)}
                      onBlur={() => setRenamingIndex(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setRenamingIndex(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="min-w-0 flex-1 bg-transparent text-[11px] outline-none"
                    />
                  ) : (
                    <span
                      className="truncate"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setActiveIndex(index);
                        setRenamingIndex(index);
                      }}
                    >
                      {tab.header}
                    </span>
                  )}
                  {active && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPinnedTabs((prev) => {
                            const next = new Set(prev);
                            if (next.has(index)) next.delete(index);
                            else next.add(index);
                            return next;
                          });
                        }}
                        className="ml-0.5 shrink-0 rounded p-0.5 hover:bg-[#f0f0f0]"
                      >
                        <Pin
                          size={10}
                          className={
                            pinnedTabs.has(index) ? "text-[#e8a317]" : "text-[#888]"
                          }
                        />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(index);
                        }}
                        className="shrink-0 rounded p-0.5 hover:bg-[#fde8e8]"
                      >
                        <X size={11} className="text-[#c44]" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={addTab}
              className="shrink-0 px-3 text-[13px] text-[#555] hover:bg-[#ddd]"
              title="New tab"
            >
              +
            </button>
          </div>

          <div className="flex shrink-0 items-center border-l border-[#c8c8c8] bg-[#e8e8e8]">
            <button
              type="button"
              onClick={() => persistTab(activeIndex)}
              disabled={!activeTab?.dirty || activeTab?.saving}
              className="flex items-center gap-1 border-r border-[#c8c8c8] px-2.5 py-1 text-[11px] text-[#333] hover:bg-[#ddd] disabled:opacity-40"
            >
              <Save size={12} />
              {activeTab?.saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => scrollTabs(-1)}
              className="px-1.5 py-1 text-[#555] hover:bg-[#ddd]"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => scrollTabs(1)}
              className="px-1.5 py-1 text-[#555] hover:bg-[#ddd]"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              className="border-l border-[#c8c8c8] px-1.5 py-1 text-[#555] hover:bg-[#ddd]"
              title="All tabs"
            >
              <ChevronsDown size={14} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="border-l border-[#c8c8c8] px-2.5 py-1 text-[#555] hover:bg-[#ddd]"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-white">
          <div className="flex shrink-0 items-center gap-2 border-b border-[#e0e0e0] bg-[#fafafa] px-3 py-2">
            <label
              htmlFor="notepad-header"
              className="shrink-0 text-[11px] font-medium text-[#666]"
            >
              Header
            </label>
            <input
              id="notepad-header"
              type="text"
              value={activeTab?.header ?? ""}
              onChange={(e) => updateTabHeader(activeIndex, e.target.value)}
              placeholder="Note title"
              className="min-w-0 flex-1 rounded border border-[#d4d4d4] bg-white px-2 py-1 font-mono text-[12px] text-[#1a1a1a] outline-none focus:border-[#6b9bd1] focus:ring-1 focus:ring-[#6b9bd1]/30"
            />
          </div>

          <div className="flex min-h-0 flex-1">
            <div
              className="shrink-0 select-none overflow-hidden border-r border-[#e0e0e0] bg-[#f5f5f5] py-2 pr-2 pl-2 text-right font-mono text-[12px] leading-[20px] text-[#8a8a8a]"
              aria-hidden
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i + 1}>{i + 1}</div>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              value={activeTab?.content ?? ""}
              onChange={(e) => updateActiveContent(e.target.value)}
              onScroll={(e) => {
                const gutter = e.currentTarget.previousElementSibling;
                if (gutter) gutter.scrollTop = e.currentTarget.scrollTop;
              }}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none border-0 bg-white py-2 pr-4 pl-2 font-mono text-[12px] leading-[20px] text-[#1a1a1a] outline-none"
              style={{
                backgroundImage:
                  "linear-gradient(to bottom, #e8f4fc 20px, transparent 20px)",
                backgroundSize: "100% 20px",
                backgroundAttachment: "local",
              }}
            />
          </div>
        </div>

        <div className="flex h-6 shrink-0 items-center justify-between border-t border-[#b0b0b0] bg-[#e8e8e8] px-3 font-mono text-[10px] text-[#555]">
          <span>
            {activeTab?.dirty ? "Modified — click Save" : "Saved"}
          </span>
          <span>
            {activeTab?.content.length ?? 0} chars
            {activeTab?.updatedBy ? ` · updated by ${activeTab.updatedBy}` : ""}
          </span>
        </div>
      </div>
    </>
  );
}

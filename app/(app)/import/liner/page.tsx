"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import ModuleHeader from "@/components/ModuleHeader";
import ImportJobEditDrawer from "@/components/import/ImportJobEditDrawer";
import ActionMenu from "@/components/shared/ActionMenu";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  getImportLinerRecords,
  softDeleteFreightForward,
  updateImportLinerRemark,
  updateImportLinerStage,
} from "@/lib/freightForward/freightForward";
import {
  canUpdateImportDo,
  canUpdateImportIgm,
  computeImportLinerCounts,
  getImportCompletionCount,
  getImportDoStatus,
  getImportIgmStatus,
  getImportMovementStatus,
  getImportStageRemark,
  getInwardBoeNoDisplay,
  ImportLinerCard,
  isImportLinerCompleted,
  isImportStagePending,
  matchesImportLinerCard,
} from "@/lib/import/linerWorkflow";
import { formatContainersDisplay } from "@/lib/freightForward/containers";
import {
  FreightForward,
  FreightForwardDocument,
  ImportDoStatus,
  ImportIgmStatus,
  ImportMovementStatus,
  ImportWorkflowSection,
} from "@/types/freightForward";

const PAGE_SIZE = 10;

function formatAuditDate(value: unknown) {
  if (!value) return "—";
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toLocaleString();
  }
  if (value instanceof Date) return value.toLocaleString();
  return String(value);
}

function latestAudit(item: FreightForward, section: ImportWorkflowSection) {
  return [...(item.importWorkflowTimeline ?? [])]
    .reverse()
    .find((entry) => entry.section === section);
}

function locationLabel(item: FreightForward) {
  return item.locationType === "sez"
    ? item.sez || "—"
    : item.cfs || item.sez || "—";
}

function TableCell({
  value,
  width = 150,
  className = "",
}: {
  value: unknown;
  width?: number;
  className?: string;
}) {
  const text = String(value || "—");
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [tooltip, setTooltip] = useState<{ left: number; top: number } | null>(
    null
  );

  const showTooltip = (cell: HTMLElement) => {
    const content = textRef.current;
    if (text === "—" || !content) return;
    if (content.scrollWidth - content.clientWidth < 1) return;

    const rect = cell.getBoundingClientRect();
    const tooltipWidth = Math.min(320, window.innerWidth - 16);
    setTooltip({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - tooltipWidth - 8)),
      top: rect.bottom + 6,
    });
  };

  return (
    <td
      className={`px-3 py-3 ${className}`}
      onMouseEnter={(event) => showTooltip(event.currentTarget)}
      onMouseLeave={() => setTooltip(null)}
    >
      <span
        ref={textRef}
        className="block truncate whitespace-nowrap"
        style={{ maxWidth: width }}
      >
        {text}
      </span>
      {tooltip &&
        createPortal(
          <span
            className="pointer-events-none fixed z-[9999] max-w-80 whitespace-normal break-words rounded-md bg-zinc-950 px-2.5 py-1.5 text-[11px] leading-4 text-white shadow-lg"
            style={{ left: tooltip.left, top: tooltip.top }}
          >
            {text}
          </span>,
          document.body
        )}
    </td>
  );
}

export default function ImportLinerPage() {
  const [records, setRecords] = useState<FreightForward[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<ImportLinerCard | null>("do");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [editItem, setEditItem] = useState<FreightForward | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [panelWidth, setPanelWidth] = useState(0);
  const [user] = useState<{ username?: string; role?: string } | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = sessionStorage.getItem("user");
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let active = true;
    getImportLinerRecords()
      .then((items) => {
        if (active) setRecords(items);
      })
      .catch(() => {
        if (active) setError("Unable to load Import Liner jobs.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const container = tableScrollRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      setPanelWidth(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const counts = useMemo(() => computeImportLinerCounts(records), [records]);

  const cards: {
    key: ImportLinerCard;
    label: string;
    value: string | number;
  }[] = [
    { key: "inProcess", label: "In Process", value: counts.inProcess },
    { key: "next7Days", label: "Next 7 Days", value: counts.next7Days },
    { key: "movement", label: "Movement", value: counts.movement },
    { key: "do", label: "DO incomplete", value: counts.do },
    {
      key: "completed",
      label: "Completed / Incomplete",
      value: `${counts.completed} / ${counts.incomplete}`,
    },
  ];

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return records.filter((item) => {
      if (activeCard && !matchesImportLinerCard(item, activeCard)) return false;
      if (!needle) return true;
      return [
        item.jobNumber,
        item.ezRefNumber,
        item.consignmentName,
        item.clientName,
        item.inwardBoeNo,
        item.mbl,
        item.hbl,
        item.vesselName,
        item.liner,
        item.agent,
        item.containerNumber,
        formatContainersDisplay(item),
      ].some((value) => String(value ?? "").toLowerCase().includes(needle));
    });
  }, [activeCard, records, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const reload = async () => {
    setLoading(true);
    try {
      setRecords(await getImportLinerRecords());
    } catch {
      setError("Unable to load Import Liner jobs.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await softDeleteFreightForward(deleteId, user?.username ?? "Unknown");
      setDeleteId(null);
      setExpandedId(null);
      await reload();
    } catch {
      setError("Unable to move job to trash.");
    }
  };

  const updateStage = async (
    item: FreightForward,
    section: ImportWorkflowSection,
    status: ImportMovementStatus | ImportIgmStatus | ImportDoStatus
  ) => {
    if (!item.id) return;
    setUpdatingId(item.id);
    setError("");
    try {
      const updated = await updateImportLinerStage(
        item.id,
        section,
        status,
        user?.username ?? "Unknown"
      );
      setRecords((current) =>
        current.map((record) => (record.id === updated.id ? updated : record))
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update Import status."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const saveRemark = async (
    item: FreightForward,
    section: ImportWorkflowSection,
    remark: string
  ) => {
    if (!item.id) return;
    setUpdatingId(item.id);
    setError("");
    try {
      const updated = await updateImportLinerRemark(
        item.id,
        section,
        remark,
        user?.username ?? "Unknown"
      );
      setRecords((current) =>
        current.map((record) => (record.id === updated.id ? updated : record))
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to save remark."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <ModuleHeader
        title="Import — Liner"
        description="Ops workflow for Import jobs. Defaults to DO-incomplete; update Movement, IGM, and DO with remarks when pending."
      />

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => {
          const selected = activeCard === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => {
                setPage(0);
                setActiveCard((current) =>
                  current === card.key ? null : card.key
                );
              }}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                selected
                  ? "border-zinc-400 bg-white shadow-md ring-1 ring-zinc-300"
                  : "border-zinc-200 bg-zinc-50 hover:bg-white hover:shadow-sm"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                {card.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">
                {card.value}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <input
          value={search}
          onChange={(event) => {
            setPage(0);
            setSearch(event.target.value);
          }}
          placeholder="Search FF No, consignee, MBL, HBL, vessel, liner, container..."
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
        />
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <div
        ref={tableScrollRef}
        className="mt-4 overflow-x-auto rounded-xl border border-zinc-200"
      >
        <table className="min-w-[1280px] w-full text-left text-xs">
          <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="w-9 px-2 py-3" />
              <th className="px-3 py-3 font-semibold">Job No</th>
              <th className="px-3 py-3 font-semibold">EZ No</th>
              <th className="px-3 py-3 font-semibold">BL Type</th>
              <th className="px-3 py-3 font-semibold">Trade Terms</th>
              <th className="px-3 py-3 font-semibold">Vessel</th>
              <th className="px-3 py-3 font-semibold">ETA</th>
              <th className="px-3 py-3 font-semibold">Location</th>
              <th className="px-3 py-3 font-semibold">Consignee</th>
              <th className="px-3 py-3 font-semibold">Client</th>
              <th className="px-3 py-3 font-semibold">Inward BOE No</th>
              <th className="px-3 py-3 font-semibold">MBL</th>
              <th className="px-3 py-3 font-semibold">HBL</th>
              <th className="px-3 py-3 font-semibold">Containers</th>
              <th className="px-3 py-3 font-semibold">Done</th>
              <th className="px-3 py-3 font-semibold">Import Status</th>
              <th className="px-3 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={17} className="px-4 py-10 text-center text-zinc-400">
                  Loading Import Liner jobs...
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={17} className="px-4 py-10 text-center text-zinc-400">
                  No jobs found for this filter. Add jobs from Import Job List,
                  or enable “Use this job for Import” in Freight Forward.
                </td>
              </tr>
            ) : (
              visibleRows.map((item) => {
                const expanded = expandedId === item.id;
                return (
                  <Row
                    key={item.id}
                    item={item}
                    expanded={expanded}
                    busy={updatingId === item.id}
                    isAdmin={user?.role === "admin"}
                    onToggle={() =>
                      setExpandedId((current) =>
                        current === item.id ? null : item.id ?? null
                      )
                    }
                    onUpdate={updateStage}
                    onRemark={saveRemark}
                    onEdit={() => setEditItem(item)}
                    onDelete={() => setDeleteId(item.id ?? null)}
                    panelWidth={panelWidth}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-xs">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-zinc-500">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page + 1 >= totalPages}
          onClick={() =>
            setPage((current) => Math.min(totalPages - 1, current + 1))
          }
          className="rounded-lg border border-zinc-200 px-3 py-1.5 disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {editItem ? (
        <ImportJobEditDrawer
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={(updated) => {
            setRecords((current) =>
              current.map((record) =>
                record.id === updated.id ? updated : record
              )
            );
            setEditItem(null);
          }}
          username={user?.username ?? "Unknown"}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleteId}
        title="Move to trash?"
        message="This Import job will move to Import Trash. You can recover it later."
        confirmLabel="Move to trash"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

function Row({
  item,
  expanded,
  busy,
  isAdmin,
  onToggle,
  onUpdate,
  onRemark,
  onEdit,
  onDelete,
  panelWidth,
}: {
  item: FreightForward;
  expanded: boolean;
  busy: boolean;
  isAdmin: boolean;
  onToggle: () => void;
  onUpdate: (
    item: FreightForward,
    section: ImportWorkflowSection,
    status: ImportMovementStatus | ImportIgmStatus | ImportDoStatus
  ) => Promise<void>;
  onRemark: (
    item: FreightForward,
    section: ImportWorkflowSection,
    remark: string
  ) => Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
  panelWidth: number;
}) {
  const movementStatus = getImportMovementStatus(item);
  const igmStatus = getImportIgmStatus(item);
  const doStatus = getImportDoStatus(item);
  const completedStages = getImportCompletionCount(item);

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50"
      >
        <td className="px-2 py-3 text-zinc-400">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </td>
        <TableCell value={item.jobNumber} width={105} className="font-medium text-zinc-900" />
        <TableCell value={item.ezRefNumber} width={105} />
        <TableCell value={item.blType} width={90} />
        <TableCell value={item.tradeTerms} width={110} />
        <TableCell value={item.vesselName} />
        <TableCell value={item.eta} width={100} />
        <TableCell value={locationLabel(item)} />
        <TableCell value={item.consignmentName} />
        <TableCell value={item.clientName} />
        <TableCell value={getInwardBoeNoDisplay(item)} width={120} />
        <TableCell value={item.mbl} width={130} />
        <TableCell value={item.hbl} width={130} />
        <TableCell value={formatContainersDisplay(item)} width={170} />
        <td className="px-3 py-3 font-medium text-zinc-800">
          {completedStages} / 3
        </td>
        <td className="px-3 py-3">
          {busy ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-600">
              <LoaderCircle size={12} className="animate-spin" />
              Updating...
            </span>
          ) : (
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                isImportLinerCompleted(item)
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {isImportLinerCompleted(item) ? "Completed" : "In Process"}
            </span>
          )}
        </td>
        <td
          className="px-3 py-3 text-center"
          onClick={(event) => event.stopPropagation()}
        >
          <ActionMenu
            showView={false}
            showDelete={isAdmin}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-zinc-100 bg-zinc-100/70">
          <td colSpan={17} className="p-0">
            <div
              className="sticky left-0 min-w-0 p-3"
              style={panelWidth ? { width: panelWidth } : undefined}
            >
              <div className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <div className="flex min-w-0 flex-col gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 sm:grid sm:grid-cols-[minmax(0,220px)_180px] sm:items-center sm:justify-start sm:gap-5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Import workflow
                    </p>
                    <h3 className="mt-1 truncate text-sm font-semibold">
                      {item.jobNumber || "Freight Forward"} workflow
                    </h3>
                  </div>
                  <div className="w-full min-w-0">
                    <div className="mb-1.5 flex items-center justify-between text-[10px] text-zinc-500">
                      <span>Progress</span>
                      <span>{completedStages} of 3 complete</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
                      <div
                        className="h-full rounded-full bg-zinc-900 transition-all"
                        style={{ width: `${(completedStages / 3) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid min-w-0 gap-3 p-4 lg:grid-cols-3">
                  <StageCard
                    title="Movement"
                    section="movement"
                    value={movementStatus}
                    options={[
                      ["pending", "Pending"],
                      ["accepted", "Accepted"],
                      ["completed", "Completed"],
                    ]}
                    locked={false}
                    lockHint=""
                    item={item}
                    busy={busy}
                    onUpdate={onUpdate}
                    onRemark={onRemark}
                  />
                  <StageCard
                    title="IGM"
                    section="igm"
                    value={igmStatus}
                    options={[
                      ["pending", "Pending"],
                      ["posted", "Posted"],
                    ]}
                    locked={!canUpdateImportIgm(item)}
                    lockHint="Complete Movement first"
                    item={item}
                    busy={busy}
                    onUpdate={onUpdate}
                    onRemark={onRemark}
                  />
                  <StageCard
                    title="DO"
                    section="do"
                    value={doStatus}
                    options={[
                      ["pending", "Pending"],
                      ["received", "Received"],
                    ]}
                    locked={!canUpdateImportDo(item)}
                    lockHint="Post IGM first"
                    item={item}
                    busy={busy}
                    onUpdate={onUpdate}
                    onRemark={onRemark}
                  />
                </div>

                <div className="border-t border-zinc-200 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Documents
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <DocumentLink label="MBL" doc={item.mblUrl} />
                    <DocumentLink label="HBL" doc={item.hblUrl} />
                    {(item.otherDocuments ?? []).map((doc, index) => (
                      <DocumentLink
                        key={`${doc.url}-${index}`}
                        label={doc.name || `Document ${index + 1}`}
                        doc={doc}
                      />
                    ))}
                    {!item.mblUrl &&
                      !item.hblUrl &&
                      !(item.otherDocuments ?? []).length && (
                        <p className="text-[11px] text-zinc-400">
                          No documents uploaded.
                        </p>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DocumentLink({
  label,
  doc,
}: {
  label: string;
  doc?: FreightForwardDocument;
}) {
  if (!doc?.url) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-[11px] text-zinc-400">
        {label}: not uploaded
      </div>
    );
  }

  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] font-medium text-zinc-800 transition hover:bg-white"
    >
      <span className="block text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <span className="mt-0.5 block truncate">{doc.name || "View file"}</span>
    </a>
  );
}

function StageCard({
  title,
  section,
  value,
  options,
  locked,
  lockHint,
  item,
  busy,
  onUpdate,
  onRemark,
}: {
  title: string;
  section: ImportWorkflowSection;
  value: string;
  options: [string, string][];
  locked: boolean;
  lockHint: string;
  item: FreightForward;
  busy: boolean;
  onUpdate: (
    item: FreightForward,
    section: ImportWorkflowSection,
    status: ImportMovementStatus | ImportIgmStatus | ImportDoStatus
  ) => Promise<void>;
  onRemark: (
    item: FreightForward,
    section: ImportWorkflowSection,
    remark: string
  ) => Promise<void>;
}) {
  const audit = latestAudit(item, section);
  const stepNumber = section === "movement" ? 1 : section === "igm" ? 2 : 3;
  const complete =
    (section === "movement" && value === "completed") ||
    (section === "igm" && value === "posted") ||
    (section === "do" && (value === "received" || value === "eod"));
  const pending = isImportStagePending(item, section);
  const [remarkDraft, setRemarkDraft] = useState(
    getImportStageRemark(item, section)
  );

  useEffect(() => {
    setRemarkDraft(getImportStageRemark(item, section));
  }, [item, section]);

  return (
    <section
      className={`relative min-w-0 overflow-hidden rounded-xl border p-4 transition ${
        complete
          ? "border-zinc-300 bg-zinc-50"
          : locked
            ? "border-zinc-200 bg-zinc-50/80"
            : "border-zinc-200 bg-white"
      }`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-0.5 ${
          complete ? "bg-zinc-900" : locked ? "bg-zinc-200" : "bg-zinc-900"
        }`}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
              complete
                ? "bg-zinc-900 text-white"
                : locked
                  ? "bg-zinc-200 text-zinc-500"
                  : "bg-zinc-900 text-white"
            }`}
          >
            {complete ? (
              <Check size={14} strokeWidth={3} />
            ) : locked ? (
              <LockKeyhole size={13} />
            ) : (
              stepNumber
            )}
          </span>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Step {stepNumber}
            </p>
            <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          </div>
        </div>
        <select
          value={value}
          disabled={busy || locked}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) =>
            void onUpdate(
              item,
              section,
              event.target.value as
                | ImportMovementStatus
                | ImportIgmStatus
                | ImportDoStatus
            )
          }
          className="max-w-32 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
        >
          {options.map(([optionValue, label]) => (
            <option key={optionValue} value={optionValue}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {pending && (
        <div
          className="mt-3 space-y-2"
          onClick={(event) => event.stopPropagation()}
        >
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Remark
          </label>
          <textarea
            value={remarkDraft}
            disabled={busy}
            rows={2}
            placeholder={`Add ${title} remark...`}
            onChange={(event) => setRemarkDraft(event.target.value)}
            className="w-full resize-none rounded-lg border border-zinc-200 px-2.5 py-2 text-[11px] outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100"
          />
          <button
            type="button"
            disabled={
              busy ||
              remarkDraft.trim() === getImportStageRemark(item, section).trim()
            }
            onClick={() => void onRemark(item, section, remarkDraft)}
            className="rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
          >
            Save remark
          </button>
        </div>
      )}

      <div className="mt-4 border-t border-zinc-200/70 pt-3 text-[11px] text-zinc-500">
        {locked ? (
          <p className="flex items-center gap-1.5 font-medium text-zinc-500">
            <LockKeyhole size={12} />
            {lockHint}
          </p>
        ) : audit ? (
          <>
            <p>
              Updated by{" "}
              <span className="font-medium text-zinc-800">
                {audit.updatedBy}
              </span>
            </p>
            <p className="mt-0.5 text-zinc-400">
              {formatAuditDate(audit.updatedAt)}
            </p>
          </>
        ) : (
          <p className="text-zinc-400">No status update yet.</p>
        )}
      </div>
    </section>
  );
}

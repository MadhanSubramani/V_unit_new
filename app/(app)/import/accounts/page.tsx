"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import ModuleHeader from "@/components/ModuleHeader";
import ImportAuditLine from "@/components/import/ImportAuditLine";
import {
  ImportTableCell,
  importLocationLabel,
} from "@/components/import/ImportJobTableCells";
import {
  completeImportAccounts,
  getImportLinerRecords,
  updateImportAccountsBilling,
  updateImportAccountsPayment,
} from "@/lib/freightForward/freightForward";
import { formatContainersDisplay } from "@/lib/freightForward/containers";
import {
  computeImportAccountsCounts,
  getImportAccountsBillingStatus,
  getImportAccountsPaymentStatus,
  getImportAccountsRecords,
  ImportAccountsCard,
  isImportAccountsCompleted,
  matchesImportAccountsCard,
} from "@/lib/import/accountsWorkflow";
import { getInwardBoeNoDisplay } from "@/lib/import/linerWorkflow";
import {
  FreightForward,
  ImportAccountsBillingStatus,
  ImportAccountsPaymentStatus,
} from "@/types/freightForward";

const PAGE_SIZE = 10;

export default function ImportAccountsPage() {
  const [records, setRecords] = useState<FreightForward[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<ImportAccountsCard | null>(
    "billingPending"
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [panelWidth, setPanelWidth] = useState(0);
  const [user] = useState<{ username?: string } | null>(() => {
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
        if (active) setRecords(getImportAccountsRecords(items));
      })
      .catch(() => {
        if (active) setError("Unable to load Accounts jobs.");
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

  const counts = useMemo(() => computeImportAccountsCounts(records), [records]);
  const cards: {
    key: ImportAccountsCard;
    label: string;
    value: number;
  }[] = [
    { key: "inProcess", label: "In Process", value: counts.inProcess },
    {
      key: "billingPending",
      label: "Billing Pending",
      value: counts.billingPending,
    },
    {
      key: "paymentPending",
      label: "Payment Pending",
      value: counts.paymentPending,
    },
    { key: "completed", label: "Completed", value: counts.completed },
  ];

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return records.filter((item) => {
      if (activeCard && !matchesImportAccountsCard(item, activeCard)) {
        return false;
      }
      if (!needle) return true;
      return [
        item.jobNumber,
        item.ezRefNumber,
        item.consignmentName,
        item.clientName,
        item.mbl,
        item.hbl,
        item.inwardBoeNo,
        formatContainersDisplay(item),
      ].some((value) => String(value ?? "").toLowerCase().includes(needle));
    });
  }, [activeCard, records, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const applyUpdated = (updated: FreightForward) => {
    setRecords((current) =>
      current.map((record) => (record.id === updated.id ? updated : record))
    );
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <ModuleHeader
        title="Import — Accounts"
        description="Transport-completed jobs. Track billing, payment, and job completion."
      />

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          placeholder="Search job no, consignee, inward BOE no, MBL, HBL..."
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
              <th className="px-3 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={15} className="px-4 py-10 text-center text-zinc-400">
                  Loading Accounts jobs...
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-4 py-10 text-center text-zinc-400">
                  No transport-completed jobs found.
                </td>
              </tr>
            ) : (
              visibleRows.map((item) => (
                <AccountsRow
                  key={item.id}
                  item={item}
                  expanded={expandedId === item.id}
                  busy={updatingId === item.id}
                  username={user?.username ?? "Unknown"}
                  panelWidth={panelWidth}
                  onToggle={() =>
                    setExpandedId((current) =>
                      current === item.id ? null : item.id ?? null
                    )
                  }
                  onBusy={(id) => setUpdatingId(id)}
                  onError={setError}
                  onUpdated={applyUpdated}
                />
              ))
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
    </div>
  );
}

function AccountsRow({
  item,
  expanded,
  busy,
  username,
  panelWidth,
  onToggle,
  onBusy,
  onError,
  onUpdated,
}: {
  item: FreightForward;
  expanded: boolean;
  busy: boolean;
  username: string;
  panelWidth: number;
  onToggle: () => void;
  onBusy: (id: string | null) => void;
  onError: (message: string) => void;
  onUpdated: (item: FreightForward) => void;
}) {
  const completed = isImportAccountsCompleted(item);

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50"
      >
        <td className="px-2 py-3 text-zinc-400">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </td>
        <ImportTableCell
          value={item.jobNumber}
          width={105}
          className="font-medium text-zinc-900"
        />
        <ImportTableCell value={item.ezRefNumber} width={105} />
        <ImportTableCell value={item.blType} width={90} />
        <ImportTableCell value={item.tradeTerms} width={110} />
        <ImportTableCell value={item.vesselName} />
        <ImportTableCell value={item.eta} width={100} />
        <ImportTableCell value={importLocationLabel(item)} />
        <ImportTableCell value={item.consignmentName} />
        <ImportTableCell value={item.clientName} />
        <ImportTableCell value={getInwardBoeNoDisplay(item)} width={120} />
        <ImportTableCell value={item.mbl} width={130} />
        <ImportTableCell value={item.hbl} width={130} />
        <ImportTableCell value={formatContainersDisplay(item)} width={170} />
        <td className="px-3 py-3">
          {busy ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-600">
              <LoaderCircle size={12} className="animate-spin" />
              Updating...
            </span>
          ) : (
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                completed
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {completed ? "Completed" : "In Process"}
            </span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-zinc-100 bg-zinc-100/70">
          <td colSpan={15} className="p-0">
            <div
              className="sticky left-0 min-w-0 p-3"
              style={panelWidth ? { width: panelWidth } : undefined}
            >
              <AccountsExpansion
                item={item}
                busy={busy}
                username={username}
                onBusy={onBusy}
                onError={onError}
                onUpdated={onUpdated}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function AccountsExpansion({
  item,
  busy,
  username,
  onBusy,
  onError,
  onUpdated,
}: {
  item: FreightForward;
  busy: boolean;
  username: string;
  onBusy: (id: string | null) => void;
  onError: (message: string) => void;
  onUpdated: (item: FreightForward) => void;
}) {
  const jobCompleted = isImportAccountsCompleted(item);
  const billingStatus = getImportAccountsBillingStatus(item);
  const billingDone = billingStatus === "completed";
  const paymentStatus = getImportAccountsPaymentStatus(item);
  const paymentReceived = paymentStatus === "received";

  const [billingRemark, setBillingRemark] = useState(
    item.importAccountsBillingRemark ?? ""
  );
  const [paymentRemark, setPaymentRemark] = useState(
    item.importAccountsPaymentRemark ?? ""
  );

  useEffect(() => {
    setBillingRemark(item.importAccountsBillingRemark ?? "");
    setPaymentRemark(item.importAccountsPaymentRemark ?? "");
  }, [item]);

  const run = async (task: () => Promise<FreightForward>) => {
    if (!item.id) return;
    onBusy(item.id);
    onError("");
    try {
      onUpdated(await task());
    } catch (updateError) {
      onError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update Accounts."
      );
    } finally {
      onBusy(null);
    }
  };

  const setBilling = (status: ImportAccountsBillingStatus) => {
    void run(() =>
      updateImportAccountsBilling(item.id!, status, billingRemark, username)
    );
  };

  const setPayment = (status: ImportAccountsPaymentStatus) => {
    void run(() =>
      updateImportAccountsPayment(item.id!, status, paymentRemark, username)
    );
  };

  const completeJob = () => {
    void run(() => completeImportAccounts(item.id!, username));
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Accounts workflow
        </p>
        <h3 className="mt-1 text-sm font-semibold text-zinc-900">
          {item.jobNumber || "Import"} — billing, payment, completion
        </h3>
      </div>

      <div className="grid min-w-0 gap-3 p-4 lg:grid-cols-3">
        <section className="rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-[11px] font-bold text-white">
              {billingDone ? <Check size={14} strokeWidth={3} /> : "1"}
            </span>
            <h3 className="text-sm font-semibold text-zinc-900">
              Billing status
            </h3>
          </div>
          <div
            className="mt-3 space-y-2 text-xs"
            onClick={(event) => event.stopPropagation()}
          >
            {(["pending", "completed"] as ImportAccountsBillingStatus[]).map(
              (status) => (
                <label key={status} className="flex items-center gap-2 capitalize">
                  <input
                    type="radio"
                    name={`billing-${item.id}`}
                    checked={billingStatus === status}
                    disabled={busy || jobCompleted}
                    onChange={() => {
                      if (status === "completed" && !billingRemark.trim()) return;
                      setBilling(status);
                    }}
                  />
                  {status}
                </label>
              )
            )}
            <label className="mt-2 block text-xs">
              <span className="font-medium text-zinc-700">
                {billingDone ? "Completion remark" : "Remark"}
              </span>
              <textarea
                value={billingRemark}
                disabled={busy || jobCompleted}
                rows={2}
                placeholder={
                  billingDone
                    ? "Billing completion remark"
                    : "Required when marking completed"
                }
                onChange={(event) => setBillingRemark(event.target.value)}
                className="mt-1 w-full resize-none rounded-lg border border-zinc-200 px-2.5 py-2 text-[11px] outline-none focus:border-zinc-500"
              />
            </label>
            {!jobCompleted &&
              billingStatus === "pending" &&
              billingRemark.trim() && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setBilling("completed")}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
                >
                  Save billing completed
                </button>
              )}
          </div>
          <ImportAuditLine audit={item.importAccountsBillingAudit} />
        </section>

        <section
          className={`rounded-xl border p-4 ${
            billingDone ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-50/80"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold ${
                billingDone ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"
              }`}
            >
              {paymentReceived ? (
                <Check size={14} strokeWidth={3} />
              ) : billingDone ? (
                "2"
              ) : (
                <LockKeyhole size={13} />
              )}
            </span>
            <h3 className="text-sm font-semibold text-zinc-900">Payment</h3>
          </div>
          {!billingDone ? (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
              <LockKeyhole size={12} />
              Complete billing first
            </p>
          ) : (
            <div
              className="mt-3 space-y-2 text-xs"
              onClick={(event) => event.stopPropagation()}
            >
              {(["pending", "received"] as ImportAccountsPaymentStatus[]).map(
                (status) => (
                  <label key={status} className="flex items-center gap-2 capitalize">
                    <input
                      type="radio"
                      name={`payment-${item.id}`}
                      checked={paymentStatus === status}
                      disabled={busy || jobCompleted}
                      onChange={() => {
                        if (!paymentRemark.trim()) return;
                        setPayment(status);
                      }}
                    />
                    {status}
                  </label>
                )
              )}
              <label className="mt-2 block text-xs">
                <span className="font-medium text-zinc-700">Remark</span>
                <textarea
                  value={paymentRemark}
                  disabled={busy || jobCompleted}
                  rows={2}
                  placeholder="Payment remark"
                  onChange={(event) => setPaymentRemark(event.target.value)}
                  className="mt-1 w-full resize-none rounded-lg border border-zinc-200 px-2.5 py-2 text-[11px] outline-none focus:border-zinc-500"
                />
              </label>
              {!jobCompleted && paymentRemark.trim() && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPayment(paymentStatus)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-[10px] font-semibold text-zinc-700 disabled:opacity-40"
                >
                  Save payment remark
                </button>
              )}
            </div>
          )}
          <ImportAuditLine audit={item.importAccountsPaymentAudit} />
        </section>

        <section
          className={`rounded-xl border p-4 ${
            paymentReceived ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-50/80"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold ${
                paymentReceived ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"
              }`}
            >
              {jobCompleted ? (
                <Check size={14} strokeWidth={3} />
              ) : paymentReceived ? (
                "3"
              ) : (
                <LockKeyhole size={13} />
              )}
            </span>
            <h3 className="text-sm font-semibold text-zinc-900">Job</h3>
          </div>
          {!paymentReceived ? (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
              <LockKeyhole size={12} />
              Mark payment as received first
            </p>
          ) : jobCompleted ? (
            <div className="mt-3 space-y-2 text-xs">
              <div>
                <span className="font-medium text-zinc-700">Billing remark: </span>
                <span className="text-zinc-600">
                  {item.importAccountsBillingRemark || "—"}
                </span>
              </div>
              <div>
                <span className="font-medium text-zinc-700">Payment remark: </span>
                <span className="text-zinc-600">
                  {item.importAccountsPaymentRemark || "—"}
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-3" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                disabled={busy}
                onClick={completeJob}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
              >
                Complete job
              </button>
            </div>
          )}
          <ImportAuditLine audit={item.importAccountsCompleteAudit} />
        </section>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus, Trash2, X, Ship,
  Package,
  Route,
  CreditCard,
  ShieldCheck,
  Paperclip,
  Download,
  FileSpreadsheet,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
} from "lucide-react";
import { DocumentSnapshot, Timestamp } from "firebase/firestore";
import ModuleHeader from "@/components/ModuleHeader";
import ActionMenu from "@/components/shared/ActionMenu";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { getCfsList } from "@/lib/cfs/cfs";
import { getConfigByCategory } from "@/lib/configurations/configurations";
import {
  createFreightForward,
  softDeleteFreightForward,
  getFreightForwardCardCounts,
  getFreightForwardPaginated,
  updateFreightForward,
  updateWorkflowStatus,
  getFreightForwardById,
  getFreightForwardForExport,
} from "@/lib/freightForward/freightForward";
import {
  FreightSortDir,
  FreightSortKey,
} from "@/lib/freightForward/sortRecords";
import {
  computeProfitLoss,
  computeTotalExpenses,
  formatDollar,
  getRecordProfitLoss,
  normalizeBilledAmountInput,
  getBilledAmount,
  getRecordTotalExpenses,
  parseAmount,
  sumExpenseItems,
} from "@/lib/freightForward/amounts";
import { exportFreightForwardToExcel } from "@/lib/freightForward/exportFreightForwardExcel";
import {
  emptyContainer,
  formatContainersDisplay,
  getContainersFromRecord,
  getOceanFreightPerContainer,
  getTotalOceanFreight,
} from "@/lib/freightForward/containers";
import { canUpdateToStatus } from "@/lib/freightForward/workflowStatus";
import { uploadDocument } from "@/lib/kyc/uploadDocument";
import { getSezList } from "@/lib/sez/sez";
import { Cfs } from "@/types/cfs";
import { ConfigItem } from "@/types/configuration";
import {
  CONTAINER_NUMBER_REGEX,
  ExpenseItem,
  ExWorksItem,
  FreightContainer,
  FREIGHT_FORWARD_STATUSES,
  FreightForward,
  FreightForwardDocument,
  FreightForwardFormData,
  FreightForwardStatus,
  FreightForwardStatusObject,
} from "@/types/freightForward";
import { Sez } from "@/types/sez";
import WorkflowTimeline from "@/components/WorkflowTimeline";
import ProformaDialog from "@/components/freightForward/ProformaDialog";
import { getKyc } from "@/lib/kyc/getKyc";
import { Kyc } from "@/types/kyc";

type FormErrors = Partial<Record<string, string>>;
type CardFilter =
  | "inProcess"
  | "next7Days"
  | "momentum"
  | "split_manifest"
  | "billing"
  | "receivable"
  | "payable"
  | "completed"
  | null;
type DrawerMode = "add" | "edit" | "view" | null;

const PAGE_SIZE = 10;

const emptyExpenseItem = (): ExpenseItem => ({ name: "", amount: 0 });

function formatProfitLossChip(amount: number) {
  const isProfit = amount > 0;
  return {
    label: isProfit ? "Profit" : "Loss",
    value: formatDollar(Math.abs(amount)) || "$0",
    className: isProfit
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : "bg-red-50 text-red-700 ring-red-200",
  };
}

function displayDollar(value?: number | string | null) {
  return formatDollar(value) || "—";
}

function getLocationCode(
  item: FreightForward,
  cfsList: Cfs[],
  sezList: Sez[]
): string {
  if (item.sez || item.locationType === "sez") {
    const stored = item.sez?.trim() ?? "";
    if (!stored) return "—";
    const match = sezList.find(
      (entry) => entry.code === stored || entry.name === stored
    );
    if (match) return match.code;
    return stored.split(/\s*[-–|]\s*/)[0]?.trim() || stored;
  }

  const stored = item.cfs?.trim() ?? "";
  if (!stored) return "—";
  const match = cfsList.find(
    (entry) => entry.code === stored || entry.name === stored
  );
  if (match) return match.code;
  return stored.split(/\s*[-–|]\s*/)[0]?.trim() || stored;
}

const emptyForm = (): FreightForwardFormData => ({
  jobNumber: "",
  ezRefNumber: "",
  consignmentName: "",
  clientName: "",
  tradeTerms: "",
  mbl: "",
  hbl: "",
  blType: "",
  containers: [emptyContainer()],
  containerNumber: "",
  containerSize: "",
  containerType: "",
  etd: "",
  eta: "",
  vesselName: "",
  pol: "",
  pod: "",
  locationType: "cfs",
  cfs: undefined,
  sez: undefined,
  liner: "",
  agent: "",
  oceanFreightPerContainer: undefined,
  oceanFreight: undefined,
  exWorks: [],
  otherExpenses: [],
  totalExpenses: undefined,
  billedAmount: undefined,
  creditNote: undefined,
  paymentType: "",
  paymentDate: "",
  status: "in_process",
});

function formatDate(value?: string) {
  if (!value) return "—";
  return value;
}

function statusLabel(status: FreightForwardStatus) {
  return FREIGHT_FORWARD_STATUSES.find((s) => s.value === status)?.label ?? status;
}

function toFormData(item: FreightForward): FreightForwardFormData {
  const containers = getContainersFromRecord(item);
  const normalizedContainers: FreightContainer[] = containers.length
    ? containers.map((c) => ({
        containerNumber: c.containerNumber ?? "",
        containerSize: c.containerSize ?? "",
        containerType: c.containerType ?? "",
      }))
    : [emptyContainer()];

  return {
    jobNumber: item.jobNumber ?? "",
    ezRefNumber: item.ezRefNumber ?? "",
    consignmentName: item.consignmentName,
    clientName: item.clientName ?? "",
    tradeTerms: item.tradeTerms ?? "",
    mbl: item.mbl,
    hbl: item.hbl,
    blType: item.blType ?? "",
    containers: normalizedContainers,
    containerNumber: normalizedContainers[0]?.containerNumber ?? item.containerNumber,
    containerSize: normalizedContainers[0]?.containerSize ?? item.containerSize ?? "",
    containerType: normalizedContainers[0]?.containerType ?? item.containerType ?? "",
    etd: item.etd ?? "",
    eta: item.eta ?? "",
    vesselName: item.vesselName ?? "",
    pol: item.pol ?? "",
    pod: item.pod ?? "",
    locationType: item.locationType ?? (item.sez ? "sez" : "cfs"),
    cfs: item.cfs,
    sez: item.sez,
    liner: item.liner ?? "",
    agent: item.agent ?? "",
    oceanFreightPerContainer: getOceanFreightPerContainer(item),
    oceanFreight: getTotalOceanFreight(item),
    exWorks: item.exWorks ?? [],
    otherExpenses: item.otherExpenses ?? [],
    billedAmount: normalizeBilledAmountInput(
      item.billedAmount ?? item.buildAmount
    ),
    creditNote: parseAmount(item.creditNote),
    totalExpenses: computeTotalExpenses(
      item.exWorks,
      item.otherExpenses,
      getTotalOceanFreight(item),
      item.totalExpenses
    ),
    paymentType: item.paymentType ?? "",
    paymentDate: item.paymentDate ?? "",
    status: item.status ?? "in_process",
  };
}

function removeUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

function buildPayload(form: FreightForwardFormData): Record<string, unknown> {
  const containers = (form.containers ?? [])
    .map((c) =>
      removeUndefined({
        containerNumber: c.containerNumber.trim().toUpperCase(),
        containerSize: c.containerSize?.trim() || undefined,
        containerType: c.containerType?.trim() || undefined,
      })
    )
    .filter((c) => c.containerNumber);

  const primary = containers[0];
  const perContainer = parseAmount(form.oceanFreightPerContainer);
  const totalOceanFreight = (perContainer ?? 0) * Math.max(1, containers.length);

  const raw: Record<string, unknown> = {
    jobNumber: form.jobNumber?.trim() || undefined,
    ezRefNumber: form.ezRefNumber?.trim() || undefined,
    consignmentName: form.consignmentName.trim(),
    clientName: form.clientName?.trim() || undefined,
    tradeTerms: form.tradeTerms || undefined,
    mbl: form.mbl.trim(),
    hbl: form.hbl.trim(),
    blType: form.blType || undefined,
    containers,
    containerNumber: primary?.containerNumber,
    containerSize: primary?.containerSize,
    containerType: primary?.containerType,
    etd: form.etd || undefined,
    eta: form.eta || undefined,
    vesselName: form.vesselName?.trim() || undefined,
    pol: form.pol?.trim() || undefined,
    pod: form.pod?.trim() || undefined,
    liner: form.liner?.trim() || undefined,
    agent: form.agent?.trim() || undefined,
    oceanFreightPerContainer: perContainer,
    oceanFreight: totalOceanFreight || undefined,
    paymentType: form.paymentType || undefined,
    paymentDate: form.paymentDate || undefined,
    totalExpenses:
      sumExpenseItems(form.exWorks) +
      sumExpenseItems(form.otherExpenses) +
      totalOceanFreight,
    billedAmount: normalizeBilledAmountInput(form.billedAmount) ?? 0,
    creditNote: parseAmount(form.creditNote),
    exWorks: (form.exWorks ?? []).filter((i) => i.name.trim() || i.amount),
    otherExpenses: (form.otherExpenses ?? []).filter((i) => i.name.trim() || i.amount),
    locationType: form.locationType,
    cfs: form.locationType === "cfs" && form.cfs ? form.cfs : undefined,
    sez: form.locationType === "sez" && form.sez ? form.sez : undefined,
    status: form.status,
  };
  return removeUndefined(raw);
}

function FormSection({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50/40 p-4">
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-zinc-200 pb-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-800">
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-[11px] text-zinc-500">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function FreightForwardPage() {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<FreightForward[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(0); // 0-indexed
  const [cursors, setCursors] = useState<(DocumentSnapshot | null)[]>([null]);

  // ── Card counts (getCountFromServer — zero document reads) ─────────────────
  const [cardCounts, setCardCounts] = useState({
    inProcess: 0,
    next7Days: 0,
    momentum: 0,
    split_manifest: 0,
    billing: 0,
    receivable: 0,
    payable: 0,
    completed: 0,
  });

  // ── Filters ───────────────────────────────────────────────────────────────
  const [activeCard, setActiveCard] = useState<CardFilter>(null);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [sortKey, setSortKey] = useState<FreightSortKey>("eta");
  const [sortDir, setSortDir] = useState<FreightSortDir>("asc");

  const isSearching = debouncedSearchValue.trim().length > 0;

  // Auto-scroll-to-error can fight the user's taps/typing on mobile.
  // Initialize from `window` immediately to avoid a race on the first Save attempt.
  const isCoarsePointerRef = useRef(
    typeof window !== "undefined" &&
      ((window.matchMedia?.("(pointer: coarse)")?.matches ?? false) ||
        (navigator.maxTouchPoints ?? 0) > 0)
  );

  useEffect(() => {
    isCoarsePointerRef.current =
      typeof window !== "undefined" &&
      ((window.matchMedia?.("(pointer: coarse)")?.matches ?? false) ||
        (navigator.maxTouchPoints ?? 0) > 0);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchValue]);

  // ── Lookups ───────────────────────────────────────────────────────────────
  const [cfsList, setCfsList] = useState<Cfs[]>([]);
  const [sezList, setSezList] = useState<Sez[]>([]);
  const [containerSizes, setContainerSizes] = useState<ConfigItem[]>([]);
  const [containerTypes, setContainerTypes] = useState<ConfigItem[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<ConfigItem[]>([]);
  const [blTypes, setBlTypes] = useState<ConfigItem[]>([]);
  const [tradeTermsList, setTradeTermsList] = useState<ConfigItem[]>([]);
  const [kycList, setKycList] = useState<Kyc[]>([]);
  const [proformaOpen, setProformaOpen] = useState(false);
  const [timelinePopupOpen, setTimelinePopupOpen] = useState(false);
  const [timelineRecord, setTimelineRecord] = useState<FreightForward | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const rowClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Drawer ────────────────────────────────────────────────────────────────
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [selected, setSelected] = useState<FreightForward | null>(null);

  // ── Form ──────────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FreightForwardFormData>(emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  const [mblFile, setMblFile] = useState<File | null>(null);
  const [hblFile, setHblFile] = useState<File | null>(null);
  const [billedAmountFile, setBilledAmountFile] = useState<File | null>(null);
  const [creditNoteFile, setCreditNoteFile] = useState<File | null>(null);
  const [paymentDateFile, setPaymentDateFile] = useState<File | null>(null);
  const [debitFiles, setDebitFiles] = useState<File[]>([]);
  const [existingMblDoc, setExistingMblDoc] = useState<FreightForwardDocument | undefined>();
  const [existingHblDoc, setExistingHblDoc] = useState<FreightForwardDocument | undefined>();
  const [existingBilledAmountDoc, setExistingBilledAmountDoc] = useState<FreightForwardDocument | undefined>();
  const [existingCreditNoteDoc, setExistingCreditNoteDoc] = useState<FreightForwardDocument | undefined>();
  const [existingPaymentDateDoc, setExistingPaymentDateDoc] = useState<FreightForwardDocument | undefined>();
  const [existingDebitDocs, setExistingDebitDocs] = useState<FreightForwardDocument[]>([]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user, setUser] = useState<{ username?: string; role?: string } | null>(null);
  const isAdmin = user?.role === "admin";

  type UserRole = "admin" | "user" | "accountant";
  const userRole: UserRole = (user?.role as UserRole) ?? "admin";
  const allowedStatuses: Record<UserRole, FreightForwardStatus[]> = {
    admin: FREIGHT_FORWARD_STATUSES.map((s) => s.value),
    user: [
      FreightForwardStatusObject.IN_PROCESS,
      FreightForwardStatusObject.MOMENTUM,
      FreightForwardStatusObject.SPLIT_MANIFEST,
    ],
    accountant: [
      FreightForwardStatusObject.BILLING,
      FreightForwardStatusObject.RECEIVABLE,
      FreightForwardStatusObject.PAYABLE,
      FreightForwardStatusObject.COMPLETED,
    ],
  };

  const availableStatuses = FREIGHT_FORWARD_STATUSES.filter((status) =>
    allowedStatuses[userRole].includes(status.value)
  );

  const totalExWorksAmount = sumExpenseItems(form.exWorks);
  const totalOtherExpensesAmount = sumExpenseItems(form.otherExpenses);
  const filledContainerCount = Math.max(
    1,
    (form.containers ?? []).filter((c) => c.containerNumber.trim()).length ||
      (form.containers ?? []).length
  );
  const totalOceanFreightAmount =
    (parseAmount(form.oceanFreightPerContainer) ?? 0) * filledContainerCount;
  const totalExpensesAmount =
    totalExWorksAmount + totalOtherExpensesAmount + totalOceanFreightAmount;
  const profitLossAmount = computeProfitLoss(
    form.creditNote,
    form.billedAmount,
    totalExpensesAmount
  );

  const selectedCfs =
    form.locationType === "cfs"
      ? cfsList.find((item) => item.code === form.cfs)
      : undefined;

  const selectedSez =
    form.locationType === "sez"
      ? sezList.find((item) => item.code === form.sez)
      : undefined;

  const selectedLocation = selectedCfs ?? selectedSez;

  const selectedConsigneeKyc = kycList.find(
    (kyc) => kyc.companyName === form.consignmentName
  );

  const handleCardClick = (card: CardFilter) => {
    setActiveStatus(null);
    setCursors([null]);
    setActiveCard((prev) => (prev === card ? null : card));
  };

  const STATUS_CHIPS = [
    { label: "BILLING", value: "billing", count: cardCounts.billing },
    { label: "RECEIVABLE", value: "receivable", count: cardCounts.receivable },
    { label: "PAYABLE", value: "payable", count: cardCounts.payable },
  ];

  const [activeStatus, setActiveStatus] = useState<string | null>(null);

  const loadStatusRecords = (status: string) => {
    setActiveCard(null);
    setActiveStatus(status);
    setCursors([null]);
    setPage(0);
  };

  const clearStatusFilter = () => {
    setActiveStatus(null);
    setCursors([null]);
    setPage(0);
  };

  const summaryCards = [
    { key: "inProcess" as CardFilter, label: "In Process", count: cardCounts.inProcess },
    { key: "next7Days" as CardFilter, label: "Next 7 Days", count: cardCounts.next7Days },
    { key: "momentum" as CardFilter, label: "Movement", count: cardCounts.momentum },
    { key: "split_manifest" as CardFilter, label: "Split Manifest", count: cardCounts.split_manifest },
    { key: "completed" as CardFilter, label: "Completed", count: cardCounts.completed },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Load card counts via getCountFromServer ────────────────────────────────
  const loadCounts = useCallback(async () => {
    try {
      const counts = await getFreightForwardCardCounts();
      setCardCounts(counts);
    } catch (error) {
      console.error("Failed to load freight forward counts:", error);
    }
  }, []);

  const loadPage = useCallback(
    async (pageIndex: number, cursorList?: (DocumentSnapshot | null)[]) => {
      setLoading(true);
      try {
        const pageCursors = cursorList ?? cursors;
        const result = await getFreightForwardPaginated({
          activeCard,
          activeStatus,
          etaFrom: dateFrom || undefined,
          etaTo: dateTo || undefined,
          searchField: "all",
          searchValue: debouncedSearchValue,
          sortKey,
          sortDir,
          pageSize: PAGE_SIZE,
          pageIndex,
          cursor: pageCursors[pageIndex] ?? null,
        });

        setRows(result.items);
        setTotal(result.total);

        if (result.mode === "server" && result.lastDoc) {
          setCursors((prev) => {
            const next = cursorList ? [...cursorList] : [...prev];
            next[pageIndex + 1] = result.lastDoc;
            return next;
          });
        } else if (result.mode === "client") {
          setCursors([null]);
        }
      } catch (error) {
        console.error("Failed to load freight forward list:", error);
        setRows([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [
      activeCard,
      activeStatus,
      cursors,
      dateFrom,
      dateTo,
      debouncedSearchValue,
      sortKey,
      sortDir,
    ]
  );

  const WORKFLOW = [
    FreightForwardStatusObject.IN_PROCESS,
    FreightForwardStatusObject.MOMENTUM,
    FreightForwardStatusObject.SPLIT_MANIFEST,
    FreightForwardStatusObject.BILLING,
    FreightForwardStatusObject.RECEIVABLE,
    FreightForwardStatusObject.PAYABLE,
    FreightForwardStatusObject.COMPLETED,
  ];

const handleStatusUpdate = async (
  nextStatus: FreightForwardStatus,
  record?: FreightForward
) => {
    const target = record ?? selected;
    if (!target?.id || !user) return;
    if (!canUpdateToStatus(nextStatus, target.statusTimeline)) return;

    await updateWorkflowStatus(
        target.id,
        nextStatus,
        user.username!
    );

    const updated = {
        ...target,
        status: nextStatus,
        statusTimeline: [
            ...(target.statusTimeline ?? []),
            {
                status: nextStatus,
                updatedBy: user.username ?? "Unknown",
                updatedAt: Timestamp.now(),
            },
        ],
    };

    if (selected?.id === target.id) {
      setSelected(updated);
    }
    if (timelineRecord?.id === target.id) {
      setTimelineRecord(updated);
    }
    await reload();
};

  const closeTimelinePopup = () => {
    setTimelinePopupOpen(false);
    setTimelineRecord(null);
  };

  const openTimelinePopup = async (item: FreightForward) => {
    if (!item.id) return;

    setTimelinePopupOpen(true);
    setTimelineLoading(true);
    try {
      const latest = await getFreightForwardById(item.id);
      setTimelineRecord(latest ?? item);
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleRowClick = (item: FreightForward) => {
    if (rowClickTimerRef.current) {
      clearTimeout(rowClickTimerRef.current);
    }
    rowClickTimerRef.current = setTimeout(() => {
      openTimelinePopup(item);
      rowClickTimerRef.current = null;
    }, 250);
  };

  const handleRowDoubleClick = (item: FreightForward) => {
    if (rowClickTimerRef.current) {
      clearTimeout(rowClickTimerRef.current);
      rowClickTimerRef.current = null;
    }
    closeTimelinePopup();
    openView(item);
  };

  // Re-fetch from scratch whenever filters change
  useEffect(() => {
    setCursors([null]);
    setPage(0);
    loadCounts();
    loadPage(0, [null]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCard, activeStatus, dateFrom, dateTo, debouncedSearchValue, sortKey, sortDir]);

  const reload = async () => {
    await Promise.all([loadCounts(), loadPage(page)]);
  };

  useEffect(() => {
    const stored = sessionStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
    loadLookups();
  }, []);

  const loadLookups = async () => {
    const [cfs, sez, sizes, types, payments, blTypeItems, tradeTerms, kyc] = await Promise.all([
      getCfsList(),
      getSezList(),
      getConfigByCategory("container_size"),
      getConfigByCategory("container_type"),
      getConfigByCategory("payment_type"),
      getConfigByCategory("bl_type"),
      getConfigByCategory("trade_terms"),
      getKyc(),
    ]);
    setCfsList(cfs);
    setSezList(sez);
    setContainerSizes(sizes);
    setContainerTypes(types);
    setPaymentTypes(payments);
    setBlTypes(blTypeItems);
    setTradeTermsList(tradeTerms);
    setKycList(kyc);
  };

  // ── Pagination ────────────────────────────────────────────────────────────
  const goNext = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadPage(nextPage);
  };

  const goPrev = () => {
    const prevPage = page - 1;
    setPage(prevPage);
    loadPage(prevPage);
  };

  // ── Drawer helpers ────────────────────────────────────────────────────────
  const closeDrawer = () => {
    setDrawerMode(null);
    setSelected(null);
    setProformaOpen(false);
    setForm(emptyForm());
    setErrors({});
    setSubmitError("");
    resetDocumentFiles();
  };

  const resetDocumentFiles = () => {
    setMblFile(null);
    setHblFile(null);
    setBilledAmountFile(null);
    setCreditNoteFile(null);
    setPaymentDateFile(null);
    setDebitFiles([]);
    setExistingMblDoc(undefined);
    setExistingHblDoc(undefined);
    setExistingBilledAmountDoc(undefined);
    setExistingCreditNoteDoc(undefined);
    setExistingPaymentDateDoc(undefined);
    setExistingDebitDocs([]);
  };

  const loadDocumentFiles = (item: FreightForward) => {
    setMblFile(null);
    setHblFile(null);
    setBilledAmountFile(null);
    setCreditNoteFile(null);
    setPaymentDateFile(null);
    setDebitFiles([]);
    setExistingMblDoc(item.mblUrl);
    setExistingHblDoc(item.hblUrl);
    setExistingBilledAmountDoc(item.billedAmountUrl);
    setExistingCreditNoteDoc(item.creditNoteUrl);
    setExistingPaymentDateDoc(item.paymentDateUrl);
    setExistingDebitDocs(item.debitDocuments ?? []);
  };

  const openAdd = () => {
    setSelected(null);
    setErrors({});
    setSubmitError("");
    setDrawerMode("add");
    setForm(emptyForm());
  };

  const openEdit = (item: FreightForward) => {
    setSelected(item);
    setForm(toFormData(item));
    loadDocumentFiles(item);
    setErrors({});
    setSubmitError("");
    setDrawerMode("edit");
  };

  const openView = async (item: FreightForward) => {
      const latest = await getFreightForwardById(item.id!);
      if (latest) {
          setSelected(latest);
      }
      setDrawerMode("view");
  };

  const drawerOpen = drawerMode !== null;

  // ── Form helpers ──────────────────────────────────────────────────────────
  const fieldClass = (key: string) =>
    `w-full rounded-xl border px-3 py-2 text-xs outline-none transition focus:ring-2 ${errors[key]
      ? "border-red-400 focus:ring-red-100"
      : "border-zinc-200 focus:border-zinc-500 focus:ring-zinc-200"
    }`;

  const clearError = (key: string) => {
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const scrollReqRef = useRef<number | null>(null);

  const scrollToFirstError = (errorKeys: string[]) => {
    if (!errorKeys.length) return;
    if (isCoarsePointerRef.current) return;
    if (scrollReqRef.current) {
      cancelAnimationFrame(scrollReqRef.current);
    }
    scrollReqRef.current = requestAnimationFrame(() => {
      document
        .querySelector(`[data-field="${errorKeys[0]}"]`)
        ?.scrollIntoView({ behavior: "auto", block: "nearest" });
      scrollReqRef.current = null;
    });
  };

  const clearPendingScroll = () => {
    if (scrollReqRef.current) {
      cancelAnimationFrame(scrollReqRef.current);
      scrollReqRef.current = null;
    }
  };

  const validate = (): boolean => {
    const next: FormErrors = {};

    if (!form.consignmentName.trim()) {
      next.consignmentName = "Consignee Name is required.";
    }
    if (!form.mbl.trim()) {
      next.mbl = "MBL is required.";
    }
    if (!form.hbl.trim()) {
      next.hbl = "HBL is required.";
    }

    const containers = form.containers ?? [];
    let hasValidContainer = false;

    containers.forEach((container, index) => {
      const number = container.containerNumber.trim().toUpperCase();
      if (!number) {
        if (containers.length === 1 || index === 0) {
          next[`containers.${index}.containerNumber`] = "Container Number is required.";
        }
        return;
      }
      if (!CONTAINER_NUMBER_REGEX.test(number)) {
        next[`containers.${index}.containerNumber`] =
          "Format must be 4 uppercase letters followed by 7 digits (e.g. ABCD1234567).";
        return;
      }
      hasValidContainer = true;
    });

    if (!hasValidContainer && !next["containers.0.containerNumber"]) {
      next["containers.0.containerNumber"] = "At least one container is required.";
    }

    setErrors(next);
    const errorKeys = Object.keys(next);
    if (errorKeys.length > 0) {
      setSubmitError("Please correct the required fields highlighted below.");
      scrollToFirstError(errorKeys);
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (saving) return;
    setSubmitError("");
    if (!validate()) return;

    // ── Duplicate check (MBL / HBL / Container No.) ────────────────────────
    // Prevent saving a job with identifiers that already exist in other records.
    const excludeId = selected?.id;
    const normalizedMbl = form.mbl.trim().toLowerCase();
    const normalizedHbl = form.hbl.trim().toLowerCase();
    const containerNumbers = [
      ...(form.containers ?? []),
    ]
      .map((c) => c.containerNumber.trim().toUpperCase())
      .filter(Boolean);

    const uniqueContainerNumbers = Array.from(new Set(containerNumbers));

    const dupErrors: FormErrors = {};
    let dupMessage = "";

    const findCandidates = async (searchField: string, searchValue: string) => {
      const result = await getFreightForwardPaginated({
        activeCard: null,
        activeStatus: null,
        etaFrom: undefined,
        etaTo: undefined,
        searchField,
        searchValue,
        sortKey: "eta",
        sortDir: "asc",
        pageSize: 5000,
        pageIndex: 0,
        cursor: null,
      });
      return result.items;
    };

    if (normalizedMbl) {
      const candidates = await findCandidates("mbl", form.mbl.trim());
      const conflict = candidates.find(
        (r) =>
          r.id !== excludeId &&
          (r.mbl ?? "").trim().toLowerCase() === normalizedMbl
      );
      if (conflict) {
        dupMessage = `MBL already exists in job ${conflict.jobNumber || "—"}.`;
        dupErrors.mbl = dupMessage;
      }
    }

    if (!dupMessage && normalizedHbl) {
      const candidates = await findCandidates("hbl", form.hbl.trim());
      const conflict = candidates.find(
        (r) =>
          r.id !== excludeId &&
          (r.hbl ?? "").trim().toLowerCase() === normalizedHbl
      );
      if (conflict) {
        dupMessage = `HBL already exists in job ${conflict.jobNumber || "—"}.`;
        dupErrors.hbl = dupMessage;
      }
    }

    if (!dupMessage && uniqueContainerNumbers.length) {
      for (const cNo of uniqueContainerNumbers) {
        const candidates = await findCandidates("containerNumber", cNo);
        const conflict = candidates.find(
          (r) =>
            r.id !== excludeId &&
            getContainersFromRecord(r).some(
              (ct) => (ct.containerNumber ?? "").trim().toUpperCase() === cNo
            )
        );
        if (conflict) {
          dupMessage = `Container ${cNo} already exists in job ${
            conflict.jobNumber || "—"
          }.`;

          // Mark all rows that have this conflicting container number.
          (form.containers ?? []).forEach((row, idx) => {
            const rowNo = row.containerNumber.trim().toUpperCase();
            if (rowNo && rowNo === cNo) {
              dupErrors[`containers.${idx}.containerNumber`] = dupMessage;
            }
          });
          break;
        }
      }
    }

    if (dupMessage) {
      setErrors(dupErrors);
      setSubmitError(dupMessage);
      scrollToFirstError(Object.keys(dupErrors));
      return;
    }

    const username = user?.username ?? "unknown";
    setSaving(true);
    try {
      const uploadIfNeeded = async (
        file: File | null,
        folder: string,
        existing?: FreightForwardDocument
      ) => {
        if (!file) return existing;
        return uploadDocument(file, folder);
      };

      const [mblUrl, hblUrl, billedAmountUrl, creditNoteUrl, paymentDateUrl] = await Promise.all([
        uploadIfNeeded(mblFile, "freight-forward/mbl", existingMblDoc),
        uploadIfNeeded(hblFile, "freight-forward/hbl", existingHblDoc),
        uploadIfNeeded(billedAmountFile, "freight-forward/billed-amount", existingBilledAmountDoc),
        uploadIfNeeded(creditNoteFile, "freight-forward/credit-note", existingCreditNoteDoc),
        uploadIfNeeded(paymentDateFile, "freight-forward/payment-date", existingPaymentDateDoc),
      ]);

      const newDebitDocs = await Promise.all(
        debitFiles.map((file) => uploadDocument(file, "freight-forward/debit-note"))
      );

      const payload = removeUndefined({
        ...buildPayload(form),
        mblUrl,
        hblUrl,
        billedAmountUrl,
        creditNoteUrl,
        paymentDateUrl,
        debitDocuments: [...existingDebitDocs, ...newDebitDocs],
      });

      if (selected?.id) {
        await updateFreightForward(selected.id, payload as Partial<FreightForwardFormData>, username);
      } else {
        await createFreightForward(payload as FreightForwardFormData, username);
      }
      closeDrawer();
      await reload();
    } catch (err) {
      console.error("Save error:", err);
      setSubmitError("Unable to save freight forward record. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!dateFrom || !dateTo) return;
    setExporting(true);
    try {
      const data = await getFreightForwardForExport(dateFrom, dateTo);
      if (!data.length) return;
      exportFreightForwardToExcel(data, dateFrom, dateTo);
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await softDeleteFreightForward(deleteId, user?.username ?? "unknown");
    setDeleteId(null);
    await reload();
  };

  const setLocationType = (type: "cfs" | "sez") => {
    setForm({ ...form, locationType: type, cfs: undefined, sez: undefined });
  };

  const addContainer = () =>
    setForm({
      ...form,
      containers: [...(form.containers ?? []), emptyContainer()],
    });

  const updateContainer = (
    index: number,
    field: keyof FreightContainer,
    value: string
  ) => {
    const items = [...(form.containers ?? [])];
    items[index] = {
      ...items[index],
      [field]: field === "containerNumber" ? value.toUpperCase() : value,
    };
    setForm({
      ...form,
      containers: items,
      containerNumber: items[0]?.containerNumber ?? "",
      containerSize: items[0]?.containerSize ?? "",
      containerType: items[0]?.containerType ?? "",
    });
    clearError(`containers.${index}.containerNumber`);
  };

  const removeContainer = (index: number) => {
    const items = [...(form.containers ?? [])];
    if (items.length <= 1) return;
    items.splice(index, 1);
    setForm({
      ...form,
      containers: items,
      containerNumber: items[0]?.containerNumber ?? "",
      containerSize: items[0]?.containerSize ?? "",
      containerType: items[0]?.containerType ?? "",
    });
  };

  const addExWorks = () => setForm({ ...form, exWorks: [...(form.exWorks ?? []), emptyExpenseItem()] });

  const updateExWorks = (index: number, field: keyof ExWorksItem, value: string | number) => {
    const items = [...(form.exWorks ?? [])];
    items[index] = { ...items[index], [field]: value };
    setForm({ ...form, exWorks: items });
  };

  const removeExWorks = (index: number) => {
    const items = [...(form.exWorks ?? [])];
    items.splice(index, 1);
    setForm({ ...form, exWorks: items });
  };

  const addOtherExpenses = () =>
    setForm({ ...form, otherExpenses: [...(form.otherExpenses ?? []), emptyExpenseItem()] });

  const updateOtherExpenses = (index: number, field: keyof ExpenseItem, value: string | number) => {
    const items = [...(form.otherExpenses ?? [])];
    items[index] = { ...items[index], [field]: value };
    setForm({ ...form, otherExpenses: items });
  };

  const removeOtherExpenses = (index: number) => {
    const items = [...(form.otherExpenses ?? [])];
    items.splice(index, 1);
    setForm({ ...form, otherExpenses: items });
  };

  const currencyInputClass = (key: string, extra = "") =>
    `pl-7 ${extra} ${fieldClass(key)}`;

  const handleColumnSort = (key: FreightSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
    setCursors([null]);
  };

  type ListColumn = {
    label: string;
    sortKey?: FreightSortKey;
  };

  const listColumns: ListColumn[] = [
    { label: "FF No", sortKey: "jobNumber" },
    { label: "EZ No", sortKey: "ezRefNumber" },
    { label: "BL Type" },
    { label: "Agent" },
    { label: "Trade Terms" },
    { label: "Vessel Name" },
    { label: "ETA", sortKey: "eta" },
    { label: "Location" },
    { label: "Consignee" },
    { label: "Client" },
    { label: "MBL" },
    { label: "HBL" },
    { label: "Cont No" },
    { label: "Actions" },
  ];

  // ── Render: form ──────────────────────────────────────────────────────────
  const renderForm = () => (
    <div className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            {drawerMode === "edit" ? "Edit Freight Forward" : "Add Freight Forward"}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Fields marked with <span className="text-red-500">*</span> are required.
          </p>
        </div>
        <button onClick={closeDrawer} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
          <X size={16} />
        </button>
      </div>

      {submitError && (
        <div
          className={`mt-4 rounded-xl border px-3 py-2 text-xs ${
            Object.keys(errors).length > 0
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-red-200 bg-red-50 text-red-600"
          }`}
        >
          {submitError}
        </div>
      )}

      <div className="mt-4 space-y-4">
        <FormSection title="Job Reference" description="Job identity and external reference numbers.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-600">Job Number</label>
              <input
                value={form.jobNumber ?? ""}
                readOnly
                placeholder={drawerMode === "add" ? "Auto-generated on save" : undefined}
                className={`${fieldClass("jobNumber")} bg-zinc-100 cursor-not-allowed`}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-600">EZ Ref Number</label>
              <input value={form.ezRefNumber ?? ""} onChange={(e) => { setForm({ ...form, ezRefNumber: e.target.value }); clearError("ezRefNumber"); }} className={fieldClass("ezRefNumber")} />
            </div>
          </div>
        </FormSection>

        <FormSection title="Parties" description="Consignee, client, and trade terms.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div data-field="consignmentName">
              <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                Consignee Name <span className="text-red-500">*</span>
              </label>
              <select
                value={form.consignmentName}
                onChange={(e) => {
                  setForm({ ...form, consignmentName: e.target.value });
                  clearError("consignmentName");
                }}
                className={fieldClass("consignmentName")}
              >
                <option value="">Select consignee from KYC</option>
                {form.consignmentName &&
                  !kycList.some((k) => k.companyName === form.consignmentName) && (
                    <option value={form.consignmentName}>{form.consignmentName}</option>
                  )}
                {kycList.map((kyc) => (
                  <option key={kyc.id ?? kyc.companyName} value={kyc.companyName}>
                    {kyc.companyName}
                  </option>
                ))}
              </select>
              {errors.consignmentName && (
                <p className="mt-1 text-[11px] text-red-500">{errors.consignmentName}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                Client Name
              </label>
              <input
                value={form.clientName ?? ""}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                className={fieldClass("clientName")}
              />
            </div>
          </div>

          {selectedConsigneeKyc?.billingAddress && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs text-zinc-600">
              <span className="font-medium text-zinc-700">Consignee address: </span>
              {selectedConsigneeKyc.billingAddress}
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">
              Trade Terms
            </label>
            <select
              value={form.tradeTerms ?? ""}
              onChange={(e) => setForm({ ...form, tradeTerms: e.target.value })}
              className={fieldClass("tradeTerms")}
            >
              <option value="">Select trade terms</option>
              {tradeTermsList.map((item) => (
                <option key={item.id} value={item.value}>
                  {item.value}
                </option>
              ))}
            </select>
          </div>
        </FormSection>

        <FormSection title="Bill of Lading" description="MBL, HBL and BL type details.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div data-field="mbl">
              <FieldWithUpload
                label="MBL"
                required
                value={form.mbl}
                onChange={(v) => {
                  setForm({ ...form, mbl: v });
                  clearError("mbl");
                }}
                file={mblFile}
                existingFile={existingMblDoc}
                onFileChange={(f) => {
                  setMblFile(f);
                  if (f) setExistingMblDoc(undefined);
                }}
                onRemoveExisting={() => setExistingMblDoc(undefined)}
                error={errors.mbl}
                fieldClass={fieldClass("mbl")}
              />
            </div>
            <div data-field="hbl">
              <FieldWithUpload
                label="HBL"
                required
                value={form.hbl}
                onChange={(v) => {
                  setForm({ ...form, hbl: v });
                  clearError("hbl");
                }}
                file={hblFile}
                existingFile={existingHblDoc}
                onFileChange={(f) => {
                  setHblFile(f);
                  if (f) setExistingHblDoc(undefined);
                }}
                onRemoveExisting={() => setExistingHblDoc(undefined)}
                error={errors.hbl}
                fieldClass={fieldClass("hbl")}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">BL Type</label>
            <select
              value={form.blType ?? ""}
              onChange={(e) => setForm({ ...form, blType: e.target.value })}
              className={fieldClass("blType")}
            >
              <option value="">Select BL type</option>
              {blTypes.map((item) => (
                <option key={item.id} value={item.value}>
                  {item.value}
                </option>
              ))}
            </select>
          </div>
        </FormSection>

        <FormSection
          title="Containers"
          description="Add one or more container numbers with size and type."
          action={
            <button
              type="button"
              onClick={addContainer}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50"
            >
              <Plus size={12} /> Add container
            </button>
          }
        >
          <div className="space-y-3">
            {(form.containers ?? []).map((container, index) => (
              <div
                key={index}
                className="rounded-xl border border-zinc-200 bg-white p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-zinc-500">
                    Container {index + 1}
                  </span>
                  {(form.containers ?? []).length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContainer(index)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <div data-field={`containers.${index}.containerNumber`}>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                      Container Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={container.containerNumber}
                      onChange={(e) =>
                        updateContainer(index, "containerNumber", e.target.value)
                      }
                      placeholder="ABCD1234567"
                      maxLength={11}
                      className={fieldClass(`containers.${index}.containerNumber`)}
                    />
                    {errors[`containers.${index}.containerNumber`] && (
                      <p className="mt-1 text-[11px] text-red-500">
                        {errors[`containers.${index}.containerNumber`]}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                        Container Size
                      </label>
                      <select
                        value={container.containerSize ?? ""}
                        onChange={(e) =>
                          updateContainer(index, "containerSize", e.target.value)
                        }
                        className={fieldClass(`containers.${index}.containerSize`)}
                      >
                        <option value="">Select size</option>
                        {containerSizes.map((item) => (
                          <option key={item.id} value={item.value}>
                            {item.value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                        Container Type
                      </label>
                      <select
                        value={container.containerType ?? ""}
                        onChange={(e) =>
                          updateContainer(index, "containerType", e.target.value)
                        }
                        className={fieldClass(`containers.${index}.containerType`)}
                      >
                        <option value="">Select type</option>
                        {containerTypes.map((item) => (
                          <option key={item.id} value={item.value}>
                            {item.value}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FormSection>

        <FormSection title="Voyage & Route" description="Vessel schedule and port movement.">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">Vessel Name</label>
            <input value={form.vesselName ?? ""} onChange={(e) => setForm({ ...form, vesselName: e.target.value })} className={fieldClass("vesselName")} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-600">ETD</label>
              <input type="date" value={form.etd ?? ""} onChange={(e) => setForm({ ...form, etd: e.target.value })} className={fieldClass("etd")} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-600">ETA</label>
              <input type="date" value={form.eta ?? ""} onChange={(e) => setForm({ ...form, eta: e.target.value })} className={fieldClass("eta")} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-600">POL</label>
              <input value={form.pol ?? ""} onChange={(e) => setForm({ ...form, pol: e.target.value })} className={fieldClass("pol")} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-600">POD</label>
              <input value={form.pod ?? ""} onChange={(e) => setForm({ ...form, pod: e.target.value })} className={fieldClass("pod")} />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-medium text-zinc-600">Location</label>
            <div className="flex gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1">
              {(["cfs", "sez"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setLocationType(type)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium uppercase transition
                    ${form.locationType === type
                      ? "bg-zinc-900 text-white shadow-md"
                      : "text-zinc-500 hover:bg-white hover:text-zinc-900"
                    }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="mt-3">
              {form.locationType === "cfs" ? (
                <select value={form.cfs ?? ""} onChange={(e) => setForm({ ...form, cfs: e.target.value ? e.target.value : undefined })} className={fieldClass("cfs")}>
                  <option value="">Select CFS</option>
                  {cfsList.map((item) => <option key={item.id} value={item.code}>{item.code}</option>)}
                </select>
              ) : (
                <select value={form.sez ?? ""} onChange={(e) => setForm({ ...form, sez: e.target.value ? e.target.value : undefined })} className={fieldClass("sez")}>
                  <option value="">Select SEZ</option>
                  {sezList.map((item) => <option key={item.id} value={item.code}>{item.code}</option>)}
                </select>
              )}
            </div>

            {selectedLocation && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                    Name
                  </label>
                  <input
                    readOnly
                    value={selectedLocation.name}
                    className={`${fieldClass("location-name")} bg-zinc-100 cursor-not-allowed`}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                    Code
                  </label>
                  <input
                    readOnly
                    value={selectedLocation.code}
                    className={`${fieldClass("location-code")} bg-zinc-100 cursor-not-allowed`}
                  />
                </div>
                {(form.locationType === "cfs" && selectedCfs) && (
                  <>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                        PAN
                      </label>
                      <input
                        readOnly
                        value={selectedCfs.pan || '-'}
                        className={`${fieldClass("location-pan")} bg-zinc-100 cursor-not-allowed`}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                        Bond
                      </label>
                      <input
                        readOnly
                        value={selectedCfs.bond || '-'}
                        className={`${fieldClass("location-bond")} bg-zinc-100 cursor-not-allowed`}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </FormSection>

        <FormSection title="Carrier" description="Liner and agent details.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-600">Liner</label>
              <input value={form.liner ?? ""} onChange={(e) => setForm({ ...form, liner: e.target.value })} className={fieldClass("liner")} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-600">Agent</label>
              <input value={form.agent ?? ""} onChange={(e) => setForm({ ...form, agent: e.target.value })} className={fieldClass("agent")} />
            </div>
          </div>
        </FormSection>

        <FormSection title="Charges & Expenses" description="Ocean freight, ex-works and other cost lines.">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">
              Ocean Freight per container
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
              <input
                type="number"
                value={form.oceanFreightPerContainer ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    oceanFreightPerContainer:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                className={currencyInputClass("oceanFreightPerContainer")}
              />
            </div>
            {totalOceanFreightAmount > 0 && (
              <div className="mt-2">
                <span className="inline-flex rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
                  Total Ocean Freight • {displayDollar(totalOceanFreightAmount)}
                  {filledContainerCount > 1 ? ` (${filledContainerCount} containers)` : ""}
                </span>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[11px] font-medium text-zinc-600">Ex-Works</label>
              <button type="button" onClick={addExWorks} className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50">
                <Plus size={12} /> Add row
              </button>
            </div>
            {(form.exWorks ?? []).length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 bg-white px-3 py-4 text-center text-[11px] text-zinc-400">
                No Ex-Works entries. Click &quot;Add row&quot; to add one.
              </p>
            ) : (
              <div className="space-y-2">
                {(form.exWorks ?? []).map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      placeholder="Name"
                      value={item.name}
                      onChange={(e) => updateExWorks(index, "name", e.target.value)}
                      className={`w-64 ${fieldClass(`exWorks-name-${index}`)}`}
                    />

                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
                      <input
                        type="number"
                        placeholder="Amount"
                        value={item.amount || ""}
                        onChange={(e) =>
                          updateExWorks(
                            index,
                            "amount",
                            e.target.value === "" ? 0 : Number(e.target.value)
                          )
                        }
                        className={currencyInputClass(`exWorks-amount-${index}`, "w-28")}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeExWorks(index)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">
              Total Ex-Works Amount
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
              <input
                type="number"
                value={totalExWorksAmount}
                readOnly
                className={`${currencyInputClass("totalExWorks")} bg-zinc-100 cursor-not-allowed`}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[11px] font-medium text-zinc-600">Other Expenses</label>
              <button type="button" onClick={addOtherExpenses} className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50">
                <Plus size={12} /> Add row
              </button>
            </div>
            {(form.otherExpenses ?? []).length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 bg-white px-3 py-4 text-center text-[11px] text-zinc-400">
                No Other Expenses entries. Click &quot;Add row&quot; to add one.
              </p>
            ) : (
              <div className="space-y-2">
                {(form.otherExpenses ?? []).map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      placeholder="Name"
                      value={item.name}
                      onChange={(e) => updateOtherExpenses(index, "name", e.target.value)}
                      className={`w-64 ${fieldClass(`otherExpenses-name-${index}`)}`}
                    />

                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
                      <input
                        type="number"
                        placeholder="Amount"
                        value={item.amount || ""}
                        onChange={(e) =>
                          updateOtherExpenses(
                            index,
                            "amount",
                            e.target.value === "" ? 0 : Number(e.target.value)
                          )
                        }
                        className={currencyInputClass(`otherExpenses-amount-${index}`, "w-28")}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeOtherExpenses(index)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">
              Total Other Expenses Amount
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
              <input
                type="number"
                value={totalOtherExpensesAmount}
                readOnly
                className={`${currencyInputClass("totalOtherExpenses")} bg-zinc-100 cursor-not-allowed`}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">
              Debit Note
            </label>
            <MultiDocumentFileUpload
              files={debitFiles}
              existingFiles={existingDebitDocs}
              onFilesAdd={(added) => setDebitFiles((prev) => [...prev, ...added])}
              onFileRemove={(index) =>
                setDebitFiles((prev) => prev.filter((_, i) => i !== index))
              }
              onExistingRemove={(index) =>
                setExistingDebitDocs((prev) => prev.filter((_, i) => i !== index))
              }
            />
          </div>
        </FormSection>

        <FormSection title="Financial Summary" description="Totals, billing and credit note.">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-600">Total Expenses</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
                  <input
                    type="number"
                    value={totalExpensesAmount}
                    readOnly
                    className={`${currencyInputClass("totalExpenses")} h-9 w-full bg-zinc-100 cursor-not-allowed`}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-600">Billed Amount</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
                  <input
                    type="number"
                    value={form.billedAmount ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        billedAmount: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    className={`${currencyInputClass("billedAmount")} h-9 w-full`}
                  />
                </div>
                <DocumentFileUpload
                  file={billedAmountFile}
                  existingFile={existingBilledAmountDoc}
                  onFileChange={(f) => {
                    setBilledAmountFile(f);
                    if (f) setExistingBilledAmountDoc(undefined);
                  }}
                  onRemoveExisting={() => setExistingBilledAmountDoc(undefined)}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-600">Profit / Loss</label>
                <div className="flex h-9 items-center">
                  <ProfitLossChip amount={profitLossAmount} />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">Credit Note</label>
            <div className="relative max-w-sm">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
              <input
                type="number"
                value={form.creditNote ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    creditNote: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                className={`${currencyInputClass("creditNote")} h-9 w-full`}
              />
            </div>
            <DocumentFileUpload
              file={creditNoteFile}
              existingFile={existingCreditNoteDoc}
              onFileChange={(f) => {
                setCreditNoteFile(f);
                if (f) setExistingCreditNoteDoc(undefined);
              }}
              onRemoveExisting={() => setExistingCreditNoteDoc(undefined)}
            />
          </div>
        </FormSection>

        <FormSection title="Payment" description="Payment type and payment date.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-600">Payment Type</label>
              <select value={form.paymentType ?? ""} onChange={(e) => setForm({ ...form, paymentType: e.target.value })} className={fieldClass("paymentType")}>
                <option value="">Select payment type</option>
                {paymentTypes.map((item) => <option key={item.id} value={item.value}>{item.value}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-600">Payment Date</label>
              <input type="date" value={form.paymentDate ?? ""} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} className={fieldClass("paymentDate")} />
              <DocumentFileUpload
                file={paymentDateFile}
                existingFile={existingPaymentDateDoc}
                onFileChange={(f) => {
                  setPaymentDateFile(f);
                  if (f) setExistingPaymentDateDoc(undefined);
                }}
                onRemoveExisting={() => setExistingPaymentDateDoc(undefined)}
              />
            </div>
          </div>
        </FormSection>
      </div>

      <div className="mt-5 flex gap-2">
        <button onClick={closeDrawer} className="flex-1 rounded-xl border border-zinc-200 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-zinc-900 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );

  // ── Render: view ──────────────────────────────────────────────────────────
  const renderViewDrawer = () => (
    // <div className="p-5">
    //   <div className="flex items-center justify-between">
    //     <h3 className="text-sm font-semibold text-zinc-900">Freight Forward Details</h3>
    //     <button onClick={closeDrawer} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
    //       <X size={16} />
    //     </button>
    //   </div>
    //   {selected && (
    //     <div className="mt-3 space-y-1.5 text-xs text-zinc-600">
    //       <p><span className="font-medium text-zinc-800">Job Number:</span> {selected.jobNumber || "—"}</p>
    //       <p><span className="font-medium text-zinc-800">EZ Ref Number:</span> {selected.ezRefNumber || "—"}</p>
    //       <p><span className="font-medium text-zinc-800">Consignment Name:</span> {selected.consignmentName}</p>
    //       <p><span className="font-medium text-zinc-800">MBL:</span> {selected.mbl}</p>
    //       <p><span className="font-medium text-zinc-800">HBL:</span> {selected.hbl}</p>
    //       <p><span className="font-medium text-zinc-800">Container Number:</span> {selected.containerNumber}</p>
    //       <p><span className="font-medium text-zinc-800">Container Size:</span> {selected.containerSize || "—"}</p>
    //       <p><span className="font-medium text-zinc-800">Container Type:</span> {selected.containerType || "—"}</p>
    //       <p><span className="font-medium text-zinc-800">ETD:</span> {formatDate(selected.etd)}</p>
    //       <p><span className="font-medium text-zinc-800">ETA:</span> {formatDate(selected.eta)}</p>
    //       <p><span className="font-medium text-zinc-800">Vessel Name:</span> {selected.vesselName || "—"}</p>
    //       <p><span className="font-medium text-zinc-800">POL:</span> {selected.pol || "—"}</p>
    //       <p><span className="font-medium text-zinc-800">POD:</span> {selected.pod || "—"}</p>
    //       <p>
    //         <span className="font-medium text-zinc-800">Location:</span>{" "}
    //         {selected.cfs ? `${selected.cfs}` : selected.sez ? `${selected.sez}` : "—"}
    //       </p>
    //       <p><span className="font-medium text-zinc-800">Liner:</span> {selected.liner || "—"}</p>
    //       <p><span className="font-medium text-zinc-800">Agent:</span> {selected.agent || "—"}</p>
    //       <p><span className="font-medium text-zinc-800">Ocean Freight:</span> {selected.oceanFreight || "—"}</p>
    //       <p>
    //         <span className="font-medium text-zinc-800">Ex-Works:</span>{" "}
    //         {(selected.exWorks ?? []).length === 0
    //           ? "—"
    //           : (selected.exWorks ?? []).map((i) => `${i.name}: ${i.amount}`).join(", ")}
    //       </p>
    //       <p><span className="font-medium text-zinc-800">billed amount:</span> {selected.buildAmount ?? "—"}</p>
    //       <p><span className="font-medium text-zinc-800">Payment Type:</span> {selected.paymentType || "—"}</p>
    //       <p><span className="font-medium text-zinc-800">Payment Date:</span> {formatDate(selected.paymentDate)}</p>
    //       <p><span className="font-medium text-zinc-800">Status:</span> {statusLabel(selected.status)}</p>
    //       <p><span className="font-medium text-zinc-800">Created By:</span> {selected.createdBy || "—"}</p>
    //       <p><span className="font-medium text-zinc-800">Updated By:</span> {selected.updatedBy || "—"}</p>
    //     </div>
    //   )}
    //   <div className="mt-5 flex gap-2">
    //     <button onClick={closeDrawer} className="flex-1 rounded-xl border border-zinc-200 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50">Close</button>
    //     <button onClick={() => selected && openEdit(selected)} className="flex-1 rounded-xl bg-zinc-900 py-2 text-xs font-medium text-white hover:bg-zinc-800">Edit</button>
    //   </div>
    // </div>



    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            Freight Forward Details
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Shipment information and payment details
          </p>
        </div>

        <button
          onClick={closeDrawer}
          className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X size={18} />
        </button>
      </div>

      {selected && (
        <div className="mt-6 space-y-6">

       

          {/* Shipment */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <SectionHeader
              icon={Ship}
              title="Shipment"
              color="bg-blue-600"
            />

            <div className="grid grid-cols-2 gap-4">
              <Info label="Job Number" value={selected.jobNumber} />
              <Info label="EZ Ref" value={selected.ezRefNumber} />
              <Info
                label="Consignment"
                value={selected.consignmentName}
                full
              />
              <Info label="Client Name" value={selected.clientName} />
              <Info label="Trade Terms" value={selected.tradeTerms} />
              <Info label="MBL" value={selected.mbl} />
              <Info label="HBL" value={selected.hbl} />
              <Info label="BL Type" value={selected.blType} />
              <DocInfo label="MBL Document" doc={selected.mblUrl} />
              <DocInfo label="HBL Document" doc={selected.hblUrl} />
            </div>
          </section>

          {/* Container */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <SectionHeader
              icon={Package}
              title="Container"
              color="bg-emerald-600"
            />

            <div className="space-y-3">
              {getContainersFromRecord(selected).map((container, index) => (
                <div
                  key={`${container.containerNumber}-${index}`}
                  className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-100 bg-zinc-50/50 p-3"
                >
                  <Info label="Container No." value={container.containerNumber} />
                  <Info label="Size" value={container.containerSize} />
                  <Info label="Type" value={container.containerType} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <Info label="Vessel" value={selected.vesselName} />
                <Info label="Liner" value={selected.liner} />
                <Info label="Agent" value={selected.agent} />
              </div>
            </div>
          </section>

          {/* Route */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <SectionHeader
              icon={Route}
              title="Route"
              color="bg-violet-600"
            />

            <div className="grid grid-cols-2 gap-4">
              <Info label="POL" value={selected.pol} />
              <Info label="POD" value={selected.pod} />
              <Info label="ETD" value={formatDate(selected.etd)} />
              <Info label="ETA" value={formatDate(selected.eta)} />
              <Info
                label="Location"
                value={getLocationCode(selected, cfsList, sezList)}
                full
              />
            </div>
          </section>

          {/* Payment */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <SectionHeader
              icon={CreditCard}
              title="Payment"
              color="bg-amber-500"
            />

            <div className="grid grid-cols-2 gap-4">
              <Info
                label="Ocean Freight per container"
                value={displayDollar(getOceanFreightPerContainer(selected))}
              />
              <Info
                label="Ocean Freight Total"
                value={displayDollar(getTotalOceanFreight(selected))}
              />
              <Info
                label="Total Expenses"
                value={displayDollar(getRecordTotalExpenses(selected))}
              />
              <Info
                label="Billed Amount"
                value={displayDollar(getBilledAmount(selected))}
              />
              <DocInfo label="Billed Amount Document" doc={selected.billedAmountUrl} />
              <Info
                label="Credit Note"
                value={displayDollar(selected.creditNote)}
              />
              <DocInfo label="Credit Note Document" doc={selected.creditNoteUrl} />
              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Profit / Loss
                </div>
                <div className="mt-2">
                  <ProfitLossChip amount={getRecordProfitLoss(selected)} />
                </div>
              </div>
              <Info
                label="Payment Type"
                value={selected.paymentType}
              />
              <Info
                label="Payment Date"
                value={formatDate(selected.paymentDate)}
              />
              <DocInfo label="Payment Date Document" doc={selected.paymentDateUrl} />

              <div className="col-span-2">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Ex Works
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(selected.exWorks ?? []).length === 0 ? (
                    <span className="text-sm text-zinc-500">—</span>
                  ) : (
                    selected?.exWorks?.map((item, index) => (
                      <span
                        key={`${item.name}-${index}`}
                        className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200"
                      >
                        {item.name} • {displayDollar(item.amount)}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="col-span-2">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Other Expenses
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(selected.otherExpenses ?? []).length === 0 ? (
                    <span className="text-sm text-zinc-500">—</span>
                  ) : (
                    selected?.otherExpenses?.map((item, index) => (
                      <span
                        key={`${item.name}-${index}`}
                        className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200"
                      >
                        {item.name} • {displayDollar(item.amount)}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="col-span-2">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Debit Note
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(selected.debitDocuments ?? []).length === 0 ? (
                    <span className="text-sm text-zinc-500">—</span>
                  ) : (
                    selected.debitDocuments?.map((doc, index) => (
                      <DocumentFileChip
                        key={`${doc.url}-${index}`}
                        name={doc.name}
                        onDownload={() => window.open(doc.url, "_blank")}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="col-span-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProformaOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800"
                >
                  <FileSpreadsheet size={14} />
                  Freight Certificate
                </button>
              </div>
            </div>
          </section>

          {/* Audit */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <SectionHeader
              icon={ShieldCheck}
              title="Audit"
              color="bg-zinc-800"
            />

            <div className="grid grid-cols-2 gap-4">
              <Info
                label="Created By"
                value={selected.createdBy}
              />
              <Info
                label="Updated By"
                value={selected.updatedBy}
              />
            </div>
          </section>
        </div>
      )}
      <div className="h-5" />

      <div className="mt-8 flex gap-3 border-t border-zinc-200 pt-5">
        <button
          onClick={closeDrawer}
          className="flex-1 rounded-xl border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
        >
          Close
        </button>

        <button
          onClick={() => selected && openEdit(selected)}
          className="flex-1 rounded-xl bg-black py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          Edit Details
        </button>
      </div>
    </div>
  );

  type InfoProps = {
    label: string;
    value?: React.ReactNode;
    full?: boolean;
  };

  const Info = ({ label, value, full = false }: InfoProps) => (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>

      <div className="mt-1 break-words text-sm font-medium text-zinc-900">
        {value || "—"}
      </div>
    </div>
  );

  const SectionHeader = ({
    icon: Icon,
    title,
    color,
  }: {
    icon: any;
    title: string;
    color: string;
  }) => (
    <div className="mb-5 flex items-center gap-3 border-b border-zinc-200 pb-4">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm bg-zinc-800`}
      >
        <Icon size={18} className="text-white" />
      </div>

      <div>
        <h3 className="text-sm font-semibold tracking-wide text-zinc-900">
          {title}
        </h3>
        <p className="text-xs text-zinc-500">
          {title} Information
        </p>
      </div>
    </div>
  );
  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <ModuleHeader title="Freight Forward" description="Manage shipments, carriers, and forwarding workflows." />

        {/* Summary Cards — counts from getCountFromServer, not from fetched documents */}
        {/* <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {summaryCards.map((card) => (
            <button
              key={card.key}
              onClick={() => handleCardClick(card.key)}
              className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${card.color} ${activeCard === card.key ? "ring-2 ring-offset-1 ring-zinc-400" : ""}`}
            >
              <p className="text-[11px] font-medium opacity-80">{card.label}</p>
              <p className="mt-1 text-2xl font-bold">{card.count}</p>
            </button>
          ))}
        </div> */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {summaryCards.map((card) => {
            const isSelected = activeCard === card.key;

            return (
              <button
                key={card.key}
                onClick={() => handleCardClick(card.key)}
                className={`
          relative overflow-hidden rounded-xl border
          px-4 py-3 text-left
          transition-all duration-200 ease-out
          ${isSelected
                    ? "bg-white border-zinc-300 shadow-lg scale-[1.015]"
                    : "bg-zinc-100 border-zinc-200 hover:bg-zinc-50 hover:shadow-sm"
                  }
        `}
              >
                {/* Left Accent */}
                {isSelected && (
                  <div className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-black via-zinc-700 to-zinc-700" />
                )}

                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                  {card.label}
                </p>

                <p className="mt-1 text-2xl font-bold leading-none text-zinc-900">
                  {card.count}
                </p>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 gap-2">
            <input
              type="text"
              placeholder="Search FF No, EZ No, Consignee, MBL, HBL, Cont No..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[11px] text-zinc-500">
              ETA From
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                if (dateTo && e.target.value > dateTo) {
                  setDateTo("");
                }
              }}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />

            <span className="text-[11px] text-zinc-500">To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom} // Prevent selecting a date before "From"
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={handleGenerateReport}
              disabled={!dateFrom || !dateTo || exporting}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40"
            >
              <FileSpreadsheet size={16} />
              {exporting ? "Generating..." : "Generate Report"}
            </button>
            <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800">
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => loadStatusRecords(chip.value)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                  activeStatus === chip.value
                    ? "bg-black text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {chip.label} ({chip.count})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(activeStatus || activeCard) && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">
                  Showing:
                  <span className="ml-1 font-medium text-zinc-800">
                    {activeStatus
                      ? STATUS_CHIPS.find((c) => c.value === activeStatus)?.label ??
                        activeStatus.charAt(0).toUpperCase() + activeStatus.slice(1)
                      : summaryCards.find((c) => c.key === activeCard)?.label}
                  </span>
                </span>
                <button
                  onClick={() => {
                    if (activeStatus) {
                      clearStatusFilter();
                    } else {
                      setActiveCard(null);
                    }
                  }}
                  className="text-[11px] text-zinc-400 underline hover:text-zinc-700"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Table */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-slate-50">
                  {listColumns.map((column) => {
                    const isSortable = Boolean(column.sortKey);
                    const isActive = column.sortKey === sortKey;
                    return (
                      <th
                        key={column.label}
                        className={`whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 ${
                          column.label === "Actions" ? "text-center" : "text-left"
                        }`}
                      >
                        {isSortable && column.sortKey ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleColumnSort(column.sortKey!);
                            }}
                            className={`inline-flex items-center gap-1 transition hover:text-zinc-800 ${
                              isActive ? "text-zinc-900" : "text-zinc-500"
                            }`}
                          >
                            {column.label}
                            {isActive ? (
                              sortDir === "asc" ? (
                                <ArrowUp size={12} />
                              ) : (
                                <ArrowDown size={12} />
                              )
                            ) : (
                              <ArrowUpDown size={12} className="opacity-50" />
                            )}
                          </button>
                        ) : (
                          column.label
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={14} className="py-10 text-center text-zinc-500">Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={14} className="py-10 text-center text-zinc-400">No freight forward records found.</td></tr>
                ) : (
                  rows.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => handleRowClick(item)}
                      onDoubleClick={() => handleRowDoubleClick(item)}
                      className="cursor-pointer border-b border-zinc-100 transition-colors hover:bg-zinc-50"
                    >
                      <td className="px-4 py-3 font-medium text-zinc-800">{item.jobNumber || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{item.ezRefNumber || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{item.blType || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{item.agent || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{item.tradeTerms || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{item.vesselName || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{formatDate(item.eta)}</td>
                      <td className="px-4 py-3 text-zinc-600">
                        {getLocationCode(item, cfsList, sezList)}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-800">{item.consignmentName}</td>
                      <td className="px-4 py-3 text-zinc-600">{item.clientName || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{item.mbl}</td>
                      <td className="px-4 py-3 text-zinc-600">{item.hbl}</td>
                      <td className="px-4 py-3 text-zinc-600">{formatContainersDisplay(item)}</td>
                      <td
                        className="px-4 py-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ActionMenu
                          showView={false}
                          showDelete={isAdmin}
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

        {/* Pagination — keyset-based, total from server count */}
        <div className="mt-4 flex items-center justify-end gap-1.5">
          <button disabled={page === 0} onClick={goPrev} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs disabled:opacity-40">Prev</button>
          <span className="px-2 py-1.5 text-xs text-zinc-500">{page + 1} / {totalPages}</span>
          <button disabled={page + 1 >= totalPages} onClick={goNext} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs disabled:opacity-40">Next</button>
        </div>
      </div>

      {/* Workflow timeline popup — single click, bottom-right corner */}
      {timelinePopupOpen && (
        <>
          <div
            className="fixed inset-0 z-[65] bg-black/20"
            onClick={closeTimelinePopup}
          />
          <div
            className="fixed bottom-4 right-4 z-[66] flex w-[min(100vw-2rem,24rem)] max-h-[min(75vh,32rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div className="min-w-0 pr-2">
                <h2 className="truncate text-sm font-semibold text-zinc-900">Workflow Timeline</h2>
                <p className="truncate text-[11px] text-zinc-500">
                  {timelineRecord?.jobNumber || "—"} · {timelineRecord?.consignmentName || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeTimelinePopup}
                className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {timelineLoading ? (
                <p className="p-4 text-xs text-zinc-500">Loading workflow...</p>
              ) : timelineRecord ? (
                <WorkflowTimeline
                  selected={timelineRecord}
                  currentUserRole={userRole}
                  compact
                  onComplete={(nextStatus) =>
                    handleStatusUpdate(nextStatus, timelineRecord)
                  }
                />
              ) : null}
            </div>
          </div>
        </>
      )}

      {/* Backdrop */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={closeDrawer} />
      )}

      {/* RIGHT-SIDE Drawer — Add / Edit / View */}
      <div
        className={`fixed right-0 top-0 z-50 h-full overflow-y-auto border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "translate-x-full"
          } ${drawerMode === "view" ? "w-full max-w-lg" : "w-full max-w-2xl"}`}
        onFocusCapture={clearPendingScroll}
        onPointerDownCapture={clearPendingScroll}
        onTouchStartCapture={clearPendingScroll}
      >
        {(drawerMode === "add" || drawerMode === "edit") && renderForm()}
        {drawerMode === "view" && renderViewDrawer()}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Move to Trash"
        message="This job will be moved to Trash. You can permanently delete it later from Freight Forward → Trash."
        confirmLabel="Move to Trash"
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />

      {selected && (
        <ProformaDialog
          open={proformaOpen}
          record={selected}
          kycList={kycList}
          onClose={() => setProformaOpen(false)}
        />
      )}
    </>
  );
}

function ProfitLossChip({ amount }: { amount: number }) {
  const chip = formatProfitLossChip(amount);
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${chip.className}`}
    >
      {chip.label} • {chip.value}
    </span>
  );
}

function DocumentFileChip({
  name,
  onRemove,
  onDownload,
}: {
  name: string;
  onRemove?: () => void;
  onDownload?: () => void;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-700">
      <span className="truncate">{name}</span>
      {onDownload && (
        <button type="button" onClick={onDownload} className="shrink-0 text-zinc-500 hover:text-zinc-900">
          <Download size={12} />
        </button>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} className="shrink-0 text-zinc-400 hover:text-red-500">
          <X size={12} />
        </button>
      )}
    </span>
  );
}

function FieldWithUpload({
  label,
  required,
  value,
  onChange,
  file,
  existingFile,
  onFileChange,
  onRemoveExisting,
  error,
  fieldClass,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  file: File | null;
  existingFile?: FreightForwardDocument;
  onFileChange: (file: File | null) => void;
  onRemoveExisting?: () => void;
  error?: string;
  fieldClass: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-zinc-600">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="shrink-0 rounded-xl border border-zinc-200 px-2.5 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
        >
          <Paperclip size={16} />
        </button>
        <input
          ref={inputRef}
          hidden
          type="file"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {file && <DocumentFileChip name={file.name} onRemove={() => onFileChange(null)} />}
        {existingFile && !file && (
          <DocumentFileChip
            name={existingFile.name}
            onDownload={() => window.open(existingFile.url, "_blank")}
            onRemove={onRemoveExisting}
          />
        )}
      </div>
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

function MultiDocumentFileUpload({
  files,
  existingFiles,
  onFilesAdd,
  onFileRemove,
  onExistingRemove,
}: {
  files: File[];
  existingFiles: FreightForwardDocument[];
  onFilesAdd: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  onExistingRemove: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] text-zinc-600 hover:bg-zinc-50"
      >
        <Paperclip size={14} />
        Upload files
      </button>
      <input
        ref={inputRef}
        hidden
        multiple
        type="file"
        onChange={(e) => {
          if (e.target.files?.length) onFilesAdd(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {existingFiles.map((doc, index) => (
          <DocumentFileChip
            key={`existing-${doc.url}-${index}`}
            name={doc.name}
            onDownload={() => window.open(doc.url, "_blank")}
            onRemove={() => onExistingRemove(index)}
          />
        ))}
        {files.map((file, index) => (
          <DocumentFileChip
            key={`new-${file.name}-${index}`}
            name={file.name}
            onRemove={() => onFileRemove(index)}
          />
        ))}
      </div>
    </div>
  );
}

function DocumentFileUpload({
  file,
  existingFile,
  onFileChange,
  onRemoveExisting,
}: {
  file: File | null;
  existingFile?: FreightForwardDocument;
  onFileChange: (file: File | null) => void;
  onRemoveExisting?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] text-zinc-600 hover:bg-zinc-50"
      >
        <Paperclip size={14} />
        Upload document
      </button>
      <input
        ref={inputRef}
        hidden
        type="file"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {file && <DocumentFileChip name={file.name} onRemove={() => onFileChange(null)} />}
        {existingFile && !file && (
          <DocumentFileChip
            name={existingFile.name}
            onDownload={() => window.open(existingFile.url, "_blank")}
            onRemove={onRemoveExisting}
          />
        )}
      </div>
    </div>
  );
}

function DocInfo({
  label,
  doc,
}: {
  label: string;
  doc?: FreightForwardDocument;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-2">
        {doc ? (
          <DocumentFileChip
            name={doc.name}
            onDownload={() => window.open(doc.url, "_blank")}
          />
        ) : (
          <span className="text-sm text-zinc-500">—</span>
        )}
      </div>
    </div>
  );
}
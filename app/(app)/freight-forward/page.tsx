"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, X,  Ship,
  Package,
  Route,
  CreditCard,
  ShieldCheck, } from "lucide-react";
import { DocumentSnapshot } from "firebase/firestore";
import ModuleHeader from "@/components/ModuleHeader";
import ActionMenu from "@/components/shared/ActionMenu";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { getCfsList } from "@/lib/cfs/cfs";
import { getConfigByCategory } from "@/lib/configurations/configurations";
import {
  createFreightForward,
  deleteFreightForward,
  getFreightForwardCardCounts,
  getFreightForwardPage,
  getFreightForwardSearch,
  updateFreightForward,
} from "@/lib/freightForward/freightForward";
import { getSezList } from "@/lib/sez/sez";
import { Cfs } from "@/types/cfs";
import { ConfigItem } from "@/types/configuration";
import {
  CONTAINER_NUMBER_REGEX,
  ExWorksItem,
  FREIGHT_FORWARD_STATUSES,
  FreightForward,
  FreightForwardFormData,
  FreightForwardStatus,
  FreightForwardStatusObject,
} from "@/types/freightForward";
import { Sez } from "@/types/sez";

type FormErrors = Partial<Record<string, string>>;
type CardFilter = "inProcess" | "next7Days" | "momentum" | "split_manifest" | "completed" | null;
type DrawerMode = "add" | "edit" | "view" | null;

const SEARCH_FIELDS = [
  { label: "EZ Ref Number", value: "ezRefNumber" },
  { label: "Consignment Name", value: "consignmentName" },
  { label: "MBL", value: "mbl" },
  { label: "HBL", value: "hbl" },
  { label: "Container Number", value: "containerNumber" },
  { label: "Vessel Name", value: "vesselName" },
];

const PAGE_SIZE = 10;

const emptyExWorks = (): ExWorksItem => ({ name: "", amount: 0 });

const emptyForm = (): FreightForwardFormData => ({
  jobNumber: "",
  ezRefNumber: "",
  consignmentName: "",
  mbl: "",
  hbl: "",
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
  oceanFreight: "",
  exWorks: [],
  buildAmount: undefined,
  paymentType: "",
  paymentDate: "",
  status: "created",
});

function formatDate(value?: string) {
  if (!value) return "—";
  return value;
}

function statusLabel(status: FreightForwardStatus) {
  return FREIGHT_FORWARD_STATUSES.find((s) => s.value === status)?.label ?? status;
}

function toFormData(item: FreightForward): FreightForwardFormData {
  return {
    jobNumber: item.jobNumber ?? "",
    ezRefNumber: item.ezRefNumber ?? "",
    consignmentName: item.consignmentName,
    mbl: item.mbl,
    hbl: item.hbl,
    containerNumber: item.containerNumber,
    containerSize: item.containerSize ?? "",
    containerType: item.containerType ?? "",
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
    oceanFreight: item.oceanFreight ?? "",
    exWorks: item.exWorks ?? [],
    buildAmount: item.buildAmount,
    paymentType: item.paymentType ?? "",
    paymentDate: item.paymentDate ?? "",
    status: item.status ?? "created",
  };
}

function removeUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

function buildPayload(form: FreightForwardFormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {
    jobNumber: form.jobNumber?.trim() || undefined,
    ezRefNumber: form.ezRefNumber?.trim() || undefined,
    consignmentName: form.consignmentName.trim(),
    mbl: form.mbl.trim(),
    hbl: form.hbl.trim(),
    containerNumber: form.containerNumber.trim().toUpperCase(),
    containerSize: form.containerSize || undefined,
    containerType: form.containerType || undefined,
    etd: form.etd || undefined,
    eta: form.eta || undefined,
    vesselName: form.vesselName?.trim() || undefined,
    pol: form.pol?.trim() || undefined,
    pod: form.pod?.trim() || undefined,
    liner: form.liner?.trim() || undefined,
    agent: form.agent?.trim() || undefined,
    oceanFreight: form.oceanFreight?.trim() || undefined,
    paymentType: form.paymentType || undefined,
    paymentDate: form.paymentDate || undefined,
    buildAmount:
      form.buildAmount !== undefined &&
        form.buildAmount !== null &&
        !Number.isNaN(form.buildAmount)
        ? Number(form.buildAmount)
        : undefined,
    exWorks: (form.exWorks ?? []).filter((i) => i.name.trim() || i.amount),
    locationType: form.locationType,
    cfs: form.locationType === "cfs" && form.cfs ? form.cfs : undefined,
    sez: form.locationType === "sez" && form.sez ? form.sez : undefined,
    status: form.status,
  };
  return removeUndefined(raw);
}

export default function FreightForwardPage() {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<FreightForward[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Keyset pagination: cursors[i] is the startAfter cursor to fetch page i.
  // cursors[0] = null means fetch from the beginning.
  const [cursors, setCursors] = useState<(DocumentSnapshot | null)[]>([null]);
  const [page, setPage] = useState(0); // 0-indexed

  // ── Card counts (getCountFromServer — zero document reads) ─────────────────
  const [cardCounts, setCardCounts] = useState({
    inProcess: 0,
    next7Days: 0,
    momentum: 0,
    split_manifest: 0,
    completed: 0,
  });

  // ── Filters ───────────────────────────────────────────────────────────────
  const [activeCard, setActiveCard] = useState<CardFilter>(null);
  const [searchField, setSearchField] = useState("consignmentName");
  const [searchValue, setSearchValue] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const isSearching = searchValue.trim().length > 0;

  // ── Lookups ───────────────────────────────────────────────────────────────
  const [cfsList, setCfsList] = useState<Cfs[]>([]);
  const [sezList, setSezList] = useState<Sez[]>([]);
  const [containerSizes, setContainerSizes] = useState<ConfigItem[]>([]);
  const [containerTypes, setContainerTypes] = useState<ConfigItem[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<ConfigItem[]>([]);

  // ── Drawer ────────────────────────────────────────────────────────────────
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [selected, setSelected] = useState<FreightForward | null>(null);

  // ── Form ──────────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FreightForwardFormData>(emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Delete ────────────────────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user, setUser] = useState<{ username?: string; role?: string } | null>(null);
  const isAdmin = user?.role === "admin";

  type UserRole = "admin" | "user" | "accountant";
  const userRole: UserRole = (user?.role as UserRole) ?? "admin";
  const allowedStatuses: Record<UserRole, FreightForwardStatus[]> = {
    admin: [FreightForwardStatusObject.CREATED, FreightForwardStatusObject.MOMENTUM, FreightForwardStatusObject.SPLIT_MANIFEST],
    user: [FreightForwardStatusObject.CREATED, FreightForwardStatusObject.MOMENTUM, FreightForwardStatusObject.SPLIT_MANIFEST],
    accountant: [
      FreightForwardStatusObject.CREATED,
      FreightForwardStatusObject.MOMENTUM,
      FreightForwardStatusObject.SPLIT_MANIFEST,
      FreightForwardStatusObject.BILLING,
      FreightForwardStatusObject.RECEIVABLE,
      FreightForwardStatusObject.PAYABLE,
      FreightForwardStatusObject.COMPLETED,
    ],
  };

  const availableStatuses = FREIGHT_FORWARD_STATUSES.filter((status) =>
    allowedStatuses[userRole].includes(status.value)
  );

  const totalExWorksAmount = (form.exWorks ?? []).reduce(
    (total, item) => total + (item.amount || 0),
    0
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

  // ── Derived ───────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Load card counts via getCountFromServer ────────────────────────────────
  const loadCounts = useCallback(async () => {
    const counts = await getFreightForwardCardCounts();
    setCardCounts(counts);
  }, []);

  // ── Load one page of rows ─────────────────────────────────────────────────
  const loadPage = useCallback(
    async (pageIndex: number, cursorDoc: DocumentSnapshot | null) => {
      setLoading(true);
      try {
        if (isSearching) {
          // Text search: Firestore has no native full-text search.
          // Fetch the filtered subset and slice client-side.
          const all = await getFreightForwardSearch({
            activeCard,
            etaFrom: dateFrom || undefined,
            etaTo: dateTo || undefined,
            searchField,
            searchValue,
          });
          setRows(all.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE));
          setTotal(all.length);
        } else {
          // Normal path: server-side query + getCountFromServer for total
          const result = await getFreightForwardPage({
            activeCard,
            etaFrom: dateFrom || undefined,
            etaTo: dateTo || undefined,
            pageSize: PAGE_SIZE,
            cursor: cursorDoc,
          });
          setRows(result.items);
          setTotal(result.total);

          // Store the cursor for the NEXT page
          setCursors((prev) => {
            const next = [...prev];
            next[pageIndex + 1] = result.lastDoc;
            return next;
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [activeCard, dateFrom, dateTo, isSearching, searchField, searchValue]
  );

  // Re-fetch from scratch whenever filters change
  useEffect(() => {
    setCursors([null]);
    setPage(0);
    loadCounts();
    loadPage(0, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCard, dateFrom, dateTo, searchValue, searchField]);

  // Reload counts + current page after a mutation
  const reload = async () => {
    await Promise.all([loadCounts(), loadPage(page, cursors[page] ?? null)]);
  };

  useEffect(() => {
    const stored = sessionStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
    loadLookups();
  }, []);

  const loadLookups = async () => {
    const [cfs, sez, sizes, types, payments] = await Promise.all([
      getCfsList(),
      getSezList(),
      getConfigByCategory("container_size"),
      getConfigByCategory("container_type"),
      getConfigByCategory("payment_type"),
    ]);
    setCfsList(cfs);
    setSezList(sez);
    setContainerSizes(sizes);
    setContainerTypes(types);
    setPaymentTypes(payments);
  };

  // ── Pagination ────────────────────────────────────────────────────────────
  const goNext = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadPage(nextPage, cursors[nextPage] ?? null);
  };

  const goPrev = () => {
    const prevPage = page - 1;
    setPage(prevPage);
    loadPage(prevPage, cursors[prevPage] ?? null);
  };

  // ── Drawer helpers ────────────────────────────────────────────────────────
  const closeDrawer = () => {
    setDrawerMode(null);
    setSelected(null);
    setForm(emptyForm());
    setErrors({});
    setSubmitError("");
  };

  const openAdd = () => {
    setSelected(null);
    setForm(emptyForm());
    setErrors({});
    setSubmitError("");
    setDrawerMode("add");
  };

  const openEdit = (item: FreightForward) => {
    setSelected(item);
    setForm(toFormData(item));
    setErrors({});
    setSubmitError("");
    setDrawerMode("edit");
  };

  const openView = (item: FreightForward) => {
    setSelected(item);
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
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.consignmentName.trim()) next.consignmentName = "Consignment Name is required.";
    if (!form.mbl.trim()) next.mbl = "MBL is required.";
    if (!form.hbl.trim()) next.hbl = "HBL is required.";
    if (!form.containerNumber.trim()) {
      next.containerNumber = "Container Number is required.";
    } else if (!CONTAINER_NUMBER_REGEX.test(form.containerNumber.trim().toUpperCase())) {
      next.containerNumber = "Format must be 4 uppercase letters followed by 7 digits (e.g. ABCD1234567).";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    setSubmitError("");
    if (!validate()) return;
    const username = user?.username ?? "unknown";
    const payload = buildPayload(form);
    setSaving(true);
    try {
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

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteFreightForward(deleteId);
    setDeleteId(null);
    await reload();
  };

  const setLocationType = (type: "cfs" | "sez") => {
    setForm({ ...form, locationType: type, cfs: undefined, sez: undefined });
  };

  const addExWorks = () => setForm({ ...form, exWorks: [...(form.exWorks ?? []), emptyExWorks()] });

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

  const handleCardClick = (card: CardFilter) => {
    setActiveCard((prev) => (prev === card ? null : card));
  };

  // ── Summary cards ─────────────────────────────────────────────────────────
  const summaryCards = [
    { key: "inProcess" as CardFilter, label: "In Process", count: cardCounts.inProcess, color: "bg-blue-50 border-blue-200 text-blue-700" },
    { key: "next7Days" as CardFilter, label: "Next 7 Days", count: cardCounts.next7Days, color: "bg-amber-50 border-amber-200 text-amber-700" },
    { key: "momentum" as CardFilter, label: "Momentum", count: cardCounts.momentum, color: "bg-purple-50 border-purple-200 text-purple-700" },
    { key: "split_manifest" as CardFilter, label: "Split Manifest", count: cardCounts.split_manifest, color: "bg-orange-50 border-orange-200 text-orange-700" },
    { key: "completed" as CardFilter, label: "Completed", count: cardCounts.completed, color: "bg-green-50 border-green-200 text-green-700" },
  ];

  const listColumns = ["EZ Ref Number", "ETA", "Consignment Name", "MBL", "HBL", "Container Number", "Vessel Name", "Actions"];

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
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {submitError}
        </div>
      )}

      <div className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">Job Number</label>
            <input value={form.jobNumber ?? ""} onChange={(e) => { setForm({ ...form, jobNumber: e.target.value }); clearError("jobNumber"); }} className={fieldClass("jobNumber")} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">EZ Ref Number</label>
            <input value={form.ezRefNumber ?? ""} onChange={(e) => { setForm({ ...form, ezRefNumber: e.target.value }); clearError("ezRefNumber"); }} className={fieldClass("ezRefNumber")} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-600">Consignment Name <span className="text-red-500">*</span></label>
          <input value={form.consignmentName} onChange={(e) => { setForm({ ...form, consignmentName: e.target.value }); clearError("consignmentName"); }} className={fieldClass("consignmentName")} />
          {errors.consignmentName && <p className="mt-1 text-[11px] text-red-500">{errors.consignmentName}</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">MBL <span className="text-red-500">*</span></label>
            <input value={form.mbl} onChange={(e) => { setForm({ ...form, mbl: e.target.value }); clearError("mbl"); }} className={fieldClass("mbl")} />
            {errors.mbl && <p className="mt-1 text-[11px] text-red-500">{errors.mbl}</p>}
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">HBL <span className="text-red-500">*</span></label>
            <input value={form.hbl} onChange={(e) => { setForm({ ...form, hbl: e.target.value }); clearError("hbl"); }} className={fieldClass("hbl")} />
            {errors.hbl && <p className="mt-1 text-[11px] text-red-500">{errors.hbl}</p>}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-600">Container Number <span className="text-red-500">*</span></label>
          <input value={form.containerNumber} onChange={(e) => { setForm({ ...form, containerNumber: e.target.value.toUpperCase() }); clearError("containerNumber"); }} placeholder="ABCD1234567" maxLength={11} className={fieldClass("containerNumber")} />
          {errors.containerNumber && <p className="mt-1 text-[11px] text-red-500">{errors.containerNumber}</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">Container Size</label>
            <select value={form.containerSize ?? ""} onChange={(e) => setForm({ ...form, containerSize: e.target.value })} className={fieldClass("containerSize")}>
              <option value="">Select size</option>
              {containerSizes.map((item) => <option key={item.id} value={item.value}>{item.value}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">Container Type</label>
            <select value={form.containerType ?? ""} onChange={(e) => setForm({ ...form, containerType: e.target.value })} className={fieldClass("containerType")}>
              <option value="">Select type</option>
              {containerTypes.map((item) => <option key={item.id} value={item.value}>{item.value}</option>)}
            </select>
          </div>
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

        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-600">Vessel Name</label>
          <input value={form.vesselName ?? ""} onChange={(e) => setForm({ ...form, vesselName: e.target.value })} className={fieldClass("vesselName")} />
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

        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-600">Ocean Freight</label>
          <input value={form.oceanFreight ?? ""} onChange={(e) => setForm({ ...form, oceanFreight: e.target.value })} className={fieldClass("oceanFreight")} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[11px] font-medium text-zinc-600">Ex-Works</label>
            <button type="button" onClick={addExWorks} className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50">
              <Plus size={12} /> Add row
            </button>
          </div>
          {(form.exWorks ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-4 text-center text-[11px] text-zinc-400">
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
                    className={`w-28 ${fieldClass(`exWorks-amount-${index}`)}`}
                  />

                  <button
                    type="button"
                    onClick={() => removeExWorks(index)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-[11px] font-medium text-zinc-600">
            Total Ex-Works Amount
          </label>

          <input
            type="number"
            value={totalExWorksAmount}
            readOnly
            className={`${fieldClass("totalExWorks")} bg-zinc-100 cursor-not-allowed`}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">billed amount</label>
            <input type="number" value={form.buildAmount ?? ""} onChange={(e) => setForm({ ...form, buildAmount: e.target.value === "" ? undefined : Number(e.target.value) })} className={fieldClass("buildAmount")} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600">Payment Type</label>
            <select value={form.paymentType ?? ""} onChange={(e) => setForm({ ...form, paymentType: e.target.value })} className={fieldClass("paymentType")}>
              <option value="">Select payment type</option>
              {paymentTypes.map((item) => <option key={item.id} value={item.value}>{item.value}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-600">Payment Date</label>
          <input type="date" value={form.paymentDate ?? ""} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} className={fieldClass("paymentDate")} />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-600">Status</label>
          <select
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value as FreightForwardStatus,
              })
            }
            className={fieldClass("status")}
          >
            {availableStatuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
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
          <Info label="MBL" value={selected.mbl} />
          <Info label="HBL" value={selected.hbl} />
        </div>
      </section>

      {/* Container */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <SectionHeader
          icon={Package}
          title="Container"
          color="bg-emerald-600"
        />

        <div className="grid grid-cols-2 gap-4">
          <Info
            label="Container No."
            value={selected.containerNumber}
          />
          <Info
            label="Size"
            value={selected.containerSize}
          />
          <Info
            label="Type"
            value={selected.containerType}
          />
          <Info
            label="Vessel"
            value={selected.vesselName}
          />
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
            value={
              selected.cfs
                ? selected.cfs
                : selected.sez
                ? selected.sez
                : "—"
            }
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
            label="Ocean Freight"
            value={selected.oceanFreight}
          />
          <Info
            label="Billed Amount"
            value={selected.buildAmount}
          />
          <Info
            label="Payment Type"
            value={selected.paymentType}
          />
          <Info
            label="Payment Date"
            value={formatDate(selected.paymentDate)}
          />

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
                  {item.name} • {item.amount}
                </span> 
              ))
              )}
            </div>
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

          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              Status
            </div>

            <span className="mt-2 inline-flex rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white">
              {statusLabel(selected.status)}
            </span>
          </div>
        </div>
      </section>
    </div>
  )}

  {/* Footer */}
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
          ${
            isSelected
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
            <select
              value={searchField}
              onChange={(e) => { setSearchField(e.target.value); setSearchValue(""); }}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            >
              {SEARCH_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <input
              type="text"
              placeholder={`Search by ${SEARCH_FIELDS.find((f) => f.value === searchField)?.label ?? ""}...`}
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
          <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800">
            <Plus size={14} /> Add
          </button>
        </div>

        {activeCard && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-zinc-500">
              Showing: <span className="font-medium text-zinc-800">{summaryCards.find((c) => c.key === activeCard)?.label}</span>
            </span>
            <button onClick={() => setActiveCard(null)} className="text-[11px] text-zinc-400 underline hover:text-zinc-700">Clear</button>
          </div>
        )}

        {/* Table */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-slate-50">
                  {listColumns.map((h) => (
                    <th key={h} className={`whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 ${h === "Actions" ? "text-center" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="py-10 text-center text-zinc-500">Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="py-10 text-center text-zinc-400">No freight forward records found.</td></tr>
                ) : (
                  rows.map((item) => (
                    <tr key={item.id} onClick={() => openView(item)} className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 text-zinc-600">{item.ezRefNumber || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{formatDate(item.eta)}</td>
                      <td className="px-4 py-3 font-medium text-zinc-800">{item.consignmentName}</td>
                      <td className="px-4 py-3 text-zinc-600">{item.mbl}</td>
                      <td className="px-4 py-3 text-zinc-600">{item.hbl}</td>
                      <td className="px-4 py-3 text-zinc-600">{item.containerNumber}</td>
                      <td className="px-4 py-3 text-zinc-600">{item.vesselName || "—"}</td>
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

      {/* Backdrop */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={closeDrawer} />
      )}

      {/* RIGHT-SIDE Drawer — Add / Edit / View */}
      <div
        className={`fixed right-0 top-0 z-50 h-full overflow-y-auto border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "translate-x-full"
          } ${drawerMode === "view" ? "w-full max-w-lg" : "w-full max-w-2xl"}`}
      >
        {(drawerMode === "add" || drawerMode === "edit") && renderForm()}
        {drawerMode === "view" && renderViewDrawer()}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Freight Forward"
        message="Are you sure you want to delete this freight forward record?"
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}
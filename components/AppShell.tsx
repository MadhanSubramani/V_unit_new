"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowUpFromLine,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  FileText,
  LogOut,
  Menu,
  ScanLine,
  Settings,
  ShieldCheck,
  Ship,
  StickyNote,
  Trash2,
  Users,
  User,
  Warehouse,
  X,
} from "lucide-react";
import {
  canViewImportSection,
  hasAppModuleAccess,
  isImportAdmin,
  parseImportSessionUser,
} from "@/lib/import/permissions";
import type { ImportModuleKey } from "@/types/importRoles";

const OPERATIONS_SUB = [
  { href: "/operations/cfs", label: "CFS Master", icon: Warehouse, module: "operations_cfs" as const },
  { href: "/operations/sez", label: "SEZ Master", icon: Warehouse, module: "operations_sez" as const },
  { href: "/operations/configurations", label: "Configurations", icon: Settings, module: "operations_config" as const },
] as const;

const FREIGHT_FORWARD_SUB = [
  { href: "/freight-forward/eta-updater", label: "ETA Updater", icon: CalendarClock, adminOnly: false, module: "freight_eta" as const },
  { href: "/freight-forward", label: "Job List", icon: Ship, adminOnly: false, module: "freight_forward" as const },
  { href: "/freight-forward/trash", label: "Trash", icon: Trash2, adminOnly: true, module: "freight_forward" as const },
] as const;

const IMPORT_SUB: {
  href: string;
  label: string;
  icon: typeof Ship;
  enabled: boolean;
  module?: ImportModuleKey | "trash";
}[] = [
  { href: "/import/eta-updater", label: "ETA Updater", icon: CalendarClock, enabled: true, module: "eta" },
  { href: "/import/worklist", label: "Job List", icon: ClipboardList, enabled: true, module: "worklist" },
  { href: "/import/liner", label: "Liner", icon: Ship, enabled: true, module: "liner" },
  { href: "/import/boe-in", label: "Z type BE", icon: FileText, enabled: true, module: "ztype" },
  { href: "/import/transport", label: "Transport", icon: ScanLine, enabled: true, module: "transport" },
  { href: "/import/boe-out", label: "T type BE", icon: ClipboardList, enabled: true, module: "ttype" },
  { href: "/import/accounts", label: "Accounts", icon: Settings, enabled: true, module: "accounts" },
  { href: "/import/trash", label: "Trash", icon: Trash2, enabled: true, module: "trash" },
];

const NAV_ITEMS = [
  { href: "/export", label: "Export", icon: ArrowUpFromLine },
  { href: "/kyc", label: "KYC", icon: ShieldCheck },
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof parseImportSessionUser>>(null);
  const [operationsOpen, setOperationsOpen] = useState(
    pathname.startsWith("/operations")
  );
  const [freightOpen, setFreightOpen] = useState(
    pathname.startsWith("/freight-forward")
  );
  const [importOpen, setImportOpen] = useState(pathname.startsWith("/import"));

  useEffect(() => {
    const stored = sessionStorage.getItem("user");
    if (!stored) {
      router.replace("/login");
      return;
    }
    try {
      setUser(JSON.parse(stored));
      setReady(true);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
    if (pathname.startsWith("/operations")) {
      setOperationsOpen(true);
    }
    if (pathname.startsWith("/freight-forward")) {
      setFreightOpen(true);
    }
    if (pathname.startsWith("/import")) {
      setImportOpen(true);
    }
  }, [pathname]);

  const handleLogout = () => {
    sessionStorage.removeItem("user");
    router.push("/login");
  };

  if (!ready) return null;

  const isAdmin = user?.role === "admin";
  const isOperationsActive = pathname.startsWith("/operations");
  const isFreightActive = pathname.startsWith("/freight-forward");
  const isImportActive = pathname.startsWith("/import");
  const freightSubItems = FREIGHT_FORWARD_SUB.filter(
    (item) =>
      (!item.adminOnly || isAdmin) &&
      hasAppModuleAccess(user, item.module)
  );
  const operationsSubItems = OPERATIONS_SUB.filter((item) =>
    hasAppModuleAccess(user, item.module)
  );
  const showKyc = hasAppModuleAccess(user, "kyc");
  const showExport = hasAppModuleAccess(user, "export");
  const showNotepad = hasAppModuleAccess(user, "notepad");
  const showImport = canViewImportSection(user);

  const flatNavClass = (active: boolean) =>
    `flex items-center transition-all duration-200 ${
      collapsed ? "justify-center rounded-xl p-2.5" : "gap-2.5 rounded-xl px-3 py-2.5"
    } ${
      active
        ? "bg-zinc-900 text-white shadow-sm"
        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
    }`;

  const groupParentClass = (active: boolean) =>
    `flex w-full items-center transition-all duration-200 ${
      collapsed ? "justify-center rounded-xl p-2.5" : "gap-2.5 rounded-xl px-3 py-2.5"
    } ${
      active
        ? "bg-zinc-100 font-medium text-zinc-900"
        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
    }`;

  const subNavClass = (active: boolean) =>
    `flex items-center gap-2 rounded-lg py-2 pr-3 pl-2.5 text-xs transition-all duration-200 ${
      active
        ? "bg-zinc-900 font-semibold text-white shadow-sm"
        : "font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
    }`;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-zinc-200/80 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/v-unit-logo.svg"
              alt="V Unit Logistics"
              className={`shrink-0 ${collapsed ? "h-8 w-8" : "h-9 w-9"}`}
            />
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  V-Unit
                </p>
                <h1 className="mt-0.5 truncate text-sm font-semibold tracking-tight text-zinc-900">
                  Operations
                </h1>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            <Menu size={16} />
          </button>
        </div>

        <div
          className={`mt-4 flex items-center border border-zinc-200/80 bg-zinc-50 transition-all ${
            collapsed ? "justify-center rounded-xl p-2" : "gap-3 rounded-2xl p-3"
          }`}
        >
          <div
            className={`flex shrink-0 items-center justify-center bg-zinc-900 text-white ${
              collapsed ? "h-7 w-7 rounded-lg" : "h-9 w-9 rounded-xl"
            }`}
          >
            <User size={collapsed ? 14 : 18} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-zinc-900">{user?.username}</p>
              <p className="text-[11px] capitalize text-zinc-500">{user?.role || "User"}</p>
            </div>
          )}
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-3">
        {operationsSubItems.length > 0 && (
        <div>
          <button
            onClick={() => {
              if (collapsed) {
                router.push("/operations/cfs");
                return;
              }
              setOperationsOpen((v) => !v);
            }}
            className={groupParentClass(isOperationsActive)}
          >
            <ClipboardList size={collapsed ? 16 : 15} strokeWidth={isOperationsActive ? 2.25 : 2} />
            {!collapsed && (
              <>
                <span className="flex-1 text-left text-xs font-medium">Operations</span>
                <ChevronDown
                  size={14}
                  className={`shrink-0 opacity-60 transition-transform duration-200 ${
                    operationsOpen ? "rotate-180" : ""
                  }`}
                />
              </>
            )}
          </button>

          {!collapsed && operationsOpen && (
            <div className="my-2 ml-5 space-y-1 border-l border-zinc-200 py-1.5 pl-2">
              {operationsSubItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link key={href} href={href} className={subNavClass(active)}>
                    <Icon size={14} strokeWidth={active ? 2.5 : 2} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        )}

        {freightSubItems.length > 0 && (
        <div>
          <button
            onClick={() => {
              if (collapsed) {
                router.push("/freight-forward/eta-updater");
                return;
              }
              setFreightOpen((v) => !v);
            }}
            className={groupParentClass(isFreightActive)}
          >
            <Ship size={collapsed ? 16 : 15} strokeWidth={isFreightActive ? 2.25 : 2} />
            {!collapsed && (
              <>
                <span className="flex-1 text-left text-xs font-medium">Freight Forward</span>
                <ChevronDown
                  size={14}
                  className={`shrink-0 opacity-60 transition-transform duration-200 ${
                    freightOpen ? "rotate-180" : ""
                  }`}
                />
              </>
            )}
          </button>

          {!collapsed && freightOpen && (
            <div className="my-2 ml-5 space-y-1 border-l border-zinc-200 py-1.5 pl-2">
              {freightSubItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link key={href} href={href} className={subNavClass(active)}>
                    <Icon size={14} strokeWidth={active ? 2.5 : 2} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        )}

        {showImport && (
        <div>
          <button
            onClick={() => {
              if (collapsed) {
                router.push("/import/eta-updater");
                return;
              }
              setImportOpen((value) => !value);
            }}
            className={groupParentClass(isImportActive)}
          >
            <FileText
              size={collapsed ? 16 : 15}
              strokeWidth={isImportActive ? 2.25 : 2}
            />
            {!collapsed && (
              <>
                <span className="flex-1 text-left text-xs font-medium">Import</span>
                <ChevronDown
                  size={14}
                  className={`shrink-0 opacity-60 transition-transform duration-200 ${
                    importOpen ? "rotate-180" : ""
                  }`}
                />
              </>
            )}
          </button>

          {!collapsed && importOpen && (
            <div className="my-2 ml-5 space-y-1 border-l border-zinc-200 py-1.5 pl-2">
              {IMPORT_SUB.filter((item) => {
                if (item.module === "trash") return isImportAdmin(user);
                return true;
              }).map(({ href, label, icon: Icon, enabled }) => {
                const active = pathname === href;
                return enabled ? (
                  <Link key={href} href={href} className={subNavClass(active)}>
                    <Icon size={14} strokeWidth={active ? 2.5 : 2} />
                    <span>{label}</span>
                  </Link>
                ) : (
                  <div
                    key={href}
                    title="Coming soon"
                    className="flex cursor-not-allowed items-center gap-2 rounded-lg py-2 pr-3 pl-2.5 text-xs font-medium text-zinc-300"
                  >
                    <Icon size={14} />
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {NAV_ITEMS.filter((item) =>
          item.href === "/kyc" ? showKyc : item.href === "/export" ? showExport : true
        ).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={href} className={flatNavClass(active)}>
              <Icon size={collapsed ? 16 : 15} strokeWidth={active ? 2.25 : 2} />
              {!collapsed && <span className="text-xs font-medium">{label}</span>}
            </Link>
          );
        })}

        {user?.role === "admin" && (
          <Link
            href="/users"
            className={flatNavClass(pathname === "/users" || pathname.startsWith("/users/"))}
          >
            <Users size={collapsed ? 16 : 15} />
            {!collapsed && <span className="text-xs font-medium">Users</span>}
          </Link>
        )}

        {showNotepad && (
        <Link
          href="/notepad"
          className={flatNavClass(pathname === "/notepad" || pathname.startsWith("/notepad/"))}
        >
          <StickyNote size={collapsed ? 16 : 15} />
          {!collapsed && <span className="text-xs font-medium">Notepad</span>}
        </Link>
        )}
      </nav>

      <div className="shrink-0 border-t border-zinc-200/80 p-3">
        <button
          onClick={handleLogout}
          className={`flex w-full items-center text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 ${
            collapsed ? "justify-center rounded-xl p-2.5" : "gap-2.5 rounded-xl px-3 py-2.5"
          }`}
        >
          <LogOut size={15} />
          {!collapsed && "Logout"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <aside
        className={`hidden h-screen shrink-0 flex-col overflow-hidden border-r border-zinc-200/80 bg-white transition-all duration-300 md:flex ${
          collapsed ? "w-[72px]" : "w-[240px]"
        }`}
      >
        {sidebar}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[260px] flex-col overflow-hidden border-r border-zinc-200/80 bg-white shadow-2xl transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200/80 bg-white px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-lg border border-zinc-200 p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
          <span className="text-xs font-semibold text-zinc-900">V-Unit Operations</span>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

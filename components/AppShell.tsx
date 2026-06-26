"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ClipboardList,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Ship,
  Users,
  User,
  Warehouse,
  X,
} from "lucide-react";

const OPERATIONS_SUB = [
  { href: "/operations/cfs", label: "CFS Master", icon: Warehouse },
  { href: "/operations/sez", label: "SEZ Master", icon: Warehouse },
  { href: "/operations/configurations", label: "Configurations", icon: Settings },
] as const;

const NAV_ITEMS = [
  { href: "/freight-forward", label: "Freight Forward", icon: Ship },
  { href: "/import", label: "Import", icon: ArrowDownToLine },
  { href: "/export", label: "Export", icon: ArrowUpFromLine },
  { href: "/kyc", label: "KYC", icon: ShieldCheck },
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<{ username?: string; role?: string } | null>(null);
  const [operationsOpen, setOperationsOpen] = useState(
    pathname.startsWith("/operations")
  );

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
  }, [pathname]);

  const handleLogout = () => {
    sessionStorage.removeItem("user");
    router.push("/login");
  };

  if (!ready) return null;

  const isOperationsActive = pathname.startsWith("/operations");

  const flatNavClass = (active: boolean) =>
    `flex items-center transition-all duration-200 ${
      collapsed ? "justify-center rounded-xl p-2.5" : "gap-2.5 rounded-xl px-3 py-2.5"
    } ${
      active
        ? "bg-zinc-900 text-white shadow-sm"
        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
    }`;

  const operationsParentClass = () =>
    `flex w-full items-center transition-all duration-200 ${
      collapsed ? "justify-center rounded-xl p-2.5" : "gap-2.5 rounded-xl px-3 py-2.5"
    } ${
      isOperationsActive
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
      <div className="border-b border-zinc-200/80 p-4">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                V-Unit
              </p>
              <h1 className="mt-0.5 text-sm font-semibold tracking-tight text-zinc-900">
                Operations
              </h1>
            </div>
          )}
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

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        <div>
          <button
            onClick={() => {
              if (collapsed) {
                router.push("/operations/cfs");
                return;
              }
              setOperationsOpen((v) => !v);
            }}
            className={operationsParentClass()}
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
              {OPERATIONS_SUB.map(({ href, label, icon: Icon }) => {
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

        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
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
      </nav>

      <div className="border-t border-zinc-200/80 p-3">
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
    <div className="flex min-h-screen bg-zinc-50">
      <aside
        className={`hidden shrink-0 border-r border-zinc-200/80 bg-white transition-all duration-300 md:block ${
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
        className={`fixed inset-y-0 left-0 z-50 w-[260px] border-r border-zinc-200/80 bg-white shadow-2xl transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-zinc-200/80 bg-white px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-lg border border-zinc-200 p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
          <span className="text-xs font-semibold text-zinc-900">V-Unit Operations</span>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

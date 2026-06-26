"use client";

import { useEffect, useState } from "react";
import { createUser, getUsers, deleteUserData, updateUserData, User } from "@/lib/auth";
import { Eye, EyeOff, Pencil, Trash2 ,MoreHorizontal} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import ModuleHeader from "@/components/ModuleHeader";

type FormErrors = {
    username?: string;
    email?: string;
    password?: string;
};

export default function UsersPage() {
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [viewOpen, setViewOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitError, setSubmitError] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const rowsPerPage = 5;

    const [form, setForm] = useState<User>({
        username: "",
        email: "",
        password: "",
        role: "user",
    });

    const loadUsers = async () => {
        const data = await getUsers();
        setUsers(data);
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const validate = (): boolean => {
        const newErrors: FormErrors = {};

        if (!form.username.trim()) {
            newErrors.username = "Username is required.";
        }

        if (!form.email.trim()) {
            newErrors.email = "Email is required.";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            newErrors.email = "Enter a valid email address.";
        } else {
            const duplicate = users.some(
                (u) =>
                    u.email?.toLowerCase() === form.email.toLowerCase() &&
                    u.id !== selectedUser?.id
            );
            if (duplicate) {
                newErrors.email = "This email is already in use.";
            }
        }

        if (!form.password.trim()) {
            newErrors.password = "Password is required.";
        } else if (form.password.length < 6) {
            newErrors.password = "Password must be at least 6 characters.";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        setSubmitError("");
        if (!validate()) return;

        try {
            if (selectedUser) {
                await updateUserData(selectedUser.id, form);
            } else {
                await createUser(form);
            }

            setForm({ username: "", email: "", password: "", role: "user" });
            setErrors({});
            setDrawerOpen(false);
            setSelectedUser(null);
            loadUsers();
        } catch (err: any) {
            setSubmitError(err?.message || "Something went wrong. Please try again.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete user?")) return;
        await deleteUserData(id);
        loadUsers();
    };

    const openAddDrawer = () => {
        setSelectedUser(null);
        setForm({ username: "", email: "", password: "", role: "user" });
        setErrors({});
        setSubmitError("");
        setDrawerOpen(true);
    };

    const openEditDrawer = (user: any) => {
        setSelectedUser(user);
        setForm({
            username: user.username,
            email: user.email,
            password: user.password,
            role: user.role,
        });
        setErrors({});
        setSubmitError("");
        setDrawerOpen(true);
    };

    const filteredUsers = users.filter((user) => {
        const matchesSearch =
            user.username?.toLowerCase().includes(search.toLowerCase()) ||
            user.email?.toLowerCase().includes(search.toLowerCase());

        const matchesRole =
            roleFilter === "all" || user.role === roleFilter;

        return matchesSearch && matchesRole;
    });

    const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);
    const currentUsers = filteredUsers.slice(
        (page - 1) * rowsPerPage,
        page * rowsPerPage
    );

    const FieldError = ({ msg }: { msg?: string }) =>
        msg ? <p className="mt-1 text-[11px] text-red-500">{msg}</p> : null;

    const inputClass = (hasError: boolean) =>
        `w-full rounded-xl border px-3 py-2 text-xs outline-none transition focus:ring-2 ${
            hasError
                ? "border-red-400 focus:ring-red-100"
                : "border-zinc-200 focus:border-zinc-400 focus:ring-zinc-100"
        }`;

    return (
        <>
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm md:p-5">
                <ModuleHeader
                    title="Users"
                    description="Manage accounts, roles, and access."
                    action={
                        <button
                            onClick={openAddDrawer}
                            className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                        >
                            + Add User
                        </button>
                    }
                />

                <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                    <input
                        type="text"
                        placeholder="Search user..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
                    />

                    <select
                        value={roleFilter}
                        onChange={(e) => {
                            setRoleFilter(e.target.value);
                            setPage(1);
                        }}
                        className="rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
                    >
                        <option value="all">All Roles</option>
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                        <option value="accountant">Accountant</option>
                    </select>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-200">
                  <div className="rounded-2xl border border-zinc-200 bg-white">
  <div className="overflow-visible">
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          <th className="px-4 py-3">Username</th>
          <th className="px-4 py-3">Email</th>
          <th className="px-4 py-3">Role</th>
          <th className="px-4 py-3 text-center">Actions</th>
        </tr>
      </thead>

      <tbody>
        {currentUsers.length === 0 ? (
          <tr>
            <td
              colSpan={4}
              className="px-4 py-12 text-center text-sm text-zinc-400"
            >
              No users found
            </td>
          </tr>
        ) : (
          currentUsers.map((user) => (
            <tr
              key={user.id}
              className="border-b border-zinc-100 transition-colors hover:bg-zinc-50"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-700">
                    {user.username?.charAt(0)?.toUpperCase()}
                  </div>

                  <span className="font-medium text-zinc-800">
                    {user.username}
                  </span>
                </div>
              </td>

              <td className="px-4 py-3 text-zinc-600">
                {user.email}
              </td>

              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium capitalize ${
                    user.role === "admin"
                      ? "bg-emerald-100 text-emerald-700"
                      : user.role === "accountant"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  {user.role}
                </span>
              </td>

              {/* <td className="px-4 py-3">
                <div className="flex justify-center gap-1">
                  <button
                    onClick={() => {
                      setSelectedUser(user);
                      setViewOpen(true);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-all hover:bg-zinc-100 hover:text-zinc-900"
                    title="View User"
                  >
                    <Eye size={16} />
                  </button>

                  <button
                    onClick={() => openEditDrawer(user)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-all hover:bg-zinc-100 hover:text-zinc-900"
                    title="Edit User"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    onClick={() => handleDelete(user.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition-all hover:bg-red-50 hover:text-red-700"
                    title="Delete User"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td> */}
              <td className="px-4 py-3 text-center">
  <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild>
      <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100">
        <MoreHorizontal size={18} />
      </button>
    </DropdownMenu.Trigger>

    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align="end"
        sideOffset={5}
        className="w-40 rounded-xl border border-zinc-200 bg-white p-1 shadow-xl"
      >
        <DropdownMenu.Item
          onSelect={() => {
            setSelectedUser(user);
            setViewOpen(true);
          }}
          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-xs"
        >
          <Eye size={14} />
          View
        </DropdownMenu.Item>

        <DropdownMenu.Item
          onSelect={() => openEditDrawer(user)}
          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-xs"
        >
          <Pencil size={14} />
          Edit
        </DropdownMenu.Item>

        <DropdownMenu.Item
          onSelect={() => handleDelete(user.id)}
          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-xs text-red-600"
        >
          <Trash2 size={14} />
          Delete
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
</td>
              
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
</div>
                </div>

                <div className="mt-4 flex justify-end gap-1.5">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs disabled:opacity-40"
                    >
                        Prev
                    </button>
                    {[...Array(totalPages)].map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setPage(i + 1)}
                            className={`rounded-lg px-3 py-1.5 text-xs ${
                                page === i + 1
                                    ? "bg-zinc-900 text-white"
                                    : "border border-zinc-200"
                            }`}
                        >
                            {i + 1}
                        </button>
                    ))}
                    <button
                        disabled={page === totalPages || totalPages === 0}
                        onClick={() => setPage(page + 1)}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            </div>

            {drawerOpen && (
                <div
                    className="fixed inset-0 z-40 bg-zinc-900/20 backdrop-blur-[2px]"
                    onClick={() => {
                        setDrawerOpen(false);
                        setSelectedUser(null);
                        setErrors({});
                    }}
                />
            )}

            <div
                className={`fixed top-0 right-0 z-50 h-full w-full max-w-[400px] border-l border-zinc-200/80 bg-white shadow-2xl transition-transform duration-300 ${
                    drawerOpen ? "translate-x-0" : "translate-x-full"
                }`}
            >
                <div className="flex h-full flex-col overflow-y-auto p-5">
                    <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-zinc-900">
                            {selectedUser ? "Edit User" : "Add User"}
                        </h2>
                        <button
                            onClick={() => {
                                setDrawerOpen(false);
                                setSelectedUser(null);
                                setErrors({});
                            }}
                            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                        >
                            ✕
                        </button>
                    </div>

                    {submitError && (
                        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                            {submitError}
                        </div>
                    )}

                    <div className="space-y-3.5">
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                                Username <span className="text-red-500">*</span>
                            </label>
                            <input
                                placeholder="Enter username"
                                value={form.username}
                                onChange={(e) => {
                                    setForm({ ...form, username: e.target.value });
                                    if (errors.username) setErrors({ ...errors, username: undefined });
                                }}
                                className={inputClass(!!errors.username)}
                            />
                            <FieldError msg={errors.username} />
                        </div>

                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                                Email <span className="text-red-500">*</span>
                            </label>
                            <input
                                placeholder="Enter email"
                                value={form.email}
                                onChange={(e) => {
                                    setForm({ ...form, email: e.target.value });
                                    if (errors.email) setErrors({ ...errors, email: undefined });
                                }}
                                className={inputClass(!!errors.email)}
                            />
                            <FieldError msg={errors.email} />
                        </div>

                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                                Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Min. 6 characters"
                                    value={form.password}
                                    onChange={(e) => {
                                        setForm({ ...form, password: e.target.value });
                                        if (errors.password) setErrors({ ...errors, password: undefined });
                                    }}
                                    className={`${inputClass(!!errors.password)} pr-10`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            <FieldError msg={errors.password} />
                        </div>

                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                                Role
                            </label>
                            <select
                                value={form.role}
                                onChange={(e) => setForm({ ...form, role: e.target.value as User["role"] })}
                                className={inputClass(false)}
                            >
                                <option value="admin">Admin</option>
                                <option value="user">User</option>
                                <option value="accountant">Accountant</option>
                            </select>
                        </div>

                        <button
                            onClick={handleSave}
                            className="w-full rounded-xl bg-zinc-900 py-2.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                        >
                            {selectedUser ? "Update User" : "Save User"}
                        </button>

                        <button
                            onClick={() => {
                                setDrawerOpen(false);
                                setSelectedUser(null);
                                setErrors({});
                            }}
                            className="w-full rounded-xl border border-zinc-200 py-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>

            {viewOpen && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/30 p-4 backdrop-blur-[2px]">
                    <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
                        <h2 className="mb-3 text-sm font-semibold text-zinc-900">User Details</h2>
                        <div className="space-y-1.5 text-xs text-zinc-600">
                            <p><span className="font-medium text-zinc-800">Username:</span> {selectedUser.username}</p>
                            <p><span className="font-medium text-zinc-800">Email:</span> {selectedUser.email}</p>
                            <p><span className="font-medium text-zinc-800">Role:</span> <span className="capitalize">{selectedUser.role}</span></p>
                        </div>
                        <button
                            onClick={() => setViewOpen(false)}
                            className="mt-5 w-full rounded-xl bg-zinc-900 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

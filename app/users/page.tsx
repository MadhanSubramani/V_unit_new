"use client";

import { useEffect, useState } from "react";
import { createUser, getUsers, deleteUserData, updateUserData, User } from "@/lib/auth";
import { Eye, EyeOff, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

type FormErrors = {
    username?: string;
    email?: string;
    password?: string;
};

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [viewOpen, setViewOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitError, setSubmitError] = useState("");
    const router = useRouter();
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

    // ── Validation ──────────────────────────────────────────────
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

    // ── Submit (Add or Edit) ─────────────────────────────────────
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

    const filteredUsers = users.filter(
        (user) =>
            user.username?.toLowerCase().includes(search.toLowerCase()) ||
            user.email?.toLowerCase().includes(search.toLowerCase())
    );

    const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);
    const currentUsers = filteredUsers.slice(
        (page - 1) * rowsPerPage,
        page * rowsPerPage
    );

    const FieldError = ({ msg }: { msg?: string }) =>
        msg ? <p className="text-red-500 text-xs mt-1">{msg}</p> : null;

    const handleLogout = () => {
        localStorage.removeItem("user"); // or sessionStorage, whatever you use
        router.push("/login");
    };

    return (
        <div className="flex min-h-screen bg-gray-100">

            {/* SIDEBAR */}
            <aside className="w-64 bg-slate-900 text-white">
                <div className="p-6 text-2xl font-bold">Admin Panel</div>
                <nav className="p-4 space-y-2">
                    <button className="w-full text-left p-3 rounded hover:bg-slate-700">Dashboard</button>
                    <button className="w-full text-left p-3 rounded bg-slate-700">Users</button>
                    <button className="w-full text-left p-3 rounded hover:bg-slate-700">Reports</button>
                    <button className="w-full text-left p-3 rounded hover:bg-slate-700">Settings</button>
                    <div className="p-4 border-t border-slate-700">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2 p-3 rounded hover:bg-red-600 text-white transition-colors"
                        >
                            <LogOut size={18} />
                            Logout
                        </button>
                    </div>
                </nav>
            </aside>

            {/* CONTENT */}
            <main className="flex-1 p-8">
                <div className="bg-white rounded-xl shadow p-6">

                    {/* HEADER */}
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold">User Management</h1>
                        <button
                            onClick={openAddDrawer}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg"
                        >
                            + Add User
                        </button>
                    </div>

                    {/* SEARCH */}
                    <input
                        type="text"
                        placeholder="Search user..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full border p-3 rounded-lg mb-6"
                    />

                    {/* TABLE */}
                    <div className="overflow-x-auto">
                        <table className="w-full border">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="p-3 text-left">Username</th>
                                    <th className="p-3 text-left">Email</th>
                                    <th className="p-3 text-left">Role</th>
                                    <th className="p-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-6 text-center text-gray-400">
                                            No users found.
                                        </td>
                                    </tr>
                                ) : (
                                    currentUsers.map((user) => (
                                        <tr key={user.id} className="border-t hover:bg-gray-50">
                                            <td className="p-3">{user.username}</td>
                                            <td className="p-3">{user.email}</td>
                                            <td className="p-3 capitalize">{user.role}</td>
                                            <td className="p-3">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => { setSelectedUser(user); setViewOpen(true); }}
                                                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        onClick={() => openEditDrawer(user)}
                                                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(user.id)}
                                                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* PAGINATION */}
                    <div className="flex justify-end gap-2 mt-6">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                            className="border px-4 py-2 rounded disabled:opacity-40"
                        >
                            Prev
                        </button>
                        {[...Array(totalPages)].map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setPage(i + 1)}
                                className={`px-4 py-2 rounded ${page === i + 1 ? "bg-blue-600 text-white" : "border"
                                    }`}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(page + 1)}
                            className="border px-4 py-2 rounded disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </main>

            {/* DRAWER OVERLAY */}
            {drawerOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-40"
                    onClick={() => {
                        setDrawerOpen(false);
                        setSelectedUser(null);
                        setErrors({});
                    }}
                />
            )}

            {/* DRAWER */}
            <div
                className={`fixed top-0 right-0 h-full w-[450px] bg-white shadow-2xl transition-transform duration-300 z-50 ${drawerOpen ? "translate-x-0" : "translate-x-full"
                    }`}
            >
                <div className="p-6 h-full overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold">
                            {selectedUser ? "Edit User" : "Add User"}
                        </h2>
                        <button
                            onClick={() => {
                                setDrawerOpen(false);
                                setSelectedUser(null);
                                setErrors({});
                            }}
                            className="text-gray-500 hover:text-gray-800 text-xl"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Global submit error */}
                    {submitError && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
                            {submitError}
                        </div>
                    )}

                    <div className="space-y-4">

                        {/* Username */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Username <span className="text-red-500">*</span>
                            </label>
                            <input
                                placeholder="Enter username"
                                value={form.username}
                                onChange={(e) => {
                                    setForm({ ...form, username: e.target.value });
                                    if (errors.username) setErrors({ ...errors, username: undefined });
                                }}
                                className={`w-full border p-3 rounded-lg focus:outline-none focus:ring-2 ${errors.username
                                        ? "border-red-500 focus:ring-red-300"
                                        : "border-gray-300 focus:ring-blue-300"
                                    }`}
                            />
                            <FieldError msg={errors.username} />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email <span className="text-red-500">*</span>
                            </label>
                            <input
                                placeholder="Enter email"
                                value={form.email}
                                onChange={(e) => {
                                    setForm({ ...form, email: e.target.value });
                                    if (errors.email) setErrors({ ...errors, email: undefined });
                                }}
                                className={`w-full border p-3 rounded-lg focus:outline-none focus:ring-2 ${errors.email
                                        ? "border-red-500 focus:ring-red-300"
                                        : "border-gray-300 focus:ring-blue-300"
                                    }`}
                            />
                            <FieldError msg={errors.email} />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter password (min. 6 characters)"
                                    value={form.password}
                                    onChange={(e) => {
                                        setForm({ ...form, password: e.target.value });
                                        if (errors.password) setErrors({ ...errors, password: undefined });
                                    }}
                                    className={`w-full border p-3 rounded-lg pr-12 focus:outline-none focus:ring-2 ${errors.password
                                            ? "border-red-500 focus:ring-red-300"
                                            : "border-gray-300 focus:ring-blue-300"
                                        }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            <FieldError msg={errors.password} />
                        </div>

                        {/* Role */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Role
                            </label>
                            <select
                                value={form.role}
                                onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                                className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value="admin">Admin</option>
                                <option value="user">User</option>
                                <option value="accountant">Accountant</option>
                            </select>
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={handleSave}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-medium transition-colors"
                        >
                            {selectedUser ? "Update User" : "Save User"}
                        </button>

                        {/* Cancel Button */}
                        <button
                            onClick={() => {
                                setDrawerOpen(false);
                                setSelectedUser(null);
                                setErrors({});
                            }}
                            className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 p-3 rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>

                    </div>
                </div>
            </div>

            {/* VIEW MODAL */}
            {viewOpen && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl w-[400px] shadow-xl">
                        <h2 className="text-xl font-bold mb-4">User Details</h2>
                        <div className="space-y-2 text-sm text-gray-700">
                            <p><span className="font-medium text-gray-900">Username:</span> {selectedUser.username}</p>
                            <p><span className="font-medium text-gray-900">Email:</span> {selectedUser.email}</p>
                            <p><span className="font-medium text-gray-900">Role:</span> <span className="capitalize">{selectedUser.role}</span></p>
                        </div>
                        <button
                            onClick={() => setViewOpen(false)}
                            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
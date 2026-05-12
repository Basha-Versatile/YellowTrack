"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { rolesAPI, usersAPI } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Users,
  Search,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  MoreVertical,
  Pencil,
  KeyRound,
  Pause,
  Play,
  Trash2,
  Copy,
  Mail,
  AlertTriangle,
  Crown,
} from "lucide-react";

type UserRow = {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  role: "ADMIN" | "OPERATOR";
  roleId?: string | null;
  status: "ACTIVE" | "SUSPENDED";
  mustResetPassword?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  isOwner?: boolean;
};

type Role = {
  id?: string;
  _id?: string;
  name: string;
  isSystem: boolean;
};

function timeAgo(date?: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    name: string;
    email: string;
    tempPassword: string;
  } | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([usersAPI.list(), rolesAPI.list()]);
      const userList = (u.data.data as UserRow[]).map((x) => ({
        ...x,
        _id: String(x.id ?? x._id),
      }));
      const roleList = (r.data.data as Role[]).map((x) => ({
        ...x,
        _id: String(x.id ?? x._id),
      }));
      setUsers(userList);
      setRoles(roleList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  const roleNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of roles) m.set(String(r._id), r.name);
    return m;
  }, [roles]);

  const summary = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "ACTIVE").length;
    const suspended = users.filter((u) => u.status === "SUSPENDED").length;
    return { total, active, suspended };
  }, [users]);

  const myId = me?.id;

  const onAction = async (
    user: UserRow,
    action: "edit" | "reset" | "suspend" | "resume" | "delete",
  ) => {
    try {
      if (action === "edit") {
        setEditing(user);
        return;
      }
      if (action === "reset") {
        if (
          !confirm(
            `Reset password for ${user.name}? They'll receive a new temporary password by email and be forced to change it on next sign-in.`,
          )
        )
          return;
        const res = await usersAPI.resetPassword(String(user._id));
        const temp = (res.data.data as { tempPassword: string }).tempPassword;
        setInviteResult({
          name: user.name,
          email: user.email,
          tempPassword: temp,
        });
        await load();
        return;
      }
      if (action === "suspend") {
        if (!confirm(`Suspend ${user.name}? They'll be signed out immediately.`))
          return;
        await usersAPI.suspend(String(user._id));
        setToast({ type: "success", message: `${user.name} suspended` });
      }
      if (action === "resume") {
        await usersAPI.resume(String(user._id));
        setToast({ type: "success", message: `${user.name} resumed` });
      }
      if (action === "delete") {
        if (
          !confirm(
            `Delete ${user.name}? This permanently removes their account. They'll be signed out immediately.`,
          )
        )
          return;
        await usersAPI.remove(String(user._id));
        setToast({ type: "success", message: `${user.name} deleted` });
      }
      await load();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Action failed";
      setToast({ type: "error", message: msg });
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-gradient-to-br from-yellow-50 via-white to-amber-50 dark:border-gray-800 dark:from-yellow-500/[0.04] dark:via-gray-900 dark:to-amber-500/[0.04] p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-yellow-300/20 blur-3xl dark:bg-yellow-400/10"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-700/70 dark:text-yellow-400">
              Settings · Team
            </span>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Users & access
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
              {summary.total} user{summary.total !== 1 ? "s" : ""} · {summary.active} active
              {summary.suspended > 0 ? ` · ${summary.suspended} suspended` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/settings/roles"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white/80 backdrop-blur px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-white dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300 dark:hover:bg-gray-900 transition-colors"
            >
              <Shield className="w-4 h-4" />
              Roles
            </Link>
            <button
              onClick={() => setInviting(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-yellow-500/30 hover:from-yellow-500 hover:to-yellow-600 transition-all"
            >
              <Plus className="w-4 h-4" />
              Invite user
            </button>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      {/* Users list */}
      <div className="rounded-2xl border border-gray-200/80 bg-white overflow-hidden dark:border-gray-800 dark:bg-white/[0.02]">
        {loading ? (
          <UserListSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState onInvite={() => setInviting(true)} />
        ) : (
          filtered.map((u, i) => (
            <UserItem
              key={u._id}
              user={u}
              isFirst={i === 0}
              isSelf={String(u._id) === String(myId)}
              roleName={u.roleId ? roleNameById.get(String(u.roleId)) : null}
              onAction={(action) => onAction(u, action)}
            />
          ))
        )}
      </div>

      {/* Edit user modal */}
      {editing && (
        <EditUserModal
          user={editing}
          roles={roles}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null);
            setToast({ type: "success", message: msg });
            await load();
          }}
          onError={(msg) => setToast({ type: "error", message: msg })}
        />
      )}

      {/* Invite modal */}
      {inviting && (
        <InviteUserModal
          roles={roles}
          onClose={() => setInviting(false)}
          onSuccess={async (result) => {
            setInviting(false);
            setInviteResult({
              name: result.user.name,
              email: result.user.email,
              tempPassword: result.tempPassword,
            });
            await load();
          }}
        />
      )}

      {/* Invite/reset password result modal */}
      {inviteResult && (
        <TempPasswordModal
          {...inviteResult}
          onClose={() => setInviteResult(null)}
        />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── User row ────────────────────────────────────────────────────────────────
function UserItem({
  user: u,
  isFirst,
  isSelf,
  roleName,
  onAction,
}: {
  user: UserRow;
  isFirst: boolean;
  isSelf: boolean;
  roleName: string | null | undefined;
  onAction: (action: "edit" | "reset" | "suspend" | "resume" | "delete") => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const initials = u.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const suspended = u.status === "SUSPENDED";

  return (
    <div
      className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${
        isFirst ? "" : "border-t border-gray-100 dark:border-gray-800"
      } ${suspended ? "opacity-70" : ""}`}
    >
      <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-400/20 to-yellow-500/10 text-yellow-700 dark:text-yellow-400 font-black text-sm shadow-sm flex-shrink-0">
        {initials}
        {u.isOwner && (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-yellow-500 text-white shadow"
            title="Tenant owner"
          >
            <Crown className="w-2.5 h-2.5" />
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
            {u.name}
          </p>
          {isSelf && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
              You
            </span>
          )}
          {u.mustResetPassword && (
            <span
              title="Password reset pending"
              className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
            >
              Pending reset
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
          {u.email}
        </p>
      </div>

      <div className="hidden lg:flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 min-w-[100px]">
        <Clock className="w-3 h-3" />
        {timeAgo(u.lastLoginAt)}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {suspended ? (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            Suspended
          </span>
        ) : u.role === "ADMIN" || u.isOwner ? (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-sm">
            <Crown className="w-3 h-3" />
            Admin
          </span>
        ) : roleName ? (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
            <Shield className="w-3 h-3" />
            {roleName}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            No role
          </span>
        )}
      </div>

      {/* Actions menu */}
      <div className="relative flex-shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
          aria-label="Actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 py-1 z-50">
            <MenuItem
              Icon={Pencil}
              label="Edit name & role"
              onClick={() => {
                setMenuOpen(false);
                onAction("edit");
              }}
            />
            <MenuItem
              Icon={KeyRound}
              label="Reset password"
              onClick={() => {
                setMenuOpen(false);
                onAction("reset");
              }}
            />
            {!isSelf && !u.isOwner && (
              <>
                <div className="my-1 h-px bg-gray-100 dark:bg-gray-800" />
                {suspended ? (
                  <MenuItem
                    Icon={Play}
                    label="Resume access"
                    onClick={() => {
                      setMenuOpen(false);
                      onAction("resume");
                    }}
                  />
                ) : (
                  <MenuItem
                    Icon={Pause}
                    label="Suspend"
                    tone="warning"
                    onClick={() => {
                      setMenuOpen(false);
                      onAction("suspend");
                    }}
                  />
                )}
                <MenuItem
                  Icon={Trash2}
                  label="Delete user"
                  tone="danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onAction("delete");
                  }}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  Icon,
  label,
  onClick,
  tone = "neutral",
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "warning" | "danger";
}) {
  const cls =
    tone === "danger"
      ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
      : tone === "warning"
        ? "text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
        : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800";
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-3 py-2 text-xs font-medium ${cls} transition-colors`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

// ── Invite user modal ──────────────────────────────────────────────────────
function InviteUserModal({
  roles,
  onClose,
  onSuccess,
}: {
  roles: Role[];
  onClose: () => void;
  onSuccess: (result: {
    user: { name: string; email: string };
    tempPassword: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedRole = useMemo(
    () => roles.find((r) => String(r._id) === roleId),
    [roles, roleId],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await usersAPI.invite({
        name,
        email,
        roleId: roleId || null,
      });
      onSuccess(res.data.data as {
        user: { name: string; email: string };
        tempPassword: string;
      });
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to invite user";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !submitting && onClose()}
      />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 px-6 py-5">
          <h2 className="text-lg font-bold text-white">Invite a user</h2>
          <p className="text-white/80 text-xs mt-0.5">
            They&apos;ll get an email with a temporary password and must change
            it on first sign-in.
          </p>
        </div>
        <form onSubmit={submit}>
          <div className="p-6 space-y-4">
            <Field label="Full name" required>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Alex Patel"
                className="input"
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="alex@example.com"
                className="input"
              />
            </Field>
            <Field
              label="Role"
              hint="Pick the role to grant. Manage role permissions on the Roles page."
            >
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="input"
              >
                <option value="">— No role (no access until assigned) —</option>
                {roles
                  .filter((r) => r.name !== "Admin")
                  .map((r) => (
                    <option key={String(r._id)} value={String(r._id)}>
                      {r.name} {r.isSystem ? "(default)" : ""}
                    </option>
                  ))}
              </select>
              {selectedRole && (
                <div className="mt-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 px-3 py-2 flex items-start gap-2">
                  <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-800 dark:text-blue-400">
                    Granted role: <span className="font-bold">{selectedRole.name}</span>
                  </p>
                </div>
              )}
            </Field>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2 dark:border-red-500/30 dark:bg-red-500/10">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-800 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {submitting && (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              <Mail className="w-4 h-4" />
              Send invite
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-11 px-5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </form>

        <style jsx>{`
          :global(.input) {
            width: 100%;
            height: 2.75rem;
            border-radius: 0.75rem;
            border: 1px solid rgb(229 231 235);
            background-color: white;
            padding: 0 1rem;
            font-size: 0.875rem;
            color: rgb(31 41 55);
          }
          :global(.dark .input) {
            border-color: rgb(55 65 81);
            background-color: rgb(31 41 55);
            color: white;
          }
          :global(.input:focus) {
            outline: none;
            border-color: rgb(234 179 8);
            box-shadow: 0 0 0 3px rgb(234 179 8 / 0.1);
          }
        `}</style>
      </div>
    </div>
  );
}

// ── Edit user modal ────────────────────────────────────────────────────────
function EditUserModal({
  user: u,
  roles,
  onClose,
  onSaved,
  onError,
}: {
  user: UserRow;
  roles: Role[];
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(u.name);
  const [roleId, setRoleId] = useState<string | null>(u.roleId ?? null);
  const [submitting, setSubmitting] = useState(false);

  const isAdminUser = u.role === "ADMIN" || u.isOwner;

  const submit = async () => {
    setSubmitting(true);
    try {
      await usersAPI.update(String(u._id), {
        name,
        // ADMIN's role assignment is locked; only send roleId for operators.
        ...(isAdminUser ? {} : { roleId }),
      });
      onSaved(`Updated ${name}`);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to update user";
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !submitting && onClose()}
      />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 px-6 py-5">
          <h2 className="text-lg font-bold text-white">Edit user</h2>
          <p className="text-white/80 text-xs mt-0.5 truncate">
            {u.email}
            {u.isOwner ? " · Workspace owner" : ""}
          </p>
        </div>
        <div className="p-6 space-y-5">
          <Field label="Full name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              required
            />
          </Field>

          {isAdminUser ? (
            <div className="rounded-xl bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 px-4 py-3 flex items-start gap-2.5">
              <Crown className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-yellow-900 dark:text-yellow-300">
                  Workspace admin
                </p>
                <p className="text-[11px] text-yellow-800 dark:text-yellow-400/80 mt-0.5">
                  Each workspace has exactly one admin and they have full access.
                  Role assignment is locked.
                </p>
              </div>
            </div>
          ) : (
            <Field
              label="Role"
              hint="Pick the role to grant. Manage role permissions on the Roles page."
            >
              <select
                value={roleId ?? ""}
                onChange={(e) => setRoleId(e.target.value || null)}
                className="input"
              >
                <option value="">— No role (no access) —</option>
                {roles
                  .filter((r) => r.name !== "Admin")
                  .map((r) => (
                    <option key={String(r._id)} value={String(r._id)}>
                      {r.name} {r.isSystem ? "(default)" : ""}
                    </option>
                  ))}
              </select>
            </Field>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {submitting && (
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            )}
            Save
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-11 px-5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
        </div>

        <style jsx>{`
          :global(.input) {
            width: 100%;
            height: 2.75rem;
            border-radius: 0.75rem;
            border: 1px solid rgb(229 231 235);
            background-color: white;
            padding: 0 1rem;
            font-size: 0.875rem;
            color: rgb(31 41 55);
          }
          :global(.dark .input) {
            border-color: rgb(55 65 81);
            background-color: rgb(31 41 55);
            color: white;
          }
          :global(.input:focus) {
            outline: none;
            border-color: rgb(234 179 8);
            box-shadow: 0 0 0 3px rgb(234 179 8 / 0.1);
          }
        `}</style>
      </div>
    </div>
  );
}

// ── Temporary-password reveal modal (after invite / reset) ─────────────────
function TempPasswordModal({
  name,
  email,
  tempPassword,
  onClose,
}: {
  name: string;
  email: string;
  tempPassword: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  const copy = async (text: string, which: "email" | "password") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-400 to-emerald-500 px-6 py-5 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-2">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-bold text-white">Credentials ready</h2>
          <p className="text-white/80 text-xs mt-0.5">
            We&apos;ve emailed {name} — keep these handy in case the email
            doesn&apos;t arrive.
          </p>
        </div>
        <div className="p-6 space-y-3">
          <CopyField
            label="Email"
            value={email}
            Icon={Mail}
            copied={copied === "email"}
            onCopy={() => copy(email, "email")}
          />
          <CopyField
            label="Temporary password"
            value={tempPassword}
            Icon={KeyRound}
            copied={copied === "password"}
            onCopy={() => copy(tempPassword, "password")}
            mono
          />
          <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 px-4 py-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-400">
              This password won&apos;t be shown again. {name} will set their own
              password at first sign-in.
            </p>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyField({
  label,
  value,
  Icon,
  onCopy,
  copied,
  mono,
}: {
  label: string;
  value: string;
  Icon: React.ComponentType<{ className?: string }>;
  onCopy: () => void;
  copied: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white text-yellow-600 dark:bg-gray-900 dark:text-yellow-400">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {label}
        </p>
        <p
          className={`text-sm text-gray-900 dark:text-white truncate ${mono ? "font-mono" : ""}`}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
          copied
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
            : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        }`}
      >
        {copied ? (
          <>
            <CheckCircle2 className="w-3 h-3" />
            Copied
          </>
        ) : (
          <>
            <Copy className="w-3 h-3" />
            Copy
          </>
        )}
      </button>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">{hint}</p>
      )}
    </label>
  );
}

function Toast({
  type,
  message,
  onClose,
}: {
  type: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-[100000] max-w-sm">
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl ${
          type === "success"
            ? "border-emerald-200 bg-white text-emerald-700 dark:border-emerald-500/30 dark:bg-gray-900 dark:text-emerald-400"
            : "border-red-200 bg-white text-red-700 dark:border-red-500/30 dark:bg-gray-900 dark:text-red-400"
        }`}
      >
        {type === "success" ? (
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
        )}
        <p className="text-sm font-medium">{message}</p>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onInvite }: { onInvite: () => void }) {
  return (
    <div className="p-12 text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400/20 to-yellow-500/10 flex items-center justify-center mb-4">
        <Users className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
      </div>
      <h3 className="text-base font-bold text-gray-900 dark:text-white">
        No users yet
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">
        Invite teammates to give them access to this workspace.
      </p>
      <button
        onClick={onInvite}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-yellow-500/30"
      >
        <Plus className="w-4 h-4" />
        Invite your first user
      </button>
    </div>
  );
}

function UserListSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-4 px-5 py-4 ${i === 0 ? "" : "border-t border-gray-100 dark:border-gray-800"}`}
        >
          <div className="w-11 h-11 rounded-xl bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
            <div className="h-3 w-48 rounded bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
          </div>
          <div className="w-20 h-6 rounded bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
          <div className="w-9 h-9 rounded-lg bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
        </div>
      ))}
    </>
  );
}

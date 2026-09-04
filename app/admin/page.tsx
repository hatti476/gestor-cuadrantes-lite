"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useToast } from "@/components/ui/toast-provider";
import { isAdmin } from "@/lib/auth/permissions";

interface AdminUser {
  id: string;
  email: string;
  role: string;
  employee: {
    id: string;
    name: string;
    rotationOrder: number;
    shiftPreference: string | null;
    active: boolean;
  } | null;
}

const GLOBAL_ROLE_BADGES: Record<string, { label: string; cls: string }> = {
  ADMIN: { label: "ADMIN", cls: "bg-red-100 text-red-700" },
  TECNICO: { label: "TECNICO", cls: "bg-green-100 text-green-700" },
  VIEWER: { label: "VIEWER", cls: "bg-gray-200 text-gray-600" },
};

const SHIFT_PREF_OPTIONS = [
  { value: "", label: "Sin preferencia" },
  { value: "M", label: "Mañanas" },
  { value: "T", label: "Tardes" },
  { value: "J", label: "Jornada" },
];

function PasswordModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { showToast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Las contraseñas no coinciden"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Error");
      showToast("Contraseña actualizada", "success");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-80 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Cambiar contraseña</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>
        <p className="text-xs text-gray-500">{user.email}</p>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="password" placeholder="Nueva contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <input type="password" placeholder="Confirmar contraseña" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteModal({ user, onClose, onConfirm }: { user: AdminUser; onClose: () => void; onConfirm: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true); setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally { setDeleting(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-80 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Eliminar usuario</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg" disabled={deleting}>×</button>
        </div>
        <p className="text-xs text-gray-500">{user.employee?.name ?? user.email}</p>
        <p className="text-sm text-gray-600">
          ¿Eliminar a <strong>{user.employee?.name ?? user.email}</strong>?
          <br />Se borrarán <strong>todos sus datos</strong> (turnos, historial, empleado).
          <br /><span className="text-red-600">No se puede deshacer.</span>
        </p>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="text-sm px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserModal({
  user, onClose, onSaved,
}: {
  user: AdminUser | null; onClose: () => void; onSaved: () => void;
}) {
  const { showToast } = useToast();
  const isEdit = user !== null;
  const [name, setName] = useState(user?.employee?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [globalRole, setGlobalRole] = useState(user?.role ?? "VIEWER");
  const [shiftPref, setShiftPref] = useState(user?.employee?.shiftPreference ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const isActive = user?.employee?.active ?? true;

  async function handleDeactivate() {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !isActive }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Error");
      showToast(isActive ? "Usuario desactivado" : "Usuario reactivado", "success");
      onSaved(); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setSaving(false); setConfirmDeactivate(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      if (isEdit) {
        const body: Record<string, unknown> = { email, globalRole };
        if (user?.employee) {
          body.name = name;
          body.shiftPreference = shiftPref || null;
        }
        const res = await fetch(`/api/admin/users/${user!.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Error actualizando");
        showToast("Usuario actualizado", "success");
      } else {
        const body: Record<string, unknown> = { name, email, password, globalRole };
        if (globalRole === "TECNICO") { body.shiftPreference = shiftPref || null; }
        const res = await fetch("/api/admin/users", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Error creando");
        showToast("Usuario creado", "success");
      }
      onSaved(); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg flex flex-col gap-5 my-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-lg">{isEdit ? `Editar — ${user?.employee?.name ?? user?.email}` : "Nuevo usuario"}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Cerrar">×</button>
          </div>
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Datos de acceso</h4>
              <div className="flex flex-col gap-3">
                {globalRole === "TECNICO" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo *</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} placeholder="Nombre completo"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="usuario@dominio.com"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                {!isEdit && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña *</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Mín. 8 chars, 1 mayúscula, 1 número"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                )}
                {isEdit && (
                  <button type="button" onClick={() => setShowPasswordModal(true)} className="text-sm text-blue-600 hover:text-blue-800 self-start">
                    Cambiar contraseña →
                  </button>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Rol global *</label>
                  <select value={globalRole} onChange={(e) => setGlobalRole(e.target.value)}
                    data-testid="select-global-role"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="ADMIN">ADMIN</option>
                    <option value="TECNICO">TECNICO</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                </div>
              </div>
            </section>
            {globalRole === "TECNICO" && (
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Preferencias de turno</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Preferencia de turno</label>
                  <select value={shiftPref} onChange={(e) => setShiftPref(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {SHIFT_PREF_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </section>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              {isEdit ? (
                confirmDeactivate ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">¿Confirmar {isActive ? "desactivar" : "reactivar"}?</span>
                    <button type="button" onClick={handleDeactivate} disabled={saving}
                      className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">Sí</button>
                    <button type="button" onClick={() => setConfirmDeactivate(false)}
                      className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-600">No</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmDeactivate(true)}
                    className={`text-xs px-3 py-1.5 rounded border ${isActive ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}>
                    {isActive ? "Desactivar usuario" : "Reactivar usuario"}
                  </button>
                )
              ) : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="text-sm px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      {showPasswordModal && user && <PasswordModal user={user} onClose={() => setShowPasswordModal(false)} />}
    </>
  );
}

function UsersTab() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [editingUser, setEditingUser] = useState<AdminUser | null | "new">(null);
  const [passwordUser, setPasswordUser] = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Error cargando usuarios");
      setUsers(await res.json());
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    } finally { setLoading(false); }
  }, [showToast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadUsers(); }, [loadUsers]);

  async function handleDelete(user: AdminUser) {
    if (!user.id || user.id === session?.user?.id) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error eliminando usuario");
      }
      showToast("Usuario eliminado", "success");
      await loadUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    }
  }

  const filtered = users.filter((u) => {
    const nm = u.employee?.name ?? "";
    const matchSearch = nm.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" && u.employee?.active !== false) || (statusFilter === "INACTIVE" && u.employee?.active === false);
    return matchSearch && matchRole && matchStatus;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" placeholder="Buscar por nombre o email…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-64" />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="ALL">Todos los roles</option>
          <option value="ADMIN">ADMIN</option>
          <option value="TECNICO">TECNICO</option>
          <option value="VIEWER">VIEWER</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="ALL">Todos los estados</option>
          <option value="ACTIVE">Activos</option>
          <option value="INACTIVE">Inactivos</option>
        </select>
        <div className="ml-auto">
          <button onClick={() => setEditingUser("new")} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
            + Nuevo usuario
          </button>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">Cargando usuarios…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 border-b border-gray-200">Nombre</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 border-b border-gray-200">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 border-b border-gray-200">Rol global</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 border-b border-gray-200">Estado</th>
                <th className="px-4 py-3 border-b border-gray-200" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">No hay usuarios que coincidan.</td></tr>
              ) : filtered.map((u) => {
                const badge = GLOBAL_ROLE_BADGES[u.role] ?? { label: u.role, cls: "bg-gray-100 text-gray-600" };
                const isActive = u.employee?.active !== false;
                return (
                  <tr key={u.id} className={`${!isActive ? "opacity-60" : ""} hover:bg-yellow-50/30 transition-colors border-b border-gray-100`}>
                    <td className="px-4 py-3 font-medium text-gray-800">{u.employee?.name ?? <span className="text-gray-400 italic">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>{badge.label}</span></td>
                    <td className="px-4 py-3">
                      {u.employee ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {isActive ? "Activo" : "Inactivo"}
                        </span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          data-testid={`btn-password-user-${u.id}`}
                          onClick={() => setPasswordUser(u)}
                          className="text-xs px-3 py-1.5 border border-blue-200 rounded text-blue-700 hover:bg-blue-50"
                        >
                          Contraseña
                        </button>
                        <button onClick={() => setEditingUser(u)} className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">Editar</button>
                        {u.id !== session?.user?.id && (
                          <button
                            data-testid={`btn-delete-user-${u.id}`}
                            onClick={() => setDeleteUser(u)}
                            className="text-xs px-3 py-1.5 border border-red-200 rounded text-red-600 hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editingUser !== null && (
        <UserModal user={editingUser === "new" ? null : editingUser} onClose={() => setEditingUser(null)} onSaved={() => { void loadUsers(); }} />
      )}
      {passwordUser && <PasswordModal user={passwordUser} onClose={() => setPasswordUser(null)} />}
      {deleteUser && (
        <DeleteModal
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onConfirm={() => handleDelete(deleteUser)}
        />
      )}
    </div>
  );
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session || !isAdmin(session)) router.replace("/");
  }, [session, status, router]);

  if (status === "loading" || !isAdmin(session)) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Administración</h2>
        <UsersTab />
      </main>
    </div>
  );
}
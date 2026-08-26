"use client";

import { useState } from "react";
import { Copy, Eye, EyeOff, Loader2, Trash2, UserPlus, Banknote, KeyRound, Sparkles, CheckCircle2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { RoleGate } from "@/components/role-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Role, StaffRole, WorkspaceUser } from "@/lib/server/rbac";

const roleLabels: Record<Role, string> = {
  pimpinan: "Pimpinan",
  pengelola_keuangan: "Bendahara / Pengelola Keuangan",
  kasir: "Kasir",
};

const staffRoles: StaffRole[] = ["kasir", "pengelola_keuangan"];

type ApiError = {
  error?: string | { issues?: Array<{ message?: string }> };
};

type InviteCredentials = {
  email: string;
  temporaryPassword: string;
};

function formatShiftTime(dateStr?: string | null) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

function formatShiftDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

function generateRandomPassword() {
  const words = ["kasir", "warung", "toko", "berkah", "sukses", "amanah", "juara"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${word}${num}`;
}

function errorMessage(data: ApiError, fallback: string) {
  if (typeof data.error === "string") {
    return data.error;
  }

  const issue = data.error?.issues?.[0]?.message;
  return issue ?? fallback;
}

export function KaryawanClient({
  currentRole,
  initialUsers,
}: Readonly<{
  currentRole: Role;
  initialUsers: WorkspaceUser[];
}>) {
  const [users, setUsers] = useState(initialUsers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("kasir");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<InviteCredentials | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmDeactivateUser, setConfirmDeactivateUser] = useState<WorkspaceUser | null>(null);
  const [salaryTarget, setSalaryTarget] = useState<WorkspaceUser | null>(null);
  const [salaryAmount, setSalaryAmount] = useState<string>("");

  // State untuk ubah nama karyawan
  const [nameTarget, setNameTarget] = useState<WorkspaceUser | null>(null);
  const [nameInput, setNameInput] = useState<string>("");

  // State untuk kelola sandi/password kasir
  const [passwordTarget, setPasswordTarget] = useState<WorkspaceUser | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState<string>("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState<{ email: string; password: string } | null>(null);

  // State untuk force-close / tutup sesi shift aktif oleh pimpinan
  const [closeShiftTarget, setCloseShiftTarget] = useState<WorkspaceUser | null>(null);

  async function refreshUsers() {
    const response = await fetch("/api/users", { cache: "no-store" });
    const data = (await response.json()) as { users?: WorkspaceUser[] } & ApiError;
    if (!response.ok || !data.users) {
      throw new Error(errorMessage(data, "Gagal memuat daftar karyawan."));
    }
    setUsers(data.users);
  }

  async function handleCloseShiftForUser() {
    if (!closeShiftTarget?.shiftStatus?.activeSessionId) return;

    const actionId = `${closeShiftTarget.id}:closeshift`;
    setPendingAction(actionId);

    try {
      const response = await fetch("/api/shifts/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: closeShiftTarget.shiftStatus.activeSessionId,
          closingCash: 0,
          closingCoins: 0,
          closingSavings: 0,
          varianceNote: `Shift ditutup oleh Pengelola Toko (${closeShiftTarget.name})`,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal menutup sesi shift.");
      }

      toast.success(`Sesi shift ${closeShiftTarget.name} berhasil ditutup.`);
      setCloseShiftTarget(null);
      await refreshUsers();
      window.dispatchEvent(new CustomEvent("cashier-shift-updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menutup shift.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUpdateName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nameTarget) return;
    if (!nameInput.trim()) {
      toast.error("Nama karyawan tidak boleh kosong.");
      return;
    }

    const actionId = `${nameTarget.id}:name`;
    setPendingAction(actionId);

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(nameTarget.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal mengubah nama karyawan.");
      }

      setUsers((current) =>
        current.map((item) =>
          item.id === nameTarget.id ? { ...item, name: nameInput.trim() } : item
        )
      );
      toast.success(`Nama akun karyawan berhasil diubah menjadi "${nameInput.trim()}".`);
      setNameTarget(null);
      window.dispatchEvent(new CustomEvent("cashier-shift-updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengubah nama karyawan.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordTarget) return;

    if (!newPasswordInput || newPasswordInput.length < 6) {
      toast.error("Password minimal 6 karakter.");
      return;
    }

    const actionId = `${passwordTarget.id}:password`;
    setPendingAction(actionId);

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(passwordTarget.id)}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPasswordInput }),
      });
      const data = (await response.json()) as { success?: boolean; email?: string; password?: string } & ApiError;

      if (!response.ok || data.success !== true || !data.password) {
        throw new Error(errorMessage(data, "Gagal mengubah password."));
      }

      setPasswordResetSuccess({
        email: data.email ?? passwordTarget.email,
        password: data.password,
      });
      toast.success(`Password akun ${passwordTarget.name} berhasil diperbarui!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengubah password.");
    } finally {
      setPendingAction(null);
    }
  }

  async function copyNewPassword() {
    if (!passwordResetSuccess || !passwordTarget) return;

    try {
      const text = `Halo ${passwordTarget.name},\nBerikut data login akun kasir TokoMu Anda:\nEmail: ${passwordResetSuccess.email}\nPassword Baru: ${passwordResetSuccess.password}\n\nSilakan login di aplikasi kasir.`;
      await navigator.clipboard.writeText(text);
      toast.success("Format data login kasir berhasil disalin!");
    } catch {
      toast.error("Browser tidak mengizinkan akses clipboard.");
    }
  }

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, name: name.trim() || undefined }),
      });
      const data = (await response.json()) as {
        email?: string;
        temporaryPassword?: string | null;
      } & ApiError;

      if (!response.ok) {
        throw new Error(errorMessage(data, "Gagal mengundang user."));
      }

      setName("");
      setEmail("");
      setRole("kasir");
      await refreshUsers();

      if (data.email && data.temporaryPassword) {
        setCredentials({
          email: data.email,
          temporaryPassword: data.temporaryPassword,
        });
      }

      toast.success("User berhasil ditambahkan ke workspace.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengundang user.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRoleChange(user: WorkspaceUser, nextRole: StaffRole) {
    if (user.role === nextRole) {
      return;
    }

    const actionId = `${user.id}:role`;
    setPendingAction(actionId);

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const data = (await response.json()) as { user?: Pick<WorkspaceUser, "id" | "role" | "isActive"> } & ApiError;

      if (!response.ok || !data.user) {
        throw new Error(errorMessage(data, "Gagal mengubah role user."));
      }

      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? { ...item, role: data.user?.role ?? nextRole, isActive: data.user?.isActive ?? item.isActive }
            : item
        )
      );
      toast.success("Role karyawan berhasil diperbarui.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengubah role user.");
    } finally {
      setPendingAction(null);
    }
  }

  async function executeDeactivate() {
    if (!confirmDeactivateUser) return;
    const user = confirmDeactivateUser;
    setConfirmDeactivateUser(null);

    const actionId = `${user.id}:delete`;
    setPendingAction(actionId);

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { user?: Pick<WorkspaceUser, "id" | "role" | "isActive"> } & ApiError;

      if (!response.ok || !data.user) {
        throw new Error(errorMessage(data, "Gagal menonaktifkan user."));
      }

      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? { ...item, role: data.user?.role ?? item.role, isActive: data.user?.isActive ?? false }
            : item
        )
      );
      toast.success("Akses karyawan berhasil dinonaktifkan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menonaktifkan user.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSetSalary(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!salaryTarget) return;

    const actionId = `${salaryTarget.id}:salary`;
    setPendingAction(actionId);

    const amount = Number(salaryAmount.replace(/[^0-9]/g, ""));
    const user = salaryTarget;
    setSalaryTarget(null);
    setSalaryAmount("");

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/salary`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlySalary: amount }),
      });
      const data = (await response.json()) as { success?: boolean; monthlySalary?: number } & ApiError;

      if (!response.ok || data.success !== true) {
        throw new Error(errorMessage(data, "Gagal mengatur gaji karyawan."));
      }

      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? { ...item, monthlySalary: data.monthlySalary ?? amount }
            : item
        )
      );
      toast.success(`Gaji ${user.name} berhasil diatur menjadi Rp ${amount.toLocaleString("id-ID")}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengatur gaji karyawan.");
    } finally {
      setPendingAction(null);
    }
  }

  async function copyCredentials() {
    if (!credentials) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        `Email: ${credentials.email}\nPassword sementara: ${credentials.temporaryPassword}`
      );
      toast.success("Kredensial disalin.");
    } catch {
      toast.error("Browser tidak mengizinkan akses clipboard.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <RoleGate role={["pimpinan"]} currentRole={currentRole}>
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-2xl">
              <UserPlus className="size-5" />
              Invite user
            </CardTitle>
            <CardDescription>
              Buat akun baru dan tempatkan user langsung ke workspace ini.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void handleInvite(event)}>
              <div className="grid gap-2">
                <Label htmlFor="invite-name">Nama Karyawan / Petugas</Label>
                <Input
                  id="invite-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Contoh: Ika Mustika"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="kasir@email.com"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(value) => setRole(value as StaffRole)}>
                  <SelectTrigger className="h-11 w-full rounded-2xl bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {staffRoles.map((item) => (
                      <SelectItem key={item} value={item}>
                        {roleLabels[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="h-11 w-full rounded-2xl" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                Invite user
              </Button>
            </form>
          </CardContent>
        </Card>
      </RoleGate>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Daftar karyawan</CardTitle>
          <CardDescription>
            Semua user di workspace yang sama beserta status operasional shift, nama akun, dan akses kredensial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status Shift</TableHead>
                <TableHead>Gaji Bulanan</TableHead>
                <TableHead>Status Akun</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Belum ada karyawan di workspace ini.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const canManage = user.role !== "pimpinan" && user.isActive;
                  const rolePending = pendingAction === `${user.id}:role`;
                  const deletePending = pendingAction === `${user.id}:delete`;

                  return (
                    <TableRow key={user.id} className={!user.isActive ? "opacity-65" : undefined}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">{user.name}</span>
                          {canManage && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Ubah nama akun karyawan"
                              onClick={() => {
                                setNameTarget(user);
                                setNameInput(user.name);
                              }}
                            >
                              <Pencil className="size-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {canManage ? (
                          <Select
                            value={user.role}
                            onValueChange={(value) => void handleRoleChange(user, value as StaffRole)}
                            disabled={rolePending || Boolean(pendingAction)}
                          >
                            <SelectTrigger className="h-9 w-[190px] rounded-xl bg-card">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {staffRoles.map((item) => (
                                <SelectItem key={item} value={item}>
                                  {roleLabels[item]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={user.role === "pimpinan" ? "default" : "secondary"}>
                            {roleLabels[user.role]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.shiftStatus?.isCurrentShiftActive ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white dark:text-emerald-950 px-2.5 py-0.5 text-xs font-bold shadow-sm shadow-emerald-600/25 w-fit">
                              <span className="size-2 rounded-full bg-white dark:bg-emerald-950 animate-pulse" />
                              {user.shiftStatus.activeShiftName || "Shift Aktif"}
                            </span>
                            {user.shiftStatus.activeStartedAt && (
                              <span className="text-[11px] text-muted-foreground">
                                Masuk sejak {formatShiftTime(user.shiftStatus.activeStartedAt)}
                              </span>
                            )}
                          </div>
                        ) : user.shiftStatus?.lastShiftName ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-300 w-fit">
                              Shift Lalu: {user.shiftStatus.lastShiftName}
                            </span>
                            {user.shiftStatus.lastEndedAt && (
                              <span className="text-[11px] text-muted-foreground">
                                Selesai: {formatShiftDate(user.shiftStatus.lastEndedAt)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Belum ada shift</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">
                          Rp {(user.monthlySalary ?? 0).toLocaleString("id-ID")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "default" : "secondary"}>
                          {user.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {user.shiftStatus?.isCurrentShiftActive && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-rose-500/40 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300 font-semibold"
                              disabled={Boolean(pendingAction)}
                              title="Tutup sesi shift yang sedang berjalan untuk karyawan ini"
                              onClick={() => setCloseShiftTarget(user)}
                            >
                              Tutup Shift
                            </Button>
                          )}
                          {canManage && (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-amber-500/35 hover:border-amber-500/70 hover:bg-amber-500/10 text-amber-900 dark:text-amber-200"
                                disabled={Boolean(pendingAction)}
                                title="Lihat atau atur ulang password akun kasir"
                                onClick={() => {
                                  setPasswordTarget(user);
                                  setNewPasswordInput("");
                                  setShowNewPassword(false);
                                  setPasswordResetSuccess(null);
                                }}
                              >
                                <KeyRound className="size-3.5 text-amber-600 dark:text-amber-400" />
                                Sandi
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={Boolean(pendingAction)}
                                onClick={() => {
                                  setSalaryTarget(user);
                                  setSalaryAmount(user.monthlySalary?.toString() ?? "0");
                                }}
                              >
                                <Banknote className="size-3.5" />
                                Atur Gaji
                              </Button>
                            </>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={!canManage || deletePending || Boolean(pendingAction)}
                            onClick={() => setConfirmDeactivateUser(user)}
                          >
                            {deletePending ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                            Nonaktifkan
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Kelola Sandi Kasir / Karyawan */}
      <Dialog
        open={Boolean(passwordTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordTarget(null);
            setPasswordResetSuccess(null);
            setNewPasswordInput("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {passwordResetSuccess && passwordTarget ? (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-5" />
                  <DialogTitle>Sandi Berhasil Diperbarui!</DialogTitle>
                </div>
                <DialogDescription>
                  Password akun {passwordTarget.name} telah berhasil diubah. Berikan data login berikut ke kasir:
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2.5">
                <div>
                  <span className="text-xs text-muted-foreground">Email Login:</span>
                  <p className="font-mono text-sm font-semibold">{passwordResetSuccess.email}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Password Baru:</span>
                  <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 mt-0.5">
                    <span className="font-mono text-sm font-bold text-primary">
                      {showNewPassword ? passwordResetSuccess.password : "•".repeat(passwordResetSuccess.password.length)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPasswordResetSuccess(null);
                    setNewPasswordInput("");
                  }}
                >
                  Ganti Lagi
                </Button>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => setPasswordTarget(null)}>
                    Tutup
                  </Button>
                  <Button type="button" onClick={() => void copyResetCredentials()} className="gap-1.5">
                    <Copy className="size-4" />
                    Salin Data Login
                  </Button>
                </div>
              </DialogFooter>
            </div>
          ) : passwordTarget ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2 text-primary">
                  <KeyRound className="size-5" />
                  <DialogTitle>Kelola Sandi Akun {passwordTarget.name}</DialogTitle>
                </div>
                <DialogDescription>
                  Atur ulang password kasir tanpa perlu verifikasi email. Sangat cocok jika kasir lupa password autentikasi.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-xs space-y-1">
                <p><span className="font-semibold text-muted-foreground">Karyawan:</span> {passwordTarget.name}</p>
                <p><span className="font-semibold text-muted-foreground">Email:</span> <code className="font-mono">{passwordTarget.email}</code></p>
                <p><span className="font-semibold text-muted-foreground">Role:</span> {roleLabels[passwordTarget.role]}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">Password Baru</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Masukkan password baru (min. 6 karakter)"
                    className="pr-10"
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>

                {/* Quick password suggestions */}
                <div className="pt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Pilihan cepat:</span>
                  <button
                    type="button"
                    onClick={() => setNewPasswordInput("kasir123")}
                    className="inline-flex items-center rounded-lg border border-border bg-card px-2 py-0.5 text-[11px] font-mono hover:bg-accent transition-colors"
                  >
                    kasir123
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPasswordInput("toko1234")}
                    className="inline-flex items-center rounded-lg border border-border bg-card px-2 py-0.5 text-[11px] font-mono hover:bg-accent transition-colors"
                  >
                    toko1234
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPasswordInput(generateRandomPassword())}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 hover:bg-accent transition-colors"
                  >
                    <Sparkles className="size-3" />
                    Acak Sandi
                  </button>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setPasswordTarget(null)}>
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={pendingAction === `${passwordTarget.id}:password` || newPasswordInput.length < 6}
                >
                  {pendingAction === `${passwordTarget.id}:password` ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-1.5" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan & Terapkan Sandi"
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(credentials)} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Password sementara</DialogTitle>
            <DialogDescription>
              Berikan kredensial ini ke karyawan, lalu minta mereka mengganti password setelah login.
            </DialogDescription>
          </DialogHeader>
          {credentials ? (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <div className="rounded-xl border bg-background px-3 py-2 font-mono text-sm">
                  {credentials.email}
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Password sementara</Label>
                <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2">
                  <span className="font-mono text-sm">
                    {showPassword ? credentials.temporaryPassword : "•".repeat(credentials.temporaryPassword.length)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCredentials(null)}>
              Tutup
            </Button>
            <Button type="button" onClick={() => void copyCredentials()}>
              <Copy className="size-4" />
              Salin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(confirmDeactivateUser)} onOpenChange={(open) => !open && setConfirmDeactivateUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nonaktifkan Karyawan</DialogTitle>
            <DialogDescription>
              Nonaktifkan akses {confirmDeactivateUser?.email} dari workspace ini? Karyawan tidak akan bisa login lagi ke warung ini.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => setConfirmDeactivateUser(null)}>
              Batal
            </Button>
            <Button type="button" variant="destructive" onClick={() => void executeDeactivate()}>
              Nonaktifkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(salaryTarget)} onOpenChange={(open) => !open && setSalaryTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSetSalary}>
            <DialogHeader>
              <DialogTitle>Atur Gaji Karyawan</DialogTitle>
              <DialogDescription>
                Tentukan gaji bulanan untuk {salaryTarget?.name}. Nilai ini akan dimasukkan sebagai pengeluaran otomatis di Laporan Keuangan (PCM).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="salary-amount">Nominal Gaji Bulanan (Rp)</Label>
                <Input
                  id="salary-amount"
                  type="text"
                  inputMode="numeric"
                  value={salaryAmount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, "");
                    setSalaryAmount(value ? Number(value).toLocaleString("id-ID") : "");
                  }}
                  placeholder="Misal: 2.000.000"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSalaryTarget(null)}>
                Batal
              </Button>
              <Button type="submit">
                Simpan Gaji
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Tutup Sesi Shift Aktif */}
      <Dialog open={Boolean(closeShiftTarget)} onOpenChange={(open) => !open && setCloseShiftTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 dark:text-rose-400">Tutup Sesi Shift Karyawan</DialogTitle>
            <DialogDescription>
              Tutup sesi shift <strong>{closeShiftTarget?.shiftStatus?.activeShiftName || "berjalan"}</strong> untuk <strong>{closeShiftTarget?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs space-y-1.5 text-foreground">
            <p>Sesi shift ini dibuka sejak: <strong>{formatShiftDate(closeShiftTarget?.shiftStatus?.activeStartedAt)}</strong>.</p>
            <p className="text-muted-foreground">Setelah ditutup, kasir lain akan dapat membuka shift baru tanpa terhalang.</p>
          </div>
          <DialogFooter className="sm:justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => setCloseShiftTarget(null)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pendingAction === `${closeShiftTarget?.id}:closeshift`}
              onClick={() => void handleCloseShiftForUser()}
            >
              {pendingAction === `${closeShiftTarget?.id}:closeshift` ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Menutup Shift...
                </>
              ) : (
                "Tutup Shift Sekarang"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Ubah Nama Akun Karyawan */}
      <Dialog
        open={Boolean(nameTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setNameTarget(null);
          }
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Ubah Nama Akun Karyawan</DialogTitle>
            <DialogDescription>
              Ubah nama akun <strong>{nameTarget?.email}</strong>. Nama ini akan tampil di sesi shift aktif, transaksi kasir, dan laporan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleUpdateName(e)} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-user-name">Nama Lengkap / Akun</Label>
              <Input
                id="edit-user-name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Contoh: Ika Mustika"
                required
                autoFocus
                className="h-11 rounded-2xl"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => setNameTarget(null)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="rounded-2xl"
                disabled={Boolean(pendingAction) || !nameInput.trim()}
              >
                {pendingAction === `${nameTarget?.id}:name` ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Nama"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

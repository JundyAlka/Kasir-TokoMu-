"use client";

import { useState } from "react";
import { Copy, Loader2, Trash2, UserPlus } from "lucide-react";
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
  pengelola_keuangan: "Pengelola Keuangan",
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
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("kasir");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<InviteCredentials | null>(null);

  async function refreshUsers() {
    const response = await fetch("/api/users", { cache: "no-store" });
    const data = (await response.json()) as { users?: WorkspaceUser[] } & ApiError;
    if (!response.ok || !data.users) {
      throw new Error(errorMessage(data, "Gagal memuat daftar karyawan."));
    }
    setUsers(data.users);
  }

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await response.json()) as {
        email?: string;
        temporaryPassword?: string | null;
      } & ApiError;

      if (!response.ok) {
        throw new Error(errorMessage(data, "Gagal mengundang user."));
      }

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

  async function handleDeactivate(user: WorkspaceUser) {
    if (!window.confirm(`Nonaktifkan akses ${user.email} dari workspace ini?`)) {
      return;
    }

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
    <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Daftar karyawan</CardTitle>
          <CardDescription>
            Semua user di workspace yang sama dengan pimpinan warung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
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
                      <TableCell className="font-medium">{user.name}</TableCell>
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
                        <Badge variant={user.isActive ? "default" : "secondary"}>
                          {user.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={!canManage || deletePending || Boolean(pendingAction)}
                          onClick={() => void handleDeactivate(user)}
                        >
                          {deletePending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                          Nonaktifkan
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                <div className="rounded-xl border bg-background px-3 py-2 font-mono text-sm">
                  {credentials.temporaryPassword}
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
    </div>
  );
}

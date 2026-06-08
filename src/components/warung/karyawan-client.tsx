"use client";

import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { RoleGate } from "@/components/role-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Role } from "@/lib/server/rbac";

export type WorkspaceUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

const roleLabels: Record<Role, string> = {
  pimpinan: "Pimpinan",
  pengelola_keuangan: "Pengelola Keuangan",
  kasir: "Kasir",
};

export function KaryawanClient({
  currentRole,
  initialUsers,
}: Readonly<{
  currentRole: Role;
  initialUsers: WorkspaceUser[];
}>) {
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("kasir");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  async function refreshUsers() {
    const response = await fetch("/api/users", { cache: "no-store" });
    const data = (await response.json()) as { users?: WorkspaceUser[]; error?: string };
    if (!response.ok || !data.users) {
      throw new Error(data.error ?? "Gagal memuat daftar karyawan.");
    }
    setUsers(data.users);
  }

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setTemporaryPassword(null);

    try {
      const response = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await response.json()) as {
        tempPassword?: string | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Gagal mengundang user.");
      }

      setEmail("");
      setRole("kasir");
      setTemporaryPassword(data.tempPassword ?? null);
      await refreshUsers();
      toast.success("User berhasil ditambahkan ke workspace.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengundang user.");
    } finally {
      setIsSubmitting(false);
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "pimpinan" ? "default" : "secondary"}>
                      {roleLabels[user.role]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
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
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as Role)}
                  className="h-11 rounded-2xl border border-input bg-card/80 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="kasir">Kasir</option>
                  <option value="pengelola_keuangan">Pengelola Keuangan</option>
                  <option value="pimpinan">Pimpinan</option>
                </select>
              </div>

              <Button type="submit" className="h-11 w-full rounded-2xl" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                Invite user
              </Button>
            </form>

            {temporaryPassword ? (
              <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/8 p-4">
                <p className="text-sm font-medium">Password sementara</p>
                <p className="mt-2 rounded-xl bg-background px-3 py-2 font-mono text-sm">
                  {temporaryPassword}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </RoleGate>
    </div>
  );
}

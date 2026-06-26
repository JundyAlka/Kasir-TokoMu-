"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  assignedUserId: string | null;
  isActive: boolean;
};

type ShiftUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type ShiftDraft = {
  name: string;
  startTime: string;
  endTime: string;
  assignedUserId: string;
};

const emptyDraft: ShiftDraft = {
  name: "",
  startTime: "07:00",
  endTime: "13:30",
  assignedUserId: "none",
};

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => null)) as T & { error?: string } | null;
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Permintaan gagal.");
  }
  return data as T;
}

export function ShiftSettings() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<ShiftUser[]>([]);
  const [draft, setDraft] = useState<ShiftDraft>(emptyDraft);
  const [editing, setEditing] = useState<Record<string, ShiftDraft>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await requestJson<{ shifts: Shift[]; users: ShiftUser[] }>("/api/shifts");
    setShifts(data.shifts);
    setUsers(data.users);
    setEditing(
      Object.fromEntries(
        data.shifts.map((shift) => [
          shift.id,
          {
            name: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            assignedUserId: shift.assignedUserId ?? "none",
          },
        ])
      )
    );
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void load()
        .catch((error) => {
          if (active) {
            toast.error(error instanceof Error ? error.message : "Gagal mengambil shift.");
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [load]);

  async function createShift() {
    if (draft.name.trim().length === 0) {
      toast.error("Nama shift wajib diisi.");
      return;
    }

    const response = await requestJson<{ shift: Shift }>("/api/shifts", {
      method: "POST",
      body: JSON.stringify({
        ...draft,
        assignedUserId: draft.assignedUserId === "none" ? null : draft.assignedUserId,
      }),
    });
    setShifts((current) => [...current, response.shift].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    setEditing((current) => ({
      ...current,
      [response.shift.id]: {
        name: response.shift.name,
        startTime: response.shift.startTime,
        endTime: response.shift.endTime,
        assignedUserId: response.shift.assignedUserId ?? "none",
      },
    }));
    setDraft(emptyDraft);
    toast.success("Shift berhasil ditambahkan.");
  }

  async function saveShift(shiftId: string) {
    const next = editing[shiftId];
    if (!next || next.name.trim().length === 0) {
      toast.error("Nama shift wajib diisi.");
      return;
    }

    const response = await requestJson<{ shift: Shift }>(`/api/shifts/${shiftId}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...next,
        assignedUserId: next.assignedUserId === "none" ? null : next.assignedUserId,
      }),
    });
    setShifts((current) => current.map((shift) => (shift.id === shiftId ? response.shift : shift)));
    toast.success("Shift berhasil diperbarui.");
  }

  async function removeShift(shiftId: string) {
    await requestJson<{ shift: Shift }>(`/api/shifts/${shiftId}`, { method: "DELETE" });
    setShifts((current) => current.filter((shift) => shift.id !== shiftId));
    toast.success("Shift dinonaktifkan.");
  }

  function assignedLabel(userId: string | null) {
    if (!userId) {
      return "Belum ditugaskan";
    }
    const user = users.find((item) => item.id === userId);
    return user ? `${user.name} (${user.role})` : "User tidak ditemukan";
  }

  return (
    <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-2xl">
          <Clock3 className="size-5" />
          Shift Kasir
        </CardTitle>
        <CardDescription>
          Atur jam kerja dan kasir yang otomatis menjadi pencatat transaksi pada rentang shift aktif.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="grid gap-4 rounded-[24px] border border-border/70 bg-card/85 p-4 md:grid-cols-[1fr_150px_150px_220px_auto] md:items-end">
          <div className="grid gap-2">
            <Label htmlFor="shift-name">Nama shift</Label>
            <Input
              id="shift-name"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Pagi"
              className="h-11 rounded-2xl"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shift-start">Mulai</Label>
            <Input
              id="shift-start"
              type="time"
              value={draft.startTime}
              onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}
              className="h-11 rounded-2xl"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shift-end">Selesai</Label>
            <Input
              id="shift-end"
              type="time"
              value={draft.endTime}
              onChange={(event) => setDraft({ ...draft, endTime: event.target.value })}
              className="h-11 rounded-2xl"
            />
          </div>
          <div className="grid gap-2">
            <Label>Kasir</Label>
            <Select value={draft.assignedUserId} onValueChange={(value) => setDraft({ ...draft, assignedUserId: value ?? "none" })}>
              <SelectTrigger className="h-11 w-full rounded-2xl bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Belum ditugaskan</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} - {user.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" className="h-11 rounded-2xl" onClick={() => void createShift()}>
            <Plus className="size-4" />
            Tambah
          </Button>
        </section>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shift</TableHead>
              <TableHead>Jam</TableHead>
              <TableHead>Kasir</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">Memuat shift...</TableCell>
              </TableRow>
            ) : shifts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">Belum ada shift. Tambahkan shift pagi atau siang terlebih dahulu.</TableCell>
              </TableRow>
            ) : (
              shifts.map((shift) => {
                const row = editing[shift.id] ?? {
                  name: shift.name,
                  startTime: shift.startTime,
                  endTime: shift.endTime,
                  assignedUserId: shift.assignedUserId ?? "none",
                };

                return (
                  <TableRow key={shift.id}>
                    <TableCell>
                      <Input
                        value={row.name}
                        onChange={(event) =>
                          setEditing((current) => ({
                            ...current,
                            [shift.id]: { ...row, name: event.target.value },
                          }))
                        }
                        className="h-10 min-w-36 rounded-2xl"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Input
                          type="time"
                          value={row.startTime}
                          onChange={(event) =>
                            setEditing((current) => ({
                              ...current,
                              [shift.id]: { ...row, startTime: event.target.value },
                            }))
                          }
                          className="h-10 w-28 rounded-2xl"
                        />
                        <Input
                          type="time"
                          value={row.endTime}
                          onChange={(event) =>
                            setEditing((current) => ({
                              ...current,
                              [shift.id]: { ...row, endTime: event.target.value },
                            }))
                          }
                          className="h-10 w-28 rounded-2xl"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.assignedUserId}
                        onValueChange={(value) =>
                          setEditing((current) => ({
                            ...current,
                            [shift.id]: { ...row, assignedUserId: value ?? "none" },
                          }))
                        }
                      >
                        <SelectTrigger className="h-10 w-56 rounded-2xl bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Belum ditugaskan</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name} - {user.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-xs text-muted-foreground">{assignedLabel(shift.assignedUserId)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={shift.isActive ? "rounded-full bg-accent text-accent-foreground" : "rounded-full bg-muted text-muted-foreground"}>
                        {shift.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => void saveShift(shift.id)}>
                          <Save className="size-4" />
                          Simpan
                        </Button>
                        <Button type="button" variant="destructive" className="rounded-full" onClick={() => void removeShift(shift.id)}>
                          <Trash2 className="size-4" />
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
  );
}

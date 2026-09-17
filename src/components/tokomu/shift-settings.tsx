"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Clock,
  Clock3,
  Plus,
  Save,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "@/components/providers/app-state-provider";
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
import { cn } from "@/lib/utils";

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

const PRESET_REMINDERS = [15, 30, 45, 60];

function formatDuration(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return "";
  const [sH, sM] = startTime.split(":").map(Number);
  const [eH, eM] = endTime.split(":").map(Number);
  if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return "";
  let totalMin = eH * 60 + eM - (sH * 60 + sM);
  if (totalMin <= 0) totalMin += 24 * 60;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hours} jam ${mins} mnt` : `${hours} jam`;
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Permintaan gagal.");
  }
  return data as T;
}

export function ShiftSettings({ role }: { role: string }) {
  const canEditShift = role === "pimpinan";
  const { settings, updateSettings } = useAppState();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<ShiftUser[]>([]);
  const [draft, setDraft] = useState<ShiftDraft>(emptyDraft);
  const [editing, setEditing] = useState<Record<string, ShiftDraft>>({});
  const [loading, setLoading] = useState(true);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [savingShiftId, setSavingShiftId] = useState<string | null>(null);

  // Reminder settings state
  const [reminderMinutes, setReminderMinutes] = useState<number>(
    settings.shiftCloseWarningMinutes || 30
  );
  const [savingReminder, setSavingReminder] = useState(false);

  useEffect(() => {
    if (settings.shiftCloseWarningMinutes) {
      setReminderMinutes(settings.shiftCloseWarningMinutes);
    }
  }, [settings.shiftCloseWarningMinutes]);

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

  async function handleSaveReminder() {
    if (reminderMinutes < 1 || reminderMinutes > 180) {
      toast.error("Waktu pengingat harus antara 1 sampai 180 menit.");
      return;
    }
    setSavingReminder(true);
    try {
      await updateSettings({
        shiftCloseWarningMinutes: reminderMinutes,
      });
      toast.success("Pengaturan waktu pengingat tutup buku berhasil disimpan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan waktu pengingat.");
    } finally {
      setSavingReminder(false);
    }
  }

  async function createShift() {
    if (draft.name.trim().length === 0) {
      toast.error("Nama shift wajib diisi.");
      return;
    }

    setIsSubmittingNew(true);
    try {
      const response = await requestJson<{ shift: Shift }>("/api/shifts", {
        method: "POST",
        body: JSON.stringify({
          ...draft,
          assignedUserId: draft.assignedUserId === "none" ? null : draft.assignedUserId,
        }),
      });
      setShifts((current) =>
        [...current, response.shift].sort((a, b) => a.startTime.localeCompare(b.startTime))
      );
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menambahkan shift.");
    } finally {
      setIsSubmittingNew(false);
    }
  }

  async function saveShift(shiftId: string) {
    const next = editing[shiftId];
    if (!next || next.name.trim().length === 0) {
      toast.error("Nama shift wajib diisi.");
      return;
    }

    setSavingShiftId(shiftId);
    try {
      const response = await requestJson<{ shift: Shift }>(`/api/shifts/${shiftId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...next,
          assignedUserId: next.assignedUserId === "none" ? null : next.assignedUserId,
        }),
      });
      setShifts((current) =>
        current.map((shift) => (shift.id === shiftId ? response.shift : shift))
      );
      toast.success("Shift berhasil diperbarui.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui shift.");
    } finally {
      setSavingShiftId(null);
    }
  }

  async function removeShift(shiftId: string) {
    if (!confirm("Apakah Anda yakin ingin menonaktifkan shift ini?")) {
      return;
    }
    try {
      await requestJson<{ shift: Shift }>(`/api/shifts/${shiftId}`, { method: "DELETE" });
      setShifts((current) => current.filter((shift) => shift.id !== shiftId));
      toast.success("Shift dinonaktifkan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menonaktifkan shift.");
    }
  }

  const draftDuration = useMemo(
    () => formatDuration(draft.startTime, draft.endTime),
    [draft.startTime, draft.endTime]
  );

  return (
    <div className="space-y-6">
      {/* 1. Pengaturan Pengingat Tutup Buku Shift */}
      <Card className="border-border/60 bg-card/74 shadow-[0_20px_50px_-35px_rgba(66,38,20,0.45)]">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <BellRing className="size-5" />
              </div>
              <div>
                <CardTitle className="font-heading text-xl">
                  Pemberitahuan Tutup Buku Kasir
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Atur waktu pengingat otomatis di pojok kanan keranjang kasir sebelum jam shift
                  berakhir.
                </CardDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className="w-fit rounded-full border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300"
            >
              Aktif: {settings.shiftCloseWarningMinutes || 30} menit sebelum usai
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-[22px] border border-border/70 bg-card/85 p-4 sm:p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <Label htmlFor="reminder-minutes" className="text-sm font-semibold">
                  Waktu Muncul Peringatan di Kasir
                </Label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Peringatan akan tampil otomatis di layar kasir dengan hitung mundur sisa menit
                  serta tombol langsung untuk tutup buku.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {PRESET_REMINDERS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      disabled={!canEditShift}
                      onClick={() => setReminderMinutes(val)}
                      className={cn(
                        "rounded-xl px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                        reminderMinutes === val
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25 font-bold"
                          : "border border-border/80 bg-background/80 hover:bg-accent/40 text-foreground"
                      )}
                    >
                      {val} Menit {val === 30 && "(Default)"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2.5 sm:self-end">
                <div className="relative w-28">
                  <Input
                    id="reminder-minutes"
                    type="number"
                    min={1}
                    max={180}
                    value={reminderMinutes}
                    onChange={(e) => setReminderMinutes(Number(e.target.value) || 0)}
                    disabled={!canEditShift}
                    className="h-11 rounded-2xl pr-11 text-center font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">
                    mnt
                  </span>
                </div>
                <Button
                  type="button"
                  disabled={!canEditShift || savingReminder}
                  onClick={() => void handleSaveReminder()}
                  className="h-11 rounded-2xl px-5 font-semibold cursor-pointer"
                >
                  <Save className="size-4 mr-1.5" />
                  {savingReminder ? "Menyimpan..." : "Simpan Waktu"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Formulir Tambah Shift Baru */}
      <Card className="border-border/60 bg-card/74 shadow-[0_20px_50px_-35px_rgba(66,38,20,0.45)]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Clock3 className="size-5" />
            </div>
            <div>
              <CardTitle className="font-heading text-xl">Tambah Jadwal Shift</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Tentukan jam kerja operasional dan tugaskan kasir yang bertanggung jawab.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-[24px] border border-border/70 bg-card/85 p-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Nama Shift */}
              <div className="space-y-1.5">
                <Label htmlFor="shift-name" className="text-xs font-semibold">
                  Nama Shift
                </Label>
                <Input
                  id="shift-name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  placeholder="Contoh: Shift Pagi"
                  className="h-11 rounded-2xl bg-background"
                  disabled={!canEditShift}
                />
              </div>

              {/* Kasir Ditugaskan */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Kasir Bertugas</Label>
                <Select
                  disabled={!canEditShift}
                  value={draft.assignedUserId}
                  onValueChange={(value) =>
                    setDraft({ ...draft, assignedUserId: value ?? "none" })
                  }
                >
                  <SelectTrigger className="h-11 w-full rounded-2xl bg-background">
                    <SelectValue placeholder="Pilih kasir...">
                      {draft.assignedUserId === "none"
                        ? "Belum ditugaskan"
                        : users.find((u) => u.id === draft.assignedUserId)?.name ?? "Pilih..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Belum ditugaskan</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Jam Mulai */}
              <div className="space-y-1.5">
                <Label htmlFor="shift-start" className="text-xs font-semibold">
                  Jam Mulai
                </Label>
                <div className="relative">
                  <Input
                    id="shift-start"
                    type="time"
                    value={draft.startTime}
                    onChange={(event) =>
                      setDraft({ ...draft, startTime: event.target.value })
                    }
                    className="h-11 rounded-2xl bg-background"
                    disabled={!canEditShift}
                  />
                </div>
              </div>

              {/* Jam Selesai */}
              <div className="space-y-1.5">
                <Label htmlFor="shift-end" className="text-xs font-semibold">
                  Jam Selesai
                </Label>
                <div className="relative">
                  <Input
                    id="shift-end"
                    type="time"
                    value={draft.endTime}
                    onChange={(event) =>
                      setDraft({ ...draft, endTime: event.target.value })
                    }
                    className="h-11 rounded-2xl bg-background"
                    disabled={!canEditShift}
                  />
                </div>
              </div>
            </div>

            {/* Sub-row: Preview Durasi & Tombol Tambah */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border/40">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="size-3.5 text-primary" />
                <span>
                  Estimasi durasi kerja:{" "}
                  <strong className="text-foreground">{draftDuration || "-"}</strong>
                </span>
              </div>
              <Button
                type="button"
                className="h-11 rounded-2xl px-6 w-full sm:w-auto font-semibold shadow-sm shadow-primary/20 cursor-pointer"
                onClick={() => void createShift()}
                disabled={!canEditShift || isSubmittingNew}
              >
                <Plus className="size-4 mr-1.5" />
                {isSubmittingNew ? "Menambahkan..." : "Tambah Shift"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Daftar Shift Aktif */}
      <Card className="border-border/60 bg-card/74 shadow-[0_20px_50px_-35px_rgba(66,38,20,0.45)]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-muted text-foreground">
                <Users className="size-5" />
              </div>
              <div>
                <CardTitle className="font-heading text-xl">Daftar Jadwal Shift</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Kelola jadwal shift harian yang berlaku di toko Anda.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="rounded-full px-3 py-1 font-semibold">
              {shifts.length} Shift Terdaftar
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Memuat daftar shift...
            </div>
          ) : shifts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <Clock3 className="size-10 stroke-1 text-muted-foreground/60 mb-2" />
              <p className="font-semibold text-foreground">Belum ada shift terdaftar</p>
              <p className="text-xs max-w-sm mt-1">
                Gunakan formulir di atas untuk menambahkan jadwal shift pagi, siang, atau malam.
              </p>
            </div>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-1 lg:grid-cols-2">
              {shifts.map((shift) => {
                const row = editing[shift.id] ?? {
                  name: shift.name,
                  startTime: shift.startTime,
                  endTime: shift.endTime,
                  assignedUserId: shift.assignedUserId ?? "none",
                };
                const rowDuration = formatDuration(row.startTime, row.endTime);
                const assignedUser = users.find((u) => u.id === row.assignedUserId);
                const isSaving = savingShiftId === shift.id;

                return (
                  <div
                    key={shift.id}
                    className="rounded-[22px] border border-border/70 bg-card/90 p-4 sm:p-5 shadow-sm transition-all hover:border-primary/40 space-y-3.5"
                  >
                    {/* Header Card Shift */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {canEditShift ? (
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                              Nama Shift
                            </Label>
                            <Input
                              value={row.name}
                              onChange={(e) =>
                                setEditing((cur) => ({
                                  ...cur,
                                  [shift.id]: { ...row, name: e.target.value },
                                }))
                              }
                              className="h-9 font-heading font-semibold text-base rounded-xl bg-background"
                            />
                          </div>
                        ) : (
                          <p className="font-heading text-lg font-bold text-foreground truncate">
                            {shift.name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          className={cn(
                            "rounded-full text-xs font-semibold px-2.5 py-0.5",
                            shift.isActive
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {shift.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </div>
                    </div>

                    {/* Jam Mulai - Selesai & Durasi */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                          <Clock className="size-3 text-muted-foreground" /> Jam Mulai
                        </Label>
                        <Input
                          type="time"
                          value={row.startTime}
                          disabled={!canEditShift}
                          onChange={(e) =>
                            setEditing((cur) => ({
                              ...cur,
                              [shift.id]: { ...row, startTime: e.target.value },
                            }))
                          }
                          className="h-9 rounded-xl bg-background text-sm font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                          <Clock className="size-3 text-muted-foreground" /> Jam Selesai
                        </Label>
                        <Input
                          type="time"
                          value={row.endTime}
                          disabled={!canEditShift}
                          onChange={(e) =>
                            setEditing((cur) => ({
                              ...cur,
                              [shift.id]: { ...row, endTime: e.target.value },
                            }))
                          }
                          className="h-9 rounded-xl bg-background text-sm font-semibold"
                        />
                      </div>
                    </div>

                    {/* Kasir Ditugaskan */}
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                        <UserCheck className="size-3 text-muted-foreground" /> Kasir Penanggung Jawab
                      </Label>
                      <Select
                        disabled={!canEditShift}
                        value={row.assignedUserId}
                        onValueChange={(val) =>
                          setEditing((cur) => ({
                            ...cur,
                            [shift.id]: { ...row, assignedUserId: val ?? "none" },
                          }))
                        }
                      >
                        <SelectTrigger className="h-9 rounded-xl bg-background text-xs sm:text-sm">
                          <SelectValue placeholder="Pilih kasir">
                            {row.assignedUserId === "none"
                              ? "Belum ditugaskan"
                              : assignedUser
                              ? `${assignedUser.name} (${assignedUser.role})`
                              : "Pilih kasir..."}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Belum ditugaskan</SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name} ({u.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Footer Card: Info Durasi & Tombol Aksi */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <span className="text-xs text-muted-foreground font-medium">
                        Durasi: <strong className="text-foreground">{rowDuration}</strong>
                      </span>
                      <div className="flex items-center gap-2">
                        {canEditShift ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-xl text-xs font-semibold px-3 cursor-pointer"
                              disabled={isSaving}
                              onClick={() => void saveShift(shift.id)}
                            >
                              <Save className="size-3.5 mr-1" />
                              {isSaving ? "Menyimpan..." : "Simpan"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              className="h-8 rounded-xl text-xs font-semibold px-3 cursor-pointer"
                              onClick={() => void removeShift(shift.id)}
                            >
                              <Trash2 className="size-3.5 mr-1" />
                              Nonaktifkan
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            Akses dibatasi
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

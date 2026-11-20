"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  QrCode,
  RefreshCw,
  Save,
  Send,
  Terminal,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface WhatsAppReportConfigDto {
  workspaceOwnerId: string;
  enabled: boolean;
  baseUrl: string;
  apiKeyMasked: string;
  hasApiKey: boolean;
  sessionId: string;
  recipients: string[];
  dailyEnabled: boolean;
  dailyHour: number;
  attachDailyPdf: boolean;
  dailyWaitShiftClose: boolean;
  weeklyEnabled: boolean;
  weeklyDayOfWeek: number;
  weeklyHour: number;
  attachWeeklyPdf: boolean;
  monthlyEnabled: boolean;
  monthlyDayOfMonth: number;
  monthlyHour: number;
  attachMonthlyPdf: boolean;
  lastDailyPeriodSent: string | null;
  lastWeeklyPeriodSent: string | null;
  lastMonthlyPeriodSent: string | null;
  lastError: string | null;
  updatedAt: string;
}

interface WhatsAppDispatchLogDto {
  id: string;
  triggerType: string;
  reportMode: string;
  periodKey: string;
  recipients: string[];
  status: string;
  summaryText: string;
  pdfAttached: boolean;
  errorMessage: string | null;
  createdAt: string;
}

interface OpenWaSessionState {
  exists: boolean;
  sessionId: string;
  status: string;
  connected: boolean;
  phoneNumber: string | null;
  pushName: string | null;
}

const WEEKDAY_OPTIONS = [
  { value: "0", label: "Minggu" },
  { value: "1", label: "Senin" },
  { value: "2", label: "Selasa" },
  { value: "3", label: "Rabu" },
  { value: "4", label: "Kamis" },
  { value: "5", label: "Jumat" },
  { value: "6", label: "Sabtu" },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, "0")}:00 WIB`,
}));

const MONTH_DAY_OPTIONS = Array.from({ length: 28 }, (_, idx) => ({
  value: String(idx + 1),
  label: `Tanggal ${idx + 1}`,
}));

function formatTriggerLabel(triggerType: string) {
  switch (triggerType) {
    case "auto_daily":
      return "Auto Harian";
    case "auto_weekly":
      return "Auto Mingguan";
    case "auto_monthly":
      return "Auto Bulanan";
    case "manual":
      return "Kirim Manual";
    case "test":
      return "Uji Koneksi";
    default:
      return triggerType;
  }
}

export function WhatsAppReportSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sendingAction, setSendingAction] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState("http://localhost:2785");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [sessionId, setSessionId] = useState("tokomu-wa");
  const [recipientsText, setRecipientsText] = useState("");

  const [dailyEnabled, setDailyEnabled] = useState(true);
  const [dailyHour, setDailyHour] = useState("19");
  const [attachDailyPdf, setAttachDailyPdf] = useState(true);
  const [dailyWaitShiftClose, setDailyWaitShiftClose] = useState(true);
  const [manualReportDate, setManualReportDate] = useState(() =>
    new Date().toLocaleDateString("en-CA")
  );

  const [weeklyEnabled, setWeeklyEnabled] = useState(true);
  const [weeklyDayOfWeek, setWeeklyDayOfWeek] = useState("1");
  const [weeklyHour, setWeeklyHour] = useState("8");
  const [attachWeeklyPdf, setAttachWeeklyPdf] = useState(true);

  const [monthlyEnabled, setMonthlyEnabled] = useState(true);
  const [monthlyDayOfMonth, setMonthlyDayOfMonth] = useState("1");
  const [monthlyHour, setMonthlyHour] = useState("8");
  const [attachMonthlyPdf, setAttachMonthlyPdf] = useState(true);

  const [lastDailySent, setLastDailySent] = useState<string | null>(null);
  const [lastWeeklySent, setLastWeeklySent] = useState<string | null>(null);
  const [lastMonthlySent, setLastMonthlySent] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const [sessionState, setSessionState] = useState<OpenWaSessionState | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [logs, setLogs] = useState<WhatsAppDispatchLogDto[]>([]);

  const applyConfig = useCallback((cfg: WhatsAppReportConfigDto) => {
    setEnabled(cfg.enabled);
    setBaseUrl(cfg.baseUrl);
    setHasApiKey(cfg.hasApiKey);
    setApiKeyMasked(cfg.apiKeyMasked);
    setApiKeyInput("");
    setClearApiKey(false);
    setSessionId(cfg.sessionId);
    setRecipientsText((cfg.recipients ?? []).join("\n"));
    setDailyEnabled(cfg.dailyEnabled ?? true);
    setDailyHour(String(cfg.dailyHour ?? 19));
    setAttachDailyPdf(cfg.attachDailyPdf ?? true);
    setDailyWaitShiftClose(cfg.dailyWaitShiftClose ?? true);
    setWeeklyEnabled(cfg.weeklyEnabled);
    setWeeklyDayOfWeek(String(cfg.weeklyDayOfWeek));
    setWeeklyHour(String(cfg.weeklyHour));
    setAttachWeeklyPdf(cfg.attachWeeklyPdf ?? true);
    setMonthlyEnabled(cfg.monthlyEnabled);
    setMonthlyDayOfMonth(String(cfg.monthlyDayOfMonth));
    setMonthlyHour(String(cfg.monthlyHour));
    setAttachMonthlyPdf(cfg.attachMonthlyPdf);
    setLastDailySent(cfg.lastDailyPeriodSent ?? null);
    setLastWeeklySent(cfg.lastWeeklyPeriodSent);
    setLastMonthlySent(cfg.lastMonthlyPeriodSent);
    setLastError(cfg.lastError);
  }, []);

  const fetchConfigAndLogs = useCallback(
    async (withSpinner = true) => {
      if (withSpinner) {
        setLoading(true);
      }
      try {
        const res = await fetch("/api/whatsapp/config", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Gagal memuat pengaturan WhatsApp.");
        }
        applyConfig(data.config);
        setLogs(Array.isArray(data.logs) ? data.logs : []);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal memuat pengaturan WhatsApp."
        );
      } finally {
        setLoading(false);
      }
    },
    [applyConfig]
  );

  const checkSession = useCallback(
    async (action: "status" | "start" | "qr" = "status") => {
      setSessionBusy(true);
      setSessionError(null);
      try {
        const res = await fetch("/api/whatsapp/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            baseUrl,
            apiKey: clearApiKey ? "" : apiKeyInput.trim() || "__KEEP__",
            sessionId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Gagal memeriksa session OpenWA.");
        }
        setSessionState(data.session ?? null);
        setQrCode(data.qr?.qrCode ?? null);
        if (action === "start" && data.session?.connected) {
          toast.success("Session WhatsApp sudah aktif dan terhubung.");
        } else if (action === "start" && data.qr?.qrCode) {
          toast.info("QR Code siap. Silakan scan dengan WhatsApp di HP Anda.");
        }
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Server OpenWA tidak terjangkau.";
        setSessionError(msg);
        setSessionState(null);
        setQrCode(null);
        if (action !== "status") {
          toast.error(msg);
        }
      } finally {
        setSessionBusy(false);
      }
    },
    [apiKeyInput, baseUrl, clearApiKey, sessionId]
  );

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      await fetchConfigAndLogs(false);
      if (cancelled) return;
      try {
        const res = await fetch("/api/whatsapp/session?includeQr=1", {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setSessionState(data.session ?? null);
          setQrCode(data.qr?.qrCode ?? null);
        } else {
          setSessionError(data.error ?? "OpenWA belum berjalan.");
        }
      } catch {
        if (!cancelled) {
          setSessionError("Server OpenWA belum terjangkau.");
        }
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [fetchConfigAndLogs]);

  async function saveConfig(): Promise<boolean> {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        enabled,
        baseUrl,
        sessionId,
        recipients: recipientsText,
        dailyEnabled,
        dailyHour: Number(dailyHour),
        attachDailyPdf,
        dailyWaitShiftClose,
        weeklyEnabled,
        weeklyDayOfWeek: Number(weeklyDayOfWeek),
        weeklyHour: Number(weeklyHour),
        attachWeeklyPdf,
        monthlyEnabled,
        monthlyDayOfMonth: Number(monthlyDayOfMonth),
        monthlyHour: Number(monthlyHour),
        attachMonthlyPdf,
      };
      if (clearApiKey) {
        payload.clearApiKey = true;
      } else if (apiKeyInput.trim()) {
        payload.apiKey = apiKeyInput.trim();
      }

      const res = await fetch("/api/whatsapp/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan konfigurasi OpenWA.");
      }
      applyConfig(data.config);
      toast.success("Konfigurasi OpenWA & jadwal laporan berhasil disimpan.");
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan konfigurasi."
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await saveConfig();
  }

  async function handleSend(action: "test" | "harian" | "mingguan" | "bulanan") {
    setSendingAction(action);
    try {
      const saved = await saveConfig();
      if (!saved) return;

      const body =
        action === "test"
          ? { action: "test" }
          : {
              action: "report",
              mode: action,
              period: action === "harian" ? manualReportDate : undefined,
              attachPdf:
                action === "harian"
                  ? attachDailyPdf
                  : action === "mingguan"
                    ? attachWeeklyPdf
                    : attachMonthlyPdf,
            };

      const res = await fetch("/api/whatsapp/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengirim pesan WhatsApp.");
      }
      toast.success(
        action === "test"
          ? "Pesan uji coba terkirim ke WhatsApp."
          : `Laporan ${action} berhasil dikirim ke WhatsApp.`
      );
      await fetchConfigAndLogs();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal mengirim ke WhatsApp."
      );
      await fetchConfigAndLogs();
    } finally {
      setSendingAction(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Memuat pengaturan integrasi OpenWA...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 font-heading text-2xl">
                <MessageSquare className="size-6 text-primary" />
                Integrasi WhatsApp (OpenWA)
              </CardTitle>
              <CardDescription>
                Hubungkan WarungOS dengan server OpenWA Anda untuk mengirim ringkasan laporan keuangan harian, mingguan, dan bulanan secara otomatis.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant={enabled ? "default" : "outline"}
              className="w-fit rounded-full"
              onClick={() => setEnabled((prev) => !prev)}
            >
              {enabled ? "Auto Laporan: AKTIF" : "Auto Laporan: NONAKTIF"}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            {/* Connection & Session Panel */}
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
                <h3 className="font-semibold">1. Koneksi Server OpenWA</h3>

                <div className="grid gap-2">
                  <Label htmlFor="openwa-base-url">URL Gateway OpenWA</Label>
                  <Input
                    id="openwa-base-url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://localhost:2785"
                    className="h-11 rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    Default port OpenWA adalah <code>2785</code> (misal{" "}
                    <code>http://localhost:2785</code> atau URL server OpenWA Anda).
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="openwa-session-id">Session ID</Label>
                    <Input
                      id="openwa-session-id"
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      placeholder="tokomu-wa"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="openwa-api-key">
                      X-API-Key {hasApiKey && !clearApiKey ? `(${apiKeyMasked})` : ""}
                    </Label>
                    <Input
                      id="openwa-api-key"
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => {
                        setApiKeyInput(e.target.value);
                        setClearApiKey(false);
                      }}
                      placeholder={
                        hasApiKey && !clearApiKey
                          ? "Kosongkan agar pakai key tersimpan"
                          : "Masukkan API_KEY OpenWA"
                      }
                      className="h-11 rounded-xl"
                    />
                    {hasApiKey && !clearApiKey ? (
                      <button
                        type="button"
                        className="w-fit text-xs text-muted-foreground underline hover:text-destructive"
                        onClick={() => setClearApiKey(true)}
                      >
                        Hapus API key tersimpan
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="openwa-recipients">
                    Nomor / Grup WhatsApp Tujuan
                  </Label>
                  <Textarea
                    id="openwa-recipients"
                    value={recipientsText}
                    onChange={(e) => setRecipientsText(e.target.value)}
                    rows={3}
                    placeholder={"081234567890\n628987654321@c.us\n120363012345678@g.us"}
                    className="rounded-xl font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Pisahkan beberapa nomor dengan Enter atau koma. Nomor berawalan{" "}
                    <code>08...</code> otomatis diubah menjadi{" "}
                    <code>628...@c.us</code>. Untuk grup WhatsApp, gunakan ID akhiran{" "}
                    <code>@g.us</code>.
                  </p>
                </div>
              </div>

              {/* Live Session & QR Card */}
              <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-border/70 bg-card/70 p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">Status Session & Pairing QR</h3>
                    {sessionState?.connected ? (
                      <Badge className="gap-1 bg-emerald-600 text-white">
                        <Wifi className="size-3.5" />
                        Terhubung
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <WifiOff className="size-3.5" />
                        {sessionState?.status ?? "Belum Terkoneksi"}
                      </Badge>
                    )}
                  </div>

                  {sessionState?.connected ? (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                      <p className="font-medium text-emerald-700 dark:text-emerald-300">
                        WhatsApp siap mengirim laporan!
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Session: <code>{sessionState.sessionId}</code>
                        {sessionState.pushName ? ` • Akun: ${sessionState.pushName}` : ""}
                        {sessionState.phoneNumber
                          ? ` • ID: ${sessionState.phoneNumber}`
                          : ""}
                      </p>
                    </div>
                  ) : null}

                  {sessionError ? (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                      {sessionError}
                    </div>
                  ) : null}

                  {qrCode ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          qrCode.startsWith("data:")
                            ? qrCode
                            : `data:image/png;base64,${qrCode}`
                        }
                        alt="QR Code OpenWA"
                        className="size-48 object-contain"
                      />
                      <p className="text-center text-xs text-slate-600">
                        Buka WhatsApp di HP &gt; Perangkat Tertaut &gt; Tautkan Perangkat, lalu scan QR ini.
                      </p>
                    </div>
                  ) : !sessionState?.connected ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 px-4 py-6 text-center text-xs text-muted-foreground">
                      <QrCode className="mb-2 size-8 opacity-60" />
                      Klik <strong>Mulai / Scan QR</strong> untuk menyalakan session{" "}
                      <code>{sessionId || "tokomu-wa"}</code> di OpenWA.
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={sessionBusy}
                    onClick={() => void checkSession("status")}
                    className="rounded-xl px-2 text-xs h-9 font-medium"
                  >
                    {sessionBusy ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 size-3.5" />
                    )}
                    Cek Status
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={sessionBusy}
                    onClick={() => void checkSession("start")}
                    className="rounded-xl px-2 text-xs h-9 font-medium"
                  >
                    <QrCode className="mr-1.5 size-3.5" />
                    Mulai QR
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={sessionBusy}
                    onClick={() => void checkSession("qr")}
                    className="rounded-xl px-2 text-xs h-9 font-medium"
                  >
                    <RefreshCw className="mr-1.5 size-3.5" />
                    Refresh
                  </Button>
                </div>
              </div>
            </div>

            {/* Schedule Configuration */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Card 1: Harian */}
              <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card/60 p-4 transition-all shadow-sm">
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="size-4 text-primary shrink-0" />
                      <h3 className="text-sm font-semibold truncate sm:text-base">2. Laporan Harian</h3>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={dailyEnabled ? "default" : "outline"}
                      className="h-7 px-3 rounded-full text-xs font-semibold shrink-0"
                      onClick={() => setDailyEnabled((v) => !v)}
                    >
                      {dailyEnabled ? "Aktif" : "Mati"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Jam Kirim (WIB)</Label>
                      <Select
                        value={dailyHour}
                        onValueChange={(val) => val && setDailyHour(val)}
                      >
                        <SelectTrigger className="w-full h-10 rounded-xl text-xs font-medium">
                          <SelectValue>
                            {HOUR_OPTIONS.find((opt) => opt.value === dailyHour)?.label ??
                              `${String(dailyHour).padStart(2, "0")}:00 WIB`}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {HOUR_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Aturan Shift</Label>
                      <Select
                        value={dailyWaitShiftClose ? "shift_close" : "exact_hour"}
                        onValueChange={(val) => setDailyWaitShiftClose(val === "shift_close")}
                      >
                        <SelectTrigger className="w-full h-10 rounded-xl text-xs font-medium">
                          <SelectValue>
                            {dailyWaitShiftClose ? "Setelah Shift" : "Sesuai Jam"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="shift_close">Setelah Shift</SelectItem>
                          <SelectItem value="exact_hour">Sesuai Jam</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2.5 space-y-3 border-t border-border/40">
                  <p className="text-xs text-muted-foreground min-h-[32px] leading-relaxed">
                    {dailyWaitShiftClose
                      ? `Dikirim mulai ${String(dailyHour).padStart(2, "0")}:00 WIB setelah shift ditutup.`
                      : `Dikirim otomatis setiap hari jam ${String(dailyHour).padStart(2, "0")}:00 WIB.`}
                    {lastDailySent ? ` (Terkirim: ${lastDailySent})` : ""}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant={attachDailyPdf ? "default" : "outline"}
                    className="w-full h-9 rounded-xl text-xs font-semibold shadow-none"
                    onClick={() => setAttachDailyPdf((v) => !v)}
                  >
                    {attachDailyPdf ? "✓ PDF Harian: Dilampirkan" : "○ PDF Harian: Teks Saja"}
                  </Button>
                </div>
              </div>

              {/* Card 2: Mingguan */}
              <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card/60 p-4 transition-all shadow-sm">
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="size-4 text-primary shrink-0" />
                      <h3 className="text-sm font-semibold truncate sm:text-base">3. Laporan Mingguan</h3>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={weeklyEnabled ? "default" : "outline"}
                      className="h-7 px-3 rounded-full text-xs font-semibold shrink-0"
                      onClick={() => setWeeklyEnabled((v) => !v)}
                    >
                      {weeklyEnabled ? "Aktif" : "Mati"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Setiap Hari</Label>
                      <Select
                        value={weeklyDayOfWeek}
                        onValueChange={(val) => val && setWeeklyDayOfWeek(val)}
                      >
                        <SelectTrigger className="w-full h-10 rounded-xl text-xs font-medium">
                          <SelectValue>
                            {WEEKDAY_OPTIONS.find((opt) => opt.value === weeklyDayOfWeek)?.label ??
                              weeklyDayOfWeek}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {WEEKDAY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Jam Kirim (WIB)</Label>
                      <Select
                        value={weeklyHour}
                        onValueChange={(val) => val && setWeeklyHour(val)}
                      >
                        <SelectTrigger className="w-full h-10 rounded-xl text-xs font-medium">
                          <SelectValue>
                            {HOUR_OPTIONS.find((opt) => opt.value === weeklyHour)?.label ??
                              `${String(weeklyHour).padStart(2, "0")}:00 WIB`}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {HOUR_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2.5 space-y-3 border-t border-border/40">
                  <p className="text-xs text-muted-foreground min-h-[32px] leading-relaxed">
                    {weeklyDayOfWeek === "0"
                      ? "Hari Minggu kirim rekap pekan yang berakhir hari ini."
                      : "Kirim rekap pekan yang baru selesai (Senin–Minggu lalu)."}
                    {lastWeeklySent ? ` (Terkirim: ${lastWeeklySent})` : ""}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant={attachWeeklyPdf ? "default" : "outline"}
                    className="w-full h-9 rounded-xl text-xs font-semibold shadow-none"
                    onClick={() => setAttachWeeklyPdf((v) => !v)}
                  >
                    {attachWeeklyPdf ? "✓ PDF Mingguan: Dilampirkan" : "○ PDF Mingguan: Teks Saja"}
                  </Button>
                </div>
              </div>

              {/* Card 3: Bulanan */}
              <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card/60 p-4 transition-all shadow-sm">
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="size-4 text-primary shrink-0" />
                      <h3 className="text-sm font-semibold truncate sm:text-base">4. Laporan Bulanan</h3>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={monthlyEnabled ? "default" : "outline"}
                      className="h-7 px-3 rounded-full text-xs font-semibold shrink-0"
                      onClick={() => setMonthlyEnabled((v) => !v)}
                    >
                      {monthlyEnabled ? "Aktif" : "Mati"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Setiap Tanggal</Label>
                      <Select
                        value={monthlyDayOfMonth}
                        onValueChange={(val) => val && setMonthlyDayOfMonth(val)}
                      >
                        <SelectTrigger className="w-full h-10 rounded-xl text-xs font-medium">
                          <SelectValue>
                            {MONTH_DAY_OPTIONS.find((opt) => opt.value === monthlyDayOfMonth)
                              ?.label ?? `Tanggal ${monthlyDayOfMonth}`}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {MONTH_DAY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Jam Kirim (WIB)</Label>
                      <Select
                        value={monthlyHour}
                        onValueChange={(val) => val && setMonthlyHour(val)}
                      >
                        <SelectTrigger className="w-full h-10 rounded-xl text-xs font-medium">
                          <SelectValue>
                            {HOUR_OPTIONS.find((opt) => opt.value === monthlyHour)?.label ??
                              `${String(monthlyHour).padStart(2, "0")}:00 WIB`}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {HOUR_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2.5 space-y-3 border-t border-border/40">
                  <p className="text-xs text-muted-foreground min-h-[32px] leading-relaxed">
                    {Number(monthlyDayOfMonth) <= 15
                      ? "Tgl 1–15 kirim rekap lengkap bulan sebelumnya."
                      : "Tgl 16–28 kirim rekap bulan berjalan saat ini."}
                    {lastMonthlySent ? ` (Terkirim: ${lastMonthlySent})` : ""}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant={attachMonthlyPdf ? "default" : "outline"}
                    className="w-full h-9 rounded-xl text-xs font-semibold shadow-none"
                    onClick={() => setAttachMonthlyPdf((v) => !v)}
                  >
                    {attachMonthlyPdf ? "✓ PDF Bulanan: Dilampirkan" : "○ PDF Bulanan: Teks Saja"}
                  </Button>
                </div>
              </div>
            </div>

            {lastError ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <strong>Catatan Error Terakhir:</strong> {lastError}
              </div>
            ) : null}

            {/* Action Buttons & Manual Dispatch Toolbar */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl h-11 px-5 font-semibold shadow-sm"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 size-4" />
                    )}
                    Simpan Pengaturan OpenWA
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={sendingAction !== null || saving}
                    onClick={() => void handleSend("test")}
                    className="rounded-xl h-11 px-4 font-medium"
                  >
                    {sendingAction === "test" ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 size-4 text-emerald-600" />
                    )}
                    Kirim Uji Coba WA
                  </Button>
                </div>
              </div>

              {/* Dedicated Toolbar for Manual Dispatch & PDF Download */}
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <Send className="size-4 text-primary" />
                    <span className="text-xs sm:text-sm font-semibold">
                      Uji Kirim Manual &amp; Unduh PDF
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-background/90 px-3 py-1.5 shadow-sm">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                      Tgl Acuan:
                    </span>
                    <Input
                      type="date"
                      value={manualReportDate}
                      onChange={(e) => setManualReportDate(e.target.value)}
                      className="h-6 w-32 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={sendingAction !== null || saving}
                    onClick={() => void handleSend("harian")}
                    className="rounded-xl h-10 text-xs font-semibold shadow-none"
                  >
                    {sendingAction === "harian" ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <Send className="mr-1.5 size-3.5" />
                    )}
                    Kirim Harian
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={sendingAction !== null || saving}
                    onClick={() => void handleSend("mingguan")}
                    className="rounded-xl h-10 text-xs font-semibold shadow-none"
                  >
                    {sendingAction === "mingguan" ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <Send className="mr-1.5 size-3.5" />
                    )}
                    Kirim Mingguan
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={sendingAction !== null || saving}
                    onClick={() => void handleSend("bulanan")}
                    className="rounded-xl h-10 text-xs font-semibold shadow-none"
                  >
                    {sendingAction === "bulanan" ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <Send className="mr-1.5 size-3.5" />
                    )}
                    Kirim Bulanan
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const periodQuery = manualReportDate
                        ? `&period=${manualReportDate}`
                        : "";
                      window.open(
                        `/api/reports/profit-loss/pdf?mode=harian${periodQuery}&download=1`,
                        "_blank",
                        "noopener,noreferrer"
                      );
                    }}
                    className="rounded-xl h-10 text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10"
                  >
                    <Download className="mr-1.5 size-3.5" />
                    Unduh PDF Harian
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                <strong>Informasi Real-time Laporan Harian:</strong> Laporan harian membaca transaksi kasir secara langsung (live) meski shift belum tutup buku. Jika belum ada transaksi pada tanggal yang dipilih, omzet tercatat Rp 0 (normal dan aman).
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Terminal className="size-5 text-primary" />
            Panduan Menjalankan Gateway OpenWA
          </CardTitle>
          <CardDescription>
            Jalankan container OpenWA di komputer/server yang sama atau di VPS agar WarungOS bisa mengirim pesan WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <pre className="overflow-x-auto rounded-xl bg-muted/60 p-3 font-mono text-xs leading-relaxed">
{`git clone https://github.com/rmyndharis/OpenWA.git
cd OpenWA
# Buat .env berisi API_KEY=rahasia-tokomu dan PORT=2785
docker compose up -d`}
          </pre>
          <p className="text-muted-foreground">
            Scheduler otomatis aktif di dalam server Next.js (cek setiap 5 menit WIB) dan juga dapat dipicu lewat cron eksternal ke endpoint{" "}
            <code>GET /api/cron/whatsapp-reports</code> dengan header{" "}
            <code>Authorization: Bearer CRON_SECRET</code>.
          </p>
        </CardContent>
      </Card>

      {/* Dispatch History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Riwayat Pengiriman WhatsApp</CardTitle>
            <CardDescription>20 pengiriman terakhir dari sistem otomatis maupun manual.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => void fetchConfigAndLogs()}
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            Muat Ulang
          </Button>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="rounded-xl bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              Belum ada riwayat pengiriman laporan ke WhatsApp.
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          log.status === "sent"
                            ? "default"
                            : log.status === "partial"
                              ? "outline"
                              : "destructive"
                        }
                      >
                        {log.status === "sent"
                          ? "Terkirim"
                          : log.status === "partial"
                            ? "Sebagian"
                            : "Gagal"}
                      </Badge>
                      <span className="text-sm font-semibold">
                        {formatTriggerLabel(log.triggerType)} ({log.periodKey})
                      </span>
                      {log.pdfAttached ? (
                        <Badge variant="outline" className="text-[11px]">
                          + PDF
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tujuan: {log.recipients.join(", ")}
                    </p>
                    {log.errorMessage ? (
                      <p className="text-xs text-destructive">{log.errorMessage}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Jakarta",
                    }).format(new Date(log.createdAt))}{" "}
                    WIB
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


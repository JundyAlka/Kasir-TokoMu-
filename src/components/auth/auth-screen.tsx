"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Store,
  ShoppingCart,
  Package,
  CreditCard,
  Users,
  BarChart3,
  Bot,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type AuthMode = "signin" | "signup";

const FEATURES = [
  {
    icon: ShoppingCart,
    label: "Kasir & Transaksi",
    desc: "POS touch-friendly, uang pas otomatis, QRIS & transfer",
  },
  {
    icon: Package,
    label: "Manajemen Stok",
    desc: "Multi-kategori, notifikasi kritis, restok & ekspor Excel",
  },
  {
    icon: CreditCard,
    label: "Buku Hutang",
    desc: "Tracking cicilan, jatuh tempo, kirim tagihan via WhatsApp",
  },
  {
    icon: Users,
    label: "Investor & Bagi Hasil",
    desc: "Distribusi profit otomatis sesuai persentase akad per bulan",
  },
  {
    icon: BarChart3,
    label: "Laporan Keuangan",
    desc: "Rekap harian–bulanan, ekspor PDF & CSV siap cetak",
  },
  {
    icon: Bot,
    label: "Asisten AI",
    desc: "Analisis penjualan, saran strategi, dan OCR struk belanja",
  },
];

export function AuthScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending: isSessionPending } = useSession();
  const queryMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const authError = searchParams.get("error");
  const [mode, setMode] = useState<AuthMode>(queryMode);
  const [isLoading, setIsLoading] = useState(false);
  const [signInForm, setSignInForm] = useState({ email: "", password: "" });
  const [signUpForm, setSignUpForm] = useState({ name: "", email: "", password: "" });

  useEffect(() => {
    if (!isSessionPending && session) {
      router.replace("/dashboard");
    }
  }, [isSessionPending, router, session]);

  useEffect(() => {
    setMode(queryMode);
  }, [queryMode]);

  return (
    <div className="relative min-h-screen bg-background">
      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-10 lg:top-6 lg:right-6">
        <ThemeToggle variant="default" className="bg-card/85 shadow-sm backdrop-blur" />
      </div>

      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[1.1fr_0.9fr]">

        {/* ── Left panel ── */}
        <div className="relative hidden flex-col overflow-hidden bg-[linear-gradient(145deg,#1e0f08,#3a2218,#5a3020)] lg:flex">
          {/* Ambient blobs */}
          <div className="pointer-events-none absolute -top-32 -left-32 size-[480px] rounded-full bg-amber-600/20 blur-[120px]" />
          <div className="pointer-events-none absolute bottom-0 right-0 size-[320px] rounded-full bg-orange-500/15 blur-[100px]" />

          <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <Store className="size-5 text-amber-300" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300/80">
                  TokoMu
                </p>
                <p className="text-xs text-white/50">Retail Operating System</p>
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-5">
              <h1 className="font-heading text-4xl font-semibold leading-[1.18] tracking-tight text-white xl:text-5xl">
                Semua yang kamu butuhkan untuk mengelola toko.
              </h1>
              <p className="max-w-md text-base leading-7 text-white/60">
                Dari kasir harian hingga laporan keuangan bulanan — satu workspace, semua beres.
              </p>
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-3">
              {FEATURES.map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="group rounded-2xl border border-white/8 bg-white/5 p-4 transition-colors hover:bg-white/8"
                >
                  <div className="mb-2.5 flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-amber-400/15">
                      <Icon className="size-3.5 text-amber-300" />
                    </div>
                    <p className="text-[13px] font-medium text-white">{label}</p>
                  </div>
                  <p className="text-[12px] leading-5 text-white/50">{desc}</p>
                </div>
              ))}
            </div>

            {/* Bottom tag */}
            <div className="flex items-center gap-2 text-xs text-white/35">
              <CheckCircle2 className="size-3.5 text-emerald-400/70" />
              Aman · Cepat · Tanpa biaya langganan
            </div>
          </div>
        </div>

        {/* ── Right panel — Auth form ── */}
        <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 lg:px-10">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/15">
              <Store className="size-4 text-primary" />
            </div>
            <span className="font-heading text-lg font-semibold">TokoMu</span>
          </div>

          <div className="w-full max-w-[400px] space-y-6">
            {/* Heading */}
            <div className="space-y-1">
              <h2 className="font-heading text-2xl font-semibold tracking-tight">
                {mode === "signin" ? "Masuk ke akun" : "Buat akun baru"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {mode === "signin"
                  ? "Selamat datang kembali. Masukkan email dan kata sandi."
                  : "Daftarkan diri untuk mulai mengelola toko kamu."}
              </p>
            </div>

            {/* Error banner */}
            {authError ? (
              <div className="flex items-start gap-2.5 rounded-2xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                <span className="mt-px">⚠</span>
                <span>{authError}</span>
              </div>
            ) : null}

            {/* Mode tabs */}
            <div className="inline-flex w-full rounded-full bg-muted p-1">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={cn(
                    "flex-1 rounded-full px-4 py-2 text-sm font-medium transition-all",
                    mode === m
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border/70"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setMode(m)}
                >
                  {m === "signin" ? "Masuk" : "Daftar"}
                </button>
              ))}
            </div>

            {/* Forms */}
            {mode === "signin" ? (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      form="signin-form"
                      type="email"
                      value={signInForm.email}
                      onChange={(e) => setSignInForm((s) => ({ ...s, email: e.target.value }))}
                      autoComplete="email"
                      className="h-12 rounded-2xl bg-card/80"
                      placeholder="warung@email.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Kata sandi</Label>
                    <Input
                      id="signin-password"
                      name="password"
                      form="signin-form"
                      type="password"
                      value={signInForm.password}
                      onChange={(e) => setSignInForm((s) => ({ ...s, password: e.target.value }))}
                      autoComplete="current-password"
                      className="h-12 rounded-2xl bg-card/80"
                      placeholder="Minimal 8 karakter"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    form="signin-form"
                    size="lg"
                    className="h-12 w-full rounded-2xl"
                    disabled={isLoading}
                    onClick={() => setIsLoading(true)}
                  >
                    {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isLoading ? "Masuk..." : "Masuk ke dashboard"}
                  </Button>
                </div>
                <form id="signin-form" action="/api/session/sign-in" method="post">
                  <input type="hidden" name="callbackURL" value="/dashboard" />
                </form>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nama pemilik</Label>
                    <Input
                      id="signup-name"
                      name="name"
                      form="signup-form"
                      value={signUpForm.name}
                      onChange={(e) => setSignUpForm((s) => ({ ...s, name: e.target.value }))}
                      autoComplete="name"
                      className="h-12 rounded-2xl bg-card/80"
                      placeholder="Ibu Sari"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      form="signup-form"
                      type="email"
                      value={signUpForm.email}
                      onChange={(e) => setSignUpForm((s) => ({ ...s, email: e.target.value }))}
                      autoComplete="email"
                      className="h-12 rounded-2xl bg-card/80"
                      placeholder="warung@email.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Kata sandi</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      form="signup-form"
                      type="password"
                      value={signUpForm.password}
                      onChange={(e) => setSignUpForm((s) => ({ ...s, password: e.target.value }))}
                      autoComplete="new-password"
                      className="h-12 rounded-2xl bg-card/80"
                      placeholder="Minimal 8 karakter"
                      minLength={8}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    form="signup-form"
                    size="lg"
                    className="h-12 w-full rounded-2xl"
                    disabled={isLoading}
                    onClick={() => setIsLoading(true)}
                  >
                    {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isLoading ? "Membuat akun..." : "Buat akun baru"}
                  </Button>
                </div>
                <form id="signup-form" action="/api/session/sign-up" method="post">
                  <input type="hidden" name="callbackURL" value="/dashboard" />
                </form>
              </>
            )}

            <p className="text-center text-xs text-muted-foreground">
              {mode === "signin" ? (
                <>
                  Belum punya akun?{" "}
                  <button
                    type="button"
                    className="font-medium text-foreground underline-offset-3 hover:underline"
                    onClick={() => setMode("signup")}
                  >
                    Daftar sekarang
                  </button>
                </>
              ) : (
                <>
                  Sudah punya akun?{" "}
                  <button
                    type="button"
                    className="font-medium text-foreground underline-offset-3 hover:underline"
                    onClick={() => setMode("signin")}
                  >
                    Masuk
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

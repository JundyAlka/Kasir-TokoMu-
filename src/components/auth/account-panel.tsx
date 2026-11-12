"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useSession, authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";

type SwitchableUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const roleBadge: Record<string, { label: string; className: string }> = {
  pimpinan: {
    label: "Pimpinan",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  pengelola_keuangan: {
    label: "Keuangan",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  },
  kasir: {
    label: "Kasir",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
};

const emptySubscribe = () => () => {};

export function AccountPanel() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [switchableUsers, setSwitchableUsers] = useState<SwitchableUser[]>([]);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);

  // Quick login to another account
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingInOther, setIsLoggingInOther] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;

    fetch("/api/auth/switchable-users")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { users: SwitchableUser[]; currentRole?: string }) => {
        setSwitchableUsers(data.users ?? []);
        setCurrentRole(data.currentRole ?? null);
      })
      .catch(() => {
        // Ignore if unreachable
      });
  }, [session?.user?.id]);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await authClient.signOut();
      toast.success("Kamu sudah keluar dari akun.");
      router.replace("/auth");
      router.refresh();
    } catch {
      toast.success("Keluar dari akun.");
      router.replace("/auth");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  async function handleSwitch(user: SwitchableUser) {
    setIsSwitching(user.id);
    try {
      const res = await fetch("/api/auth/switch-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: user.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Gagal ganti akun.");
      }

      toast.success(`Berhasil switch ke akun ${user.name}`);
      setSwitchDialogOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal ganti akun.");
    } finally {
      setIsSwitching(null);
    }
  }

  async function handleLoginOther(e: React.FormEvent) {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      toast.error("Email dan kata sandi wajib diisi.");
      return;
    }

    setIsLoggingInOther(true);
    try {
      const { error } = await authClient.signIn.email({
        email: loginEmail.trim(),
        password: loginPassword,
      });

      if (error) {
        throw new Error(error.message || "Email atau kata sandi salah.");
      }

      toast.success(`Berhasil masuk ke ${loginEmail.trim()}`);
      setSwitchDialogOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal masuk ke akun lain.");
    } finally {
      setIsLoggingInOther(false);
    }
  }

  const busy = isSigningOut || isSwitching !== null || isLoggingInOther;

  if (!mounted || isPending) {
    return (
      <div className="mt-4 rounded-[24px] border border-border/70 bg-card/55 p-4">
        <p className="text-sm text-muted-foreground">Memuat sesi akun...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const activeBadge = currentRole ? roleBadge[currentRole] : null;

  return (
    <>
      <div className="mt-4 rounded-[24px] border border-border/70 bg-card/55 p-4">
        {/* Current user */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
            <span className="text-xs font-semibold">
              {getInitials(session.user.name || session.user.email || "WU")}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium">{session.user.name || "Pemilik Warung"}</p>
              {activeBadge && (
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none",
                    activeBadge.className
                  )}
                >
                  {activeBadge.label}
                </span>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
          </div>
        </div>

        {/* Action buttons: Switch Akun & Keluar */}
        <div className="mt-3.5 grid gap-2">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="h-10 w-full rounded-2xl font-medium"
            onClick={() => setSwitchDialogOpen(true)}
            disabled={busy}
          >
            <ArrowRightLeft className="size-4" />
            <span>Switch Akun</span>
            {switchableUsers.length > 0 && (
              <span className="ml-auto rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                {switchableUsers.length}
              </span>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-10 w-full rounded-2xl"
            onClick={() => void handleSignOut()}
            disabled={busy}
          >
            {isSigningOut ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogOut className="size-4" />
            )}
            {isSigningOut ? "Keluar..." : "Keluar"}
          </Button>
        </div>
      </div>

      {/* Switch Account Dialog */}
      <Dialog
        open={switchDialogOpen}
        onOpenChange={(nextOpen) => {
          setSwitchDialogOpen(nextOpen);
          if (!nextOpen) {
            setShowLoginForm(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-[28px] p-6 gap-5">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl flex items-center gap-2">
              <ArrowRightLeft className="size-5 text-primary" />
              <span>Switch Akun</span>
            </DialogTitle>
            <DialogDescription>
              Berpindah cepat antar akun kasir atau masuk dengan akun lain tanpa keluar terlebih dahulu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Active user banner */}
            <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background text-xs font-semibold">
                {getInitials(session.user.name || session.user.email || "WU")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold">{session.user.name || "Pengguna"}</p>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Sedang Aktif
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
              </div>
            </div>

            {/* Same-workspace 1-click switchable users */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  Akun Toko Ini (1-Klik Switch)
                </p>
                {currentRole === "pimpinan" && (
                  <Link
                    href="/pengaturan/karyawan"
                    onClick={() => setSwitchDialogOpen(false)}
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    <UserCog className="size-3" />
                    Kelola Karyawan
                  </Link>
                )}
              </div>

              {switchableUsers.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {switchableUsers.map((user) => {
                    const badge = roleBadge[user.role];
                    const switching = isSwitching === user.id;

                    return (
                      <div
                        key={user.id}
                        className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3 transition-colors hover:bg-muted/40"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground text-xs font-semibold">
                          {getInitials(user.name || user.email || "U")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-medium">{user.name}</p>
                            {badge && (
                              <span
                                className={cn(
                                  "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none",
                                  badge.className
                                )}
                              >
                                {badge.label}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 shrink-0 gap-1.5 rounded-xl px-3 text-xs font-semibold"
                          onClick={() => void handleSwitch(user)}
                          disabled={busy}
                        >
                          {switching ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <ArrowRightLeft className="size-3.5" />
                          )}
                          {switching ? "..." : "Switch"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/25 p-4 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Belum ada akun kasir atau staf lain yang terdaftar di toko ini.
                  </p>
                  {currentRole === "pimpinan" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs gap-1.5"
                      onClick={() => {
                        setSwitchDialogOpen(false);
                        router.push("/pengaturan/karyawan");
                      }}
                    >
                      <UserPlus className="size-3.5" />
                      Tambah Akun Kasir
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Login with another account */}
            <div className="border-t border-border/60 pt-3">
              {!showLoginForm ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-9 rounded-xl gap-1.5 text-xs font-medium"
                  onClick={() => setShowLoginForm(true)}
                  disabled={busy}
                >
                  <UserPlus className="size-3.5" />
                  Masuk dengan Akun Lain (Email & Sandi)
                </Button>
              ) : (
                <form onSubmit={(e) => void handleLoginOther(e)} className="space-y-3 rounded-2xl border border-border/60 bg-muted/25 p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">Masuk ke Akun Lain</p>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setShowLoginForm(false)}
                    >
                      Tutup
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="switch-login-email" className="text-xs">
                      Email
                    </Label>
                    <Input
                      id="switch-login-email"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="kasir@email.com"
                      className="h-9 rounded-xl text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="switch-login-password" className="text-xs">
                      Kata sandi
                    </Label>
                    <div className="relative">
                      <Input
                        id="switch-login-password"
                        type={showPassword ? "text" : "password"}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-9 rounded-xl pr-9 text-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    className="w-full h-9 rounded-xl text-xs font-semibold"
                    disabled={busy}
                  >
                    {isLoggingInOther ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        Memproses...
                      </>
                    ) : (
                      "Masuk & Ganti Akun"
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSession, authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/format";

export function AccountPanel() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [mounted, setMounted] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await authClient.signOut();
      toast.success("Kamu sudah keluar dari akun.");
      router.replace("/auth");
      router.refresh();
    } catch {
      // Fallback: langsung redirect paksa
      toast.success("Keluar dari akun.");
      router.replace("/auth");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

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

  return (
    <div className="mt-4 rounded-[24px] border border-border/70 bg-card/55 p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-foreground text-background">
          <span className="text-xs font-semibold">
            {getInitials(session.user.name || session.user.email || "WU")}
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{session.user.name || "Pemilik Warung"}</p>
          <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="mt-4 h-11 w-full rounded-2xl"
        onClick={() => void handleSignOut()}
        disabled={isSigningOut}
      >
        {isSigningOut ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <LogOut className="size-4" />
        )}
        {isSigningOut ? "Keluar..." : "Keluar"}
      </Button>
    </div>
  );
}

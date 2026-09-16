"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home, LogIn } from "lucide-react";

export default function GlobalErrorPage({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background text-foreground">
      <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-destructive mb-4">
        <AlertTriangle className="h-12 w-12" />
      </div>
      <h1 className="font-heading text-3xl font-bold text-foreground">Terjadi Kendala Memuat Halaman</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {error.message && error.message !== "REQUEST_FAILED" && !error.message.includes("Server Components render")
          ? error.message
          : "Sistem mengalami kendala saat memproses permintaan. Silakan muat ulang halaman atau kembali ke halaman login."}
      </p>

      {/* Native anchor links with direct window reload so they ALWAYS work even if React hydration failed */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <a
          href=""
          onClick={(e) => {
            e.preventDefault();
            window.location.reload();
          }}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-all cursor-pointer select-none"
          title="Muat ulang halaman"
        >
          <RefreshCw className="h-4 w-4" />
          Muat Ulang
        </a>

        <a
          href="/auth"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border/80 bg-card/80 px-5 py-2.5 text-sm font-medium text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground transition-all cursor-pointer select-none"
          title="Ke halaman login"
        >
          <LogIn className="h-4 w-4" />
          Halaman Login
        </a>

        <a
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border/80 bg-card/80 px-5 py-2.5 text-sm font-medium text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground transition-all cursor-pointer select-none"
          title="Kembali ke dashboard"
        >
          <Home className="h-4 w-4" />
          Dashboard
        </a>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-destructive mb-4">
        <AlertTriangle className="h-10 w-10" />
      </div>
      <h2 className="font-heading text-2xl font-bold text-foreground">Terjadi Kendala Memuat Halaman</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {error.message && error.message !== "REQUEST_FAILED"
          ? error.message
          : "Sistem mengalami kendala saat memuat data. Silakan coba muat ulang halaman atau kembali ke Dashboard."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => reset()} variant="default" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Coba Lagi
        </Button>
        <Button onClick={() => (window.location.href = "/dashboard")} variant="outline" className="gap-2">
          <Home className="h-4 w-4" />
          Kembali ke Dashboard
        </Button>
      </div>
    </div>
  );
}

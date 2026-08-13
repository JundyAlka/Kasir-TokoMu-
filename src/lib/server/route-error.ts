import { NextResponse } from "next/server";
import { isValidationError, validationErrorResponse } from "@/lib/server/validation";

export function notFoundError() {
  return new Error("NOT_FOUND");
}

function friendlyAiError(message: string) {
  if (message.includes("GEMINI_API_KEY") || message.includes("JUAN_ROUTER_API_KEY")) {
    return {
      status: 503,
      message: "Layanan AI sedang tidak tersedia. Coba lagi nanti.",
    };
  }

  if (message.includes("model_not_allowed") || message.includes("no models enabled")) {
    return {
      status: 502,
      message: "Layanan AI sedang tidak tersedia. Coba lagi nanti.",
    };
  }

  if (message.includes("Gemini Proxy") || message.includes("gagal merespons") || message.includes("penyedia AI")) {
    return {
      status: 502,
      message: "AI sedang tidak tersedia saat ini. Silakan coba lagi dalam beberapa saat.",
    };
  }

  if (
    message.includes("Gemini API") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("Quota exceeded")
  ) {
    return {
      status: 502,
      message: "Layanan AI sedang tidak tersedia. Coba lagi nanti.",
    };
  }

  return null;
}

export function handleRouteError(error: unknown, fallbackMessage: string, badRequestStatus = 400) {
  if (isValidationError(error)) {
    return validationErrorResponse(error);
  }

  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Sesi tidak valid. Silakan masuk kembali.", code: "UNAUTHORIZED" }, { status: 401 });
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Anda tidak memiliki akses untuk tindakan ini.", code: "FORBIDDEN" }, { status: 403 });
  }

  if (error instanceof Error && error.message === "NOT_FOUND") {
    return NextResponse.json({ error: "Data tidak ditemukan.", code: "NOT_FOUND" }, { status: 404 });
  }

  if (error instanceof Error) {
    const aiError = friendlyAiError(error.message);
    if (aiError) {
      console.error("[api] AI request failed", error);
      return NextResponse.json({ error: aiError.message, code: "AI_UNAVAILABLE" }, { status: aiError.status });
    }
  }

  console.error("[api] unhandled route error", error);
  return NextResponse.json({ error: fallbackMessage, code: "REQUEST_FAILED" }, { status: badRequestStatus });
}

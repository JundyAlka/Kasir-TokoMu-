import { NextResponse } from "next/server";
import { isValidationError, validationErrorResponse } from "@/lib/server/validation";

function friendlyAiError(message: string) {
  if (message.includes("GEMINI_API_KEY")) {
    return {
      status: 503,
      message:
        "API key AI belum dikonfigurasi. Tambahkan GEMINI_API_KEY di server untuk mengaktifkan AI.",
    };
  }

  if (message.includes("model_not_allowed") || message.includes("no models enabled")) {
    return {
      status: 502,
      message:
        "IYH API key sudah terbaca, tetapi belum ada model yang aktif untuk key ini. Aktifkan model di dashboard IYH lalu coba lagi.",
    };
  }

  if (message.includes("IYH API")) {
    return {
      status: 502,
      message,
    };
  }

  if (
    message.includes("Gemini API") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("Quota exceeded")
  ) {
    return {
      status: 502,
      message:
        "AI Gemini belum bisa dipakai saat ini karena kuota API habis atau belum aktif. Coba lagi setelah quota/billing Google AI Studio aktif.",
    };
  }

  return null;
}

export function handleRouteError(error: unknown, fallbackMessage: string, badRequestStatus = 400) {
  if (isValidationError(error)) {
    return validationErrorResponse(error);
  }

  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  if (error instanceof Error) {
    const aiError = friendlyAiError(error.message);
    if (aiError) {
      return NextResponse.json({ error: aiError.message }, { status: aiError.status });
    }
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallbackMessage },
    { status: badRequestStatus }
  );
}

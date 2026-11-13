import { buildProfitLossPdfBuffer } from "@/lib/server/profit-loss-pdf-builder";
import { getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";

export const runtime = "nodejs";

function parseCustomNumber(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export async function GET(request: Request) {
  try {
    await requireRoutePolicy("/api/reports/profit-loss/pdf", "GET");
    const { workspaceOwnerId } = await getRequestUser();
    const url = new URL(request.url);
    const modeParam = url.searchParams.get("mode");
    const mode =
      modeParam === "harian" || modeParam === "mingguan" || modeParam === "bulanan"
        ? modeParam
        : "bulanan";
    const periodValue = url.searchParams.get("period") ?? "";
    const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
    const requestedNotes = url.searchParams
      .getAll("note")
      .map((note) => note.trim())
      .filter(Boolean)
      .slice(0, 6);

    const { buffer, filename } = await buildProfitLossPdfBuffer({
      workspaceOwnerId,
      periodValue,
      mode,
      requestedNotes,
      customModalAwal: parseCustomNumber(url.searchParams.get("modalAwal")),
      customInventaris: parseCustomNumber(url.searchParams.get("inventaris")),
      customShowcase: parseCustomNumber(url.searchParams.get("showcase")),
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Gagal membuat PDF laporan untung rugi.");
  }
}

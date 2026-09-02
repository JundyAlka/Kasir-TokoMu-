import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { previewInvestorTitipanImport } from "@/lib/server/investor-titipan-import";
import { DEFAULT_TITIPAN_BASE64 } from "@/lib/server/default-titipan-base64";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireRoutePolicy("/api/investors/import-titipan/preview", "POST");
    const { workspaceOwnerId } = await getRequestUser();

    let fileBuffer: ArrayBuffer | null = null;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (file instanceof File) {
        fileBuffer = await file.arrayBuffer();
      }
    } else {
      const body = await request.json().catch(() => ({}));
      if (body.useDefaultFile) {
        const nodeBuffer = Buffer.from(DEFAULT_TITIPAN_BASE64, "base64");
        fileBuffer = nodeBuffer.buffer.slice(
          nodeBuffer.byteOffset,
          nodeBuffer.byteOffset + nodeBuffer.byteLength
        );
      }
    }

    if (!fileBuffer) {
      throw new Error("File Excel produk titipan wajib diunggah.");
    }

    const preview = await previewInvestorTitipanImport(workspaceOwnerId, fileBuffer);
    return NextResponse.json({ preview });
  } catch (error) {
    return handleRouteError(error, "Gagal membuat pratinjau impor produk titipan.");
  }
}

import { describe, expect, it } from "vitest";
import { parseReceiptItemsContent } from "@/lib/server/ai/vision";

describe("receipt vision parsing", () => {
  it("parses Indonesian field aliases from nested AI payloads", () => {
    const items = parseReceiptItemsContent(
      JSON.stringify({
        receipt: {
          daftar_barang: [
            {
              nama_barang: "Beras",
              jumlah: "4.000",
              satuan: "Kg",
              harga_satuan: "12.500",
              total_harga: "50.000.000",
            },
          ],
        },
      })
    );

    expect(items).toEqual([
      {
        rawName: "Beras",
        quantity: 4000,
        unit: "Kg",
        unitPrice: 12500,
        lineTotal: 50000000,
        rawText: null,
      },
    ]);
  });

  it("parses compact row arrays returned by vision models", () => {
    const items = parseReceiptItemsContent(
      JSON.stringify([["Beras", "4.000 Kg X 12.500", "Rp. 50.000.000"]])
    );

    expect(items).toEqual([
      {
        rawName: "Beras",
        quantity: 4000,
        unit: "Kg",
        unitPrice: 12500,
        lineTotal: 50000000,
        rawText: "Beras 4.000 Kg X 12.500 Rp. 50.000.000",
      },
    ]);
  });

  it("falls back to OCR-like text lines with Rupiah before unit price", () => {
    const items = parseReceiptItemsContent(
      ["Beras", "4.000 Kg X Rp. 12.500 Rp. 50.000.000"].join("\n")
    );

    expect(items).toEqual([
      {
        rawName: "Beras",
        quantity: 4000,
        unit: "Kg",
        unitPrice: 12500,
        lineTotal: 50000000,
        rawText: "4.000 Kg X Rp. 12.500 Rp. 50.000.000",
      },
    ]);
  });
});

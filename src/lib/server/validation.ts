import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

const productCategories = ["Makanan", "Minuman", "Sembako", "Kebutuhan Harian"] as const;
const paymentMethods = ["Tunai", "QRIS", "Transfer"] as const;

const requiredText = (field: string) =>
  z.string().trim().min(1, `${field} wajib diisi.`);

const optionalText = z.string().trim().default("");

const nonNegativeInteger = (field: string) =>
  z.number().finite(`${field} harus berupa angka.`).int(`${field} harus bilangan bulat.`).min(0, `${field} tidak boleh negatif.`);

const positiveInteger = (field: string) =>
  z.number().finite(`${field} harus berupa angka.`).int(`${field} harus bilangan bulat.`).positive(`${field} harus lebih dari 0.`);

const percentage = (field: string) =>
  z.number().finite(`${field} harus berupa angka.`).int(`${field} harus bilangan bulat.`).min(0, `${field} minimal 0.`).max(100, `${field} maksimal 100.`);

const isoDateLike = (field: string) =>
  requiredText(field).refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: `${field} tidak valid.`,
  });

export const ProductCreateSchema = z
  .object({
    name: requiredText("Nama barang"),
    category: z.enum(productCategories),
    buyPrice: nonNegativeInteger("Harga beli"),
    sellPrice: positiveInteger("Harga jual"),
    stock: nonNegativeInteger("Stok"),
    minimumStock: nonNegativeInteger("Stok minimum"),
    description: optionalText,
  })
  .strict();

export const ProductUpdateSchema = ProductCreateSchema;

export const RestockBodySchema = z
  .object({
    quantity: positiveInteger("Jumlah restok"),
  })
  .strict();

export const TransactionCheckoutSchema = z
  .object({
    paymentMethod: z.enum(paymentMethods),
    items: z
      .array(
        z
          .object({
            productId: requiredText("Produk"),
            quantity: positiveInteger("Jumlah item"),
          })
          .strict()
      )
      .min(1, "Keranjang masih kosong."),
  })
  .strict();

export const DebtCreateSchema = z
  .object({
    borrowerName: requiredText("Nama peminjam"),
    whatsapp: requiredText("Nomor WhatsApp").min(10, "Nomor WhatsApp minimal 10 karakter."),
    amount: positiveInteger("Nominal hutang"),
    dueDate: isoDateLike("Tanggal jatuh tempo"),
  })
  .strict();

export const DebtUpdateSchema = z
  .object({
    isPaid: z.literal(true, {
      error: "Hanya perubahan status lunas yang didukung.",
    }),
  })
  .strict();

export const SettingsUpdateSchema = z
  .object({
    storeName: requiredText("Nama warung"),
    storeTagline: optionalText,
    storeAddress: requiredText("Alamat warung"),
    pcmName: optionalText,
    pcmChairmanName: optionalText,
    pcmAddress: optionalText,
    ownerName: requiredText("Nama pemilik"),
    ownerWhatsapp: requiredText("WhatsApp pemilik").min(10, "WhatsApp pemilik minimal 10 karakter."),
    city: requiredText("Kota"),
    businessNotes: optionalText,
    stockAlertThreshold: positiveInteger("Batas stok menipis"),
    profitSharePcmPct: percentage("Persentase PCM"),
    profitShareReservePct: percentage("Persentase cadangan"),
    enabledPayments: z
      .array(z.enum(paymentMethods))
      .min(1, "Pilih minimal satu metode bayar.")
      .transform((methods) => Array.from(new Set(methods))),
  })
  .strict();

export type ProductCreateInput = z.infer<typeof ProductCreateSchema>;
export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>;
export type RestockBodyInput = z.infer<typeof RestockBodySchema>;
export type TransactionCheckoutInput = z.infer<typeof TransactionCheckoutSchema>;
export type DebtCreateInput = z.infer<typeof DebtCreateSchema>;
export type DebtUpdateInput = z.infer<typeof DebtUpdateSchema>;
export type SettingsUpdateInput = z.infer<typeof SettingsUpdateSchema>;

export function formatValidationIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

export function validationErrorResponse(error: ZodError) {
  return NextResponse.json(
    {
      error: {
        issues: formatValidationIssues(error),
      },
    },
    { status: 400 }
  );
}

export function isValidationError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}

export type PaymentMethod = "Tunai" | "QRIS" | "Transfer";

export type ProductCategory =
  | "Makanan"
  | "Minuman"
  | "Sembako"
  | "Kebutuhan Harian";

export interface Product {
  id: string;
  sku?: string;
  name: string;
  category: ProductCategory;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  minimumStock: number;
  description: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface TransactionItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
}

export interface Transaction {
  id: string;
  paymentMethod: PaymentMethod;
  total: number;
  paidAmount: number;
  changeAmount: number;
  createdAt: string;
  recordedByUserId?: string;
  recordedByName?: string;
  shiftSessionId?: string | null;
  items: TransactionItem[];
}

export interface Debt {
  id: string;
  borrowerName: string;
  whatsapp: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "aktif" | "lunas" | "lewat_tempo";
  createdAt: string;
  dueDate: string;
  isPaid: boolean;
  lastReminderAt?: string;
}

export interface DebtItem {
  id: string;
  debtId: string;
  productId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  paidAt: string;
  note: string;
  recordedByUserId: string;
}

export interface DebtDetail extends Debt {
  items: DebtItem[];
  payments: DebtPayment[];
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  createdAt: string;
  category: "Operasional" | "Belanja" | "Utilitas";
}

export interface Settings {
  storeName: string;
  storeTagline: string;
  storeAddress: string;
  pcmName: string;
  pcmChairmanName: string;
  pcmAddress: string;
  ownerName: string;
  ownerWhatsapp: string;
  city: string;
  businessNotes: string;
  stockAlertThreshold: number;
  profitSharePcmPct: number;
  profitShareReservePct: number;
  enabledPayments: PaymentMethod[];
}

export interface AppState {
  products: Product[];
  cart: CartItem[];
  transactions: Transaction[];
  debts: Debt[];
  expenses: Expense[];
  paymentMethod: PaymentMethod;
  settings: Settings;
}

export interface ProductDraft {
  sku?: string;
  name: string;
  category: ProductCategory;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  minimumStock: number;
  description: string;
}

export interface DebtDraft {
  borrowerName: string;
  whatsapp: string;
  amount?: number;
  dueDate: string;
  items?: Array<{
    productId?: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal?: number;
  }>;
}

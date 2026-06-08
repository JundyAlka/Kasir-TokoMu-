export type PaymentMethod = "Tunai" | "QRIS" | "Transfer";

export type ProductCategory =
  | "Makanan"
  | "Minuman"
  | "Sembako"
  | "Kebutuhan Harian";

export interface Product {
  id: string;
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
  createdAt: string;
  items: TransactionItem[];
}

export interface Debt {
  id: string;
  borrowerName: string;
  whatsapp: string;
  amount: number;
  createdAt: string;
  dueDate: string;
  isPaid: boolean;
  lastReminderAt?: string;
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
  amount: number;
  dueDate: string;
}

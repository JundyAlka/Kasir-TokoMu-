import { AppState } from "@/lib/types";

export const emptyAppState: AppState = {
  products: [],
  cart: [],
  transactions: [],
  debts: [],
  expenses: [],
  paymentMethod: "Tunai",
  settings: {
    storeName: "",
    storeTagline: "",
    storeAddress: "",
    pcmName: "",
    pcmChairmanName: "",
    pcmAddress: "",
    ownerName: "",
    ownerWhatsapp: "",
    city: "",
    businessNotes: "",
    stockAlertThreshold: 5,
    profitSharePcmPct: 30,
    profitShareReservePct: 20,
    enabledPayments: ["Tunai", "QRIS", "Transfer"],
  },
};

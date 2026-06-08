"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { emptyAppState } from "@/lib/empty-state";
import { AppState, Debt, DebtDraft, PaymentMethod, Product, ProductDraft, Settings, Transaction } from "@/lib/types";

type CartLine = {
  product: Product;
  quantity: number;
  lineTotal: number;
};

type AppStateContextValue = AppState & {
  cartLines: CartLine[];
  cartTotal: number;
  lowStockProducts: Product[];
  addToCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  checkout: () => Promise<Transaction | null>;
  addProduct: (draft: ProductDraft) => Promise<void>;
  updateProduct: (productId: string, draft: ProductDraft) => Promise<void>;
  restockProduct: (productId: string, quantity: number) => Promise<void>;
  addDebt: (draft: DebtDraft) => Promise<void>;
  markDebtPaid: (debtId: string) => Promise<void>;
  sendDebtReminder: (debtId: string) => Promise<Debt | null>;
  updateSettings: (settings: Settings) => Promise<void>;
  resetWorkspace: () => Promise<void>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json().catch(() => null)) as T & { error?: string } | null;

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }

    throw new Error(data?.error ?? "Permintaan ke server gagal.");
  }

  return data as T;
}

export function AppStateProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const [state, setState] = useState<AppState>(emptyAppState);
  const { data: session, isPending } = useSession();
  const sessionUserId = session?.user?.id ?? null;

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!sessionUserId) {
      return;
    }

    let isActive = true;

    void requestJson<{ appState: AppState }>("/api/bootstrap")
      .then((response) => {
        if (!isActive) {
          return;
        }

        setState((current) => ({
          ...response.appState,
          cart: current.cart,
          paymentMethod: response.appState.settings.enabledPayments.includes(current.paymentMethod)
            ? current.paymentMethod
            : response.appState.paymentMethod,
        }));
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        if (error instanceof Error && error.message === "UNAUTHORIZED") {
          setState(emptyAppState);
          router.replace("/auth");
        }
      });

    return () => {
      isActive = false;
    };
  }, [isPending, router, sessionUserId]);

  const cartLines = state.cart.flatMap((line) => {
    const product = state.products.find((item) => item.id === line.productId);
    if (!product) {
      return [];
    }

    return [
      {
        product,
        quantity: line.quantity,
        lineTotal: product.sellPrice * line.quantity,
      },
    ];
  });

  const cartTotal = cartLines.reduce((sum, line) => sum + line.lineTotal, 0);

  const lowStockProducts = state.products.filter(
    (product) => product.stock <= Math.max(product.minimumStock, state.settings.stockAlertThreshold)
  );

  function addToCart(productId: string) {
    setState((current) => {
      const product = current.products.find((item) => item.id === productId);
      if (!product || product.stock <= 0) {
        return current;
      }

      const existing = current.cart.find((item) => item.productId === productId);
      const nextCart = existing
        ? current.cart.map((item) =>
            item.productId === productId
              ? {
                  ...item,
                  quantity: Math.min(item.quantity + 1, product.stock),
                }
              : item
          )
        : [...current.cart, { productId, quantity: 1 }];

      return {
        ...current,
        cart: nextCart,
      };
    });
  }

  function updateCartQuantity(productId: string, quantity: number) {
    setState((current) => {
      const product = current.products.find((item) => item.id === productId);
      if (!product) {
        return current;
      }

      const nextQuantity = Math.max(0, Math.min(quantity, product.stock));
      return {
        ...current,
        cart:
          nextQuantity === 0
            ? current.cart.filter((item) => item.productId !== productId)
            : current.cart.map((item) =>
                item.productId === productId ? { ...item, quantity: nextQuantity } : item
              ),
      };
    });
  }

  function removeFromCart(productId: string) {
    setState((current) => ({
      ...current,
      cart: current.cart.filter((item) => item.productId !== productId),
    }));
  }

  function setPaymentMethod(method: PaymentMethod) {
    setState((current) => ({
      ...current,
      paymentMethod: method,
    }));
  }

  async function checkout() {
    if (state.cart.length === 0) {
      return null;
    }

    const response = await requestJson<{
      transaction: Transaction;
      products: Product[];
    }>("/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        paymentMethod: state.paymentMethod,
        items: state.cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      }),
    });

    setState((current) => ({
      ...current,
      cart: [],
      transactions: [response.transaction, ...current.transactions],
      products: response.products,
    }));

    const transaction = response.transaction;
    return transaction;
  }

  async function addProduct(draft: ProductDraft) {
    const response = await requestJson<{ product: Product }>("/api/products", {
      method: "POST",
      body: JSON.stringify(draft),
    });

    setState((current) => ({
      ...current,
      products: [response.product, ...current.products],
    }));
  }

  async function updateProduct(productId: string, draft: ProductDraft) {
    const response = await requestJson<{ product: Product }>(`/api/products/${productId}`, {
      method: "PATCH",
      body: JSON.stringify(draft),
    });

    setState((current) => ({
      ...current,
      products: current.products.map((product) =>
        product.id === productId ? response.product : product
      ),
    }));
  }

  async function restockProduct(productId: string, quantity: number) {
    const response = await requestJson<{ product: Product }>(
      `/api/products/${productId}/restock`,
      {
        method: "POST",
        body: JSON.stringify({ quantity }),
      }
    );

    setState((current) => ({
      ...current,
      products: current.products.map((product) =>
        product.id === productId ? response.product : product
      ),
    }));
  }

  async function addDebt(draft: DebtDraft) {
    const response = await requestJson<{ debt: Debt }>("/api/debts", {
      method: "POST",
      body: JSON.stringify(draft),
    });

    setState((current) => ({
      ...current,
      debts: [response.debt, ...current.debts],
    }));
  }

  async function markDebtPaid(debtId: string) {
    const response = await requestJson<{ debt: Debt }>(`/api/debts/${debtId}`, {
      method: "PATCH",
      body: JSON.stringify({ isPaid: true }),
    });

    setState((current) => ({
      ...current,
      debts: current.debts.map((debt) =>
        debt.id === debtId ? response.debt : debt
      ),
    }));
  }

  async function sendDebtReminder(debtId: string) {
    const response = await requestJson<{ debt: Debt }>(`/api/debts/${debtId}/remind`, {
      method: "POST",
    });

    setState((current) => ({
      ...current,
      debts: current.debts.map((debt) =>
        debt.id === debtId ? response.debt : debt
      ),
    }));

    return response.debt;
  }

  async function updateSettings(settings: Settings) {
    const response = await requestJson<{ settings: Settings }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });

    setState((current) => ({
      ...current,
      paymentMethod: response.settings.enabledPayments.includes(current.paymentMethod)
        ? current.paymentMethod
        : response.settings.enabledPayments[0] ?? "Tunai",
      settings: response.settings,
    }));
  }

  async function resetWorkspace() {
    const response = await requestJson<{ appState: AppState }>("/api/bootstrap/reset", {
      method: "POST",
    });
    setState((current) => ({
      ...response.appState,
      cart: [],
      paymentMethod: response.appState.settings.enabledPayments.includes(current.paymentMethod)
        ? current.paymentMethod
        : response.appState.paymentMethod,
    }));
  }

  return (
    <AppStateContext.Provider
      value={{
        ...state,
        cartLines,
        cartTotal,
        lowStockProducts,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        setPaymentMethod,
        checkout,
        addProduct,
        updateProduct,
        restockProduct,
        addDebt,
        markDebtPaid,
        sendDebtReminder,
        updateSettings,
        resetWorkspace,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState harus dipakai di dalam AppStateProvider.");
  }

  return value;
}

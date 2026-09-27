"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: Theme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const resolvedTheme = theme === "system" ? resolveSystemTheme() : theme;

  document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  document.documentElement.style.colorScheme = resolvedTheme;
}

export function ThemeProvider({ children, defaultTheme = "dark" }: ThemeProviderProps) {
  useEffect(() => {
    // Intercept and strip browser extension injected attributes (e.g. Bitdefender bis_skin_checked)
    const cleanupExtensionAttrs = () => {
      document.querySelectorAll("[bis_skin_checked], [bis_register], [bis_size]").forEach((el) => {
        el.removeAttribute("bis_skin_checked");
        el.removeAttribute("bis_register");
        el.removeAttribute("bis_size");
      });
    };
    cleanupExtensionAttrs();

    // Suppress extension hydration warnings in console
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      const msg = typeof args[0] === "string" ? args[0] : "";
      if (msg.includes("bis_skin_checked") || msg.includes("bis_register") || msg.includes("bis_size")) {
        return;
      }
      origError.apply(console, args);
    };

    return () => {
      console.error = origError;
    };
  }, []);
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return defaultTheme;
    }

    return (window.localStorage.getItem("tokomu-theme") as Theme | null) ?? defaultTheme;
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = useCallback((nextTheme: Theme) => {
    window.localStorage.setItem("tokomu-theme", nextTheme);
    setThemeState(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}

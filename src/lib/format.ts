const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
  notation: "compact",
});

export function formatCurrency(value: number) {
  if (value < 0) {
    return `- ${currencyFormatter.format(Math.abs(value))}`;
  }
  return currencyFormatter.format(value);
}

export function formatCompactCurrency(value: number) {
  if (value < 0) {
    return `- ${compactCurrencyFormatter.format(Math.abs(value))}`;
  }
  return compactCurrencyFormatter.format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value || 0);
}

function parseDateSafely(date: unknown): Date | null {
  if (!date) return null;
  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? null : date;
  }
  let str = String(date).trim();
  if (!str) return null;

  // Check if string is Excel serial number (e.g. "46266.555555555555" or 46266)
  const num = Number(str);
  if (!Number.isNaN(num) && num > 25569 && num < 100000) {
    // Excel base epoch Jan 1 1900 -> 25569 days to Unix epoch Jan 1 1970
    const utcMs = Math.round((num - 25569) * 86400 * 1000);
    const dExcel = new Date(utcMs);
    if (!Number.isNaN(dExcel.getTime())) return dExcel;
  }

  // Direct parse test
  let d = new Date(str);
  if (!Number.isNaN(d.getTime())) return d;

  // Strip appended ISO time if attached to non-standard dates (e.g. "01 September 2026T12:00:00")
  if (str.includes("T")) {
    const beforeT = str.split("T")[0]?.trim();
    if (beforeT) {
      d = new Date(beforeT);
      if (!Number.isNaN(d.getTime())) return d;
      str = beforeT;
    }
  }

  // Indonesian month names
  const indonesianMonths: Record<string, number> = {
    januari: 0, jan: 0,
    februari: 1, feb: 1, pebruari: 1,
    maret: 2, mar: 2,
    april: 3, apr: 3,
    mei: 4, may: 4,
    juni: 5, jun: 5,
    juli: 6, jul: 6,
    agustus: 7, ags: 7, agu: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    oktober: 9, okt: 9, oct: 9,
    november: 10, nov: 10, nopember: 10,
    desember: 11, des: 11, dec: 11,
  };
  const wordMatch = /^(\d{1,2})[\s\-]+([a-zA-Z]+)[\s\-]+(\d{4})/.exec(str);
  if (wordMatch) {
    const month = indonesianMonths[wordMatch[2].toLowerCase()];
    if (month !== undefined) {
      return new Date(Date.UTC(Number(wordMatch[3]), month, Number(wordMatch[1]), 12));
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(str);
  if (dmy) {
    return new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 12));
  }

  return null;
}

export function formatDate(date: string | null | undefined) {
  if (!date) return "-";
  const parsed = parseDateSafely(date);
  if (!parsed) return String(date);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export function formatShortDate(date: string | null | undefined) {
  if (!date) return "-";
  const parsed = parseDateSafely(date);
  if (!parsed) return String(date);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
  }).format(parsed);
}

export function formatDateTime(date: string | null | undefined) {
  if (!date) return "-";
  const parsed = parseDateSafely(date);
  if (!parsed) return String(date);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function formatTime(date: string | null | undefined) {
  if (!date) return "-";
  const parsed = parseDateSafely(date);
  if (!parsed) return String(date);
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() ?? "")
    .join("");
}

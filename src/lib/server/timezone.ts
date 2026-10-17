export const JAKARTA_TIME_ZONE = "Asia/Jakarta";

export type DateRange = {
  start: string;
  end: string;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function getJakartaDateKey(dateInput: Date | string | number = new Date()): string {
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "";
  // Asia/Jakarta is strictly UTC+7 with no daylight saving time (DST).
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${wib.getUTCFullYear()}-${pad2(wib.getUTCMonth() + 1)}-${pad2(wib.getUTCDate())}`;
}

export function jakartaNow() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}

export function getJakartaDayRange(dateInput: Date | string = new Date()): DateRange {
  const day = getJakartaDateKey(dateInput);
  const [y, m, d] = day.split("-").map(Number);
  const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
  const nextDay = `${nextDate.getUTCFullYear()}-${pad2(nextDate.getUTCMonth() + 1)}-${pad2(nextDate.getUTCDate())}`;

  return {
    start: new Date(`${day}T00:00:00.000+07:00`).toISOString(),
    end: new Date(`${nextDay}T00:00:00.000+07:00`).toISOString(),
  };
}

export function getJakartaMonthRange(year: number, month: number): DateRange {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Tahun periode tidak valid.");
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Bulan periode tidak valid.");
  }

  const startMonth = `${year}-${pad2(month)}-01`;
  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const endMonth = `${nextMonthYear}-${pad2(nextMonth)}-01`;

  return {
    start: new Date(`${startMonth}T00:00:00.000+07:00`).toISOString(),
    end: new Date(`${endMonth}T00:00:00.000+07:00`).toISOString(),
  };
}

export function getJakartaWeekRange(dateInput: Date | string = new Date()): DateRange {
  const dayKey = getJakartaDateKey(dateInput);
  const [y, m, d] = dayKey.split("-").map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = utcDate.getUTCDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayUtc = new Date(Date.UTC(y, m - 1, d - diffToMonday));
  const mondayKey = `${mondayUtc.getUTCFullYear()}-${pad2(mondayUtc.getUTCMonth() + 1)}-${pad2(mondayUtc.getUTCDate())}`;
  const nextMondayUtc = new Date(Date.UTC(mondayUtc.getUTCFullYear(), mondayUtc.getUTCMonth(), mondayUtc.getUTCDate() + 7));
  const nextMondayKey = `${nextMondayUtc.getUTCFullYear()}-${pad2(nextMondayUtc.getUTCMonth() + 1)}-${pad2(nextMondayUtc.getUTCDate())}`;

  return {
    start: new Date(`${mondayKey}T00:00:00.000+07:00`).toISOString(),
    end: new Date(`${nextMondayKey}T00:00:00.000+07:00`).toISOString(),
  };
}

export function isWithinJakartaRange(isoDate: string, range: DateRange) {
  const value = new Date(isoDate).getTime();
  return value >= new Date(range.start).getTime() && value < new Date(range.end).getTime();
}

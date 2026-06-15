import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export const JAKARTA_TIME_ZONE = "Asia/Jakarta";

type DateRange = {
  start: string;
  end: string;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function wallClockMidnightUtc(day: string) {
  return fromZonedTime(`${day}T00:00:00.000`, JAKARTA_TIME_ZONE);
}

function jakartaDayKey(date: Date) {
  return formatInTimeZone(date, JAKARTA_TIME_ZONE, "yyyy-MM-dd");
}

export function jakartaNow() {
  return toZonedTime(new Date(), JAKARTA_TIME_ZONE);
}

export function getJakartaDayRange(date: Date = new Date()): DateRange {
  const day = jakartaDayKey(date);
  const start = wallClockMidnightUtc(day);
  const endDay = formatInTimeZone(addDays(toZonedTime(start, JAKARTA_TIME_ZONE), 1), JAKARTA_TIME_ZONE, "yyyy-MM-dd");
  const end = wallClockMidnightUtc(endDay);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
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
    start: wallClockMidnightUtc(startMonth).toISOString(),
    end: wallClockMidnightUtc(endMonth).toISOString(),
  };
}

export function getJakartaWeekRange(date: Date = new Date()): DateRange {
  const zoned = toZonedTime(date, JAKARTA_TIME_ZONE);
  const day = zoned.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = addDays(zoned, -diff);
  const mondayKey = formatInTimeZone(monday, JAKARTA_TIME_ZONE, "yyyy-MM-dd");
  const start = wallClockMidnightUtc(mondayKey);
  const endKey = formatInTimeZone(addDays(toZonedTime(start, JAKARTA_TIME_ZONE), 7), JAKARTA_TIME_ZONE, "yyyy-MM-dd");

  return {
    start: start.toISOString(),
    end: wallClockMidnightUtc(endKey).toISOString(),
  };
}

export function isWithinJakartaRange(isoDate: string, range: DateRange) {
  const value = new Date(isoDate).getTime();
  return value >= new Date(range.start).getTime() && value < new Date(range.end).getTime();
}

/** True from H-2 until the final day of the current calendar month. */
export function isReportReminderWindow(date: Date) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return date.getDate() >= lastDay - 2;
}

const notificationTimeZone = "Europe/Dublin";

const weekdayNumbers: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function isWithinNotificationWindow(date: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: notificationTimeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekday = weekdayNumbers[value("weekday")] ?? 0;
  const minutes = Number(value("hour")) * 60 + Number(value("minute"));

  return weekday >= 1 && weekday <= 5 && minutes >= 6 * 60 && minutes < 18 * 60;
}

export const notificationWindowDescription =
  "Monday-Friday, 06:00-18:00 Europe/Dublin";

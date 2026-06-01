/** Fechas de trabajo en calendario local (YYYY-MM-DD), sin hora de zona cruzada. */
export const MS_DAY = 24 * 60 * 60 * 1000;

export const toDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const dateMinusDays = (referenceDate: string, days: number) => {
  const parsed = toDate(referenceDate);
  if (!parsed) return referenceDate;
  return new Date(parsed.getTime() - days * MS_DAY).toISOString().slice(0, 10);
};

export const datePlusDays = (referenceDate: string, days: number) => dateMinusDays(referenceDate, -days);

export const daysBetween = (date: string, referenceDate: string) => {
  const a = toDate(date);
  const b = toDate(referenceDate);
  if (!a || !b) return 9999;
  return Math.round((b.getTime() - a.getTime()) / MS_DAY);
};

export const dateRange = (startDate: string, endDate: string) => {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end || start > end) return [];
  const dates: string[] = [];
  for (let ts = start.getTime(); ts <= end.getTime(); ts += MS_DAY) {
    dates.push(new Date(ts).toISOString().slice(0, 10));
  }
  return dates;
};

export const dateWindow = (referenceDate: string, minDays: number, maxDays: number) =>
  Array.from({ length: maxDays - minDays + 1 }, (_, index) => dateMinusDays(referenceDate, minDays + index));

export const inDateWindow = (date: string, referenceDate: string, minDays: number, maxDays: number) => {
  const diff = daysBetween(date, referenceDate);
  return diff >= minDays && diff <= maxDays;
};

export const todayInputDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

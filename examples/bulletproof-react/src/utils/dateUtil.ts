const format = (date: Date) => date.toISOString().slice(0, 10);

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

const isWeekend = (date: Date) => [0, 6].includes(date.getDay());

export const DateUtil = {
  format,
  addDays,
  isWeekend,
};

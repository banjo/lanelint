export interface DateRange {
  start: Date;
  end: Date;
}

export const emptyRange: DateRange = { start: new Date(0), end: new Date(0) };

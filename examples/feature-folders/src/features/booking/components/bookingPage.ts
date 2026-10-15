import { emptyRange, type DateRange } from '../../../common/date/models/dateRange.ts';
import { DateUtil } from '../../../common/date/utils/dateUtil.ts';

const bookings: DateRange[] = [emptyRange];

export const bookingCount = () => bookings.length;

export const BookingPage = () => bookings.map((range) => DateUtil.format(range.start)).join(', ');

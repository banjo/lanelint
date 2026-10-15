import { bookingCount, BookingPage } from './features/booking/index.ts';
import { CalendarPage } from './features/calendar/index.ts';

export const app = { pages: [CalendarPage, BookingPage], bookingCount };

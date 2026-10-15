import { DateUtil } from '../../../common/date/utils/dateUtil.ts';
import { useClock } from '../../../hooks/useClock.ts';
import { bookingCount } from '../../booking/index.ts';
import messages from '../messages.ts';

export const CalendarPage = () =>
  `${messages.title}: ${DateUtil.format(useClock())} (${bookingCount()} bookings)`;

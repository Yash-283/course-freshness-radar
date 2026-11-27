
import 'dotenv/config';

export const schedule = {
  enabled: (process.env.SCHEDULE || 'on').toLowerCase() !== 'off',
  time: process.env.SCHEDULE_TIME || '07:00',
  tz: process.env.SCHEDULE_TZ || 'Asia/Kolkata',
  days: (process.env.SCHEDULE_DAYS || 'every').toLowerCase() === 'weekdays' ? 'weekdays' : 'every',
};

// Date parts (year, month, day, weekday) of an instant, as seen in the schedule's time zone
function partsIn(date, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second, wd: p.weekday };
}

// The UTC instant of "y-m-d hh:mm" in the time zone
function zonedTime(y, m, d, hh, mm, tz) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const p = partsIn(new Date(guess), tz);
  const shown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  return new Date(guess - (shown - guess));       // correct by the zone's offset
}

const isWeekend = (date, tz) => ['Sat', 'Sun'].includes(partsIn(date, tz).wd);
const [HH, MM] = schedule.time.split(':').map(Number);

// Today's scheduled time (UTC instant), or null if today is not a run day
export function todaysSlot(now = new Date(), s = schedule) {
  const p = partsIn(now, s.tz);
  const slot = zonedTime(p.y, p.m, p.d, HH, MM, s.tz);
  if (s.days === 'weekdays' && isWeekend(slot, s.tz)) return null;
  return slot;
}

// Is the automatic run due right now?
export function isDue(lastRunStartedAt, now = new Date(), s = schedule) {
  if (!s.enabled) return false;
  const slot = todaysSlot(now, s);
  if (!slot || now < slot) return false;                         // not a run day, or too early
  return !lastRunStartedAt || new Date(lastRunStartedAt) < slot; // nothing has run since the slot
}

// When will the next automatic run happen? (for the dashboard)
export function nextRunAt(lastRunStartedAt, now = new Date(), s = schedule) {
  if (!s.enabled) return null;
  if (isDue(lastRunStartedAt, now, s)) return now.toISOString(); // due now (catch-up)
  for (let i = 0; i < 8; i++) {
    const day = new Date(now.getTime() + i * 864e5);
    const slot = todaysSlot(day, s);
    if (slot && slot > now) return slot.toISOString();
  }
  return null;
}
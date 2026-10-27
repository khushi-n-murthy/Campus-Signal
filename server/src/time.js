// India Standard Time is UTC+5:30 all year (no daylight saving), so a fixed offset is exact.
const IST_OFFSET_MS = 330 * 60 * 1000;

export function istParts(date = new Date()) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return { hour: shifted.getUTCHours(), dow: shifted.getUTCDay() }; // dow: 0 = Sunday
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

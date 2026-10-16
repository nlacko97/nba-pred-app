// Game days and seasons follow the US schedule, not the viewer's clock.
// Dates are 'YYYY-MM-DD' strings, matching games.date in Supabase.

// The first season the app ran; the oldest one the leaderboard offers
export const FIRST_SEASON = 2024

// Keep showing last night's slate until 6am Eastern, so late West Coast
// games stay on "today" while they are still being played
const ROLLOVER_HOURS = 6

const easternDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const gameDayIso = (now = new Date()) =>
  easternDate.format(new Date(now.getTime() - ROLLOVER_HOURS * 36e5))

export const addDays = (iso, days) => {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().split('T')[0]
}

// A season is named after the year it tips off: Sep 2026 – Aug 2027 is 2026
export const seasonForDate = iso => {
  const [year, month] = iso.split('-').map(Number)
  return month >= 9 ? year : year - 1
}

export const CURRENT_SEASON = seasonForDate(gameDayIso())

export const seasonLabel = season => {
  const start = Number(season)
  return `${start}–${String(start + 1).slice(2)}`
}

// Weeks run Monday–Sunday by US game day, like the day strip
export const weekStart = iso => {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay()
  return addDays(iso, -((day + 6) % 7))
}

export const monthStart = iso => `${iso.slice(0, 7)}-01`

const monthEnd = iso => {
  const date = new Date(`${monthStart(iso)}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + 1, 0)
  return date.toISOString().split('T')[0]
}

// The week or month containing iso, as { start, end } (inclusive)
export const periodRange = (type, iso) =>
  type === 'week'
    ? { start: weekStart(iso), end: addDays(weekStart(iso), 6) }
    : { start: monthStart(iso), end: monthEnd(iso) }

// Week 1 is the week containing opening night
export const weekNumber = (iso, openingNight) =>
  Math.round(
    (new Date(`${weekStart(iso)}T00:00:00Z`) -
      new Date(`${weekStart(openingNight)}T00:00:00Z`)) /
      (7 * 864e5),
  ) + 1

const shortDate = (iso, options) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    ...options,
  })

// 'Week 3 · Nov 2–8', 'Week 6 · Nov 30–Dec 6' or 'November 2026'
export const periodLabel = (type, start, openingNight) => {
  if (type === 'month') {
    return shortDate(start, { month: 'long', year: 'numeric' })
  }
  const end = addDays(start, 6)
  const sameMonth = start.slice(0, 7) === end.slice(0, 7)
  const range = `${shortDate(start, { month: 'short', day: 'numeric' })}–${
    sameMonth
      ? shortDate(end, { day: 'numeric' })
      : shortDate(end, { month: 'short', day: 'numeric' })
  }`
  return openingNight
    ? `Week ${weekNumber(start, openingNight)} · ${range}`
    : range
}

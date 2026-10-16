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

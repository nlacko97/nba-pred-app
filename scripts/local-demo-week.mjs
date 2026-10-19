// Fills the LOCAL stack with a demo week so today's page has something to
// show before opening night: Thursday–Sunday of last week played and graded,
// with picks for every local player, and three games tonight.
//
//   npm run local:demo-week               add (or reset) the demo week
//   npm run local:demo-week -- --live     same, with Sunday's last game
//                                         still being played
//   npm run local:demo-week -- --clean    remove it again
//
// Demo games use ids from 990000000 up, so they never clash with real ones.

import process from 'node:process'
import { call } from './local-stack.mjs'

const FIRST_ID = 990000000
const args = new Set(process.argv.slice(2))

// Dates on the US game day, like the app (6am Eastern rollover)
const easternDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const addDays = (iso, days) => {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().split('T')[0]
}
const today = easternDate.format(new Date())
const seasonForDate = iso => {
  const [year, month] = iso.split('-').map(Number)
  return month >= 9 ? year : year - 1
}

async function clean() {
  await call(`/rest/v1/picks?game_id=gte.${FIRST_ID}`, { method: 'DELETE' })
  await call(`/rest/v1/games?id=gte.${FIRST_ID}`, { method: 'DELETE' })
}

await clean()
if (args.has('--clean')) {
  console.log('Removed the demo week')
  process.exit(0)
}

// The same "random" week on every run
let seed = 20261019
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32
  return seed / 2 ** 32
}

const teams = await call('/rest/v1/teams?select=id,abbreviation&order=id')
const byAbbr = Object.fromEntries(teams.map(t => [t.abbreviation, t.id]))
const profiles = await call('/rest/v1/profiles?select=id,full_name')

// [away, home] per night, oldest first; tonight's DEN@LAL is a rematch of
// Friday's, so the ticket shows a season series
const nights = [
  [
    -4,
    [
      ['BOS', 'NYK'],
      ['MIL', 'CHI'],
      ['PHX', 'SAC'],
      ['ATL', 'MIA'],
    ],
  ],
  [
    -3,
    [
      ['LAL', 'DEN'],
      ['OKC', 'HOU'],
      ['CLE', 'IND'],
    ],
  ],
  [
    -2,
    [
      ['GSW', 'POR'],
      ['DAL', 'MEM'],
      ['TOR', 'PHI'],
      ['SAS', 'UTA'],
      ['ORL', 'WAS'],
    ],
  ],
  [
    -1,
    [
      ['MIN', 'NOP'],
      ['BKN', 'DET'],
      ['LAC', 'CHA'],
      ['NYK', 'BOS'],
    ],
  ],
  [
    0,
    [
      ['DEN', 'LAL'],
      ['HOU', 'OKC'],
      ['MIA', 'ATL'],
    ],
  ],
]

let nextId = FIRST_ID
const games = []
for (const [offset, matchups] of nights) {
  const date = addDays(today, offset)
  matchups.forEach(([away, home], i) => {
    const played = offset < 0
    const live =
      args.has('--live') && offset === -1 && i === matchups.length - 1
    // Tonight tips at 7pm, 8:30pm and 10pm Eastern (23:00Z and later)
    const tip = new Date(`${date}T23:00:00Z`)
    tip.setUTCMinutes(tip.getUTCMinutes() + i * 90)
    const homeScore = played ? 98 + Math.floor(random() * 30) : null
    let awayScore = played ? 98 + Math.floor(random() * 30) : null
    if (played && awayScore === homeScore) awayScore += 3
    games.push({
      id: nextId++,
      date,
      season: seasonForDate(date),
      postseason: false,
      home_team_id: byAbbr[home],
      away_team_id: byAbbr[away],
      home_team_score: homeScore,
      away_team_score: awayScore,
      period: played ? 4 : 0,
      status: !played ? tip.toISOString() : live ? '4th Qtr' : 'Final',
      time: live ? '2:41' : played ? 'Final' : null,
      // ESPN's pre-tip projection, so tonight shows win probability
      home_win_prob: played ? null : [24, 61.5, 47][i],
      win_prob_at: played ? null : new Date().toISOString(),
    })
  })
}
await call('/rest/v1/games', { method: 'POST', body: JSON.stringify(games) })

// Each player picks most games, at confidence 1–3 within the daily budget
// (games + 2), and played games are graded
const picks = []
for (const profile of profiles) {
  for (const [offset] of nights) {
    if (offset === 0) continue
    const date = addDays(today, offset)
    const slate = games.filter(g => g.date === date)
    let budget = slate.length + 2
    slate.forEach((game, i) => {
      if (random() < 0.15) return
      const left = slate.length - i - 1
      const confidence = Math.max(
        1,
        Math.min(3, budget - left, 1 + Math.floor(random() * 3)),
      )
      budget -= confidence
      const home = random() < 0.55
      const picked = home ? game.home_team_id : game.away_team_id
      const homeWon = game.home_team_score > game.away_team_score
      picks.push({
        user_id: profile.id,
        game_id: game.id,
        picked_team: picked,
        confidence_score: confidence,
        correct: game.status === 'Final' ? home === homeWon : null,
      })
    })
  }
}
await call('/rest/v1/picks', { method: 'POST', body: JSON.stringify(picks) })

console.log(
  `Demo week: ${games.length} games (${addDays(today, -4)} to ${today}), ${picks.length} picks for ${profiles.length} players`,
)

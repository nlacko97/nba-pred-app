import { gameDayIso } from './season'

// Preview-only slate injected into today's games when VITE_DEMO_GAMES=true.
// Demo games never touch Supabase: picks on them live in local state only.

export const demoGamesEnabled = import.meta.env.VITE_DEMO_GAMES === 'true'

const TEAMS = {
  BOS: { id: 2, name: 'Celtics' },
  DEN: { id: 8, name: 'Nuggets' },
  GSW: { id: 10, name: 'Warriors' },
  HOU: { id: 11, name: 'Rockets' },
  LAL: { id: 14, name: 'Lakers' },
  NYK: { id: 20, name: 'Knicks' },
  OKC: { id: 21, name: 'Thunder' },
  SAS: { id: 27, name: 'Spurs' },
}

const hoursFromNow = hours => {
  const date = new Date(Date.now() + hours * 3600 * 1000)
  date.setMinutes(date.getMinutes() < 30 ? 0 : 30, 0, 0)
  return date.toISOString()
}

function demoGame(index, date, away, home, extra) {
  return {
    game_id: -1000 - index,
    game_date: date,
    away_team_id: TEAMS[away].id,
    away_team_name: TEAMS[away].name,
    away_team_abbreviation: away,
    home_team_id: TEAMS[home].id,
    home_team_name: TEAMS[home].name,
    home_team_abbreviation: home,
    away_team_wins: 0,
    away_team_losses: 0,
    home_team_wins: 0,
    home_team_losses: 0,
    away_team_score: null,
    home_team_score: null,
    stage: null,
    picks: [],
    is_demo: true,
    ...extra,
  }
}

export function withDemoGames(rows, date) {
  const today = gameDayIso()
  if (!demoGamesEnabled || date !== today) return rows
  return [
    ...rows,
    demoGame(1, date, 'DEN', 'LAL', {
      game_status: 'Q3 4:12',
      away_team_score: 78,
      home_team_score: 81,
    }),
    demoGame(2, date, 'BOS', 'NYK', { game_status: hoursFromNow(2) }),
    demoGame(3, date, 'OKC', 'SAS', {
      game_status: hoursFromNow(3.5),
      stage: 'NBA Cup · West Group B',
    }),
    demoGame(4, date, 'GSW', 'HOU', { game_status: hoursFromNow(5) }),
  ]
}

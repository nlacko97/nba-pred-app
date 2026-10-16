import { matchupKey } from './teams'

// Deterministic sample data so the UI can be designed before a live source
// is wired in. Replace by setting VITE_INSIGHTS_SOURCE=espn.

export const isMock = true

const hash = text =>
  [...text].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 7)

const BROADCASTS = ['ESPN', 'TNT', 'NBA TV', 'Prime Video', 'NBC', 'Peacock']

const winPct = team => {
  const played = (team?.wins || 0) + (team?.losses || 0)
  return played ? team.wins / played : 0.5
}

export async function getGameLines(date, games) {
  return games.reduce((acc, game) => {
    const seed = hash(
      `${date}${game.away_team_abbreviation}${game.home_team_abbreviation}`,
    )
    const edge = winPct(game.home_team) - winPct(game.away_team)
    const homeWinPct = Math.min(
      92,
      Math.max(8, 50 + edge * 70 + 3 + ((seed % 9) - 4)),
    )
    const spread = Math.round(((homeWinPct - 50) / 3.2) * 2) / 2
    const favorite =
      spread >= 0 ? game.home_team_abbreviation : game.away_team_abbreviation

    acc[matchupKey(game.away_team_abbreviation, game.home_team_abbreviation)] =
      {
        spread: spread === 0 ? 'EVEN' : `${favorite} -${Math.abs(spread)}`,
        total: 218.5 + (seed % 18),
        homeWinPct: Math.round(homeWinPct * 10) / 10,
        broadcast: BROADCASTS[seed % BROADCASTS.length],
        venue: null,
        seriesSummary: seed % 3 === 0 ? 'First meeting this season' : null,
      }
    return acc
  }, {})
}

// Final 2025–26 regular-season standings (top 8 per conference)
export async function getStandings() {
  const row = (abbr, wins, losses, gamesBehind, streak) => ({
    abbr,
    wins,
    losses,
    gamesBehind,
    streak,
  })
  return {
    east: [
      row('DET', 60, 22, '-', 'W3'),
      row('BOS', 56, 26, '4', 'W2'),
      row('NYK', 53, 29, '7', 'L1'),
      row('CLE', 52, 30, '8', 'W1'),
      row('TOR', 46, 36, '14', 'W1'),
      row('ATL', 46, 36, '14', 'L1'),
      row('PHI', 45, 37, '15', 'W2'),
      row('ORL', 45, 37, '15', 'L1'),
    ],
    west: [
      row('OKC', 64, 18, '-', 'L2'),
      row('SAS', 62, 20, '2', 'L1'),
      row('DEN', 54, 28, '10', 'W12'),
      row('LAL', 53, 29, '11', 'W3'),
      row('HOU', 52, 30, '12', 'W1'),
      row('MIN', 49, 33, '15', 'W2'),
      row('PHX', 45, 37, '19', 'W1'),
      row('POR', 42, 40, '22', 'W2'),
    ],
  }
}

// 2025–26 per-game leaders
export async function getLeaders() {
  return [
    {
      category: 'Points',
      abbr: 'PTS',
      value: '33.5',
      player: 'Luka Dončić',
      team: 'LAL',
    },
    {
      category: 'Rebounds',
      abbr: 'REB',
      value: '12.9',
      player: 'Nikola Jokić',
      team: 'DEN',
    },
    {
      category: 'Assists',
      abbr: 'AST',
      value: '10.7',
      player: 'Nikola Jokić',
      team: 'DEN',
    },
    {
      category: 'Field goal %',
      abbr: 'FG%',
      value: '68.2',
      player: 'Rudy Gobert',
      team: 'MIN',
    },
  ]
}

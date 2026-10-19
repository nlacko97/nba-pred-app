import { seasonLabel } from '../season'
import { matchupKey, toAppAbbr } from './teams'

// ESPN's public site API: no key required and CORS-enabled, but unofficial
// and undocumented, so every field is read defensively.

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba'
const SITE_V3 = 'https://site.api.espn.com/apis/site/v3/sports/basketball/nba'
const STANDINGS =
  'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings'

async function getJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`ESPN ${response.status}: ${url}`)
  return response.json()
}

// One scoreboard request per day. Win probability is not on it: the games
// table keeps ESPN's pre-tip snapshot (snapshot-win-probs), and the season
// series comes from our own results (get_games_by_date_v2).
export async function getGameLines(date) {
  const scoreboard = await getJson(
    `${SITE}/scoreboard?dates=${date.replaceAll('-', '')}`,
  )

  const entries = (scoreboard.events || []).map(event => {
    const competition = event.competitions?.[0] || {}
    const teams = competition.competitors || []
    const home = teams.find(team => team.homeAway === 'home')
    const away = teams.find(team => team.homeAway === 'away')
    if (!home || !away) return null

    const odds = competition.odds?.[0] || {}
    return [
      matchupKey(
        toAppAbbr(away.team?.abbreviation),
        toAppAbbr(home.team?.abbreviation),
      ),
      {
        spread: odds.details || null,
        total: odds.overUnder ?? null,
        venue: competition.venue?.fullName || null,
      },
    ]
  })

  return Object.fromEntries(entries.filter(Boolean))
}

// ESPN names a season after the year it ends (2026–27 is 2027) and
// seasontype=2 is the regular season; without it ESPN serves preseason
const regularSeason = season => `season=${Number(season) + 1}&seasontype=2`

// Before opening night everyone is 0–0, so show last season's final table
export async function getStandings(season) {
  const current = await getConferenceStandings(season)
  const played = [...current.east, ...current.west].some(
    team => team.wins + team.losses > 0,
  )
  if (played) return { ...current, label: null }
  const previous = await getConferenceStandings(Number(season) - 1)
  return { ...previous, label: `${seasonLabel(Number(season) - 1)} final` }
}

async function getConferenceStandings(season) {
  const data = await getJson(`${STANDINGS}?${regularSeason(season)}`)
  const conference = name => {
    const group = (data.children || []).find(child =>
      child.name?.startsWith(name),
    )
    return (group?.standings?.entries || [])
      .map(entry => {
        const stats = Object.fromEntries(
          (entry.stats || []).map(stat => [stat.name, stat.displayValue]),
        )
        return {
          abbr: toAppAbbr(entry.team?.abbreviation),
          wins: Number(stats.wins) || 0,
          losses: Number(stats.losses) || 0,
          gamesBehind: stats.gamesBehind ?? '-',
          streak: stats.streak || '',
          seed: Number(stats.playoffSeed) || 99,
        }
      })
      .sort((a, b) => a.seed - b.seed)
      .slice(0, 8)
  }
  return { east: conference('Eastern'), west: conference('Western') }
}

const LEADER_CATEGORIES = {
  pointsPerGame: 'Points',
  reboundsPerGame: 'Rebounds',
  assistsPerGame: 'Assists',
  fieldGoalPercentage: 'Field goal %',
}

const categoryOrder = Object.values(LEADER_CATEGORIES)

// No leaders exist until games are played, so fall back to last season
export async function getLeaders(season) {
  const current = await getSeasonLeaders(season)
  if (current.length) return { leaders: current, label: null }
  const previous = await getSeasonLeaders(Number(season) - 1)
  return {
    leaders: previous,
    label: `${seasonLabel(Number(season) - 1)} final`,
  }
}

async function getSeasonLeaders(season) {
  const response = await fetch(`${SITE_V3}/leaders?${regularSeason(season)}`)
  // ESPN answers 404 for a season with no games played yet
  if (response.status === 404) return []
  if (!response.ok) throw new Error(`ESPN ${response.status}: leaders`)
  const data = await response.json()
  return (data.leaders?.categories || [])
    .filter(category => LEADER_CATEGORIES[category.name])
    .map(category => {
      const leader = category.leaders?.[0] || {}
      return {
        category: LEADER_CATEGORIES[category.name],
        abbr: category.abbreviation,
        value: leader.displayValue,
        player: leader.athlete?.displayName,
        team: toAppAbbr(
          leader.team?.abbreviation || leader.athlete?.team?.abbreviation,
        ),
      }
    })
    .sort(
      (a, b) =>
        categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category),
    )
}

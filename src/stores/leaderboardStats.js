import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabaseClient'
import {
  CURRENT_SEASON,
  FIRST_SEASON,
  addDays,
  gameDayIso,
  periodRange,
  seasonForDate,
} from '../lib/season'

export const useLeaderboardStatsStore = defineStore('leaderboardStats', () => {
  const stats = ref([])
  const selectedSeason = ref(String(CURRENT_SEASON))
  const isPostseason = ref(false)
  const loading = ref(false)
  const cache = ref({})

  // 'season' shows the season table; 'week' and 'month' show one period
  // (Monday–Sunday or calendar month, regular season and postseason alike)
  const mode = ref('season')
  const periodStart = ref(null)
  const periodStats = ref([])
  const periodCache = ref({})
  const seasonBounds = ref({})

  const getCacheKey = (season, postseason) => `${season}-${postseason}`

  const fetchStats = async (
    season = selectedSeason.value,
    postseason = isPostseason.value,
  ) => {
    const cacheKey = getCacheKey(season, postseason)

    if (cache.value[cacheKey]) {
      stats.value = cache.value[cacheKey]
      selectedSeason.value = season
      isPostseason.value = postseason
      return
    }

    loading.value = true
    try {
      const { data, error } = await supabase.rpc('get_leaderboard_stats', {
        p_season: season,
        p_postseason: postseason,
      })

      if (error) {
        console.error('Error fetching leaderboard stats:', error)
        stats.value = []
        return
      }

      // Totals include All-Star market points (see the pick_points view)
      stats.value = data || []
      cache.value[cacheKey] = stats.value
    } catch (error) {
      console.error('Error fetching leaderboard stats:', error)
      stats.value = []
    } finally {
      loading.value = false
    }
  }

  const setSeason = async (season, postseason) => {
    await fetchStats(season, postseason)
    selectedSeason.value = season
    isPostseason.value = postseason
  }

  // First and last game day of a season: week 1 is the week of opening night,
  // and period navigation stops at the season's last game
  const fetchSeasonBounds = async season => {
    if (seasonBounds.value[season]) return seasonBounds.value[season]
    const firstGame = supabase
      .from('games')
      .select('date')
      .eq('season', Number(season))
      .eq('postseason', false)
      .order('date', { ascending: true })
      .limit(1)
    const lastGame = supabase
      .from('games')
      .select('date')
      .eq('season', Number(season))
      .order('date', { ascending: false })
      .limit(1)
    const [first, last] = await Promise.all([firstGame, lastGame])
    if (first.error || last.error) {
      console.error('Error fetching season dates:', first.error || last.error)
      return null
    }
    if (!first.data.length) return null
    const bounds = {
      openingNight: first.data[0].date,
      lastGameDay: last.data[0].date,
    }
    seasonBounds.value[season] = bounds
    return bounds
  }

  const fetchPeriod = async (type = mode.value, start = periodStart.value) => {
    const { end } = periodRange(type, start)
    const cacheKey = `${type}-${start}`
    // The current period is still being played, so never serve it stale
    const isLive = end >= gameDayIso()
    if (periodCache.value[cacheKey] && !isLive) {
      periodStats.value = periodCache.value[cacheKey]
      return
    }

    loading.value = true
    try {
      const { data, error } = await supabase.rpc('get_period_leaderboard', {
        p_start: start,
        p_end: end,
      })
      if (error) {
        console.error('Error fetching period leaderboard:', error)
        periodStats.value = []
        return
      }
      periodStats.value = data || []
      periodCache.value[cacheKey] = periodStats.value
    } finally {
      loading.value = false
    }
  }

  // A season's periods run from the one with opening night to the one being
  // played now (or the last one, once the season is over). Before opening
  // night that is week 1, still to come.
  const firstPeriodStart = (type, bounds) =>
    periodRange(type, bounds.openingNight).start

  const lastPeriodStart = (type, bounds) => {
    const today = gameDayIso()
    let day = bounds.lastGameDay < today ? bounds.lastGameDay : today
    if (day < bounds.openingNight) day = bounds.openingNight
    return periodRange(type, day).start
  }

  const latestPeriodStart = async (type, season) => {
    const bounds = await fetchSeasonBounds(season)
    return bounds
      ? lastPeriodStart(type, bounds)
      : periodRange(type, gameDayIso()).start
  }

  // The neighbouring periods; the arrows skip the offseason into the
  // previous or next season
  const periodNav = ref({ previous: null, next: null })

  const updatePeriodNav = async () => {
    const type = mode.value
    const start = periodStart.value
    const season = Number(selectedSeason.value)
    const bounds = await fetchSeasonBounds(season)
    const nav = { previous: null, next: null }
    if (bounds) {
      if (start > firstPeriodStart(type, bounds)) {
        nav.previous = {
          start: periodRange(type, addDays(start, -1)).start,
          season,
        }
      } else if (season > FIRST_SEASON) {
        const before = await fetchSeasonBounds(season - 1)
        if (before) {
          nav.previous = {
            start: lastPeriodStart(type, before),
            season: season - 1,
          }
        }
      }
      if (start < lastPeriodStart(type, bounds)) {
        nav.next = {
          start: addDays(periodRange(type, start).end, 1),
          season,
        }
      } else if (season < CURRENT_SEASON) {
        const after = await fetchSeasonBounds(season + 1)
        if (after) {
          nav.next = {
            start: firstPeriodStart(type, after),
            season: season + 1,
          }
        }
      }
    }
    periodNav.value = nav
  }

  const showPeriod = async (start, season = selectedSeason.value) => {
    selectedSeason.value = String(season)
    periodStart.value = start
    await Promise.all([fetchPeriod(), updatePeriodNav()])
  }

  const setMode = async newMode => {
    mode.value = newMode
    if (newMode === 'season') {
      await fetchStats()
      return
    }
    const season = selectedSeason.value
    const current = periodStart.value
    // Keep the period when switching week ⇄ month inside the same season
    const anchor =
      current && seasonForDate(current) === Number(season)
        ? periodRange(newMode, current).start
        : await latestPeriodStart(newMode, season)
    await showPeriod(anchor)
  }

  // One choice for the scope: the regular season, the postseason, or the
  // latest week or month
  const setScope = async scope => {
    if (scope === 'week' || scope === 'month') {
      await setMode(scope)
      return
    }
    isPostseason.value = scope === 'post'
    mode.value = 'season'
    await fetchStats()
  }

  // Another season while on weeks or months: its latest period
  const setPeriodSeason = async season => {
    await showPeriod(await latestPeriodStart(mode.value, season), season)
  }

  const stepPeriod = async direction => {
    const target = periodNav.value[direction]
    if (!target) return
    await showPeriod(target.start, target.season)
  }

  const displayedStats = computed(() =>
    mode.value === 'season' ? sortedStats.value : periodStats.value,
  )

  const aggregatedStats = computed(() => {
    const rows = displayedStats.value
    if (rows.length === 0) {
      return {
        totalPlayers: 0,
        totalPicks: 0,
        totalCorrect: 0,
        avgAccuracy: 0,
        totalScore: 0,
      }
    }

    const totalPicks = rows.reduce((sum, user) => sum + user.total_picks, 0)
    const totalCorrect = rows.reduce((sum, user) => sum + user.correct_picks, 0)
    const totalScore = rows.reduce((sum, user) => sum + user.total_score, 0)
    const avgAccuracy = Math.round(
      rows.reduce((sum, user) => sum + user.accuracy, 0) / rows.length,
    )

    return {
      totalPlayers: rows.length,
      totalPicks,
      totalCorrect,
      avgAccuracy,
      totalScore,
    }
  })

  const sortedStats = computed(() => {
    return [...stats.value].sort((a, b) => {
      if (b.total_score !== a.total_score) {
        return b.total_score - a.total_score
      }
      return b.correct_picks - a.correct_picks
    })
  })

  return {
    stats,
    selectedSeason,
    isPostseason,
    loading,
    fetchStats,
    setSeason,
    aggregatedStats,
    sortedStats,
    mode,
    periodStart,
    periodStats,
    displayedStats,
    fetchSeasonBounds,
    fetchPeriod,
    setMode,
    periodNav,
    stepPeriod,
    setScope,
    setPeriodSeason,
  }
})

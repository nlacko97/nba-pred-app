import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { addDays, easternDayIso, gameDayIso } from '../lib/season'
import { useGamesStore } from './games'

export const useDailyResultsStore = defineStore('dailyResults', () => {
  const userResults = ref(null)
  const allPlayerResults = ref([])
  const loading = ref(false)
  const lastGameDate = ref(null)
  const initialized = ref(false)
  const cache = ref({}) // Cache results by game date
  const lastFetchDate = ref(null) // Track when data was last fetched

  // Changes at midnight and 6am Eastern, when "today" may move on
  const clockKey = () => `${gameDayIso()}|${easternDayIso()}`

  // The most recent game day before today with a Final game or a resolved
  // All-Star market, within the last week
  const findLastGameDate = async () => {
    const today = await useGamesStore().resolveToday()
    const weekAgo = addDays(today, -7)
    const [games, markets] = await Promise.all([
      supabase
        .from('games')
        .select('date')
        .eq('status', 'Final')
        .lt('date', today)
        .gte('date', weekAgo)
        .order('date', { ascending: false })
        .limit(1),
      supabase
        .from('all_star_markets')
        .select('event_date')
        .eq('status', 'resolved')
        .lt('event_date', today)
        .gte('event_date', weekAgo)
        .order('event_date', { ascending: false })
        .limit(1),
    ])
    if (games.error) console.error('Error finding last game day:', games.error)
    if (markets.error && markets.error.code !== '42P01') {
      console.error('Error fetching all-star market date:', markets.error)
    }
    const dates = [games.data?.[0]?.date, markets.data?.[0]?.event_date]
      .filter(Boolean)
      .sort()
    lastGameDate.value = dates.pop() || null
    return lastGameDate.value
  }

  // Get all players' results for the last game day (game and market points,
  // ranked like the period leaderboards)
  const getAllPlayersDailyResults = async gameDate => {
    if (!gameDate) return []

    // Check cache first
    if (cache.value[gameDate]) {
      return cache.value[gameDate]
    }

    const { data, error } = await supabase.rpc('get_period_leaderboard', {
      p_start: gameDate,
      p_end: gameDate,
    })

    if (error) {
      console.error('Error fetching daily results:', error)
      return []
    }

    const dayResults = (data || []).map(row => ({
      user_id: row.user_id,
      user_full_name: row.full_name || 'Unknown',
      username: row.username || 'Unknown',
      avatar_url: row.avatar_url,
      total_picks: row.total_picks,
      correct_picks: row.correct_picks,
      points: Number(row.total_score),
      accuracy: Number(row.accuracy) || 0,
      rank: Number(row.rank),
    }))

    // Cache the results
    cache.value[gameDate] = dayResults
    return dayResults
  }

  // Check if cache is stale (new day has started)
  const isCacheStale = () => {
    if (!lastFetchDate.value) return true

    return lastFetchDate.value !== clockKey()
  }

  // Clear stale cache
  const clearStaleCache = () => {
    cache.value = {}
    allPlayerResults.value = []
    userResults.value = null
    initialized.value = false
    lastGameDate.value = null
  }

  // Initialize and fetch all data
  const initializeDailyResults = async userId => {
    // Check if cache is stale (new day)
    if (isCacheStale()) {
      clearStaleCache()
    }

    // Return cached data if already initialized
    if (initialized.value && allPlayerResults.value.length > 0) {
      // Update user results if userId changed
      if (userId) {
        userResults.value =
          allPlayerResults.value.find(p => p.user_id === userId) || null
      }
      return
    }

    if (loading.value) return

    loading.value = true

    try {
      // Find last game date
      const gameDate = await findLastGameDate()

      if (!gameDate) {
        loading.value = false
        return
      }

      // Fetch all players results
      const allRes = await getAllPlayersDailyResults(gameDate)

      allPlayerResults.value = allRes
      // Derive user results from all results to ensure consistent data (including points)
      userResults.value = allRes.find(p => p.user_id === userId) || null
      initialized.value = true
      lastFetchDate.value = clockKey()
    } catch (err) {
      console.error('Error initializing daily results:', err)
    } finally {
      loading.value = false
    }
  }

  // Computed values
  const userRank = computed(() => {
    if (!userResults.value || !allPlayerResults.value.length) return null
    const index = allPlayerResults.value.findIndex(
      p => p.user_id === userResults.value.user_id,
    )
    return index !== -1 ? index + 1 : null
  })

  const formattedDate = computed(() => {
    if (!lastGameDate.value) return ''
    const date = new Date(`${lastGameDate.value}T00:00:00Z`)
    return date.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  })

  // A player's points per game day for one Monday–Sunday week, for the
  // scores written on the day strip: { 'YYYY-MM-DD': { points, correct, picks } }
  const weekScores = ref({}) // `${userId}-${weekStart}` → scores by day

  const fetchWeekScores = async (userId, weekStart) => {
    if (!userId) return
    const { data, error } = await supabase
      .from('pick_points')
      .select('game_date, points, correct')
      .eq('user_id', userId)
      .eq('settled', true)
      .gte('game_date', weekStart)
      .lte('game_date', addDays(weekStart, 6))
    if (error) {
      console.error('Error fetching week scores:', error)
      return
    }
    const byDay = {}
    for (const row of data || []) {
      const day = (byDay[row.game_date] ||= { points: 0, correct: 0, picks: 0 })
      day.points += row.points
      day.picks += 1
      if (row.correct) day.correct += 1
    }
    weekScores.value[`${userId}-${weekStart}`] = byDay
  }

  // Force refresh data (useful for manual refresh or when detecting stale data)
  const refreshDailyResults = async userId => {
    clearStaleCache()
    await initializeDailyResults(userId)
  }

  return {
    weekScores,
    fetchWeekScores,
    userResults,
    allPlayerResults,
    loading,
    lastGameDate,
    userRank,
    formattedDate,
    initializeDailyResults,
    refreshDailyResults,
    isCacheStale,
  }
})

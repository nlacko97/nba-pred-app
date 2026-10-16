import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { addDays, gameDayIso } from '../lib/season'

export const useDailyResultsStore = defineStore('dailyResults', () => {
  const userResults = ref(null)
  const allPlayerResults = ref([])
  const loading = ref(false)
  const lastGameDate = ref(null)
  const initialized = ref(false)
  const cache = ref({}) // Cache results by game date
  const lastFetchDate = ref(null) // Track when data was last fetched

  // Find the most recent date with completed games
  const findLastGameDate = async () => {
    const today = gameDayIso()

    // Search backwards up to 7 days, starting with yesterday
    for (let i = 1; i <= 7; i++) {
      const dateStr = addDays(today, -i)
      const { data, error } = await supabase
        .from('games')
        .select('date, status')
        .eq('date', dateStr)
        .eq('status', 'Final')
        .limit(1)

      let hasResolvedAllStarMarket = false
      const { data: marketRows, error: marketError } = await supabase
        .from('all_star_markets')
        .select('id')
        .eq('event_date', dateStr)
        .eq('status', 'resolved')
        .limit(1)

      if (!marketError && marketRows && marketRows.length > 0) {
        hasResolvedAllStarMarket = true
      } else if (marketError && marketError.code !== '42P01') {
        console.error('Error fetching all-star market date:', marketError)
      }

      if ((!error && data && data.length > 0) || hasResolvedAllStarMarket) {
        lastGameDate.value = dateStr
        return dateStr
      }
    }

    return null
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
    }))

    // Cache the results
    cache.value[gameDate] = dayResults
    return dayResults
  }

  // Check if cache is stale (new day has started)
  const isCacheStale = () => {
    if (!lastFetchDate.value) return true

    return lastFetchDate.value !== gameDayIso()
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
      lastFetchDate.value = gameDayIso()
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
    const date = new Date(lastGameDate.value)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  })

  // Force refresh data (useful for manual refresh or when detecting stale data)
  const refreshDailyResults = async userId => {
    clearStaleCache()
    await initializeDailyResults(userId)
  }

  return {
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

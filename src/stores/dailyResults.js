import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabaseClient'

export const useDailyResultsStore = defineStore('dailyResults', () => {
  const userResults = ref(null)
  const allPlayerResults = ref([])
  const loading = ref(false)
  const lastGameDate = ref(null)
  const initialized = ref(false)
  const cache = ref({}) // Cache results by game date
  const lastFetchDate = ref(null) // Track when data was last fetched

  const ensureUserStats = (userStats, pick, profileMap = {}) => {
    const userId = pick.user_id
    const profile = profileMap[userId] || pick.profiles
    if (!userStats[userId]) {
      userStats[userId] = {
        user_id: userId,
        user_full_name: profile?.full_name || 'Unknown',
        username: profile?.username || 'Unknown',
        avatar_url: profile?.avatar_url,
        total_picks: 0,
        correct_picks: 0,
        points: 0,
      }
    }
  }

  const getProfileMap = async userIds => {
    if (!userIds.length) return {}
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', userIds)

    if (error) {
      console.error('Error fetching profiles for daily results:', error)
      return {}
    }

    return (data || []).reduce((acc, profile) => {
      acc[profile.id] = profile
      return acc
    }, {})
  }

  // Find the most recent date with completed games
  const findLastGameDate = async () => {
    const today = new Date()
    let searchDate = new Date(today)
    searchDate.setDate(searchDate.getDate() - 1) // Start with yesterday

    // Search backwards up to 7 days to find last game day
    for (let i = 0; i < 7; i++) {
      const dateStr = searchDate.toISOString().split('T')[0]
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

      searchDate.setDate(searchDate.getDate() - 1)
    }

    return null
  }

  // Get all players' results for the last game day
  const getAllPlayersDailyResults = async gameDate => {
    if (!gameDate) return []

    // Check cache first
    if (cache.value[gameDate]) {
      return cache.value[gameDate]
    }

    // Get games for this date to fetch picks
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id')
      .eq('date', gameDate)

    if (gamesError) {
      console.error('Error fetching games for date:', gamesError)
      return []
    }

    const gameIds = games?.map(g => g.id) || []

    const { data: allStarMarkets, error: allStarMarketError } = await supabase
      .from('all_star_markets')
      .select('id')
      .eq('event_date', gameDate)
      .eq('status', 'resolved')

    if (allStarMarketError && allStarMarketError.code !== '42P01') {
      console.error('Error fetching all-star markets for date:', allStarMarketError)
      return []
    }

    const allStarMarketIds = allStarMarkets?.map(market => market.id) || []
    if (gameIds.length === 0 && allStarMarketIds.length === 0) return []

    let picks = []
    if (gameIds.length > 0) {
      const { data: gamePicks, error: picksError } = await supabase
        .from('picks')
        .select(
          `
          user_id,
          confidence_score,
          correct,
          profiles:user_id (
            id,
            full_name,
            username,
            avatar_url
          )
        `,
        )
        .in('game_id', gameIds)

      if (picksError) {
        console.error('Error fetching picks:', picksError)
        return []
      }
      picks = gamePicks || []
    }

    let allStarPicks = []
    if (allStarMarketIds.length > 0) {
      const { data: marketPicks, error: marketPicksError } = await supabase
        .from('all_star_picks')
        .select(
          `
          user_id,
          confidence_score,
          correct,
          all_star_markets!inner (
            multiplier
          )
        `,
        )
        .in('market_id', allStarMarketIds)
        .not('correct', 'is', null)

      if (marketPicksError) {
        console.error('Error fetching all-star picks:', marketPicksError)
        return []
      }
      allStarPicks = marketPicks || []
    }

    const allUserIds = Array.from(
      new Set([...picks.map(pick => pick.user_id), ...allStarPicks.map(pick => pick.user_id)]),
    )
    const profileMap = await getProfileMap(allUserIds)

    // Aggregate user stats
    const userStats = {}
    if (picks) {
      picks.forEach(pick => {
        ensureUserStats(userStats, pick, profileMap)
        userStats[pick.user_id].total_picks++
        if (pick.correct) {
          userStats[pick.user_id].correct_picks++
          userStats[pick.user_id].points += pick.confidence_score || 1
        }
      })
    }

    if (allStarPicks) {
      allStarPicks.forEach(pick => {
        ensureUserStats(userStats, pick, profileMap)
        userStats[pick.user_id].total_picks++
        if (pick.correct) {
          userStats[pick.user_id].correct_picks++
          userStats[pick.user_id].points +=
            (pick.confidence_score || 1) * (pick.all_star_markets?.multiplier || 1)
        }
      })
    }

    // Convert to array and calculate accuracy
    const dayResults = Object.values(userStats)
      .map(stats => ({
        ...stats,
        accuracy:
          stats.total_picks > 0
            ? (stats.correct_picks / stats.total_picks) * 100
            : 0,
      }))
      .sort((a, b) => {
        // Sort by points (desc), then by correct picks (desc), then accuracy
        if (b.points !== a.points) {
          return b.points - a.points
        }
        if (b.correct_picks !== a.correct_picks) {
          return b.correct_picks - a.correct_picks
        }
        return b.accuracy - a.accuracy
      })

    // Cache the results
    cache.value[gameDate] = dayResults
    return dayResults
  }

  // Check if cache is stale (new day has started)
  const isCacheStale = () => {
    if (!lastFetchDate.value) return true

    const today = new Date().toISOString().split('T')[0]
    return lastFetchDate.value !== today
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
      lastFetchDate.value = new Date().toISOString().split('T')[0]
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

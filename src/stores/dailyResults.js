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

      if (!error && data && data.length > 0) {
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
    if (gameIds.length === 0) return []

    // Fetch all picks for these games with user info and confidence scores
    const { data: picks, error: picksError } = await supabase
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

    // Aggregate user stats
    const userStats = {}
    if (picks) {
      picks.forEach(pick => {
        const userId = pick.user_id
        if (!userStats[userId]) {
          userStats[userId] = {
            user_id: userId,
            user_full_name: pick.profiles?.full_name || 'Unknown',
            username: pick.profiles?.username,
            avatar_url: pick.profiles?.avatar_url,
            total_picks: 0,
            correct_picks: 0,
            points: 0,
          }
        }

        userStats[userId].total_picks++
        if (pick.correct) {
          userStats[userId].correct_picks++
          userStats[userId].points += pick.confidence_score || 1
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

  // Initialize and fetch all data
  const initializeDailyResults = async userId => {
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

  return {
    userResults,
    allPlayerResults,
    loading,
    lastGameDate,
    userRank,
    formattedDate,
    initializeDailyResults,
  }
})

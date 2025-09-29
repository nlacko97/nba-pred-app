import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabaseClient'

export const useLeaderboardStore = defineStore('leaderboard', () => {
  const users = ref([])
  const leaderboard = ref([])
  const leaderboardCache = ref(new Map()) // Cache leaderboard by season and playoff mode
  const yesterdayReport = ref(null)
  const teams = ref([])
  const loadingTeams = ref(false)
  const selectedSeason = ref('2024')
  const expandedUsers = ref(new Set())
  const isLeaderboardPlayoff = ref(true)
  const initialized = ref(false)

  const sortByPoints = () => {
    leaderboard.value = leaderboard.value.sort((a, b) => {
      if (b.points === a.points) return a.totalPicks - b.totalPicks
      return b.points - a.points
    })
  }

  const toggleUserExpansion = userId => {
    if (expandedUsers.value.has(userId)) {
      expandedUsers.value.delete(userId)
    } else {
      expandedUsers.value.add(userId)
    }
    expandedUsers.value = new Set(expandedUsers.value) // Trigger reactivity
  }

  const formatYesterdayToDateString = () => {
    const date = new Date()
    date.setDate(date.getDate() - 1)
    return date.toISOString().split('T')[0]
  }

  const getUsers = async (postseason = true) => {
    isLeaderboardPlayoff.value = postseason
    const cacheKey = `${selectedSeason.value}-${postseason}`

    // Check if we already have cached data for this season and mode
    if (leaderboardCache.value.has(cacheKey)) {
      const cachedData = leaderboardCache.value.get(cacheKey)
      leaderboard.value = cachedData.leaderboard
      users.value = cachedData.users
      return
    }

    let { data: userWithSummary, error } = await supabase.rpc(
      'get_user_picks_summary',
      {
        for_postseason: postseason,
        p_season: selectedSeason.value,
      },
    )
    if (error) {
      console.error('Error fetching user picks summary:', error)
      return
    }
    let { data: userPicksPastRecord, error: error2 } = await supabase.rpc(
      'get_user_picks_past_record',
      {
        for_postseason: postseason,
        p_season: selectedSeason.value,
      },
    )
    if (error2) {
      console.error('Error fetching user picks past record:', error2)
      return
    }

    userWithSummary = userWithSummary.map(u => {
      u.picks = userPicksPastRecord.filter(up => up.user_id === u.id)
      return u
    })

    const processedLeaderboard = userWithSummary.map(user => {
      user.latestDailyAccuracy = user.picks.reduce((acc, curr) => {
        acc[curr.game_date] = curr.accuracy
        return acc
      }, {})
      return {
        id: user.id,
        name: user.full_name,
        avatar_url: user.avatar_url,
        points: user.correct_picks,
        totalPicks: user.total_picks,
        latestDailyAccuracy: user.latestDailyAccuracy,
        accuracy: user.accuracy,
        best_team_ids: user.best_team_ids,
        best_team_accuracy: user.best_team_accuracy,
        worst_team_ids: user.worst_team_ids,
        worst_team_accuracy: user.worst_team_accuracy,
      }
    })

    // Cache the processed data
    leaderboardCache.value.set(cacheKey, {
      leaderboard: processedLeaderboard,
      users: userWithSummary,
    })

    leaderboard.value = processedLeaderboard
    users.value = userWithSummary
    sortByPoints()
  }

  const updateYesterdayReport = userId => {
    const picksFromYesterday = users.value
      .find(u => u.id === userId)
      ?.picks.find(
        p =>
          p.game_date === formatYesterdayToDateString() && p.correct !== null,
      )
    if (picksFromYesterday) {
      yesterdayReport.value = {
        correct: picksFromYesterday.correct_picks,
        total: picksFromYesterday.total_picks,
        accuracy: picksFromYesterday.accuracy,
      }
    } else {
      yesterdayReport.value = null
    }
  }

  const fetchTeams = async () => {
    try {
      loadingTeams.value = true
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, abbreviation')
        .order('name')

      if (error) {
        console.error('Error fetching teams:', error)
        return
      }

      teams.value = data || []
    } catch (error) {
      console.error('Error fetching teams:', error)
    } finally {
      loadingTeams.value = false
    }
  }

  const initializeLeaderboard = async () => {
    if (initialized.value) {
      // If already initialized, just make sure we have data for current settings
      await getUsers(isLeaderboardPlayoff.value)
      return
    }

    await getUsers(isLeaderboardPlayoff.value)
    await fetchTeams()
    initialized.value = true
  }

  const calculateWinStreak = user => {
    if (!user.latestDailyAccuracy) return 0

    let streak = 0
    const accuracies = Object.values(user.latestDailyAccuracy).reverse()

    for (const accuracy of accuracies) {
      if (accuracy >= 50) {
        // Consider 50%+ as a "win"
        streak++
      } else {
        break
      }
    }

    return streak
  }

  const calculateConsistencyScore = user => {
    if (
      !user.latestDailyAccuracy ||
      Object.keys(user.latestDailyAccuracy).length < 3
    )
      return 0

    const accuracies = Object.values(user.latestDailyAccuracy)
    const mean =
      accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length
    const variance =
      accuracies.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) /
      accuracies.length
    const stdDev = Math.sqrt(variance)

    // Lower standard deviation = more consistent = higher score
    return Math.max(0, Math.min(100, 100 - stdDev * 2))
  }

  const getBestDayAccuracy = user => {
    if (!user.latestDailyAccuracy) return 0
    const accuracies = Object.values(user.latestDailyAccuracy)
    return accuracies.length > 0 ? Math.max(...accuracies) : 0
  }

  const getAveragePointsPerPick = user => {
    if (user.totalPicks === 0) return 0
    return (user.points / user.totalPicks).toFixed(2)
  }

  const getPerformanceTrend = user => {
    if (
      !user.latestDailyAccuracy ||
      Object.keys(user.latestDailyAccuracy).length < 3
    )
      return 'insufficient-data'

    const accuracies = Object.values(user.latestDailyAccuracy)
    const recent = accuracies.slice(-3) // Last 3 days
    const earlier = accuracies.slice(-6, -3) // Previous 3 days

    if (earlier.length === 0) return 'insufficient-data'

    const recentAvg = recent.reduce((sum, acc) => sum + acc, 0) / recent.length
    const earlierAvg =
      earlier.reduce((sum, acc) => sum + acc, 0) / earlier.length

    const diff = recentAvg - earlierAvg

    if (diff > 5) return 'improving'
    if (diff < -5) return 'declining'
    return 'stable'
  }

  return {
    users,
    leaderboard,
    yesterdayReport,
    teams,
    loadingTeams,
    selectedSeason,
    expandedUsers,
    isLeaderboardPlayoff,
    sortByPoints,
    toggleUserExpansion,
    formatYesterdayToDateString,
    getUsers,
    updateYesterdayReport,
    fetchTeams,
    initializeLeaderboard,
    calculateWinStreak,
    calculateConsistencyScore,
    getBestDayAccuracy,
    getAveragePointsPerPick,
    getPerformanceTrend,
  }
})

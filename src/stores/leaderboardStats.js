import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabaseClient'

export const useLeaderboardStatsStore = defineStore('leaderboardStats', () => {
  const stats = ref([])
  const selectedSeason = ref('2024')
  const isPostseason = ref(false)
  const loading = ref(false)
  const cache = ref({})

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

      stats.value = data || []
      cache.value[cacheKey] = data || []
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

  const aggregatedStats = computed(() => {
    if (stats.value.length === 0) {
      return {
        totalPlayers: 0,
        totalPicks: 0,
        totalCorrect: 0,
        avgAccuracy: 0,
        totalScore: 0,
      }
    }

    const totalPicks = stats.value.reduce(
      (sum, user) => sum + user.total_picks,
      0,
    )
    const totalCorrect = stats.value.reduce(
      (sum, user) => sum + user.correct_picks,
      0,
    )
    const totalScore = stats.value.reduce(
      (sum, user) => sum + user.total_score,
      0,
    )
    const avgAccuracy = Math.round(
      stats.value.reduce((sum, user) => sum + user.accuracy, 0) /
        stats.value.length,
    )

    return {
      totalPlayers: stats.value.length,
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
  }
})

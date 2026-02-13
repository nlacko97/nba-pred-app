import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabaseClient'

export const useLeaderboardStatsStore = defineStore('leaderboardStats', () => {
  const stats = ref([])
  const selectedSeason = ref('2025')
  const isPostseason = ref(false)
  const loading = ref(false)
  const cache = ref({})

  const getCacheKey = (season, postseason) => `${season}-${postseason}`

  const fetchAllStarPointSummary = async (season, postseason) => {
    const { data, error } = await supabase
      .from('all_star_picks')
      .select(
        `
        user_id,
        confidence_score,
        correct,
        all_star_markets!inner (
          season,
          postseason,
          multiplier
        )
      `,
      )
      .eq('all_star_markets.season', Number(season))
      .eq('all_star_markets.postseason', postseason)
      .not('correct', 'is', null)

    if (error) {
      // Missing table should not break leaderboard rendering
      if (error.code !== '42P01') {
        console.error('Error fetching all-star picks summary:', error)
      }
      return {}
    }

    return (data || []).reduce((acc, pick) => {
      if (!acc[pick.user_id]) {
        acc[pick.user_id] = {
          total_picks: 0,
          correct_picks: 0,
          total_score: 0,
        }
      }
      acc[pick.user_id].total_picks += 1
      if (pick.correct) {
        acc[pick.user_id].correct_picks += 1
        acc[pick.user_id].total_score +=
          (pick.confidence_score || 1) * (pick.all_star_markets?.multiplier || 1)
      }
      return acc
    }, {})
  }

  const mergeAllStarStats = async (baseStats, season, postseason) => {
    const allStarSummary = await fetchAllStarPointSummary(season, postseason)
    const mergedStats = [...(baseStats || [])]
    const existingUsers = new Set(mergedStats.map(user => user.user_id))

    mergedStats.forEach(user => {
      const summary = allStarSummary[user.user_id]
      if (!summary) return
      user.total_picks = (user.total_picks || 0) + summary.total_picks
      user.correct_picks = (user.correct_picks || 0) + summary.correct_picks
      user.total_score = (user.total_score || 0) + summary.total_score
      user.accuracy =
        user.total_picks > 0 ? (user.correct_picks / user.total_picks) * 100 : 0
    })

    const missingUserIds = Object.keys(allStarSummary).filter(
      userId => !existingUsers.has(userId),
    )

    if (missingUserIds.length) {
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', missingUserIds)

      if (profileError) {
        console.error('Error fetching all-star profile rows:', profileError)
      } else {
        profileRows.forEach(profile => {
          const summary = allStarSummary[profile.id]
          if (!summary) return
          mergedStats.push({
            user_id: profile.id,
            full_name: profile.full_name || profile.username || 'Unknown',
            username: profile.username || profile.full_name || 'Unknown',
            avatar_url: profile.avatar_url || null,
            total_picks: summary.total_picks,
            correct_picks: summary.correct_picks,
            total_score: summary.total_score,
            accuracy:
              summary.total_picks > 0
                ? (summary.correct_picks / summary.total_picks) * 100
                : 0,
          })
        })
      }
    }

    return mergedStats
  }

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

      const mergedStats = await mergeAllStarStats(data || [], season, postseason)
      stats.value = mergedStats
      cache.value[cacheKey] = mergedStats
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

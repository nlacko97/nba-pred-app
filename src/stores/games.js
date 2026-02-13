import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { useGlobalStore } from './global'

export const useGamesStore = defineStore('games', () => {
  const globalStore = useGlobalStore()
  const games = ref([])
  const gamesCache = ref(new Map()) // Cache games by date
  const allStarMarkets = ref([])
  const allStarMarketsCache = ref(new Map()) // Cache all-star markets by season+date
  const teamResultsLast5Games = ref([])
  const injuries = ref(null)
  const selectedDate = ref(new Date().toISOString().split('T')[0])
  // const selectedDate = ref('2025-10-21')
  const selectedDateMobile = ref(new Date().toISOString().split('T')[0])
  const loading = ref(false)
  const allowPastVotes = ref(false)
  const initialized = ref(false)

  // Check if current date is All-Star Weekend (when allStarMarkets are present)
  const isAllStarWeekend = computed(() => allStarMarkets.value.length > 0)

  // Confidence tracking
  const maxConfidencePerDay = computed(() => {
    const baseBudget = games.value.length + allStarMarkets.value.length + 2
    // Add +1 bonus for All-Star Weekend
    return isAllStarWeekend.value ? baseBudget + 1 : baseBudget
  })
  const usedConfidenceToday = computed(() => {
    const userGamePicks = games.value.flatMap(game =>
      Object.values(game.picks || {}).filter(
        pick => pick.user_id === globalStore.userId,
      ),
    )
    const userAllStarPicks = allStarMarkets.value.flatMap(market =>
      Object.values(market.picks || {}).filter(
        pick => pick.user_id === globalStore.userId,
      ),
    )
    const allPicks = [...userGamePicks, ...userAllStarPicks]

    return allPicks.reduce(
      (total, pick) => total + (pick.confidence_score || 1),
      0,
    )
  })
  const remainingConfidence = computed(() =>
    Math.max(0, maxConfidencePerDay.value - usedConfidenceToday.value),
  )

  const selectedSeason = computed(() => {
    const cutoffDate = new Date('2025-10-10')
    const selected = new Date(selectedDate.value)
    return selected < cutoffDate ? 2024 : 2025
  })

  // Watch for selectedDate changes and fetch games
  watch(selectedDate, async (newDate, oldDate) => {
    if (newDate !== oldDate && initialized.value) {
      await getGames()
    }
  })

  // Watch for selectedSeason changes and fetch last 5 games
  watch(selectedSeason, async (newSeason, oldSeason) => {
    if (newSeason !== oldSeason && initialized.value) {
      await getLast5GamesByTeam()
    }
  })

  // Watch selectedDate changes
  const setSelectedDate = date => {
    selectedDate.value = date
    selectedDateMobile.value = date
  }

  const setSelectedDateMobile = date => {
    selectedDateMobile.value = date
    selectedDate.value = date
  }

  const goToPreviousDay = () => {
    const date = new Date(selectedDate.value)
    date.setDate(date.getDate() - 1)
    const newDate = date.toISOString().split('T')[0]
    setSelectedDate(newDate)
    return newDate
  }

  const goToNextDay = () => {
    const date = new Date(selectedDate.value)
    date.setDate(date.getDate() + 1)
    const newDate = date.toISOString().split('T')[0]
    setSelectedDate(newDate)
    return newDate
  }

  const getAllStarCacheKey = () =>
    `${selectedSeason.value}-${selectedDate.value}`

  const normalizeAllStarMarkets = data =>
    (data || []).map(market => {
      const picksByUser = (market.all_star_picks || []).reduce((acc, pick) => {
        acc[pick.user_id] = {
          ...pick,
        }
        return acc
      }, {})

      const options = (market.all_star_market_options || [])
        .sort((a, b) => (a.option_order || 0) - (b.option_order || 0))
        .map(option => ({
          ...option,
          picks: (market.all_star_picks || [])
            .filter(pick => pick.option_id === option.id)
            .map(pick => ({
              ...pick,
            })),
        }))

      return {
        ...market,
        picks: picksByUser,
        options,
      }
    })

  const getAllStarMarkets = async () => {
    const cacheKey = getAllStarCacheKey()
    if (allStarMarketsCache.value.has(cacheKey)) {
      allStarMarkets.value = allStarMarketsCache.value.get(cacheKey)
      return
    }

    const { data, error } = await supabase
      .from('all_star_markets')
      .select(
        `
        id,
        season,
        postseason,
        category,
        title,
        subtitle,
        event_date,
        lock_at,
        status,
        multiplier,
        winning_option_id,
        sort_order,
        all_star_market_options!all_star_market_options_market_id_fkey (
          id,
          market_id,
          label,
          subtitle,
          option_order
        ),
        all_star_picks (
          id,
          market_id,
          option_id,
          user_id,
          confidence_score,
          correct
        )
      `,
      )
      .eq('event_date', selectedDate.value)
      .eq('season', selectedSeason.value)
      .order('sort_order', { ascending: true })
      .order('lock_at', { ascending: true })

    if (error) {
      if (error.code !== '42P01') {
        console.error('Error fetching all-star markets:', error)
      }
      allStarMarkets.value = []
      return
    }

    const normalizedMarkets = normalizeAllStarMarkets(data)
    allStarMarketsCache.value.set(cacheKey, normalizedMarkets)
    allStarMarkets.value = normalizedMarkets
  }

  const getGames = async () => {
    loading.value = true
    try {
      if (gamesCache.value.has(selectedDate.value)) {
        games.value = gamesCache.value.get(selectedDate.value)
      } else {
        let { data, error } = await supabase.rpc('get_games_by_date_v2', {
          game_date_v2: selectedDate.value,
          p_season: selectedSeason.value,
        })
        if (error) {
          console.error('Error fetching games:', error)
          games.value = []
        } else {
          data = data.map(g => {
            g.home_team = {}
            g.away_team = {}
            g.home_team.picks = g.picks.filter(pick => {
              return pick.picked_team === g.home_team_id
            })
            g.away_team.picks = g.picks.filter(pick => {
              return pick.picked_team === g.away_team_id
            })
            g.picks = g.picks.reduce((acc, pick) => {
              acc[pick.user_id] = pick
              return acc
            }, {})

            g.home_team.wins = g.home_team_wins || 0
            g.home_team.losses = g.home_team_losses || 0
            g.away_team.wins = g.away_team_wins || 0
            g.away_team.losses = g.away_team_losses || 0
            g.home_team.record =
              teamResultsLast5Games.value
                .filter(r => r.team_id === g.home_team_id)
                .map(r => r.result)
                .slice(0, 5)
                .reverse() || []
            g.away_team.record =
              teamResultsLast5Games.value
                .filter(r => r.team_id === g.away_team_id)
                .map(r => r.result)
                .slice(0, 5)
                .reverse() || []
            if (isValidDate(g.game_status)) {
              g.home_team.injuries = injuries.value
                ?.filter(i => i.team === g.home_team_abbreviation)
                .map(i => ({
                  playerName: i.player,
                  injury: i.injury,
                  position: i.position,
                  status: i.status,
                }))
              g.away_team.injuries = injuries.value
                ?.filter(i => i.team === g.away_team_abbreviation)
                .map(i => ({
                  playerName: i.player,
                  injury: i.injury,
                  position: i.position,
                  status: i.status,
                }))
            }

            return g
          })

          // Cache the processed data
          gamesCache.value.set(selectedDate.value, data)
          games.value = data
        }
      }

      await getAllStarMarkets()
    } finally {
      loading.value = false
    }
  }

  const getLast5GamesByTeam = async () => {
    const { data, error } = await supabase.rpc('get_last_5_games_per_team', {
      p_season: selectedSeason.value,
    })

    if (error) {
      console.error('Error fetching last 5 games by team:', error)
      return
    }

    teamResultsLast5Games.value = data
  }

  const getInjuryReport = async () => {
    const injuriesApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-injuries`
    const injuriesResponse = await fetch(injuriesApiUrl, {
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    })
    injuries.value = await injuriesResponse.json()
  }

  const initializeGames = async () => {
    if (initialized.value) {
      // If already initialized, just make sure we have games for the current date
      await getGames()
      return
    }

    allowPastVotes.value = import.meta.env.VITE_ALLOW_PAST_VOTES === 'true'
    await getLast5GamesByTeam()
    await getInjuryReport()
    await getGames()
    initialized.value = true
  }

  const submitPick = async (
    game,
    picked_team_id,
    userId,
    confidence_score = 1,
  ) => {
    if (!userId) {
      return
    }
    if (!allowPastVotes.value && !isValidDate(game.game_status)) {
      return
    }
    if (new Date(game.game_status) < new Date()) {
      alert('AH AH. game already started :)')
      return
    }

    // Validate confidence limits
    const currentPick = game.picks[userId]
    const currentConfidence = currentPick
      ? currentPick.confidence_score || 1
      : 0
    const confidenceChange = confidence_score - currentConfidence
    if (remainingConfidence.value - confidenceChange < 0) {
      alert(
        `Not enough confidence remaining. You have ${remainingConfidence.value} confidence left, but this would use ${confidenceChange} more.`,
      )
      return
    }

    const toUpsert = {
      game_id: game.game_id,
      picked_team: picked_team_id,
      user_id: userId,
      confidence_score: confidence_score,
    }

    if (allowPastVotes.value && game.game_status === 'Final') {
      const winner =
        game.home_team_score > game.away_team_score
          ? game.home_team
          : game.away_team
      toUpsert.correct = picked_team_id === winner.id
    }

    if (game.picks[userId]) {
      toUpsert.id = game.picks[userId].id || game.picks[userId].pick_id
    }
    const { data, error } = await supabase
      .from('picks')
      .upsert([toUpsert])
      .select(
        '*,user:user_id(full_name),\
        picked_team_name:picked_team(name)',
      )

    if (error) {
      alert(error.message)
      return
    }

    games.value = games.value.map(g => {
      if (g.game_id === game.game_id) {
        return {
          ...g,
          picks: {
            ...g.picks,
            [userId]: { ...data[0], pick_id: data[0].id },
          },
        }
      }
      return g
    })

    gamesCache.value.set(selectedDate.value, games.value)
  }

  const isAllStarMarketLocked = market => {
    if (!market) return true
    if (market.status === 'locked' || market.status === 'resolved') return true
    if (allowPastVotes.value) return false
    return new Date(market.lock_at) < new Date()
  }

  const applyAllStarPickToLocalState = (marketId, userId, pick) => {
    allStarMarkets.value = allStarMarkets.value.map(market => {
      if (market.id !== marketId) return market

      const nextOptions = market.options.map(option => {
        const filteredPicks = (option.picks || []).filter(
          existingPick => existingPick.user_id !== userId,
        )
        if (option.id !== pick.option_id) {
          return {
            ...option,
            picks: filteredPicks,
          }
        }
        return {
          ...option,
          picks: [...filteredPicks, pick],
        }
      })

      return {
        ...market,
        options: nextOptions,
        picks: {
          ...market.picks,
          [userId]: pick,
        },
      }
    })
    allStarMarketsCache.value.set(getAllStarCacheKey(), allStarMarkets.value)
  }

  const removeAllStarPickFromLocalState = (marketId, userId) => {
    allStarMarkets.value = allStarMarkets.value.map(market => {
      if (market.id !== marketId) return market
      const nextPicks = { ...(market.picks || {}) }
      delete nextPicks[userId]
      const nextOptions = market.options.map(option => ({
        ...option,
        picks: (option.picks || []).filter(pick => pick.user_id !== userId),
      }))

      return {
        ...market,
        picks: nextPicks,
        options: nextOptions,
      }
    })
    allStarMarketsCache.value.set(getAllStarCacheKey(), allStarMarkets.value)
  }

  const submitAllStarPick = async (
    market,
    optionId,
    userId,
    confidence_score = 1,
  ) => {
    if (!userId) return
    if (isAllStarMarketLocked(market)) {
      alert('This market is locked.')
      return
    }

    const currentPick = market.picks[userId]
    const currentConfidence = currentPick
      ? currentPick.confidence_score || 1
      : 0
    const confidenceChange = confidence_score - currentConfidence
    if (remainingConfidence.value - confidenceChange < 0) {
      alert(
        `Not enough confidence remaining. You have ${remainingConfidence.value} confidence left, but this would use ${confidenceChange} more.`,
      )
      return
    }

    const toUpsert = {
      market_id: market.id,
      option_id: optionId,
      user_id: userId,
      confidence_score,
    }

    if (currentPick?.id) {
      toUpsert.id = currentPick.id
    }

    const { data, error } = await supabase
      .from('all_star_picks')
      .upsert([toUpsert], { onConflict: 'market_id,user_id' })
      .select(
        `
        id,
        market_id,
        option_id,
        user_id,
        confidence_score,
        correct
      `,
      )

    if (error) {
      alert(error.message)
      return
    }

    const normalizedPick = {
      ...data[0],
    }
    applyAllStarPickToLocalState(market.id, userId, normalizedPick)
  }

  const cancelAllStarPick = async (market, userId) => {
    if (!userId) return
    if (isAllStarMarketLocked(market)) {
      alert('This market is locked.')
      return
    }

    const pick = market.picks[userId]
    if (!pick?.id) return

    const { data: deletedRows, error } = await supabase
      .from('all_star_picks')
      .delete()
      .eq('id', pick.id)
      .eq('user_id', userId)
      .select('id')

    if (error) {
      alert(error.message)
      return
    }
    if (!deletedRows || deletedRows.length === 0) {
      alert('Could not cancel pick. The pick may no longer exist.')
      return
    }

    removeAllStarPickFromLocalState(market.id, userId)
  }

  const cancelPick = async (game, userId) => {
    if (!userId) return
    if (!allowPastVotes.value && !isValidDate(game.game_status)) return
    if (new Date(game.game_status) < new Date()) {
      alert('AH AH. game already started :)')
      return
    }
    const pick = game.picks[userId]
    if (!pick) return
    const pickId = pick.id || pick.pick_id
    const { data: deletedRows, error } = await supabase
      .from('picks')
      .delete()
      .eq('id', pickId)
      .eq('user_id', userId)
      .select('id')
    if (error) {
      alert(error.message)
      return
    }
    if (!deletedRows || deletedRows.length === 0) {
      alert(
        'Could not cancel pick. You may not have permission or the pick no longer exists.',
      )
      return
    }
    games.value = games.value.map(g => {
      if (g.game_id === game.game_id) {
        const rest = { ...(g.picks || {}) }
        delete rest[userId]
        return { ...g, picks: rest }
      }
      return g
    })
    gamesCache.value.set(selectedDate.value, games.value)
  }

  const isValidDate = date => {
    date = new Date(date)
    return date.toString() !== 'Invalid Date'
  }

  return {
    games,
    allStarMarkets,
    teamResultsLast5Games,
    injuries,
    selectedDate,
    selectedDateMobile,
    selectedSeason,
    loading,
    allowPastVotes,
    maxConfidencePerDay,
    usedConfidenceToday,
    remainingConfidence,
    isAllStarWeekend,
    setSelectedDate,
    setSelectedDateMobile,
    goToPreviousDay,
    goToNextDay,
    getGames,
    getAllStarMarkets,
    getLast5GamesByTeam,
    getInjuryReport,
    initializeGames,
    submitPick,
    submitAllStarPick,
    cancelPick,
    cancelAllStarPick,
    isValidDate,
    isAllStarMarketLocked,
  }
})

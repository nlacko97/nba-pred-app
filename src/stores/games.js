import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { useGlobalStore } from './global'

export const useGamesStore = defineStore('games', () => {
  const globalStore = useGlobalStore()
  const games = ref([])
  const gamesCache = ref(new Map()) // Cache games by date
  const teamResultsLast5Games = ref([])
  const injuries = ref(null)
  const selectedDate = ref(new Date().toISOString().split('T')[0])
  // const selectedDate = ref('2025-10-21')
  const selectedDateMobile = ref(new Date().toISOString().split('T')[0])
  const loading = ref(false)
  const allowPastVotes = ref(false)
  const initialized = ref(false)

  // Confidence tracking
  const maxConfidencePerDay = computed(() => games.value.length + 2)
  const usedConfidenceToday = computed(() => {
    const userPicks = games.value.flatMap(game =>
      Object.values(game.picks || {}).filter(
        pick => pick.user_id === globalStore.userId,
      ),
    )
    return userPicks.reduce(
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

  const getGames = async () => {
    // Check if we already have cached data for this date
    if (gamesCache.value.has(selectedDate.value)) {
      games.value = gamesCache.value.get(selectedDate.value)
      return
    }

    loading.value = true
    let { data, error } = await supabase.rpc('get_games_by_date_v2', {
      game_date_v2: selectedDate.value,
      p_season: selectedSeason.value,
    })
    if (error) {
      console.error('Error fetching games:', error)
      loading.value = false
      return
    }

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
    loading.value = false
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
      alert('Could not cancel pick. You may not have permission or the pick no longer exists.')
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
    setSelectedDate,
    setSelectedDateMobile,
    goToPreviousDay,
    goToNextDay,
    getGames,
    getLast5GamesByTeam,
    getInjuryReport,
    initializeGames,
    submitPick,
    cancelPick,
    isValidDate,
  }
})

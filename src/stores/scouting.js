import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabaseClient'

// How a player picks: by team, by confidence, home/away, favourite/underdog
export const useScoutingStore = defineStore('scouting', () => {
  const reports = ref({})

  const fetchReport = async (userId, season, postseason) => {
    const key = `${userId}-${season}-${postseason}`
    if (reports.value[key]) return reports.value[key]
    const { data, error } = await supabase.rpc('get_user_scouting', {
      p_user_id: userId,
      p_season: Number(season),
      p_postseason: postseason,
    })
    if (error) {
      console.error('Error fetching scouting report:', error)
      return null
    }
    reports.value[key] = data
    return data
  }

  // Every player's traits for a season, to compare a player with the league
  const leagues = ref({})

  const fetchLeagueTraits = async (season, postseason) => {
    const key = `${season}-${postseason}`
    if (leagues.value[key]) return leagues.value[key]
    const { data, error } = await supabase.rpc('get_league_traits', {
      p_season: Number(season),
      p_postseason: postseason,
    })
    if (error) {
      console.error('Error fetching league traits:', error)
      return []
    }
    leagues.value[key] = data || []
    return leagues.value[key]
  }

  return { reports, fetchReport, leagues, fetchLeagueTraits }
})

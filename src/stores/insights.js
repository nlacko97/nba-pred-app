import { defineStore } from 'pinia'
import { ref } from 'vue'
import { insightsProvider } from '../lib/insights'
import { CURRENT_SEASON } from '../lib/season'

export const useInsightsStore = defineStore('insights', () => {
  const linesByDate = ref({})
  const standings = ref(null)
  const standingsLabel = ref(null)
  const leaders = ref([])
  const leadersLabel = ref(null)

  const fetchLines = async (date, games) => {
    if (!games.length || linesByDate.value[date]) return
    try {
      linesByDate.value[date] = await insightsProvider.getGameLines(date, games)
    } catch (error) {
      console.error('Error fetching game lines:', error)
    }
  }

  const fetchLeagueContext = async () => {
    if (standings.value) return
    try {
      const [standingsData, leadersData] = await Promise.all([
        insightsProvider.getStandings(CURRENT_SEASON),
        insightsProvider.getLeaders(CURRENT_SEASON),
      ])
      standings.value = standingsData
      standingsLabel.value = standingsData.label
      leaders.value = leadersData.leaders
      leadersLabel.value = leadersData.label
    } catch (error) {
      console.error('Error fetching league context:', error)
    }
  }

  const linesFor = (date, key) => linesByDate.value[date]?.[key] || null

  return {
    linesByDate,
    standings,
    standingsLabel,
    leaders,
    leadersLabel,
    fetchLines,
    fetchLeagueContext,
    linesFor,
  }
})

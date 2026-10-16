import { defineStore } from 'pinia'
import { ref } from 'vue'
import { insightsProvider } from '../lib/insights'

export const useInsightsStore = defineStore('insights', () => {
  const linesByDate = ref({})
  const standings = ref(null)
  const leaders = ref([])
  const isSample = insightsProvider.isMock

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
        insightsProvider.getStandings(),
        insightsProvider.getLeaders(),
      ])
      standings.value = standingsData
      leaders.value = leadersData
    } catch (error) {
      console.error('Error fetching league context:', error)
    }
  }

  const linesFor = (date, key) => linesByDate.value[date]?.[key] || null

  return {
    linesByDate,
    standings,
    leaders,
    isSample,
    fetchLines,
    fetchLeagueContext,
    linesFor,
  }
})

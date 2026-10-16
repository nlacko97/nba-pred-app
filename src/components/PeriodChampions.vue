<script setup>
import { computed, onMounted, ref } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { useLeaderboardStatsStore } from '../stores/leaderboardStats'
import { addDays, gameDayIso, periodLabel, weekNumber } from '../lib/season'
import RailPanel from './RailPanel.vue'

// Crowns the latest week and month champions until the first game day after
// the period closed has been played

const leaderboardStore = useLeaderboardStatsStore()
const panels = ref([])

const today = gameDayIso()

async function firstGameDayAfter(iso) {
  const { data, error } = await supabase
    .from('games')
    .select('date')
    .gt('date', iso)
    .order('date', { ascending: true })
    .limit(1)
  if (error) {
    console.error('Error fetching next game day:', error)
    return null
  }
  return data[0]?.date || null
}

async function panelFor(type, rows) {
  const latest = rows.find(row => row.period_type === type)
  if (!latest) return null
  // Old news after the offseason or a long break
  if (addDays(latest.period_end, 10) < today) return null
  const nextGameDay = await firstGameDayAfter(latest.period_end)
  if (nextGameDay && today > nextGameDay) return null

  const champions = rows.filter(
    row => row.period_type === type && row.period_start === latest.period_start,
  )
  const bounds = await leaderboardStore.fetchSeasonBounds(latest.season)
  let title = `${periodLabel('month', latest.period_start)} champion`
  if (type === 'week') {
    title = bounds
      ? `Week ${weekNumber(latest.period_start, bounds.openingNight)} champion`
      : 'Weekly champion'
  }
  return {
    key: `${type}-${latest.period_start}`,
    title,
    meta: periodLabel(type, latest.period_start),
    champions,
  }
}

onMounted(async () => {
  const { data, error } = await supabase
    .from('period_awards')
    .select(
      'period_type, period_start, period_end, season, points, correct_picks, total_picks, user_id, profiles (full_name, username, avatar_url)',
    )
    .eq('rank', 1)
    .order('period_end', { ascending: false })
    .limit(12)
  if (error) {
    // Missing table should not break the games page
    if (error.code !== '42P01') {
      console.error('Error fetching period champions:', error)
    }
    return
  }
  const rows = data || []
  panels.value = (
    await Promise.all([panelFor('week', rows), panelFor('month', rows)])
  ).filter(Boolean)
})

const displayName = row =>
  row.profiles?.full_name || row.profiles?.username || 'Unknown'

const hasPanels = computed(() => panels.value.length > 0)
</script>

<template>
  <div v-if="hasPanels" class="space-y-6">
    <RailPanel
      v-for="panel in panels"
      :key="panel.key"
      :title="panel.title"
      :meta="panel.meta"
    >
      <ul class="space-y-3">
        <li
          v-for="row in panel.champions"
          :key="row.user_id"
          class="flex items-center gap-3"
        >
          <span class="avatar h-11 w-11 border-[1.5px] border-gold text-lg">
            <img
              v-if="row.profiles?.avatar_url"
              :src="row.profiles.avatar_url"
              :alt="`${displayName(row)}'s avatar`"
              referrerpolicy="no-referrer"
            />
            <template v-else>{{ displayName(row).charAt(0) }}</template>
          </span>
          <span class="min-w-0 flex-1">
            <span class="display block truncate text-2xl">{{
              displayName(row)
            }}</span>
            <span class="label !tracking-[0.14em]"
              >{{ row.correct_picks }}/{{ row.total_picks }} correct</span
            >
          </span>
          <span class="display num text-4xl text-gold"
            >{{ row.points }}<span class="text-lg text-muted">pts</span></span
          >
        </li>
      </ul>
    </RailPanel>
  </div>
</template>

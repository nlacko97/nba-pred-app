<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useGamesStore } from '../stores/games'
import { useInsightsStore } from '../stores/insights'
import { matchupKey } from '../lib/insights'
import { getTeamImageUrl } from '../lib/teamLogo'
import RailPanel from './RailPanel.vue'

const gamesStore = useGamesStore()
const insightsStore = useInsightsStore()
const { games, selectedDate } = storeToRefs(gamesStore)

// Closest projected upcoming game on the slate
const spotlight = computed(() => {
  const candidates = games.value
    .filter(game => gamesStore.isValidDate(game.game_status))
    .filter(game => game.home_win_prob != null)
    .map(game => ({
      game,
      homeWinPct: Number(game.home_win_prob),
      lines:
        insightsStore.linesFor(
          selectedDate.value,
          matchupKey(game.away_team_abbreviation, game.home_team_abbreviation),
        ) || {},
    }))
    .sort(
      (a, b) => Math.abs(a.homeWinPct - 50) - Math.abs(b.homeWinPct - 50),
    )
  return candidates[0] || null
})

const tipTime = computed(() => {
  if (!spotlight.value) return ''
  return new Date(spotlight.value.game.game_status).toLocaleTimeString(
    'en-GB',
    {
      hour: '2-digit',
      minute: '2-digit',
    },
  )
})
</script>

<template>
  <RailPanel v-if="spotlight" title="Closest matchup" :meta="tipTime">
    <div class="flex items-center justify-between gap-2">
      <div
        v-for="side in [
          {
            abbr: spotlight.game.away_team_abbreviation,
            name: spotlight.game.away_team_name,
            pct: 100 - spotlight.homeWinPct,
          },
          {
            abbr: spotlight.game.home_team_abbreviation,
            name: spotlight.game.home_team_name,
            pct: spotlight.homeWinPct,
          },
        ]"
        :key="side.abbr"
        class="flex flex-1 flex-col items-center text-center"
      >
        <img
          :src="getTeamImageUrl(side.abbr)"
          :alt="side.name"
          class="h-14 w-14 object-contain"
        />
        <span class="display mt-2 text-xl">{{ side.name }}</span>
        <span class="display num mt-1 text-4xl"
          >{{ Math.round(side.pct)
          }}<span class="text-lg text-muted">%</span></span
        >
      </div>
    </div>
    <div class="mt-3 flex h-2">
      <span
        class="bg-ink"
        :style="{ width: `${100 - spotlight.homeWinPct}%` }"
      />
      <span class="flex-1 bg-ink/20" />
    </div>
    <dl class="mt-4 grid grid-cols-2 gap-3 border-t border-ink/15 pt-3">
      <div>
        <dt class="label">Spread</dt>
        <dd class="num mt-0.5 font-semibold">
          {{ spotlight.lines.spread ?? '—' }}
        </dd>
      </div>
      <div>
        <dt class="label">Total</dt>
        <dd class="num mt-0.5 font-semibold">
          {{ spotlight.lines.total ?? '—' }}
        </dd>
      </div>
    </dl>
  </RailPanel>
</template>

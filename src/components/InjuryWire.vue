<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useGamesStore } from '../stores/games'
import { getTeamImageUrl } from '../lib/teamLogo'
import RailPanel from './RailPanel.vue'

const MAX_ROWS = 8

const gamesStore = useGamesStore()
const { games } = storeToRefs(gamesStore)

// Injuries for teams on the selected slate (attached to upcoming games only)
const injuries = computed(() =>
  games.value
    .flatMap(game => [
      ...(game.away_team.injuries || []).map(injury => ({
        ...injury,
        team: game.away_team_abbreviation,
      })),
      ...(game.home_team.injuries || []).map(injury => ({
        ...injury,
        team: game.home_team_abbreviation,
      })),
    ])
    .sort(
      (a, b) =>
        Number(!!b.status?.includes('Out')) -
        Number(!!a.status?.includes('Out')),
    ),
)
</script>

<template>
  <RailPanel
    v-if="injuries.length"
    title="Injury report"
    :meta="`${injuries.length} players listed · ESPN`"
  >
    <ul class="divide-y divide-ink/10">
      <li
        v-for="(injury, idx) in injuries.slice(0, MAX_ROWS)"
        :key="idx"
        class="flex items-center gap-3 py-2"
      >
        <img
          :src="getTeamImageUrl(injury.team)"
          :alt="injury.team"
          class="h-6 w-6 shrink-0 object-contain"
        />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-semibold">{{
            injury.playerName
          }}</span>
          <span class="block truncate text-xs text-muted"
            >{{ injury.position }} · {{ injury.injury }}</span
          >
        </span>
        <span
          class="shrink-0 text-[0.6875rem] font-extrabold uppercase tracking-[0.12em]"
          :class="injury.status.includes('Out') ? 'text-loss' : 'text-gold'"
          >{{ injury.status }}</span
        >
      </li>
    </ul>
    <p v-if="injuries.length > MAX_ROWS" class="label mt-3">
      +{{ injuries.length - MAX_ROWS }} more in each game's injury report
    </p>
  </RailPanel>
</template>

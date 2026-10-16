<script setup>
import { storeToRefs } from 'pinia'
import { useInsightsStore } from '../stores/insights'
import { getTeamImageUrl } from '../lib/teamLogo'
import RailPanel from './RailPanel.vue'

const insightsStore = useInsightsStore()
const { leaders, leadersLabel } = storeToRefs(insightsStore)
</script>

<template>
  <RailPanel
    v-if="leaders.length"
    title="League leaders"
    :meta="leadersLabel ? `${leadersLabel} · Per game` : 'Per game'"
  >
    <ul class="grid grid-cols-2 gap-px bg-ink/15">
      <li v-for="leader in leaders" :key="leader.abbr" class="bg-card p-3">
        <p class="label">{{ leader.category }}</p>
        <p class="display num mt-1 text-4xl">{{ leader.value }}</p>
        <p class="mt-1 flex items-center gap-1.5 text-xs font-semibold">
          <img
            v-if="leader.team"
            :src="getTeamImageUrl(leader.team)"
            :alt="leader.team"
            class="h-4 w-4 object-contain"
          />
          <span class="truncate">{{ leader.player }}</span>
        </p>
      </li>
    </ul>
  </RailPanel>
</template>

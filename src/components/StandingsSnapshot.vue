<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useGamesStore } from '../stores/games'
import { useInsightsStore } from '../stores/insights'
import { getTeamImageUrl } from '../lib/teamLogo'
import RailPanel from './RailPanel.vue'

const insightsStore = useInsightsStore()
const { standings, standingsLabel } = storeToRefs(insightsStore)
const { games } = storeToRefs(useGamesStore())

const conference = ref('east')

const playingToday = computed(
  () =>
    new Set(
      games.value.flatMap(game => [
        game.away_team_abbreviation,
        game.home_team_abbreviation,
      ]),
    ),
)

const rows = computed(() => standings.value?.[conference.value] || [])
</script>

<template>
  <RailPanel
    v-if="standings"
    title="League standings"
    :meta="
      standingsLabel
        ? `${standingsLabel} · Top 8 · ● plays on this date`
        : 'Top 8 · ● plays on this date'
    "
  >
    <div class="seg mb-3 w-full [&>button]:flex-1">
      <button
        v-for="conf in ['east', 'west']"
        :key="conf"
        type="button"
        :class="{ 'is-on': conference === conf }"
        @click="conference = conf"
      >
        {{ conf }}
      </button>
    </div>

    <table class="w-full text-sm">
      <thead>
        <tr class="label text-left">
          <th class="pb-2 font-semibold">#</th>
          <th class="pb-2 font-semibold">Team</th>
          <th class="pb-2 text-right font-semibold">W–L</th>
          <th class="pb-2 text-right font-semibold">GB</th>
          <th class="pb-2 text-right font-semibold">Strk</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(team, i) in rows"
          :key="team.abbr"
          class="border-t border-ink/10"
          :class="{ 'border-t-2 border-t-ink/40': i === 6 }"
        >
          <td
            class="num w-6 py-1.5 font-display text-lg font-extrabold text-muted"
          >
            {{ i + 1 }}
          </td>
          <td class="py-1.5">
            <span class="flex items-center gap-2">
              <img
                :src="getTeamImageUrl(team.abbr)"
                :alt="team.abbr"
                class="h-5 w-5 object-contain"
              />
              <span class="font-semibold">{{ team.abbr }}</span>
              <span
                v-if="playingToday.has(team.abbr)"
                class="h-1.5 w-1.5 rounded-full bg-ink"
              />
            </span>
          </td>
          <td class="num py-1.5 text-right font-semibold">
            {{ team.wins }}–{{ team.losses }}
          </td>
          <td class="num py-1.5 text-right text-muted">
            {{ team.gamesBehind }}
          </td>
          <td
            class="num py-1.5 text-right text-xs font-bold"
            :class="
              team.streak.startsWith('W')
                ? 'text-win'
                : team.streak.startsWith('L')
                  ? 'text-loss'
                  : 'text-muted'
            "
          >
            {{ team.streak }}
          </td>
        </tr>
      </tbody>
    </table>
  </RailPanel>
</template>

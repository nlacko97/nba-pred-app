<script setup>
import { computed } from 'vue'

const props = defineProps({
  teams: {
    type: Array,
    required: true,
  },
  userSummary: {
    type: Object,
    required: true,
  },
})

// Computed properties for best and worst teams
const bestTeams = computed(() => {
  if (
    !props.userSummary.best_team_ids ||
    !props.userSummary.best_team_accuracy ||
    props.teams.length === 0
  ) {
    return []
  }

  const teamsWithAccuracy = props.userSummary.best_team_ids.map(
    (teamId, index) => {
      const team = props.teams.find(t => t.id === teamId)
      return {
        id: teamId,
        name: team?.name || 'Unknown Team',
        code: team?.abbreviation || 'UNK',
        accuracy: props.userSummary.best_team_accuracy[index] || 0,
      }
    },
  )

  // Sort by accuracy in descending order (highest first)
  return teamsWithAccuracy.sort((a, b) => b.accuracy - a.accuracy)
})

const worstTeams = computed(() => {
  if (
    !props.userSummary.worst_team_ids ||
    !props.userSummary.worst_team_accuracy ||
    props.teams.length === 0
  ) {
    return []
  }

  const teamsWithAccuracy = props.userSummary.worst_team_ids.map(
    (teamId, index) => {
      const team = props.teams.find(t => t.id === teamId)
      return {
        id: teamId,
        name: team?.name || 'Unknown Team',
        code: team?.abbreviation || 'UNK',
        accuracy: props.userSummary.worst_team_accuracy[index] || 0,
      }
    },
  )

  // Sort by accuracy in ascending order (lowest first)
  return teamsWithAccuracy.sort((a, b) => a.accuracy - b.accuracy)
})

// Handle image loading errors
function handleImageError(event) {
  event.target.style.display = 'none'
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        🏆 Team Performance
      </h3>
      <div class="text-sm text-gray-500 dark:text-gray-400">
        Top 3 & Worst 3 Teams
      </div>
    </div>
    <div>
      <div class="grid grid-cols-1 gap-4 w-full">
        <!-- Best Teams Section -->
        <div v-if="bestTeams.length > 0" class="space-y-2">
          <h4
            class="text-sm font-medium text-green-600 dark:text-green-400 mb-2"
          >
            🏆 Top Performing Teams
          </h4>
          <div
            v-for="(team, index) in bestTeams"
            :key="team.id"
            class="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
          >
            <div class="flex items-center">
              <div
                class="flex items-center justify-center w-6 h-6 bg-green-500 text-white text-xs font-bold rounded-full mr-3"
              >
                {{ index + 1 }}
              </div>
              <img
                :src="`/src/assets/${team.code}/logo.svg`"
                :alt="`${team.name} logo`"
                class="w-8 h-8 mr-3"
                @error="handleImageError"
              />
              <div>
                <span
                  class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >{{ team.name }}</span
                >
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ team.code }}
                </p>
              </div>
            </div>
            <span class="text-lg font-bold text-green-600 dark:text-green-400">
              {{ team.accuracy }}%
            </span>
          </div>
        </div>

        <!-- Worst Teams Section -->
        <div v-if="worstTeams.length > 0" class="space-y-2">
          <h4 class="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
            📉 Worst Performing Teams
          </h4>
          <div
            v-for="(team, index) in worstTeams"
            :key="team.id"
            class="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg"
          >
            <div class="flex items-center">
              <div
                class="flex items-center justify-center w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full mr-3"
              >
                {{ index + 1 }}
              </div>
              <img
                :src="`/src/assets/${team.code}/logo.svg`"
                :alt="`${team.name} logo`"
                class="w-8 h-8 mr-3"
                @error="handleImageError"
              />
              <div>
                <span
                  class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >{{ team.name }}</span
                >
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ team.code }}
                </p>
              </div>
            </div>
            <span class="text-lg font-bold text-red-600 dark:text-red-400">
              {{ team.accuracy }}%
            </span>
          </div>
        </div>

        <!-- No Data State -->
        <div
          v-if="bestTeams.length === 0 && worstTeams.length === 0"
          class="flex items-center justify-center py-8"
        >
          <div class="text-center">
            <div class="text-gray-400 dark:text-gray-500 text-4xl mb-2">🏀</div>
            <p class="text-gray-500 dark:text-gray-400">
              No team performance data available
            </p>
          </div>
        </div>

        <!-- Overall Team Accuracy -->
        <div
          class="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-t border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center">
            <div
              class="w-8 h-8 bg-blue-500 rounded-full mr-3 flex items-center justify-center"
            >
              <span class="text-white font-bold text-sm">NBA</span>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >Overall</span
              >
              <p class="text-xs text-gray-500 dark:text-gray-400">All Teams</p>
            </div>
          </div>
          <span class="text-lg font-bold text-blue-600 dark:text-blue-400">
            {{ userSummary.accuracy }}%
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

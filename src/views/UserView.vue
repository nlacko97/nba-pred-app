<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLeaderboardStatsStore } from '../stores/leaderboardStats'

const props = defineProps({
  id: String,
})

const router = useRouter()
const leaderboardStore = useLeaderboardStatsStore()

const user = ref(null)
const rank = ref(null)
const loading = ref(true)

const navigateBack = () => {
  router.push({ name: 'leaderboard' })
}

onMounted(async () => {
  loading.value = true
  try {
    const stats = leaderboardStore.sortedStats
    const userIndex = stats.findIndex(u => u.user_id === props.id)

    if (userIndex !== -1) {
      user.value = stats[userIndex]
      rank.value = userIndex + 1
    } else {
      await leaderboardStore.fetchStats()
      const updatedStats = leaderboardStore.sortedStats
      const updatedIndex = updatedStats.findIndex(u => u.user_id === props.id)

      if (updatedIndex !== -1) {
        user.value = updatedStats[updatedIndex]
        rank.value = updatedIndex + 1
      }
    }
  } catch (error) {
    console.error('Error loading user details:', error)
  } finally {
    loading.value = false
  }
})

const getMedalEmoji = rank => {
  const medals = ['🥇', '🥈', '🥉']
  return medals[rank - 1] || null
}

const getAccuracyColor = accuracy => {
  if (accuracy >= 70) return '#3b82f6'
  if (accuracy >= 50) return '#f59e0b'
  return '#ef4444'
}

const getAccuracyGradientDashoffset = accuracy => {
  const circumference = 2 * Math.PI * 45
  return circumference - (accuracy / 100) * circumference
}
</script>

<template>
  <div class="py-6 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
    <!-- Back Button -->
    <button
      @click="navigateBack"
      class="mb-6 flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
    >
      <svg
        class="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 19l-7-7 7-7"
        />
      </svg>
      Back to Leaderboard
    </button>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="text-center">
        <div
          class="animate-spin inline-block w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full mb-4"
        ></div>
        <p class="text-gray-600 dark:text-gray-400">Loading user details...</p>
      </div>
    </div>

    <!-- User Not Found -->
    <div v-else-if="!user" class="flex items-center justify-center py-16">
      <div class="text-center">
        <div class="text-5xl mb-4">❌</div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          User not found
        </h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          We couldn't find this user in the leaderboard.
        </p>
        <button
          @click="navigateBack"
          class="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Return to Leaderboard
        </button>
      </div>
    </div>

    <!-- User Details -->
    <div v-else class="space-y-6">
      <!-- Header Card -->
      <div
        class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 sm:p-8"
      >
        <div
          class="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6"
        >
          <!-- Avatar Section -->
          <div class="relative flex-shrink-0">
            <img
              v-if="user.avatar_url"
              :src="user.avatar_url"
              :alt="`${user.username}'s avatar`"
              class="w-20 sm:w-24 h-20 sm:h-24 rounded-full border-4 border-blue-500 object-cover shadow-lg"
            />
            <div
              v-else
              class="w-20 sm:w-24 h-20 sm:h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-2xl sm:text-3xl shadow-lg border-4 border-blue-500"
            >
              {{ user.full_name.charAt(0).toUpperCase() }}
            </div>

            <!-- Rank Badge -->
            <div
              v-if="getMedalEmoji(rank)"
              class="absolute -bottom-1 -right-1 text-3xl sm:text-4xl drop-shadow-lg bg-white dark:bg-gray-800 rounded-full w-10 sm:w-12 h-10 sm:h-12 flex items-center justify-center border-2 border-gray-200 dark:border-gray-700"
            >
              {{ getMedalEmoji(rank) }}
            </div>
            <div
              v-else
              class="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full w-10 sm:w-12 h-10 sm:h-12 flex items-center justify-center text-xs sm:text-sm font-bold shadow-lg border-2 border-white dark:border-gray-800"
            >
              #{{ rank }}
            </div>
          </div>

          <!-- User Info -->
          <div class="flex-1 min-w-0">
            <div class="flex flex-col gap-1 mb-2">
              <h1
                class="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-white truncate"
              >
                {{ user.full_name }}
              </h1>
              <span
                class="px-2 sm:px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-semibold rounded-full w-fit"
              >
                Rank #{{ rank }}
              </span>
            </div>
            <div class="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              <div>
                Season: {{ leaderboardStore.selectedSeason }}-{{
                  parseInt(leaderboardStore.selectedSeason) + 1
                }}
              </div>
              <div>
                {{
                  leaderboardStore.isPostseason
                    ? '🏆 Postseason'
                    : '🏀 Regular Season'
                }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Accuracy Ring Section -->
      <div
        class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-8"
      >
        <!-- Large Circular Progress -->
        <div class="flex-shrink-0">
          <div class="relative w-32 sm:w-40 h-32 sm:h-40">
            <svg class="w-full h-full" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                :stroke="getAccuracyColor(user.accuracy)"
                stroke-width="3"
                stroke-dasharray="282.7"
                :stroke-dashoffset="
                  getAccuracyGradientDashoffset(user.accuracy)
                "
                stroke-linecap="round"
                class="transition-all duration-500"
                style="transform: rotate(-90deg); transform-origin: 50% 50%"
              />
              <text
                x="50"
                y="50"
                text-anchor="middle"
                dominant-baseline="middle"
                class="fill-gray-900 dark:fill-white"
                style="font-size: 28px; font-weight: 700"
              >
                {{ user.accuracy.toFixed(1) }}
              </text>
              <text
                x="50"
                y="68"
                text-anchor="middle"
                dominant-baseline="middle"
                class="fill-gray-500 dark:fill-gray-400"
                style="font-size: 11px; font-weight: 500"
              >
                %
              </text>
            </svg>
          </div>
        </div>

        <!-- Accuracy Insights -->
        <div class="flex-1 w-full">
          <h3
            class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6"
          >
            Performance
          </h3>
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p
                  class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1"
                >
                  Correct
                </p>
                <p
                  class="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400"
                >
                  {{ user.correct_picks }}
                </p>
              </div>
              <div>
                <p
                  class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1"
                >
                  Incorrect
                </p>
                <p
                  class="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400"
                >
                  {{ user.total_picks - user.correct_picks }}
                </p>
              </div>
            </div>

            <div class="pt-2">
              <div class="flex justify-between items-center mb-2">
                <span
                  class="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Total Picks
                </span>
                <span
                  class="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ user.total_picks }}
                </span>
              </div>
              <div
                class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden"
              >
                <div
                  class="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full"
                  :style="{
                    width: `${(user.correct_picks / user.total_picks) * 100}%`,
                  }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Score Metrics -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- Total Score -->
        <div
          class="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-5 sm:p-6"
        >
          <div
            class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 font-medium"
          >
            Total Score
          </div>
          <div
            class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white"
          >
            {{ user.total_score }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-500 mt-3">
            Points earned
          </div>
        </div>

        <!-- Average per Win -->
        <div
          class="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-5 sm:p-6"
        >
          <div
            class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 font-medium"
          >
            Avg per Win
          </div>
          <div
            class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white"
          >
            {{ (user.total_score / (user.correct_picks || 1)).toFixed(1) }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-500 mt-3">
            Points when correct
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

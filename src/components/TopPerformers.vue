<script setup>
import { onMounted, onUnmounted, computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDailyResultsStore } from '../stores/dailyResults'
import { useGlobalStore } from '../stores/global'

const dailyResultsStore = useDailyResultsStore()
const globalStore = useGlobalStore()
const { userId } = storeToRefs(globalStore)
const { allPlayerResults, userResults, loading, formattedDate } =
  storeToRefs(dailyResultsStore)

const isCollapsed = ref(false)
let stalenessCheckInterval = null

const checkAndRefreshIfStale = () => {
  if (dailyResultsStore.isCacheStale() && userId.value) {
    dailyResultsStore.refreshDailyResults(userId.value)
  }
}

const handleVisibilityChange = () => {
  // When user returns to the tab/window, immediately check for stale data
  if (!document.hidden) {
    checkAndRefreshIfStale()
  }
}

onMounted(() => {
  if (userId.value) {
    // Check if cache is stale and refresh if needed
    if (dailyResultsStore.isCacheStale()) {
      dailyResultsStore.refreshDailyResults(userId.value)
    } else {
      dailyResultsStore.initializeDailyResults(userId.value)
    }
  }

  // Listen for page visibility changes (tab switching, laptop wake, etc.)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // Also listen for focus event (when window regains focus)
  window.addEventListener('focus', checkAndRefreshIfStale)

  // Background check every 5 minutes as fallback
  // (in case user keeps page visible but inactive)
  stalenessCheckInterval = setInterval(() => {
    checkAndRefreshIfStale()
  }, 300000) // Check every 5 minutes
})

onUnmounted(() => {
  if (stalenessCheckInterval) {
    clearInterval(stalenessCheckInterval)
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('focus', checkAndRefreshIfStale)
})

const topThree = computed(() => {
  return allPlayerResults.value.slice(0, 3)
})

const userInTopThree = computed(() => {
  if (!userResults.value) return false
  return topThree.value.some(p => p.user_id === userResults.value.user_id)
})

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}
</script>

<template>
  <section v-if="!loading && topThree.length > 0" class="card mb-6">
    <button
      @click="toggleCollapse"
      class="card-header flex justify-between items-center w-full text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
    >
      <h2 class="text-lg font-bold flex items-center gap-2">
        Last Day's Winners
        <span class="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2"
          >({{ formattedDate }})</span
        >
        <!-- Loading indicator -->
        <svg
          v-if="loading"
          class="animate-spin h-4 w-4 text-blue-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </h2>
      <svg
        class="w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-200"
        :class="{ 'rotate-180': !isCollapsed }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>

    <div v-show="!isCollapsed" class="p-4 transition-all duration-200">
      <!-- Top 3 Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
        <div
          v-for="(player, index) in topThree"
          :key="player.user_id"
          class="relative flex items-center p-4 rounded-xl border transition-all duration-300 bg-white dark:bg-gray-800/50"
          :class="[
            player.user_id === userId
              ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900 border-blue-200 dark:border-blue-800'
              : 'border-gray-100 dark:border-gray-700',
          ]"
        >
          <!-- Rank -->
          <div
            class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-700/50 mr-3 font-mono font-bold text-gray-500 dark:text-gray-400"
          >
            {{ index + 1 }}
          </div>

          <!-- Avatar -->
          <div class="flex-shrink-0 mr-3">
            <img
              v-if="player.avatar_url"
              :src="player.avatar_url"
              :alt="player.username"
              class="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-gray-800 shadow-sm"
            />
            <div
              v-else
              class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white dark:ring-gray-800 shadow-sm"
            >
              {{
                (player.username || player.user_full_name || '?')
                  .charAt(0)
                  .toUpperCase()
              }}
            </div>
          </div>

          <!-- Player Info -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold truncate text-gray-900 dark:text-white">
              {{ player.user_full_name }}
            </p>
            <div
              class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1"
            >
              <span
                class="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded"
              >
                {{ player.points }} Pts
              </span>
              <span class="flex items-center gap-1">
                {{ player.correct_picks }}/{{ player.total_picks }}
                <span class="text-gray-300 dark:text-gray-600">|</span>
                {{ Math.round(player.accuracy) }}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- User Comparison (if not in top 3) -->
      <div
        v-if="userResults && !userInTopThree"
        class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800"
      >
        <div class="flex items-center justify-between text-sm mb-2">
          <span class="text-gray-500 dark:text-gray-400 font-medium"
            >Your Performance</span
          >
        </div>
        <div
          class="flex items-center p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10"
        >
          <div
            class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 font-bold text-sm mr-3 font-mono"
          >
            #{{ dailyResultsStore.userRank }}
          </div>

          <!-- User Avatar -->
          <div class="flex-shrink-0 mr-3">
            <img
              v-if="userResults.avatar_url"
              :src="userResults.avatar_url"
              class="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
            />
            <div
              v-else
              class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white dark:ring-gray-800"
            >
              {{
                (userResults.username || userResults.user_full_name || 'Y')
                  .charAt(0)
                  .toUpperCase()
              }}
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <p class="font-semibold text-gray-900 dark:text-white">You</p>
            <div class="flex items-center gap-3 text-xs font-medium mt-1">
              <span
                class="text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded"
                >{{ userResults.points || 0 }} Pts</span
              >
              <span class="text-gray-500 dark:text-gray-400">
                {{ userResults.correct_picks }}/{{ userResults.total_picks }}
                <span class="mx-1 opacity-50">|</span>
                {{ Math.round(userResults.accuracy) }}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cup-card {
  @apply border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30;
}
</style>

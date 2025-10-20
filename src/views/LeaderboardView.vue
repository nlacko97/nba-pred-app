<script setup>
import { onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLeaderboardStatsStore } from '../stores/leaderboardStats'
import { useGlobalStore } from '../stores/global'
import FilterControls from '../components/FilterControls.vue'
import LeaderboardCard from '../components/LeaderboardCard.vue'

const router = useRouter()
const leaderboardStore = useLeaderboardStatsStore()
const globalStore = useGlobalStore()

const session = computed(() => globalStore.session)
const userId = computed(() => globalStore.userId)

const sortedStats = computed(() => leaderboardStore.sortedStats)
const loading = computed(() => leaderboardStore.loading)
const selectedSeason = computed({
  get: () => leaderboardStore.selectedSeason,
  set: value => {
    leaderboardStore.selectedSeason = value
  },
})
const isPostseason = computed({
  get: () => leaderboardStore.isPostseason,
  set: value => {
    leaderboardStore.isPostseason = value
  },
})

const navigateToUser = userId => {
  router.push({ name: 'user', params: { id: userId } })
}

const handleFilterChange = async (season, postseason) => {
  await leaderboardStore.setSeason(season, postseason)
}

onMounted(async () => {
  if (session.value) {
    await leaderboardStore.fetchStats()
  }
})

watch(session, async newSession => {
  if (newSession) {
    await leaderboardStore.fetchStats()
  }
})
</script>

<template>
  <div class="py-6 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
    <!-- Filter Controls -->
    <FilterControls
      v-if="session"
      :selected-season="selectedSeason"
      :is-postseason="isPostseason"
      @update-filters="handleFilterChange"
      class="mb-8"
    />

    <!-- Leaderboard Content -->
    <div v-if="session" class="space-y-2">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="text-center">
          <div
            class="animate-spin inline-block w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full mb-4"
          ></div>
          <p class="text-gray-600 dark:text-gray-400">Loading leaderboard...</p>
        </div>
      </div>

      <div v-else-if="sortedStats.length > 0">
        <LeaderboardCard
          v-for="(user, index) in sortedStats"
          :key="user.user_id"
          :user="user"
          :rank="index + 1"
          :is-current-user="user.user_id === userId"
          @click="navigateToUser(user.user_id)"
        />
      </div>

      <div v-else class="flex items-center justify-center py-12">
        <div class="text-center">
          <div class="text-5xl mb-4">📭</div>
          <p class="text-gray-600 dark:text-gray-400 text-lg">
            No data available for this selection
          </p>
        </div>
      </div>
    </div>

    <!-- Login Prompt -->
    <div v-else class="flex items-center justify-center py-16">
      <div class="text-center">
        <div class="text-5xl mb-4">🏀</div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Sign in to view the leaderboard
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
          Use the login button in the top navigation to get started
        </p>
      </div>
    </div>
  </div>
</template>

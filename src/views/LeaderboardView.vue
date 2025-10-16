<script setup>
import { computed, onMounted, watch } from 'vue'
import { useLeaderboardStore } from '../stores/leaderboard'
import { useGlobalStore } from '../stores/global'
import PerformanceChart from '../components/PerformanceChart.vue'
import TeamPerformance from '../components/TeamPerformance.vue'

const leaderboardStore = useLeaderboardStore()
const globalStore = useGlobalStore()

// Reactive computed properties from stores
const session = computed(() => globalStore.session)
const userId = computed(() => globalStore.userId)

const leaderboard = computed(() => leaderboardStore.leaderboard)
const yesterdayReport = computed(() => leaderboardStore.yesterdayReport)
const teams = computed(() => leaderboardStore.teams)

const expandedUsers = computed(() => leaderboardStore.expandedUsers)
const isLeaderboardPlayoff = computed(
  () => leaderboardStore.isLeaderboardPlayoff,
)

onMounted(async () => {
  // Only initialize leaderboard if user is logged in
  if (session.value) {
    await leaderboardStore.initializeLeaderboard()
  }
})

// Watch session changes to initialize leaderboard when user logs in
watch(session, async (newSession, oldSession) => {
  if (newSession && !oldSession) {
    await leaderboardStore.initializeLeaderboard()
  }
})
</script>

<template>
  <div class="py-4 space-y-6">
    <!-- KPIs -->
    <section class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="kpi">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs uppercase tracking-wide text-gray-500">
              Total Players
            </p>
            <p class="text-3xl font-bold leading-tight">
              {{ leaderboard.length }}
            </p>
            <p class="text-xs text-gray-500 mt-1">Active predictors</p>
          </div>
          <div class="text-4xl">👥</div>
        </div>
      </div>
      <div class="kpi">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs uppercase tracking-wide text-gray-500">
              Avg Accuracy
            </p>
            <p class="text-3xl font-bold leading-tight">
              {{
                Math.round(
                  leaderboard.reduce((acc, user) => acc + user.accuracy, 0) /
                    (leaderboard.length || 1),
                )
              }}%
            </p>
            <p class="text-xs text-gray-500 mt-1">Community average</p>
          </div>
          <div class="text-4xl">🎯</div>
        </div>
      </div>
      <div class="kpi">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs uppercase tracking-wide text-gray-500">
              Total Picks
            </p>
            <p class="text-3xl font-bold leading-tight">
              {{
                leaderboard
                  .reduce((acc, user) => acc + user.totalPicks, 0)
                  .toLocaleString()
              }}
            </p>
            <p class="text-xs text-gray-500 mt-1">Predictions made</p>
          </div>
          <div class="text-4xl">📊</div>
        </div>
      </div>
    </section>

    <!-- Season Selector -->
    <section class="card">
      <div class="card-body">
        <div class="flex items-center gap-4">
          <label class="text-sm font-semibold text-gray-700 dark:text-gray-300"
            >Season:</label
          >
          <select
            v-model="leaderboardStore.selectedSeason"
            @change="leaderboardStore.getUsers(isLeaderboardPlayoff.value)"
            class="input"
          >
            <option value="2024">2024-25 🏀</option>
            <option value="2025">2025-26 🚀 (Upcoming)</option>
          </select>
        </div>
      </div>
    </section>

    <!-- Season Toggle -->
    <section class="card">
      <div class="p-2">
        <button
          @click="leaderboardStore.getUsers(false)"
          :class="['btn', !isLeaderboardPlayoff ? 'btn-primary' : 'btn-ghost']"
        >
          🏀 Regular Season
        </button>
        <button
          @click="leaderboardStore.getUsers(true)"
          :class="[
            'btn ml-2',
            isLeaderboardPlayoff ? 'btn-primary' : 'btn-ghost',
          ]"
        >
          🏆 Playoffs
        </button>
      </div>
    </section>

    <!-- Yesterday's Report -->
    <section v-if="yesterdayReport" class="card">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold">Yesterday's Performance</h3>
            <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
              You got <strong>{{ yesterdayReport.correct }}</strong> out of
              <strong>{{ yesterdayReport.total }}</strong> picks correct!
            </p>
          </div>
          <div class="text-3xl">
            {{
              yesterdayReport.accuracy >= 70
                ? '🔥'
                : yesterdayReport.accuracy >= 40
                  ? '👍'
                  : '💪'
            }}
          </div>
        </div>
      </div>
    </section>

    <!-- Leaderboard -->
    <section v-if="session" class="card overflow-hidden">
      <div class="card-header">
        <div>
          <h2 class="text-xl font-bold">Player Rankings</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Detailed performance breakdown
          </p>
        </div>
      </div>

      <div class="divide-y divide-gray-200 dark:divide-gray-800">
        <div
          v-for="(user, index) in leaderboard"
          :key="user.id"
          :class="[
            'transition-colors',
            user.id === userId
              ? 'bg-blue-50 dark:bg-blue-900/20'
              : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
          ]"
        >
          <!-- Row -->
          <div class="flex items-center justify-between min-h-[60px] px-6">
            <!-- Left: Rank + Avatar + Name -->
            <div class="flex items-center gap-4 flex-shrink-0 w-48">
              <div class="relative">
                <img
                  :src="user.avatar_url"
                  alt="User Avatar"
                  class="w-12 h-12 rounded-full border border-gray-300 dark:border-gray-700 object-cover"
                />
                <span
                  v-if="index < 3"
                  :class="{
                    'absolute -top-1 -right-1 text-xs font-bold py-0.5 px-1.5 rounded-full shadow-sm': true,
                    'bg-yellow-400 text-yellow-900': index === 0,
                    'bg-gray-400 text-gray-900': index === 1,
                    'bg-amber-400 text-amber-900': index === 2,
                  }"
                  >{{ ['🥇', '🥈', '🥉'][index] }}</span
                >
              </div>
              <div class="min-w-0">
                <div class="text-sm font-bold text-gray-600 dark:text-gray-400">
                  #{{ index + 1 }}
                </div>
                <h3 class="text-base font-bold truncate">{{ user.name }}</h3>
                <div
                  v-if="user.id === userId"
                  class="text-[10px] font-semibold text-blue-600 dark:text-blue-400"
                >
                  YOU
                </div>
              </div>
            </div>

            <!-- Middle: Stats -->
            <div class="flex-1 flex justify-center">
              <div
                class="grid grid-cols-2 sm:grid-cols-4 gap-6 w-full max-w-sm"
              >
                <div class="text-center">
                  <div
                    class="text-base md:text-lg font-bold text-blue-600 dark:text-blue-400"
                  >
                    {{ user.points }}
                  </div>
                  <div class="text-xs text-gray-500">Points</div>
                </div>
                <div class="text-center">
                  <div
                    class="text-base md:text-lg font-bold text-green-600 dark:text-green-400"
                  >
                    {{ user.accuracy }}%
                  </div>
                  <div class="text-xs text-gray-500">Accuracy</div>
                </div>
                <div class="hidden sm:block text-center">
                  <div
                    class="text-base md:text-lg font-bold text-purple-600 dark:text-purple-400"
                  >
                    {{ user.totalPicks }}
                  </div>
                  <div class="text-xs text-gray-500">Picks</div>
                </div>
                <div class="hidden sm:block text-center">
                  <div
                    class="text-base md:text-lg font-bold text-orange-600 dark:text-orange-400"
                  >
                    {{ leaderboardStore.calculateWinStreak(user) }}
                  </div>
                  <div class="text-xs text-gray-500">Streak</div>
                </div>
              </div>
            </div>

            <!-- Right: Expand -->
            <div class="flex-shrink-0 w-12 flex justify-center">
              <button
                @click="leaderboardStore.toggleUserExpansion(user.id)"
                class="icon-btn"
                :class="{
                  'text-blue-600 dark:text-blue-400': expandedUsers.has(
                    user.id,
                  ),
                  'text-gray-400 dark:text-gray-500': !expandedUsers.has(
                    user.id,
                  ),
                }"
              >
                <svg
                  class="w-5 h-5 transition-transform"
                  :class="{ 'rotate-180': expandedUsers.has(user.id) }"
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
            </div>
          </div>

          <!-- Expanded -->
          <div
            v-if="expandedUsers.has(user.id)"
            class="mt-4 pt-4 pb-6 px-4 border-t border-gray-200 dark:border-gray-800"
          >
            <!-- Mini Stats -->
            <div
              class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 w-full"
            >
              <div
                class="rounded-lg p-2 sm:p-3 text-center bg-gray-50 dark:bg-gray-800/40"
              >
                <div
                  class="text-lg font-bold text-indigo-600 dark:text-indigo-400"
                >
                  {{ leaderboardStore.getBestDayAccuracy(user).toFixed(0) }}%
                </div>
                <div
                  class="text-xs text-indigo-600 dark:text-indigo-400 font-medium"
                >
                  Best Day
                </div>
              </div>
              <div
                class="rounded-lg p-2 sm:p-3 text-center bg-gray-50 dark:bg-gray-800/40"
              >
                <div class="text-lg font-bold text-pink-600 dark:text-pink-400">
                  {{ leaderboardStore.getAveragePointsPerPick(user) }}
                </div>
                <div
                  class="text-xs text-pink-600 dark:text-pink-400 font-medium"
                >
                  Avg Points/Pick
                </div>
              </div>
              <div
                class="rounded-lg p-2 sm:p-3 text-center bg-gray-50 dark:bg-gray-800/40"
              >
                <div class="text-lg font-bold text-teal-600 dark:text-teal-400">
                  {{
                    leaderboardStore.calculateConsistencyScore(user).toFixed(0)
                  }}%
                </div>
                <div
                  class="text-xs text-teal-600 dark:text-teal-400 font-medium"
                >
                  Consistency
                </div>
              </div>
              <div
                class="rounded-lg p-2 sm:p-3 text-center bg-gray-50 dark:bg-gray-800/40"
              >
                <span
                  class="pill"
                  :class="{
                    'pill-green':
                      leaderboardStore.getPerformanceTrend(user) ===
                      'improving',
                    'pill-red':
                      leaderboardStore.getPerformanceTrend(user) ===
                      'declining',
                    'pill-blue':
                      leaderboardStore.getPerformanceTrend(user) === 'stable',
                    'pill-gray':
                      leaderboardStore.getPerformanceTrend(user) ===
                      'insufficient-data',
                  }"
                >
                  {{
                    leaderboardStore.getPerformanceTrend(user) === 'improving'
                      ? '📈 Improving'
                      : leaderboardStore.getPerformanceTrend(user) ===
                          'declining'
                        ? '📉 Declining'
                        : leaderboardStore.getPerformanceTrend(user) ===
                            'stable'
                          ? '➡️ Stable'
                          : '❓ Need Data'
                  }}
                </span>
                <div
                  class="text-xs text-cyan-600 dark:text-cyan-400 font-medium mt-1"
                >
                  Trend
                </div>
              </div>
            </div>

            <!-- Performance Trend & Win/Loss Ratio -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 w-full">
              <div>
                <h4
                  class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
                >
                  Performance Trend
                </h4>
                <div class="flex items-center gap-2">
                  <div
                    class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3"
                  >
                    <div
                      class="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full"
                      :style="{ width: `${user.accuracy}%` }"
                    ></div>
                  </div>
                  <span
                    class="text-sm font-medium text-gray-600 dark:text-gray-400"
                    >{{ user.accuracy }}%</span
                  >
                </div>
              </div>
              <div>
                <h4
                  class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
                >
                  Win/Loss Ratio
                </h4>
                <div class="flex items-center gap-2">
                  <div
                    class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden"
                  >
                    <div class="flex h-full">
                      <div
                        class="bg-green-500"
                        :style="{
                          width: `${(user.points / user.totalPicks) * 100}%`,
                        }"
                      ></div>
                      <div
                        class="bg-red-500"
                        :style="{
                          width: `${((user.totalPicks - user.points) / user.totalPicks) * 100}%`,
                        }"
                      ></div>
                    </div>
                  </div>
                  <span
                    class="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap"
                    >{{ user.points }}W/{{
                      user.totalPicks - user.points
                    }}L</span
                  >
                </div>
              </div>
            </div>

            <!-- Charts -->
            <div class="mb-4 w-full overflow-x-auto">
              <PerformanceChart :user="user" />
            </div>
            <div class="mb-4 w-full overflow-x-auto">
              <TeamPerformance :teams="teams" :user-summary="user" />
            </div>

            <!-- Recent Performance -->
            <div>
              <h4
                class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3"
              >
                Recent Performance (Last 7 Days)
              </h4>
              <div
                class="grid grid-cols-7 gap-1 sm:gap-2 w-full overflow-x-auto"
              >
                <div
                  v-for="(acc, date) in Object.entries(
                    user.latestDailyAccuracy || {},
                  ).slice(-7)"
                  :key="date"
                  class="text-center p-1.5 sm:p-2 rounded-lg text-xs font-medium"
                  :class="{
                    'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200':
                      acc[1] >= 70,
                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200':
                      acc[1] >= 40 && acc[1] < 70,
                    'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200':
                      acc[1] < 40,
                    'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400':
                      !acc[1] && acc[1] !== 0,
                  }"
                >
                  <div class="font-bold text-xs sm:text-sm">
                    {{ acc[1].toFixed(0) }}%
                  </div>
                  <div class="text-[9px] sm:text-[10px] mt-1">
                    {{ new Date(acc[0]).toDateString() }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Login Prompt for non-logged-in users -->
    <section v-if="!session" class="card">
      <div class="card-body">
        <div class="text-center">
          <h1 class="text-3xl font-bold mb-4">🏆 Leaderboard</h1>
          <p class="text-lg text-gray-600 dark:text-gray-300 mb-6">
            Please log in using the button in the top navigation to view the
            leaderboard
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

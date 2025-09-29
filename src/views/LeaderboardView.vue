<script setup>
import { computed, onMounted, nextTick, watch } from 'vue'
import { useLeaderboardStore } from '../stores/leaderboard'
import { useGlobalStore } from '../stores/global'
import { supabase } from '../lib/supabaseClient'
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

window.handleSignInWithGoogle = handleSignInWithGoogle

onMounted(async () => {
  await globalStore.initializeAuth()

  // Only initialize leaderboard if user is logged in
  if (session.value) {
    await leaderboardStore.initializeLeaderboard()
  } else {
    // Initialize Google Sign-In only when not logged in
    const initializeGoogleSignIn = () => {
      if (window.google && window.google.accounts) {
        console.log('Google Sign-In initialized')
        try {
          window.google.accounts.id.initialize({
            client_id: getGoogleClientId(),
            callback: handleSignInWithGoogle,
            auto_select: false,
            cancel_on_tap_outside: true,
          })
          window.google.accounts.id.renderButton(
            document.querySelector('.g_id_signin'),
            {
              theme: 'outline',
              size: 'large',
              type: 'standard',
              text: 'signin_with',
              shape: 'rectangular',
              logo_alignment: 'left',
            },
          )
          console.log('Google Sign-In button rendered')
        } catch (error) {
          console.error('Google Sign-In initialization error:', error)
        }
      } else {
        console.log('Google Sign-In not loaded yet')
      }
    }

    nextTick(() => {
      initializeGoogleSignIn()
    })

    // Also try to initialize when Google script loads
    const checkGoogleLoaded = () => {
      if (window.google && window.google.accounts) {
        initializeGoogleSignIn()
      } else {
        setTimeout(checkGoogleLoaded, 100)
      }
    }
    checkGoogleLoaded()
  }
})

// Watch session changes to initialize leaderboard when user logs in
watch(session, async (newSession, oldSession) => {
  if (newSession && !oldSession) {
    // User just logged in, initialize leaderboard
    await leaderboardStore.initializeLeaderboard()
  }
})

async function handleSignInWithGoogle(response) {
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: response.credential,
  })

  if (error) {
    console.error('Google Sign-In Error:', error)
  } else {
    console.log('Google Sign-In Success:')
  }
}

async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    // Session will be updated automatically by the auth state listener
  } catch (error) {
    alert(error.message)
  }
}

function getGoogleClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-800">
    <!-- Content -->
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 bg-gray-50 dark:bg-gray-800"
    >
      <!-- Stats Overview Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div
          class="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow"
        >
          <div class="flex items-center justify-between">
            <div>
              <p
                class="text-blue-100 text-sm font-medium uppercase tracking-wide"
              >
                Total Players
              </p>
              <p class="text-4xl font-bold mt-1">{{ leaderboard.length }}</p>
              <p class="text-blue-200 text-xs mt-1">Active predictors</p>
            </div>
            <div class="text-5xl opacity-80">👥</div>
          </div>
        </div>

        <div
          class="bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow"
        >
          <div class="flex items-center justify-between">
            <div>
              <p
                class="text-green-100 text-sm font-medium uppercase tracking-wide"
              >
                Avg Accuracy
              </p>
              <p class="text-4xl font-bold mt-1">
                {{
                  Math.round(
                    leaderboard.reduce((acc, user) => acc + user.accuracy, 0) /
                      leaderboard.length,
                  )
                }}%
              </p>
              <p class="text-green-200 text-xs mt-1">Community average</p>
            </div>
            <div class="text-5xl opacity-80">🎯</div>
          </div>
        </div>

        <div
          class="bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow"
        >
          <div class="flex items-center justify-between">
            <div>
              <p
                class="text-purple-100 text-sm font-medium uppercase tracking-wide"
              >
                Total Picks
              </p>
              <p class="text-4xl font-bold mt-1">
                {{
                  leaderboard
                    .reduce((acc, user) => acc + user.totalPicks, 0)
                    .toLocaleString()
                }}
              </p>
              <p class="text-purple-200 text-xs mt-1">Predictions made</p>
            </div>
            <div class="text-5xl opacity-80">📊</div>
          </div>
        </div>
      </div>

      <!-- Season Selector -->
      <div class="flex justify-center mb-6">
        <div
          class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center space-x-4">
            <label
              class="text-sm font-semibold text-gray-700 dark:text-gray-300"
              >Season:</label
            >
            <select
              v-model="leaderboardStore.selectedSeason"
              @change="leaderboardStore.getUsers(isLeaderboardPlayoff.value)"
              class="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            >
              <option value="2024">2024-25 🏀</option>
              <option value="2025">2025-26 🚀 (Upcoming)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Season Toggle -->
      <div class="flex justify-center mb-8">
        <div
          class="bg-white dark:bg-gray-800 rounded-xl p-2 shadow-lg border border-gray-200 dark:border-gray-700"
        >
          <button
            @click="leaderboardStore.getUsers(false)"
            :class="[
              'px-8 py-3 rounded-lg font-semibold text-sm transition-all duration-200 transform',
              !isLeaderboardPlayoff
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg scale-105'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
            ]"
          >
            🏀 Regular Season
          </button>
          <button
            @click="leaderboardStore.getUsers(true)"
            :class="[
              'ml-4 px-8 py-3 rounded-lg font-semibold text-sm transition-all duration-200 transform',
              isLeaderboardPlayoff
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg scale-105'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
            ]"
          >
            🏆 Playoffs
          </button>
        </div>
      </div>

      <!-- Yesterday's Report -->
      <div
        class="bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 rounded-xl shadow-lg p-6 mb-8 text-white"
        v-if="yesterdayReport"
      >
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-xl font-bold mb-2">Yesterday's Performance</h3>
            <p class="text-indigo-100">
              You got <strong>{{ yesterdayReport.correct }}</strong> out of
              <strong>{{ yesterdayReport.total }}</strong> picks correct!
            </p>
          </div>
          <div class="text-4xl">
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
      <div v-if="session">
        <!-- Leaderboard - Takes up 3/4 of page -->
        <div
          class="bg-white dark:bg-gray-800 shadow-lg overflow-hidden"
          style="min-height: 75vh"
        >
          <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
              Player Rankings
            </h2>
            <p class="text-gray-600 dark:text-gray-300 mt-1">
              Detailed performance breakdown
            </p>
          </div>

          <div class="divide-y divide-gray-200 dark:divide-gray-700">
            <div
              v-for="(user, index) in leaderboard"
              :key="user.id"
              :class="[
                'hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
                user.id === userId
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                  : '',
              ]"
            >
              <!-- Compressed View -->
              <div class="flex items-center justify-between min-h-[60px] px-6">
                <!-- Left side: Rank, Avatar, Name -->
                <div class="flex items-center space-x-4 flex-shrink-0 w-48">
                  <!-- Rank and Avatar -->
                  <div class="flex-shrink-0">
                    <div class="relative">
                      <img
                        :src="user.avatar_url"
                        alt="User Avatar"
                        class="w-12 h-12 rounded-full border-2 border-gray-300 dark:border-gray-600 object-cover shadow-sm"
                      />
                      <span
                        v-if="index < 3"
                        :class="{
                          'absolute -top-1 -right-1 text-xs font-bold py-0.5 px-1.5 rounded-full flex items-center justify-center shadow-sm': true,
                          'bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900':
                            index === 0,
                          'bg-gradient-to-r from-gray-400 to-gray-500 text-gray-900':
                            index === 1,
                          'bg-gradient-to-r from-amber-400 to-amber-500 text-amber-900':
                            index === 2,
                        }"
                      >
                        {{ ['🥇', '🥈', '🥉'][index] }}
                      </span>
                    </div>
                  </div>

                  <!-- Rank and Name -->
                  <div class="flex flex-col justify-center min-w-0 flex-1">
                    <div
                      class="text-lg font-bold text-gray-600 dark:text-gray-400 leading-tight"
                    >
                      #{{ index + 1 }}
                    </div>
                    <h3
                      class="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate"
                    >
                      {{ user.name }}
                    </h3>
                    <div
                      v-if="user.id === userId"
                      class="text-xs font-semibold text-blue-600 dark:text-blue-400 leading-tight"
                    >
                      YOU
                    </div>
                  </div>
                </div>

                <!-- Center: Main Stats -->
                <div class="flex-1 flex justify-center">
                  <div
                    class="grid grid-cols-2 sm:grid-cols-4 gap-8 w-full max-w-sm"
                  >
                    <div class="flex flex-col items-center">
                      <div
                        class="text-base sm:text-lg md:text-xl font-bold text-blue-600 dark:text-blue-400 text-center whitespace-nowrap"
                      >
                        {{ user.points }}
                      </div>
                      <div
                        class="text-xs text-gray-500 dark:text-gray-400 text-center whitespace-nowrap"
                      >
                        Points
                      </div>
                    </div>

                    <div class="flex flex-col items-center">
                      <div
                        class="text-base sm:text-lg md:text-xl font-bold text-green-600 dark:text-green-400 text-center whitespace-nowrap"
                      >
                        {{ user.accuracy }}%
                      </div>
                      <div
                        class="text-xs text-gray-500 dark:text-gray-400 text-center whitespace-nowrap"
                      >
                        Accuracy
                      </div>
                    </div>

                    <!-- Hidden on mobile, visible on sm+ -->
                    <div class="hidden sm:flex flex-col items-center">
                      <div
                        class="text-lg md:text-xl font-bold text-purple-600 dark:text-purple-400 text-center whitespace-nowrap"
                      >
                        {{ user.totalPicks }}
                      </div>
                      <div
                        class="text-xs text-gray-500 dark:text-gray-400 text-center whitespace-nowrap"
                      >
                        Picks
                      </div>
                    </div>

                    <div class="hidden sm:flex flex-col items-center">
                      <div
                        class="text-lg md:text-xl font-bold text-orange-600 dark:text-orange-400 text-center whitespace-nowrap"
                      >
                        {{ leaderboardStore.calculateWinStreak(user) }}
                      </div>
                      <div
                        class="text-xs text-gray-500 dark:text-gray-400 text-center whitespace-nowrap"
                      >
                        Streak
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Right side: Expand Button -->
                <div class="flex-shrink-0 w-12 flex justify-center">
                  <button
                    @click="leaderboardStore.toggleUserExpansion(user.id)"
                    class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                      ></path>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Expanded View -->
              <div
                v-if="expandedUsers.has(user.id)"
                class="mt-4 pt-4 pb-6 px-4 border-t border-gray-200 dark:border-gray-700"
              >
                <!-- Detailed Stats Grid - Mobile: 2 cols, Tablet+: 4 cols -->
                <div
                  class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 w-full"
                >
                  <div
                    class="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 rounded-lg p-2 sm:p-3 text-center"
                  >
                    <div
                      class="text-lg font-bold text-indigo-600 dark:text-indigo-400"
                    >
                      {{
                        leaderboardStore.getBestDayAccuracy(user).toFixed(0)
                      }}%
                    </div>
                    <div
                      class="text-xs text-indigo-600 dark:text-indigo-400 font-medium"
                    >
                      Best Day
                    </div>
                  </div>

                  <div
                    class="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/30 dark:to-pink-800/30 rounded-lg p-2 sm:p-3 text-center"
                  >
                    <div
                      class="text-lg font-bold text-pink-600 dark:text-pink-400"
                    >
                      {{ leaderboardStore.getAveragePointsPerPick(user) }}
                    </div>
                    <div
                      class="text-xs text-pink-600 dark:text-pink-400 font-medium"
                    >
                      Avg Points/Pick
                    </div>
                  </div>

                  <div
                    class="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/30 dark:to-teal-800/30 rounded-lg p-2 sm:p-3 text-center"
                  >
                    <div
                      class="text-lg font-bold text-teal-600 dark:text-teal-400"
                    >
                      {{
                        leaderboardStore
                          .calculateConsistencyScore(user)
                          .toFixed(0)
                      }}%
                    </div>
                    <div
                      class="text-xs text-teal-600 dark:text-teal-400 font-medium"
                    >
                      Consistency
                    </div>
                  </div>

                  <div
                    class="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/30 dark:to-cyan-800/30 rounded-lg p-2 sm:p-3 text-center"
                  >
                    <span
                      class="px-2 py-1 rounded-full text-xs font-medium inline-block"
                      :class="{
                        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200':
                          leaderboardStore.getPerformanceTrend(user) ===
                          'improving',
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200':
                          leaderboardStore.getPerformanceTrend(user) ===
                          'declining',
                        'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200':
                          leaderboardStore.getPerformanceTrend(user) ===
                          'stable',
                        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400':
                          leaderboardStore.getPerformanceTrend(user) ===
                          'insufficient-data',
                      }"
                    >
                      {{
                        leaderboardStore.getPerformanceTrend(user) ===
                        'improving'
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
                    <div class="flex items-center space-x-2">
                      <div
                        class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3"
                      >
                        <div
                          class="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full transition-all duration-500"
                          :style="{ width: `${user.accuracy}%` }"
                        ></div>
                      </div>
                      <span
                        class="text-sm font-medium text-gray-600 dark:text-gray-400"
                      >
                        {{ user.accuracy }}%
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4
                      class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Win/Loss Ratio
                    </h4>
                    <div class="flex items-center space-x-2">
                      <div
                        class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden"
                      >
                        <div class="flex h-full">
                          <div
                            class="bg-green-500 transition-all duration-500"
                            :style="{
                              width: `${(user.points / user.totalPicks) * 100}%`,
                            }"
                          ></div>
                          <div
                            class="bg-red-500 transition-all duration-500"
                            :style="{
                              width: `${((user.totalPicks - user.points) / user.totalPicks) * 100}%`,
                            }"
                          ></div>
                        </div>
                      </div>
                      <span
                        class="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap"
                      >
                        {{ user.points }}W/{{ user.totalPicks - user.points }}L
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Performance Charts -->
                <div class="mb-4 w-full overflow-x-auto">
                  <PerformanceChart :user="user" />
                </div>

                <!-- Team Performance -->
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
                      class="text-center p-1.5 sm:p-2 rounded-lg text-xs font-medium transition-all"
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
        </div>
        <!-- Sign Out Button -->
        <div
          class="flex w-full justify-center p-4 sm:px-6 lg:px-8 pb-8 dark:bg-gray-800"
        >
          <button
            @click="signOut"
            class="px-8 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
          >
            🚪 Sign Out
          </button>
        </div>
      </div>

      <!-- Login Prompt for non-logged-in users -->
      <div v-if="!session" class="bg-gray-50 dark:bg-gray-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div class="text-center">
            <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              🏆 Leaderboard
            </h1>
            <p class="text-gray-600 dark:text-gray-300">
              Track your NBA prediction performance
            </p>
          </div>
        </div>
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div class="flex justify-center">
            <div
              class="h-80 bg-white dark:bg-gray-800 shadow-md flex flex-col items-center justify-center gap-8 rounded-xl w-full max-w-md"
            >
              <p
                class="font-thin text-xl text-gray-900 dark:text-white text-center"
              >
                Please log in to view the leaderboard 🏆
              </p>
              <div id="google-signin-container">
                <div
                  id="g_id_onload"
                  :data-client_id="getGoogleClientId()"
                  data-context="signin"
                  data-ux_mode="popup"
                  data-callback="handleSignInWithGoogle"
                  data-auto_prompt="false"
                  data-use_fedcm_for_prompt="true"
                ></div>
                <div
                  class="g_id_signin"
                  ref="googleSignInButton"
                  data-type="standard"
                  data-shape="rectangular"
                  data-theme="outline"
                  data-text="signin_with"
                  data-size="large"
                  data-logo_alignment="left"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

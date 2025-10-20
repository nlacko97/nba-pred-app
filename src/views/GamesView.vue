<script setup>
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useGamesStore } from '../stores/games'
import { useGlobalStore } from '../stores/global'
import ConfidenceSelector from '../components/ConfidenceSelector.vue'

const gamesStore = useGamesStore()
const globalStore = useGlobalStore()

// Reactive computed properties from stores
const {
  games,
  selectedDate,
  selectedDateMobile,
  loading,
  maxConfidencePerDay,
  usedConfidenceToday,
} = storeToRefs(gamesStore)
const { session, userId } = storeToRefs(globalStore)

const expandedInjuries = ref({})

// Check if selected date is today or future
const isTodayOrFuture = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const selected = new Date(selectedDate.value)
  selected.setHours(0, 0, 0, 0)
  return selected >= today
})

// Handle date changes
const handleDateChange = newDate => {
  gamesStore.selectedDate = newDate
  gamesStore.selectedDateMobile = newDate
}

const handleMobileDateChange = newDate => {
  gamesStore.selectedDateMobile = newDate
  gamesStore.selectedDate = newDate
}

onMounted(async () => {
  await gamesStore.initializeGames()
})

function getTeamImageUrl(teamAbbreviation) {
  return new URL(`../assets/${teamAbbreviation}/logo.svg`, import.meta.url).href
}

function createAssetUrl(assetPath) {
  return new URL(`./assets/${assetPath}`, import.meta.url).href
}

function formatISOTo24HourTime(date) {
  let hours = date.getHours()
  let minutes = date.getMinutes()

  if (hours < 10) hours = `0${hours}`
  if (minutes < 10) minutes = `0${minutes}`

  return `${hours}:${minutes}`
}

function getStatus(game) {
  if (gamesStore.isValidDate(game.game_status)) {
    return formatISOTo24HourTime(new Date(game.game_status))
  }
  return game.game_status
}

async function submitPick(game, picked_team_id) {
  const userPick = game.picks[userId.value]
  if (userPick && userPick.picked_team === picked_team_id) {
    return
  }
  await gamesStore.submitPick(game, picked_team_id, userId.value)
}

async function updateConfidence(game, confidence_score) {
  const userPick = game.picks[userId.value]
  if (userPick) {
    await gamesStore.submitPick(
      game,
      userPick.picked_team,
      userId.value,
      confidence_score,
    )
  }
}

function toggleInjuries(gameIndex) {
  expandedInjuries.value[gameIndex] = !expandedInjuries.value[gameIndex]
}

function hasInjuries(game) {
  return (
    game.away_team.injuries?.length > 0 || game.home_team.injuries?.length > 0
  )
}

const getClass = (game, teamId) => {
  const pick = game.picks[userId.value]
  const isGameActive =
    session.value &&
    (gamesStore.isValidDate(game.game_status) || gamesStore.allowPastVotes)
  const hasUserPick = pick && session.value
  const hoverClasses =
    isGameActive
      ? `hover:cursor-pointer dark:hover:bg-blue-900/40 hover:border-blue-300 dark:hover:border-blue-700 `
      : ''

  let classes = hoverClasses

  if (!pick) {
    return classes
  }

  if (pick.correct && pick.picked_team === teamId) {
    classes = classes.concat(
      'bg-green-50 border-2 border-green-300 dark:bg-green-900 dark:border-green-700 dark:text-gray-100',
    )
  } else if (pick.correct === false && pick.picked_team === teamId) {
    classes = classes.concat(
      'bg-red-50 border-2 border-red-300 dark:bg-red-900 dark:border-red-700 dark:text-gray-100',
    )
  } else if (pick.picked_team === teamId) {
    classes = classes.concat(
      'bg-blue-50 border-2 border-blue-400 dark:bg-blue-900 dark:border-blue-600 dark:text-gray-100',
    )
  } else {
    classes = classes.concat(
      'bg-gray-50 border-2 border-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100',
    )
  }

  return classes
}
</script>

<template>
  <div class="py-4 space-y-6">
    <!-- Date Picker Card -->
    <section class="card">
      <div class="card-body">
        <div
          class="flex flex-col md:flex-row justify-between items-center gap-4"
        >
          <h1 class="text-2xl font-bold tracking-tight">Games</h1>

          <!-- Desktop Date Navigation -->
          <div class="hidden md:flex items-center gap-3">
            <button
              class="icon-btn rotate-90"
              @click="gamesStore.goToPreviousDay()"
              aria-label="Previous day"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            <div class="text-lg font-semibold tabular-nums">
              {{ selectedDate }}
            </div>
            <button
              class="icon-btn -rotate-90"
              @click="gamesStore.goToNextDay()"
              aria-label="Next day"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
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

          <!-- Desktop Date Picker -->
          <div class="hidden md:block">
            <input
              type="date"
              :value="selectedDate"
              @input="handleDateChange($event.target.value)"
              class="input"
            />
          </div>

          <!-- Mobile Date Picker -->
          <div class="md:hidden w-full max-w-xs">
            <input
              type="date"
              :value="selectedDateMobile"
              @input="handleMobileDateChange($event.target.value)"
              class="input w-full"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Confidence Display -->
    <section v-if="session && games.length && isTodayOrFuture" class="kpi">
      <div class="text-center">
        <p
          class="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 leading-4"
        >
          Daily Confidence Budget ({{ usedConfidenceToday }}/{{
            maxConfidencePerDay
          }})
        </p>
        <div
          class="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3 overflow-hidden"
        >
          <div
            class="h-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 dark:from-blue-400 dark:to-indigo-400 transition-all duration-200"
            :style="{
              width: `${maxConfidencePerDay > 0 ? (usedConfidenceToday / maxConfidencePerDay) * 100 : 0}%`,
            }"
          ></div>
        </div>
      </div>
    </section>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <svg
        class="animate-spin h-10 w-10 text-blue-600"
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
          stroke-width="2"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        ></path>
      </svg>
    </div>

    <!-- Games Grid -->
    <div v-else class="space-y-4">
      <div
        v-for="(game, index) in games"
        :key="index"
        class="card overflow-hidden"
      >
        <!-- Game Header -->
        <div class="card-header">
          <p class="text-xs font-medium text-gray-500 flex items-center gap-2">
            <span class="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
            {{ game.game_date }}
          </p>
          <p
            class="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide"
          >
            {{ getStatus(game) }}
          </p>
        </div>

        <div
          v-if="game.stage"
          class="px-6 py-3 text-center text-sm text-gray-500 dark:text-gray-300 border-b border-gray-200 dark:border-gray-800"
        >
          {{ game.stage }}
        </div>

        <!-- Main Content Grid -->
        <div class="flex flex-col lg:flex-row">
          <!-- Teams Section -->
          <div class="flex-1 flex flex-col md:flex-row items-stretch gap-4 p-6">
            <!-- Away Team -->
            <div
              :class="[
                'panel transition-all duration-300 flex-1 flex flex-col md:flex-row md:items-center p-5 relative',
                getClass(game, game.away_team_id),
              ]"
              @click="submitPick(game, game.away_team_id)"
            >
              <span
                class="panel__watermark"
                :style="{
                  backgroundImage: `url(${getTeamImageUrl(game.away_team_abbreviation)})`,
                }"
              />
              <img
                :src="getTeamImageUrl(game.away_team_abbreviation)"
                alt="away-logo"
                class="w-14 h-14 object-contain mb-3 md:mb-0 md:mr-4"
              />
              <div class="flex flex-col flex-1 relative z-10">
                <p class="font-bold text-lg leading-tight">
                  {{ game.away_team_name }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  away team
                </p>
                <div class="flex items-center gap-2 mt-2">
                  <span
                    class="text-xs text-gray-600 dark:text-gray-300 font-medium"
                  >
                    {{ game.away_team.wins }}-{{ game.away_team.losses }}
                  </span>
                  <span class="text-xs flex items-center gap-1">
                    <span
                      v-for="(wl, idx) in game.away_team.record"
                      :key="idx"
                      :class="{
                        'text-red-600 dark:text-red-400': wl === 'L',
                        'text-green-600 dark:text-green-400': wl === 'W',
                      }"
                      >{{ wl }}</span
                    >
                  </span>
                </div>
              </div>
              <div
                class="mt-3 md:mt-0 md:ml-auto md:text-right relative z-10 flex md:flex-col items-center md:items-end"
              >
                <span
                  class="text-xs text-gray-500 dark:text-gray-400 mr-2 md:mr-0"
                  >Score:</span
                >
                <p
                  class="font-black text-2xl md:text-3xl text-blue-600 dark:text-blue-400"
                >
                  {{ game.away_team_score }}
                </p>
              </div>
            </div>

            <!-- Home Team -->
            <div
              :class="[
                'panel transition-all duration-300 flex-1 flex flex-col md:flex-row md:items-center p-5 relative',
                getClass(game, game.home_team_id),
              ]"
              @click="submitPick(game, game.home_team_id)"
            >
              <span
                class="panel__watermark"
                :style="{
                  backgroundImage: `url(${getTeamImageUrl(game.home_team_abbreviation)})`,
                }"
              />
              <img
                :src="getTeamImageUrl(game.home_team_abbreviation)"
                alt="home-logo"
                class="w-14 h-14 object-contain mb-3 md:mb-0 md:mr-4"
              />
              <div class="flex flex-col flex-1 relative z-10">
                <p class="font-bold text-lg leading-tight">
                  {{ game.home_team_name }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  home team
                </p>
                <div class="flex items-center gap-2 mt-2">
                  <span
                    class="text-xs text-gray-600 dark:text-gray-300 font-medium"
                  >
                    {{ game.home_team.wins }}-{{ game.home_team.losses }}
                  </span>
                  <span class="text-xs flex items-center gap-1">
                    <span
                      v-for="(wl, idx) in game.home_team.record"
                      :key="idx"
                      :class="{
                        'text-red-600 dark:text-red-400': wl === 'L',
                        'text-green-600 dark:text-green-400': wl === 'W',
                      }"
                      >{{ wl }}</span
                    >
                  </span>
                </div>
              </div>
              <div
                class="mt-3 md:mt-0 md:ml-auto md:text-right relative z-10 flex md:flex-col items-center md:items-end"
              >
                <span
                  class="text-xs text-gray-500 dark:text-gray-400 mr-2 md:mr-0"
                  >Score:</span
                >
                <p
                  class="font-black text-2xl md:text-3xl text-purple-600 dark:text-purple-400"
                >
                  {{ game.home_team_score }}
                </p>
              </div>
            </div>
          </div>

          <!-- Confidence Selector Sidebar (Desktop) -->
          <div
            v-if="session && game.picks[userId]"
            class="hidden lg:flex flex-col justify-center px-6 py-6 border-l border-gray-200 dark:border-gray-800 bg-gradient-to-b from-blue-50/50 to-purple-50/50 dark:from-blue-950/30 dark:to-purple-950/30"
          >
            <ConfidenceSelector
              :model-value="game.picks[userId].confidence_score || 1"
              :disabled="
                !gamesStore.isValidDate(game.game_status) ||
                new Date(game.game_status) < new Date()
              "
              @update:model-value="updateConfidence(game, $event)"
            />
          </div>
        </div>

        <!-- Confidence Selector Mobile -->
        <div
          v-if="session && game.picks[userId]"
          class="lg:hidden px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/30 dark:to-purple-950/30"
        >
          <ConfidenceSelector
            :model-value="game.picks[userId].confidence_score || 1"
            :disabled="
              !gamesStore.isValidDate(game.game_status) ||
              new Date(game.game_status) < new Date()
            "
            @update:model-value="updateConfidence(game, $event)"
          />
        </div>

        <!-- User Picks -->
        <div
          class="px-4 py-3 bg-gray-50 dark:bg-transparent text-sm text-gray-700 border-t border-gray-200 dark:border-gray-800 flex flex-col md:flex-row"
          v-show="game.game_status === 'Final'"
        >
          <div class="w-full md:w-1/2 mb-4 md:mb-0 pl-4 text-xs">
            <div class="overflow-x-auto">
              <table class="w-full table-fixed text-left border-collapse">
                <thead>
                  <tr>
                    <th
                      class="px-4 py-2 text-gray-600 dark:text-white font-medium"
                    >
                      Voted for {{ game.away_team_name }}
                    </th>
                    <th
                      class="px-4 py-2 text-gray-600 dark:text-white font-medium text-center"
                    >
                      Conf.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    class="border-t border-gray-200 dark:border-gray-800"
                    v-for="(pick, index) in game.away_team.picks"
                    :key="index"
                  >
                    <td class="px-4 py-2 text-gray-800 dark:text-white">
                      {{ pick.user_full_name }}
                    </td>
                    <td class="px-4 py-2 text-center text-yellow-500">
                      <div class="flex justify-center">
                        <span
                          v-for="star in pick.confidence_score || 1"
                          :key="star"
                          class="text-xs"
                          >★</span
                        >
                      </div>
                    </td>
                    <td class="px-4 py-2 flex justify-end opacity-70">
                      <span v-if="pick.correct">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle cx="12" cy="12" r="12" fill="#34D399" />
                          <path
                            d="M8 12.5L10.5 15L16 9"
                            stroke="white"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </span>
                      <span v-else>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle cx="12" cy="12" r="12" fill="#F87171" />
                          <path
                            d="M9 9L15 15M15 9L9 15"
                            stroke="white"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="w-full md:w-1/2 mb-4 md:mb-0 pl-4 text-xs">
            <div class="overflow-x-auto">
              <table class="w-full table-fixed text-left border-collapse">
                <thead>
                  <tr>
                    <th
                      class="px-4 py-2 text-gray-600 dark:text-gray-100 font-medium"
                    >
                      Voted for {{ game.home_team_name }}
                    </th>
                    <th
                      class="px-4 py-2 text-gray-600 dark:text-gray-100 font-medium text-center"
                    >
                      Conf.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    class="border-t border-gray-200 dark:border-gray-800"
                    v-for="(pick, index) in game.home_team.picks"
                    :key="index"
                  >
                    <td class="px-4 py-2 text-gray-800 dark:text-gray-100">
                      {{ pick.user_full_name }}
                    </td>
                    <td class="px-4 py-2 text-center text-yellow-500">
                      <div class="flex justify-center">
                        <span
                          v-for="star in pick.confidence_score || 1"
                          :key="star"
                          class="text-xs"
                          >★</span
                        >
                      </div>
                    </td>
                    <td class="px-4 py-2 flex justify-end opacity-70">
                      <span v-if="pick.correct">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle cx="12" cy="12" r="12" fill="#34D399" />
                          <path
                            d="M8 12.5L10.5 15L16 9"
                            stroke="white"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </span>
                      <span v-else>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle cx="12" cy="12" r="12" fill="#F87171" />
                          <path
                            d="M9 9L15 15M15 9L9 15"
                            stroke="white"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Injury Report Toggle -->
        <div
          v-if="hasInjuries(game) && gamesStore.isValidDate(game.game_status)"
          class="border-t border-gray-200 dark:border-gray-800"
        >
          <button
            @click="toggleInjuries(index)"
            class="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200"
          >
            <div class="flex items-center gap-2">
              <svg
                :class="[
                  'h-5 w-5 transition-transform duration-200',
                  expandedInjuries[index] ? 'rotate-180' : '',
                ]"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              <span
                class="text-sm font-semibold text-gray-700 dark:text-gray-300"
              >
                Injury Report
              </span>
            </div>
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {{ game.away_team.injuries?.length || 0 }} +
              {{ game.home_team.injuries?.length || 0 }}
            </span>
          </button>

          <!-- Expanded Injury Content -->
          <div
            v-if="expandedInjuries[index]"
            class="px-4 py-4 bg-gray-50/50 dark:bg-gray-800/30 text-sm text-gray-700 dark:text-gray-200 flex flex-col md:flex-row gap-6 border-t border-gray-200 dark:border-gray-800 transition-all duration-200"
          >
            <!-- Away Team Injuries -->
            <div class="flex-1">
              <h4
                class="font-semibold text-sm mb-3 text-gray-700 dark:text-gray-200"
              >
                {{ game.away_team_name }}
              </h4>
              <div
                v-if="game.away_team.injuries?.length"
                class="overflow-x-auto"
              >
                <table
                  class="w-full table-fixed text-left border-collapse text-xs"
                >
                  <thead>
                    <tr class="text-gray-600 dark:text-gray-400">
                      <th class="px-2 py-1 font-medium">Player</th>
                      <th class="px-2 py-1 font-medium">Injury</th>
                      <th class="px-2 py-1 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      class="border-t border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                      v-for="(injury, idx) in game.away_team.injuries"
                      :key="idx"
                    >
                      <td class="px-2 py-1">{{ injury.playerName }}</td>
                      <td class="px-2 py-1">{{ injury.injury }}</td>
                      <td
                        class="px-2 py-1 font-medium"
                        :class="{
                          'text-red-500 dark:text-red-400':
                            injury.status.includes('Out'),
                          'text-yellow-500 dark:text-yellow-400':
                            !injury.status.includes('Out'),
                        }"
                      >
                        {{ injury.status }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="text-gray-500 dark:text-gray-400 text-xs">
                No injuries reported
              </div>
            </div>

            <!-- Home Team Injuries -->
            <div class="flex-1">
              <h4
                class="font-semibold text-sm mb-3 text-gray-700 dark:text-gray-200"
              >
                {{ game.home_team_name }}
              </h4>
              <div
                v-if="game.home_team.injuries?.length"
                class="overflow-x-auto"
              >
                <table
                  class="w-full table-fixed text-left border-collapse text-xs"
                >
                  <thead>
                    <tr class="text-gray-600 dark:text-gray-400">
                      <th class="px-2 py-1 font-medium">Player</th>
                      <th class="px-2 py-1 font-medium">Injury</th>
                      <th class="px-2 py-1 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      class="border-t border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                      v-for="(injury, idx) in game.home_team.injuries"
                      :key="idx"
                    >
                      <td class="px-2 py-1">{{ injury.playerName }}</td>
                      <td class="px-2 py-1">{{ injury.injury }}</td>
                      <td
                        class="px-2 py-1 font-medium"
                        :class="{
                          'text-red-500 dark:text-red-400':
                            injury.status.includes('Out'),
                          'text-yellow-500 dark:text-yellow-400':
                            !injury.status.includes('Out'),
                        }"
                      >
                        {{ injury.status }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="text-gray-500 dark:text-gray-400 text-xs">
                No injuries reported
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No Games Message -->
      <div
        v-if="!games.length"
        class="card py-16 px-6 flex flex-col items-center justify-center"
      >
        <div
          v-if="selectedDate === '2024-11-05'"
          class="border-dashed border-2 rounded-lg border-gray-600 mb-6 -mt-6 p-6 flex flex-col items-center"
        >
          <p class="text-2xl font-bold text-blue-600">ELECTION</p>
          <p class="text-2xl font-bold text-red-600">DAY</p>
          <img
            :src="createAssetUrl('donut_election.avif')"
            alt="election"
            class="rounded-lg"
          />
        </div>
        <p class="text-2xl font-light uppercase">No games scheduled</p>
      </div>
    </div>
  </div>
</template>

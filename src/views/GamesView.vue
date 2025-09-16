<script setup>
import { ref, onMounted, watch } from 'vue'
import { supabase } from '../lib/supabaseClient'

const games = ref([])
const teamResultsLast5Games = ref([])
const injuries = ref()
const session = ref()
const userId = ref()
const selectedDate = ref(new Date().toISOString().split('T')[0])
const selectedDateMobile = ref(new Date().toISOString().split('T')[0])
const loading = ref(false)
const allowPastVotes = ref(false)

watch(selectedDate, value => {
  selectedDateMobile.value = value
  getGames()
})

watch(selectedDateMobile, value => {
  selectedDate.value = value
})

watch(injuries, () => {
  games.value = games.value.map(game => {
    if (isValidDate(game.game_status)) {
      game.home_team.injuries = injuries.value
        .filter(i => i.team === game.home_team_abbreviation)
        .map(i => ({
          playerName: i.player,
          injury: i.injury,
          position: i.position,
          status: i.status,
        }))
      game.away_team.injuries = injuries.value
        .filter(i => i.team === game.away_team_abbreviation)
        .map(i => ({
          playerName: i.player,
          injury: i.injury,
          position: i.position,
          status: i.status,
        }))
    }
    return game
  })
})

function goToPreviousDay() {
  const date = new Date(selectedDate.value)
  date.setDate(date.getDate() - 1)
  selectedDate.value = date.toISOString().split('T')[0]
}

function goToNextDay() {
  const date = new Date(selectedDate.value)
  date.setDate(date.getDate() + 1)
  selectedDate.value = date.toISOString().split('T')[0]
}

async function getGames() {
  loading.value = true
  let { data, error } = await supabase.rpc('get_games_by_date_v2', {
    game_date_v2: selectedDate.value,
  })
  if (error) {
    console.error('Error fetching games:', error)
    return
  }

  data = data.map(g => {
    g.home_team = {}
    g.away_team = {}
    g.home_team.picks = g.picks.filter(pick => {
      return pick.picked_team === g.home_team_id
    })
    g.away_team.picks = g.picks.filter(pick => {
      return pick.picked_team === g.away_team_id
    })
    g.picks = g.picks.reduce((acc, pick) => {
      acc[pick.user_id] = pick
      return acc
    }, {})

    g.home_team.wins = g.home_team_wins || 0
    g.home_team.losses = g.home_team_losses || 0
    g.away_team.wins = g.away_team_wins || 0
    g.away_team.losses = g.away_team_losses || 0
    g.home_team.record =
      teamResultsLast5Games.value
        .filter(r => r.team_id === g.home_team_id)
        .map(r => r.result)
        .slice(0, 5)
        .reverse() || []
    g.away_team.record =
      teamResultsLast5Games.value
        .filter(r => r.team_id === g.away_team_id)
        .map(r => r.result)
        .slice(0, 5)
        .reverse() || []
    if (isValidDate(g.game_status)) {
      g.home_team.injuries = injuries?.value
        ?.filter(i => i.team === g.home_team_abbreviation)
        .map(i => ({
          playerName: i.player,
          injury: i.injury,
          position: i.position,
          status: i.status,
        }))
      g.away_team.injuries = injuries?.value
        ?.filter(i => i.team === g.away_team_abbreviation)
        .map(i => ({
          playerName: i.player,
          injury: i.injury,
          position: i.position,
          status: i.status,
        }))
    }

    return g
  })
  games.value = data
  loading.value = false
}

onMounted(async () => {
  allowPastVotes.value = import.meta.env.VITE_ALLOW_PAST_VOTES === 'true'
  await getLast5GamesByTeam()
  getGames()
  getInjuryReport()

  const { data } = await supabase.auth.getSession()
  session.value = data.session

  if (session.value) {
    userId.value = session.value.user.id
  } else {
    userId.value = null
  }
})

async function getLast5GamesByTeam() {
  const { data, error } = await supabase.rpc('get_last_5_games_per_team')

  if (error) {
    console.error('Error fetching last 5 games by team:', error)
    return
  }

  teamResultsLast5Games.value = data
}

async function getInjuryReport() {
  const injuriesApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-injuries`
  const injuriesResponse = await fetch(injuriesApiUrl, {
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
  })
  injuries.value = await injuriesResponse.json()
}

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
  if (isValidDate(game.game_status)) {
    return formatISOTo24HourTime(new Date(game.game_status))
  }
  return game.game_status
}

function isValidDate(date) {
  date = new Date(date)
  return date.toString() !== 'Invalid Date'
}

async function submitPick(game, picked_team_id) {
  if (!userId.value) {
    return
  }
  if (!allowPastVotes.value && !isValidDate(game.game_status)) {
    return
  }
  if (new Date(game.game_status) < new Date()) {
    alert('AH AH. game already started :)')
    return
  }
  const toUpsert = {
    game_id: game.game_id,
    picked_team: picked_team_id,
    user_id: userId.value,
  }

  if (allowPastVotes.value && game.game_status === 'Final') {
    const winner =
      game.home_team_score > game.away_team_score
        ? game.home_team
        : game.away_team
    toUpsert.correct = picked_team_id === winner.id
  }

  if (game.picks[userId.value]) {
    toUpsert.id = game.picks[userId.value].pick_id
  }
  const { data, error } = await supabase
    .from('picks')
    .upsert([toUpsert])
    .select(
      '*,user:user_id(full_name),\
      picked_team_name:picked_team(name)',
    )

  if (error) {
    alert(error.message)
    return
  }

  games.value = games.value.map(g => {
    if (g.game_id === game.game_id) {
      return {
        ...g,
        picks: {
          ...g.picks,
          [userId.value]: { ...data[0], pick_id: data[0].id },
        },
      }
    }
    return g
  })
}

const getClass = (game, teamId) => {
  const hoverClasses =
    'hover:bg-blue-50 hover:cursor-pointer dark:hover:bg-blue-950 '
  let classes = ''
  if (
    session.value &&
    (isValidDate(game.game_status) || allowPastVotes.value)
  ) {
    classes = classes.concat(hoverClasses)
  }

  const pick = game.picks[userId.value]

  if (!pick) {
    return classes
  }
  if (pick.correct && pick.picked_team === teamId) {
    classes = classes.concat(
      'bg-green-50 border-2 border-green-300 dark:bg-green-900 dark:text-gray-100',
    )
  } else if (pick.correct === false && pick.picked_team === teamId) {
    classes = classes.concat(
      'bg-red-50 border-2 border-red-300 dark:bg-red-900 dark:text-gray-100',
    )
  } else if (pick.picked_team === teamId) {
    classes = classes.concat(
      'bg-blue-50 border-2 border-blue-300 dark:bg-blue-950 dark:text-gray-100',
    )
  } else {
    classes = classes.concat(
      'bg-gray-50 border-2 border-gray-50 dark:bg-blue-900 dark:border-0 dark:text-gray-100',
    )
  }

  return classes
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-800">
    <!-- Date Picker Header -->
    <div
      class="bg-white dark:bg-gradient-to-r dark:from-blue-950 dark:to-indigo-950 shadow-md"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div
          class="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0"
        >
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            Games
          </h1>

          <!-- Desktop Date Navigation -->
          <div class="hidden md:flex justify-between items-center space-x-3">
            <span
              class="underline hover:scale-110 transition-all cursor-pointer hover:underline-offset-1 rotate-90"
              @click="goToPreviousDay"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-gray-500 hover:text-blue-500 dark:text-gray-200 transition"
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
            </span>
            <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">
              {{ selectedDate }}
            </h2>
            <span
              class="underline hover:scale-110 transition-all cursor-pointer hover:underline-offset-1 -rotate-90"
              @click="goToNextDay"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-gray-500 hover:text-blue-500 dark:text-gray-200 transition"
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
            </span>
          </div>

          <!-- Mobile Date Picker -->
          <div class="md:hidden w-full max-w-xs">
            <input
              type="date"
              v-model="selectedDateMobile"
              class="w-full px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm"
            />
          </div>

          <!-- Desktop Date Picker -->
          <div class="hidden md:block">
            <input
              type="date"
              v-model="selectedDate"
              class="px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <svg
          class="animate-spin h-12 w-12 text-indigo-500"
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
      <div v-else class="space-y-6">
        <!-- Game Cards -->
        <div
          v-for="(game, index) in games"
          :key="index"
          class="bg-white dark:bg-gradient-to-b dark:to-indigo-900 dark:from-blue-900 rounded-xl shadow-md overflow-hidden transform transition duration-100"
        >
          <!-- Game Header -->
          <div
            class="flex justify-between items-center bg-gray-100 dark:bg-transparent px-6 py-3 border-b border-gray-200"
          >
            <p class="text-xs font-medium text-gray-500 dark:text-gray-200">
              {{ game.game_date }}
            </p>
            <p
              class="text-xs font-semibold text-red-500 uppercase tracking-wide"
            >
              {{ getStatus(game) }}
            </p>
          </div>

          <div
            v-if="game.stage"
            class="w-full flex justify-center items-center p-4 text-lg bg-gradient-to-r via-slate-50 to-red-50 from-blue-50 shadow text-gray-400 dark:from-red-900 dark:via-gray-900 dark:to-blue-900 dark:text-gray-100 font-medium"
          >
            {{ game.stage }}
          </div>

          <!-- Teams Section -->
          <div
            class="flex flex-col md:flex-row items-center md:items-start px-6 py-6 space-y-4 md:space-y-0 md:space-x-4"
          >
            <!-- Away Team -->
            <div
              :class="[
                'w-full md:w-1/2 flex justify-between items-center p-4 rounded-lg shadow-sm ',
                getClass(game, game.away_team_id),
              ]"
              @click="submitPick(game, game.away_team_id)"
            >
              <div class="flex items-center space-x-3">
                <img
                  :src="getTeamImageUrl(game.away_team_abbreviation)"
                  alt="away-logo"
                  class="w-20 h-20 object-contain"
                />
                <div class="flex flex-col">
                  <p
                    class="font-semibold text-lg text-gray-800 dark:text-gray-100"
                  >
                    {{ game.away_team_name }}
                    <span class="text-sm font-medium">
                      ({{ game.away_team.wins }} - {{ game.away_team.losses }})
                    </span>
                  </p>
                  <p class="text-gray-500 dark:text-gray-300 text-xs">
                    away team
                  </p>
                  <p class="text-xs flex items-center gap-3 font-semibold mt-2">
                    <span
                      v-for="(wl, index) in game.away_team.record"
                      :key="index"
                      :class="{
                        'text-red-600 dark:text-red-400': wl === 'L',
                        'text-green-600 dark:text-green-400': wl === 'W',
                      }"
                      >{{ wl }}</span
                    >
                  </p>
                </div>
              </div>
              <p
                class="ml-auto font-extrabold text-2xl text-gray-700 dark:text-gray-100"
              >
                {{ game.away_team_score }}
              </p>
            </div>

            <!-- Home Team -->
            <div
              :class="[
                'w-full md:w-1/2 flex justify-between items-center p-4 rounded-lg shadow-sm',
                getClass(game, game.home_team_id),
              ]"
              @click="submitPick(game, game.home_team_id)"
            >
              <div class="flex items-center space-x-3">
                <img
                  :src="getTeamImageUrl(game.home_team_abbreviation)"
                  alt="home-logo"
                  class="w-20 h-20 object-contain"
                />
                <div class="flex flex-col">
                  <p
                    class="font-semibold text-lg text-gray-800 dark:text-gray-100"
                  >
                    {{ game.home_team_name }}
                    <span class="text-sm font-medium">
                      ({{ game.home_team.wins }} - {{ game.home_team.losses }})
                    </span>
                  </p>
                  <p class="text-gray-500 dark:text-gray-300 text-xs">
                    home team
                  </p>
                  <p class="text-xs flex items-center gap-3 font-semibold mt-2">
                    <span
                      v-for="(wl, index) in game.away_team.record"
                      :key="index"
                      :class="{
                        'text-red-600 dark:text-red-400': wl === 'L',
                        'text-green-600 dark:text-green-400': wl === 'W',
                      }"
                      >{{ wl }}</span
                    >
                  </p>
                </div>
              </div>
              <p
                class="ml-auto font-extrabold text-2xl text-gray-700 dark:text-gray-100"
              >
                {{ game.home_team_score }}
              </p>
            </div>
          </div>

          <!-- User Picks -->
          <div
            class="px-4 py-2 bg-gray-100 dark:bg-transparent text-sm text-gray-700 border-t border-gray-200 dark:border-gray-600 flex flex-col md:flex-row"
            v-show="game.game_status === 'Final'"
          >
            <div class="w-full md:w-1/2 mb-4 md:mb-0 pl-4 text-xs">
              <div class="overflow-x-auto">
                <table class="w-full table-fixed text-left border-collapse">
                  <thead>
                    <tr class="bg-gray-100 dark:bg-transparent">
                      <th
                        class="px-4 py-2 text-gray-600 dark:text-white font-medium"
                      >
                        Voted for {{ game.away_team_name }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      class="border-t border-gray-200 dark:border-gray-600"
                      v-for="(pick, index) in game.away_team.picks"
                      :key="index"
                    >
                      <td class="px-4 py-2 text-gray-800 dark:text-white">
                        {{ pick.user_full_name }}
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
                    <tr class="bg-gray-100 dark:bg-transparent">
                      <th
                        class="px-4 py-2 text-gray-600 dark:text-gray-100 font-medium"
                      >
                        Voted for {{ game.home_team_name }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      class="border-t border-gray-200 dark:border-gray-600"
                      v-for="(pick, index) in game.home_team.picks"
                      :key="index"
                    >
                      <td class="px-4 py-2 text-gray-800 dark:text-gray-100">
                        {{ pick.user_full_name }}
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

          <!-- Injury Report -->
          <div
            class="px-4 py-2 bg-gray-100 dark:bg-transparent text-sm text-gray-700 dark:text-gray-200 border-t border-gray-200 dark:border-gray-600 flex flex-col md:flex-row"
            v-show="isValidDate(game.game_status)"
          >
            <div class="w-full md:w-1/2 mb-4 md:mb-0 pl-4 text-xs">
              <div class="overflow-x-auto">
                <table class="w-full table-fixed text-left border-collapse">
                  <thead>
                    <tr
                      class="bg-gray-100 dark:bg-transparent text-gray-600 dark:text-gray-300"
                    >
                      <th class="px-4 py-2 font-medium">Player</th>
                      <th class="px-4 py-2 font-medium">Injury</th>
                      <th class="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      class="border-t border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                      v-for="(injury, index) in game.away_team.injuries"
                      :key="index"
                    >
                      <td class="px-4 py-2">{{ injury.playerName }}</td>
                      <td class="px-4 py-2">{{ injury.injury }}</td>
                      <td
                        class="px-4 py-2"
                        :class="{
                          'text-red-500 dark:text-red-300':
                            injury.status.includes('Out'),
                          'text-yellow-500 dark:text-yellow-300':
                            !injury.status.includes('Out'),
                        }"
                      >
                        <span class="hidden md:block">
                          {{ injury.status }}
                        </span>
                        <span class="md:hidden opacity-80">
                          <span v-if="injury.status === 'Out'">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <circle
                                cx="12"
                                cy="12"
                                r="11"
                                stroke="currentColor"
                                stroke-width="2"
                              />
                            </svg>
                          </span>
                          <span v-else>
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="currentCOlor"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <circle
                                cx="12"
                                cy="12"
                                r="11"
                                stroke="currentColor"
                                stroke-width="2"
                              />
                            </svg>
                          </span>
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
                    <tr
                      class="bg-gray-100 dark:bg-transparent text-gray-600 dark:text-gray-300"
                    >
                      <th class="px-4 py-2 font-medium">Player</th>
                      <th class="px-4 py-2 font-medium">Injury</th>
                      <th class="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      class="border-t border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                      v-for="(injury, index) in game.home_team.injuries"
                      :key="index"
                    >
                      <td class="px-4 py-2">{{ injury.playerName }}</td>
                      <td class="px-4 py-2">{{ injury.injury }}</td>
                      <td
                        class="px-4 py-2"
                        :class="{
                          'text-red-500 dark:text-red-300':
                            injury.status.includes('Out'),
                          'text-yellow-500 dark:text-yellow-300':
                            !injury.status.includes('Out'),
                        }"
                      >
                        <span class="hidden md:block">
                          {{ injury.status }}
                        </span>
                        <span class="md:hidden opacity-80">
                          <span v-if="injury.status === 'Out'">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <circle
                                cx="12"
                                cy="12"
                                r="11"
                                stroke="currentColor"
                                stroke-width="2"
                              />
                            </svg>
                          </span>
                          <span v-else>
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="currentCOlor"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <circle
                                cx="12"
                                cy="12"
                                r="11"
                                stroke="currentColor"
                                stroke-width="2"
                              />
                            </svg>
                          </span>
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- No Games Message -->
        <div
          class="bg-white dark:bg-gradient-to-b dark:to-indigo-900 dark:from-blue-900 w-full rounded-xl shadow-md py-20 px-4 flex flex-col items-center justify-center"
          v-if="!games.length"
        >
          <div
            v-if="selectedDate === '2024-11-05'"
            class="border-dashed border-2 rounded-lg hover:border-dotted hover:scale-110 transition-all border-gray-600 mb-6 -mt-10 p-6 flex flex-col items-center"
          >
            <p class="text-2xl font-bold text-blue-600">ELECTION</p>
            <p class="text-2xl font-bold text-red-600">DAY</p>
            <img
              :src="createAssetUrl('donut_election.avif')"
              alt=""
              class="rounded-lg shadow-sm"
            />
          </div>
          <p
            class="text-2xl font-light uppercase text-gray-900 dark:text-white"
          >
            No games scheduled
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

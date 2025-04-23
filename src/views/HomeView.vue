<script setup>
import { ref, onMounted, watch } from 'vue'
// import { useRoute } from 'vue-router'

import { supabase } from '../lib/supabaseClient'
import { useDark, useToggle } from "@vueuse/core";
// const route = useRoute()

const games = ref([])

const teamResultsLast5Games = ref([]);

const injuries = ref()

const session = ref()

const userId = ref()

const users = ref([])

const selectedDate = ref(new Date().toISOString().split('T')[0]); // Sets today's date by default
// const selectedDate = ref('2025-04-30'); // Sets today's date by default

const selectedDateMobile = ref(new Date().toISOString().split('T')[0]); // Sets today's date by default

const leaderboard = ref([])

const datePicker = ref(null);

const allowPastVotes = ref(false)

const yesterdayReport = ref()

const loading = ref(false)

const nbaCupGroupDates = ['2024-11-12', '2024-11-15', '2024-11-19', '2024-11-22', '2024-11-26', '2024-11-29', '2024-12-03']

const circleCircumference = 2 * Math.PI * 25;

const isDark = useDark()

const toggleDarkMode = useToggle(isDark)

let isLeaderboardPlayoff = true;

window.handleSignInWithGoogle = handleSignInWithGoogle

function sortByAccuracy() {
  leaderboard.value = leaderboard.value.sort((a, b) => {
    return (b.points * 100 / b.totalPicks).toPrecision(3) - (a.points * 100 / a.totalPicks).toPrecision(3);
  })
}

function sortByPoints() {
  leaderboard.value = leaderboard.value.sort((a, b) => {
    if (b.points === a.points) return a.totalPicks - b.totalPicks;
    return b.points - a.points;
  })
}

function goToPreviousDay() {
  const date = new Date(selectedDate.value);
  date.setDate(date.getDate() - 1)
  selectedDate.value = date.toISOString().split('T')[0];
}

function goToNextDay() {
  const date = new Date(selectedDate.value);
  date.setDate(date.getDate() + 1)
  selectedDate.value = date.toISOString().split('T')[0];
}

watch(selectedDate, (value) => {
  selectedDateMobile.value = value;
  getGames()
  updateYesterdayReport()
})

watch(users, () => {
  updateYesterdayReport()
})

watch(selectedDateMobile, (value) => {
  selectedDate.value = value;
})

watch(injuries, () => {
  games.value = games.value.map(game => {
    if (isValidDate(game.game_status)) {
      game.home_team.injuries = injuries.value.filter(i => i.team === game.home_team_abbreviation).map(i => ({ playerName: i.player, injury: i.injury, position: i.position, status: i.status }))
      game.away_team.injuries = injuries.value.filter(i => i.team === game.away_team_abbreviation).map(i => ({ playerName: i.player, injury: i.injury, position: i.position, status: i.status }))
    }

    return game;
  })
})

function formatYesterdayToDateString() {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return date.toISOString().split('T')[0]
}

async function getUsers(postseason = false) {
  isLeaderboardPlayoff = postseason;
  let { data: userWithSummary, error } = await supabase.rpc('get_user_picks_summary', { for_postseason: postseason });
  if (error) {
    console.error('Error fetching user picks summary:', error);
    return;
  }
  let { data: userPicksPastRecord, error: error2 } = await supabase.rpc('get_user_picks_past_record');
  if (error) {
    console.error('Error fetching user picks past record:', error2);
    return;
  }

  userWithSummary = userWithSummary.map(u => {
    u.picks = userPicksPastRecord.filter(up => up.user_id === u.id)
    return u;
  })

  leaderboard.value = userWithSummary.map(user => {
    user.latestDailyAccuracy = user.picks.reduce((acc, curr) => {
      acc[curr.game_date] = curr.accuracy;
      return acc;
    }, {})
    return {
      id: user.id,
      name: user.full_name,
      avatar_url: user.avatar_url,
      points: user.correct_picks,
      totalPicks: user.total_picks,
      latestDailyAccuracy: user.latestDailyAccuracy,
      accuracy: user.accuracy,
    }
  });
  users.value = userWithSummary;
  sortByPoints()
}

function updateYesterdayReport() {
  const picksFromYesterady = users.value.find(u => u.id === userId.value)?.picks.find(p => p.game_date === formatYesterdayToDateString() && p.correct !== null);
  if (picksFromYesterady) {
    yesterdayReport.value = {
      correct: picksFromYesterady.correct_picks,
      total: picksFromYesterady.total_picks,
      accuracy: picksFromYesterady.accuracy
    }
  } else {
    yesterdayReport.value = null
  }
}

const toggleDatePicker = () => {
  datePicker.value.showPicker();
};

async function getGames() {
  loading.value = true;
  // await new Promise(r => setTimeout(r, 2000));
  let { data, error } = await supabase.rpc('get_games_by_date_v2', { game_date_v2: selectedDate.value })
  if (error) {
    console.error('Error fetching games:', error);
    return;
  }

  data = data.map(g => {
    g.home_team = {};
    g.away_team = {}
    g.home_team.picks = g.picks.filter((pick) => {
      return pick.picked_team === g.home_team_id;
    })
    g.away_team.picks = g.picks.filter((pick) => {
      return pick.picked_team === g.away_team_id;
    })
    g.picks = g.picks.reduce((acc, pick) => {
      acc[pick.user_id] = pick;
      return acc;
    }, {});

    // hello
    g.home_team.wins = g.home_team_wins || 0
    g.home_team.losses = g.home_team_losses || 0
    g.away_team.wins = g.away_team_wins || 0
    g.away_team.losses = g.away_team_losses || 0
    g.home_team.record = teamResultsLast5Games.value.filter(r => r.team_id === g.home_team_id).map(r => r.result).slice(0, 5).reverse() || [];
    g.away_team.record = teamResultsLast5Games.value.filter(r => r.team_id === g.away_team_id).map(r => r.result).slice(0, 5).reverse() || [];
    if (isValidDate(g.game_status)) {
      g.home_team.injuries = injuries?.value?.filter(i => i.team === g.home_team_abbreviation).map(i => ({ playerName: i.player, injury: i.injury, position: i.position, status: i.status }))
      g.away_team.injuries = injuries?.value?.filter(i => i.team === g.away_team_abbreviation).map(i => ({ playerName: i.player, injury: i.injury, position: i.position, status: i.status }))
    }

    return g;
  });
  games.value = data;

  loading.value = false;

  // SCOREBOARD GROUNDWORK
  // if (selectedDate.value === formatYesterdayToDateString()) {
  //   console.log('making request')
  //   const scoreboardR = await fetch('https://corsproxy.io/?https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json');
  //   const scoreboard = await scoreboardR.json()

  //   games.value = games.value.map(game => {
  //     game.scoreboard = scoreboard.scoreboard.games.find(g => g.awayTeam.teamName === game.away_team.name && g.homeTeam.teamName === game.home_team.name)
  //     return game;
  //   })
  // }
}

onMounted(async () => {
  init()
})

async function impersonate() {
  // use to log in as one of your users -> use edge function create-impersonate-link to create the auth link
  const { searchParams } = new URL(window.location.href)
  const token_hash = searchParams.get('token_hash')
  if (token_hash) {
    await supabase.auth.verifyOtp({ type: "magiclink", token_hash })
    // add redirect
  }
}

async function getLast5GamesByTeam() {
  const { data, error } = await supabase.rpc('get_last_5_games_per_team');

  if (error) {
    console.error('Error fetching last 5 games by team:', error);
    return;
  }

  teamResultsLast5Games.value = data;
}

async function init() {
  allowPastVotes.value = import.meta.env.VITE_ALLOW_PAST_VOTES === 'true';
  getUsers(isLeaderboardPlayoff)
  getLast5GamesByTeam();
  getGames()
  getInjuryReport()

  const { data } = await supabase.auth.getSession();
  session.value = data.session;

  if (session.value) {
    userId.value = session.value.user.id;
  } else { userId.value = null }
}

async function getInjuryReport() {
  // console.log('making request to injuries')
  const injuriesApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-injuries`
  const injuriesResponse = await fetch(injuriesApiUrl, { headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` } });
  injuries.value = await injuriesResponse.json()
}

async function handleSignInWithGoogle(response) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: response.credential,
  })

  if (error) {
    console.error("Google Sign-In Error:", error);
  } else {
    console.log("Google Sign-In Success:");
    init()
  }
}

function getTeamImageUrl(teamAbbreviation) {
  return new URL(`../assets/${teamAbbreviation}/logo.svg`, import.meta.url).href;
}

function createAssetUrl(assetPath) {
  return new URL(`./assets/${assetPath}`, import.meta.url).href;
}

function formatISOTo24HourTime(date) {
  let hours = date.getHours();
  let minutes = date.getMinutes();

  if (hours < 10) hours = `0${hours}`;
  if (minutes < 10) minutes = `0${minutes}`;

  return `${hours}:${minutes}`;
}

function getStatus(game) {
  if (isValidDate(game.game_status)) {
    return formatISOTo24HourTime(new Date(game.game_status));
  }
  return game.game_status;
}

function isValidDate(date) {
  date = new Date(date)
  return date.toString() !== 'Invalid Date';
}

async function submitPick(game, picked_team_id) {
  if (!userId.value) {
    return;
  }
  if (!allowPastVotes.value && !isValidDate(game.game_status)) {
    return;
  }
  if (new Date(game.game_status) < new Date()) {
    alert('AH AH. game already started :)')
    return;
  }
  const toUpsert = { game_id: game.game_id, picked_team: picked_team_id, user_id: userId.value };

  if (allowPastVotes.value && game.game_status === 'Final') {
    const winner =
      game.home_team_score > game.away_team_score
        ? game.home_team
        : game.away_team
    toUpsert.correct = picked_team_id === winner.id
  }

  if (game.picks[userId.value]) {
    toUpsert.id = game.picks[userId.value].pick_id;
  }
  const { data, error } = await supabase.from('picks')
    .upsert([toUpsert]).select('*,user:user_id(full_name),\
      picked_team_name:picked_team(name)');

  if (error) {
    alert(error.message);
    return;
  }

  games.value = games.value.map(g => {
    if (g.game_id === game.game_id) {
      return {
        ...g,
        picks: {
          ...g.picks,
          [userId.value]: { ...data[0], pick_id: data[0].id },
        },
      };
    }
    return g;
  });
}

async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    init()
  } catch (error) {
    alert(error.message)
  }
}

const getClass = (game, teamId) => {
  const hoverClasses = 'hover:bg-blue-50 hover:cursor-pointer dark:hover:bg-blue-950 ';
  let classes = '';
  if (session.value && (isValidDate(game.game_status) || allowPastVotes.value)) {
    classes = classes.concat(hoverClasses);
  }

  const pick = game.picks[userId.value];

  if (!pick) { return classes }
  if (pick.correct && pick.picked_team === teamId) {
    classes = classes.concat('bg-green-50 border-2 border-green-300 dark:bg-green-900 dark:text-gray-100')
  } else if (pick.correct === false && pick.picked_team === teamId) {
    classes = classes.concat('bg-red-50 border-2 border-red-300 dark:bg-red-900 dark:text-gray-100');
  } else if (pick.picked_team === teamId) {
    classes = classes.concat('bg-blue-50 border-2 border-blue-300 dark:bg-blue-950 dark:text-gray-100');
  } else {
    classes = classes.concat('bg-gray-50 border-2 border-gray-50 dark:bg-blue-900 dark:border-0 dark:text-gray-100');
  }

  return classes;
};

function getGoogleClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID;
}

function getStrokeOffset(accuracy) {
  const circumference = circleCircumference;
  return circumference * (1 - accuracy / 100);
}
function getAccuracyColorClass(accuracy) {
  if (accuracy >= 70) return 'text-green-500 dark:text-green-300';
  if (accuracy >= 40) return 'text-yellow-500 dark:text-yellow-300';
  return 'text-red-500 dark:text-red-300';
}

</script>


<template>


  <div class="min-h-screen bg-gray-50 dark:bg-gray-800 p-6 flex justify-between transition-all">
    <div class="container mx-auto grid grid-cols-1 lg:grid-cols-3 gap-20">

      <!-- Left Column: Date Picker and Game Cards -->
      <div class="lg:col-span-2 space-y-6">
        <div
          class="h-20 md:flex hidden justify-between items-center w-full bg-white dark:bg-gradient-to-r dark:from-blue-950 dark:to-indigo-950 dark:text-gray-100 px-6 py-4 shadow-md">
          <h4 class="text-2xl uppercase">Games</h4>
          <div class="flex justify-between items-center space-x-3 select-none">
            <span class="underline hover:scale-110 transition-all cursor-pointer hover:underline-offset-1 rotate-90"
              @click="goToPreviousDay">
              <svg xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-gray-500 hover:text-blue-500 dark:text-gray-200 transition" fill="none"
                viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
            <h4 class="text-2xl">
              {{ selectedDate }}
            </h4>
            <span class="underline hover:scale-110 transition-all cursor-pointer hover:underline-offset-1 -rotate-90"
              @click="goToNextDay">
              <svg xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-gray-500 hover:text-blue-500 dark:text-gray-200 transition" fill="none"
                viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </div>
          <div class="relative w-14">
            <!-- Button wrapping the entire input area for click anywhere functionality -->
            <button @click="toggleDatePicker"
              class="w-full z-20 bg-gray-100 dark:bg-indigo-900 text-center rounded-md py-2 px-3 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-indigo-600 flex items-center justify-between transition">
              <!-- Calendar Icon -->
              <svg xmlns="http://www.w3.org/2000/svg"
                class="h-7 w-7 text-gray-500 dark:text-gray-200 hover:text-gray-400 transition z-20" fill="none"
                viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 7V3m8 4V3M3 10h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>

            <!-- Hidden Date Picker Input -->
            <input ref="datePicker" type="date" v-model="selectedDate"
              class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
        </div>
        <div
          class="h-20 flex md:hidden justify-center items-center w-full bg-white dark:bg-gradient-to-r dark:from-blue-950 dark:to-indigo-950 dark:text-gray-100 px-6 py-4 shadow-md">
          <input type="date" v-model="selectedDateMobile"
            class="p-2 border rounded-lg text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-300" />
        </div>

        <!-- <div v-if="nbaCupGroupDates.includes(selectedDate)"
          class="rounded-lg transition-all border-gray-600 mb-6 flex flex-col items-center">
          <img :src="createAssetUrl('image002.webp')" alt="" class="rounded-lg shadow-sm ">
        </div> -->

        <div v-if="loading" class="flex items-center justify-center">
          <svg class="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none"
            viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
        </div>

        <div v-else>

          <!-- Game Cards -->
          <div v-for="(game, index) in games" :key="index"
            class="bg-white dark:bg-gradient-to-b dark:to-indigo-900 dark:from-blue-900 rounded-xl shadow-md overflow-hidden transform transition duration-100 mb-6">
            <!-- Game Header -->
            <div
              class="flex justify-between items-center bg-gray-100 dark:bg-transparent px-6 py-3 border-b border-gray-200">
              <p class="text-xs font-medium text-gray-500 dark:text-gray-200">{{ game.game_date }}</p>
              <p class="text-xs font-semibold text-red-500 uppercase tracking-wide">{{ getStatus(game) }}</p>
            </div>
            <div v-if="game.stage"
              class="w-full flex justify-center items-center p-4 text-lg bg-gradient-to-r via-slate-50 to-red-50 from-blue-50 shadow text-gray-400 dark:from-red-900 dark:via-gray-900 dark:to-blue-900 dark:text-gray-100 font-medium">
              {{ game.stage }}
            </div>

            <!-- Teams Section -->
            <div
              class="flex flex-col md:flex-row items-center md:items-start px-6 py-6 space-y-4 md:space-y-0 md:space-x-4">
              <!-- Away Team -->
              <div
                :class="['w-full md:w-1/2 flex justify-between items-center p-4 rounded-lg shadow-sm ', getClass(game, game.away_team_id)]"
                @click="submitPick(game, game.away_team_id)">
                <div class="flex items-center space-x-3">
                  <img :src="getTeamImageUrl(game.away_team_abbreviation)" alt="away-logo"
                    class="w-20 h-20 object-contain" />
                  <div class="flex flex-col">
                    <p class="font-semibold text-lg text-gray-800 dark:text-gray-100">{{ game.away_team_name }} <span
                        class="text-sm font-medium">
                        ({{ game.away_team.wins }} - {{ game.away_team.losses }})
                      </span>
                    </p>
                    <p class="text-gray-500 dark:text-gray-300 text-xs">away team</p>
                    <p class="text-xs flex items-center gap-3 font-semibold mt-2">
                      <span v-for="(wl, index) in game.away_team.record" :key="index"
                        :class="{ 'text-red-600 dark:text-red-400': wl === 'L', 'text-green-600 dark:text-green-400': wl === 'W' }">{{
                          wl }}</span>
                    </p>
                  </div>
                </div>
                <p class="ml-auto font-extrabold text-2xl text-gray-700 dark:text-gray-100">{{ game.away_team_score }}
                </p>
              </div>

              <!-- Home Team -->
              <div
                :class="['w-full md:w-1/2 flex justify-between items-center p-4 rounded-lg shadow-sm', getClass(game, game.home_team_id)]"
                @click="submitPick(game, game.home_team_id)">
                <div class="flex items-center space-x-3">
                  <img :src="getTeamImageUrl(game.home_team_abbreviation)" alt="home-logo"
                    class="w-20 h-20 object-contain" />
                  <div class="flex flex-col">
                    <p class="font-semibold text-lg text-gray-800 dark:text-gray-100">{{ game.home_team_name }} <span
                        class="text-sm font-medium">
                        ({{ game.home_team.wins }} - {{ game.home_team.losses }})
                      </span>
                    </p>
                    <p class="text-gray-500 dark:text-gray-300 text-xs">home team</p>
                    <p class="text-xs flex items-center gap-3 font-semibold mt-2">
                      <span v-for="(wl, index) in game.home_team.record" :key="index"
                        :class="{ 'text-red-600 dark:text-red-400': wl === 'L', 'text-green-600 dark:text-green-400': wl === 'W' }">{{
                          wl }}</span>
                    </p>
                  </div>
                </div>
                <p class="ml-auto font-extrabold text-2xl text-gray-700 dark:text-gray-100">{{ game.home_team_score }}
                </p>
              </div>
            </div>

            <!-- Team Leaders Section -->
            <!-- <div class="grid grid-cols-2 gap-4 -mt-4 mb-2 px-6" v-if="game.scoreboard"> -->
            <!-- <div class="bg-gray-50 p-4 rounded-xl shadow-sm border-t-2 border-gray-600">
                <p class="text-gray-800 font-semibold text-center">{{ game.scoreboard.gameLeaders.awayLeaders.name }}
                </p>
                <div class="flex justify-between mt-2 text-gray-600">
                  <span class="font-bold text-gray-800">{{ game.scoreboard.gameLeaders.awayLeaders.rebounds }} <span
                      class="text-sm uppercase font-normal">REB</span></span>
                  <span class="font-bold text-gray-800">{{ game.scoreboard.gameLeaders.awayLeaders.points }} <span
                      class="text-sm uppercase font-normal">PTS</span></span>
                  <span class="font-bold text-gray-800">{{ game.scoreboard.gameLeaders.awayLeaders.assists }} <span
                      class="text-sm uppercase font-normal">AST</span></span>
                </div>
              </div>

              <div class="bg-gray-50 p-4 rounded-xl shadow-sm border-t-2 border-gray-600">
                <p class="text-gray-800 font-semibold text-center">{{ game.scoreboard.gameLeaders.homeLeaders.name }}
                </p>
                <div class="flex justify-between mt-2 text-gray-600">
                  <span class="font-bold text-gray-800">{{ game.scoreboard.gameLeaders.homeLeaders.rebounds }} <span
                      class="text-sm uppercase font-normal">REB</span></span>
                  <span class="font-bold text-gray-800">{{ game.scoreboard.gameLeaders.homeLeaders.points }} <span
                      class="text-sm uppercase font-normal">PTS</span></span>
                  <span class="font-bold text-gray-800">{{ game.scoreboard.gameLeaders.homeLeaders.assists }} <span
                      class="text-sm uppercase font-normal">AST</span></span>
                </div>
              </div>
            </div> -->

            <!-- User Picks -->
            <div
              class="px-4 py-2 bg-gray-100 dark:bg-transparent text-sm text-gray-700 border-t border-gray-200 dark:border-gray-600 flex flex-col md:flex-row"
              v-show="game.game_status === 'Final'">
              <div class="w-full md:w-1/2 mb-4 md:mb-0 pl-4 text-xs">
                <div class="overflow-x-auto">
                  <table class="w-full table-fixed text-left border-collapse">
                    <thead>
                      <tr class="bg-gray-100 dark:bg-transparent">
                        <th class="px-4 py-2 text-gray-600 dark:text-white font-medium">Voted for {{
                          game.away_team_name }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr class="border-t border-gray-200 dark:border-gray-600"
                        v-for="(pick, index) in game.away_team.picks" :key="index">
                        <td class="px-4 py-2 text-gray-800 dark:text-white">{{ pick.user_full_name }}</td>
                        <td class="px-4 py-2 flex justify-end opacity-70">
                          <span v-if="pick.correct">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                              xmlns="http://www.w3.org/2000/svg">
                              <circle cx="12" cy="12" r="12" fill="#34D399" />
                              <path d="M8 12.5L10.5 15L16 9" stroke="white" stroke-width="2" stroke-linecap="round"
                                stroke-linejoin="round" />
                            </svg>
                          </span>
                          <span v-else>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                              xmlns="http://www.w3.org/2000/svg">
                              <circle cx="12" cy="12" r="12" fill="#F87171" />
                              <path d="M9 9L15 15M15 9L9 15" stroke="white" stroke-width="2" stroke-linecap="round"
                                stroke-linejoin="round" />
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
                        <th class="px-4 py-2 text-gray-600 dark:text-gray-100 font-medium">Voted for {{
                          game.home_team_name }}</th>
                      </tr>
                      <tr></tr>
                    </thead>
                    <tbody>
                      <tr class="border-t border-gray-200 dark:border-gray-600"
                        v-for="(pick, index) in game.home_team.picks" :key="index">
                        <td class="px-4 py-2 text-gray-800 dark:text-gray-100">{{ pick.user_full_name }}</td>
                        <td class="px-4 py-2 flex justify-end opacity-70">
                          <span v-if="pick.correct">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                              xmlns="http://www.w3.org/2000/svg">
                              <circle cx="12" cy="12" r="12" fill="#34D399" />
                              <path d="M8 12.5L10.5 15L16 9" stroke="white" stroke-width="2" stroke-linecap="round"
                                stroke-linejoin="round" />
                            </svg>
                          </span>
                          <span v-else>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                              xmlns="http://www.w3.org/2000/svg">
                              <circle cx="12" cy="12" r="12" fill="#F87171" />
                              <path d="M9 9L15 15M15 9L9 15" stroke="white" stroke-width="2" stroke-linecap="round"
                                stroke-linejoin="round" />
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
              v-show="isValidDate(game.game_status)">
              <div class="w-full md:w-1/2 mb-4 md:mb-0 pl-4 text-xs">
                <div class="overflow-x-auto">
                  <table class="w-full table-fixed text-left border-collapse">
                    <thead>
                      <tr class="bg-gray-100 dark:bg-transparent text-gray-600 dark:text-gray-300">
                        <th class="px-4 py-2 font-medium">Player</th>
                        <th class="px-4 py-2 font-medium">Injury</th>
                        <th class="px-4 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr class="border-t border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                        v-for="(injury, index) in game.away_team.injuries" :key="index">
                        <td class="px-4 py-2">{{ injury.playerName }}</td>
                        <td class="px-4 py-2">{{ injury.injury }}</td>
                        <td class="px-4 py-2 "
                          :class="{ 'text-red-500 dark:text-red-300': injury.status.includes('Out'), 'text-yellow-500 dark:text-yellow-300': !injury.status.includes('Out') }">
                          <span class="hidden md:block">
                            {{ injury.status }}
                          </span>
                          <span class="md:hidden opacity-80">
                            <span v-if="injury.status === 'Out'">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"
                                xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="11" stroke="currentColor" stroke-width="2" />
                              </svg>

                            </span>
                            <span v-else>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentCOlor"
                                xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="11" stroke="currentColor" stroke-width="2" />
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
                      <tr class="bg-gray-100 dark:bg-transparent text-gray-600 dark:text-gray-300">
                        <th class="px-4 py-2 font-medium">Player</th>
                        <th class="px-4 py-2 font-medium">Injury</th>
                        <th class="px-4 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr class="border-t border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                        v-for="(injury, index) in game.home_team.injuries" :key="index">
                        <td class="px-4 py-2">{{ injury.playerName }}</td>
                        <td class="px-4 py-2">{{ injury.injury }}</td>
                        <td class="px-4 py-2 "
                          :class="{ 'text-red-500 dark:text-red-300': injury.status.includes('Out'), 'text-yellow-500 dark:text-yellow-300': !injury.status.includes('Out') }">
                          <span class="hidden md:block">
                            {{ injury.status }}
                          </span>
                          <span class="md:hidden opacity-80">
                            <span v-if="injury.status === 'Out'">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"
                                xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="11" stroke="currentColor" stroke-width="2" />
                              </svg>

                            </span>
                            <span v-else>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentCOlor"
                                xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="11" stroke="currentColor" stroke-width="2" />
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
          <div
            class="bg-white dark:bg-gradient-to-b dark:to-indigo-900 dark:from-blue-900 dark:text-white w-full rounded-xl shadow-md py-20 px-4 flex flex-col items-center justify-center"
            v-if="!games.length">
            <div v-if="selectedDate === '2024-11-05'" class="border-dashed border-2 rounded-lg hover:border-dotted hover:scale-110 transition-all
              border-gray-600 mb-6 -mt-10 p-6 flex flex-col items-center">
              <p class="text-2xl font-bold text-blue-600">ELECTION</p>
              <p class="text-2xl font-bold text-red-600">DAY</p>
              <img :src="createAssetUrl('donut_election.avif')" alt="" class="rounded-lg shadow-sm ">
            </div>
            <p class="text-2xl font-light uppercase">No games scheduled</p>
          </div>
        </div>
      </div>



      <!-- Right Column: Leaderboard Table -->
      <div class="bg-gray-50 dark:bg-transparent">
        <div
          class="flex h-20 justify-between items-center w-full bg-white dark:bg-gradient-to-r dark:from-blue-950 dark:to-indigo-950 dark:text-gray-100 px-6 py-4 shadow-md mb-4">
          <h4 class="text-2xl uppercase">Leaderboard</h4>
          <div @click="toggleDarkMode()">
            <input type="checkbox" name="light-switch" v-model="isDark" class="light-switch sr-only" />
            <label
              class="flex items-center justify-center cursor-pointer w-8 h-8 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600/80 rounded-full"
              for="light-switch">
              <svg class="w-4 h-4 dark:hidden" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                <path class="fill-current text-slate-400"
                  d="M7 0h2v2H7V0Zm5.88 1.637 1.414 1.415-1.415 1.413-1.414-1.414 1.415-1.414ZM14 7h2v2h-2V7Zm-1.05 7.433-1.415-1.414 1.414-1.414 1.415 1.413-1.414 1.415ZM7 14h2v2H7v-2Zm-4.02.363L1.566 12.95l1.415-1.414 1.414 1.415-1.415 1.413ZM0 7h2v2H0V7Zm3.05-5.293L4.465 3.12 3.05 4.535 1.636 3.121 3.05 1.707Z" />
                <path class="fill-current text-slate-500" d="M8 4C5.8 4 4 5.8 4 8s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4Z" />
              </svg>
              <svg class="w-4 h-4 hidden dark:block" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                <path class="fill-current text-slate-400"
                  d="M6.2 2C3.2 2.8 1 5.6 1 8.9 1 12.8 4.2 16 8.1 16c3.3 0 6-2.2 6.9-5.2C9.7 12.2 4.8 7.3 6.2 2Z" />
                <path class="fill-current text-slate-500"
                  d="M12.5 6a.625.625 0 0 1-.625-.625 1.252 1.252 0 0 0-1.25-1.25.625.625 0 1 1 0-1.25 1.252 1.252 0 0 0 1.25-1.25.625.625 0 1 1 1.25 0c.001.69.56 1.249 1.25 1.25a.625.625 0 1 1 0 1.25c-.69.001-1.249.56-1.25 1.25A.625.625 0 0 1 12.5 6Z" />
              </svg>
              <span class="sr-only">Switch to light / dark version</span>
            </label>
          </div>
        </div>
        <div
          class="bg-white dark:bg-gradient-to-r dark:from-blue-950 dark:to-indigo-950 dark:text-gray-100 mb-4 rounded-xl shadow-md px-4 py-6 font-thin text-lg flex flex-col justify-center items-center leading-relaxed"
          v-if="yesterdayReport">
          <p>
            You got <strong>{{ yesterdayReport.correct }}</strong> out of <strong>{{ yesterdayReport.total }}</strong>
            picks correct from <span class="hover:underline cursor-pointer text-blue-500 dark:text-blue-300"
              @click="selectedDate = formatYesterdayToDateString()">last night!</span>
          </p>
          <p class="text-green-600 dark:text-green-300 text-md" v-if="yesterdayReport.accuracy >= 70">Wow, {{
            yesterdayReport.accuracy }}% ! You're on a roll! 🔥</p>
          <p class="text-yellow-600 dark:text-yellow-300 text-md"
            v-if="yesterdayReport.accuracy < 70 && yesterdayReport.accuracy >= 40">
            Hmm, {{ yesterdayReport.accuracy }}% ! Not great, not terrible 🥨</p>
          <p class="text-red-600 dark:text-red-300 text-md"
            v-if="yesterdayReport.accuracy < 40 && yesterdayReport.accuracy > 0">Pretty
            weak, {{
              yesterdayReport.accuracy }}% ! Do better 🥗</p>
          <p class="text-red-600 dark:text-red-300 text-md" v-if="yesterdayReport.accuracy == 0">Wow, {{
            yesterdayReport.accuracy }}% ! Now that's bad (and sad) 🤦‍♂️</p>
        </div>
        <div
          class="bg-white dark:bg-gradient-to-r dark:from-blue-950 dark:to-indigo-950 dark:text-gray-100 mb-4 rounded-xl shadow-md px-4 py-6 font-thin text-lg flex justify-between items-center leading-relaxed">
          <button class="px-4 py-3 border rounded-lg uppercase font-semibold
           shadow-lg transition-all duration-100 ease-in-out
           transform hover:scale-105 active:scale-95
           bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border-gray-300
           dark:bg-gradient-to-r dark:from-slate-800 dark:to-indigo-600 dark:text-white dark:border-indigo-700" :class="{
            'ring-4 ring-yellow-400 shadow-yellow-400/50 bg-gradient-to-r from-yellow-300 to-yellow-400 text-yellow-900 border-yellow-400':
              !isLeaderboardPlayoff,
            'bg-gradient-to-r from-indigo-400 to-indigo-600 text:yellow-900 dark:text-white border-indigo-600':
              isLeaderboardPlayoff,
          }" v-on:click="getUsers(false)">
            Regular Season
          </button>

          <button class="px-4 py-3 border rounded-lg uppercase font-semibold
           shadow-lg transition-all duration-100 ease-in-out
           transform hover:scale-105 active:scale-95
           bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border-gray-300
           dark:bg-gradient-to-r dark:from-slate-800 dark:to-indigo-600 dark:text-white dark:border-indigo-700" :class="{
            'ring-4 ring-yellow-400 shadow-yellow-400/50 bg-gradient-to-r from-yellow-300 to-yellow-400 text-yellow-900 border-yellow-400':
              isLeaderboardPlayoff,
            'bg-gradient-to-r from-indigo-400 to-indigo-600 text-white border-indigo-600':
              !isLeaderboardPlayoff,
          }" v-on:click="getUsers(true)">
            Playoffs
          </button>
        </div>
        <div v-if="session">
          <div class="space-y-4 py-3">
            <div v-for="(user, index) in leaderboard" :key="user.id"
              class=" p-4 bg-white text-gray-900 dark:bg-gradient-to-r dark:from-blue-950 dark:to-indigo-950 dark:text-gray-100 flex items-start w-full rounded-lg shadow-md">

              <!-- Left Section: Avatar and Medal -->
              <div class="flex-shrink-0 relative mr-6 flex flex-col h-full justify-between items-center">
                <!-- Avatar Image -->
                <img :src="user.avatar_url" alt="User Avatar"
                  class="w-12 h-12 rounded-full border border-gray-300 dark:border-gray-800 object-cover">

                <!-- Rank (Takes the full height of the left section) -->
                <div
                  class="flex-grow flex items-center justify-center text-6xl text-gray-200 dark:bg-gradient-to-b from-blue-900 to-indigo-900 dark:text-transparent dark:bg-clip-text mt-4 font-extrabold">
                  {{ index + 1 }}
                </div>

                <span v-if="index < 3" :class="{
                  'absolute -top-2 -right-2 text-xs font-bold py-1 px-1.5 rounded-full flex items-center justify-center': true,
                  'bg-yellow-200': index === 0,
                  'bg-gray-200': index === 1,
                  'bg-amber-500': index === 2
                }" class="text-white">
                  {{ ['🥇', '🥈', '🥉'][index] }}
                </span>
              </div>
              <!-- <RouterLink to="/user/1">go to user</RouterLink> -->
              <!-- User Information -->
              <div class="flex-1">
                <h3 class="text-lg font-semibold">{{ user.name }}</h3>

                <!-- Points and Accuracy Circles -->
                <div class="flex items-center space-x-6 mt-4">
                  <!-- Points Circle -->
                  <div
                    class="relative flex flex-col items-center justify-center w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border-2 border-blue-200 dark:border-blue-200 text-lg font-bold">
                    <!-- Points Value -->
                    <span class="text-lg">{{ user.points }}</span>
                    <!-- Total Picks Value -->
                    <span class="text-xs scale-80 text-gray-600 dark:text-gray-400">{{ user.totalPicks }}</span>
                  </div>

                  <!-- Accuracy Circle with SVG Progress Border -->
                  <div class="relative w-16 h-16 flex items-center justify-center">
                    <!-- SVG Progress Circle -->
                    <svg class="w-full h-full" transform="rotate(-90)">
                      <circle cx="50%" cy="50%" r="25" stroke="lightgray" stroke-width="4" fill="none" />
                      <circle cx="50%" cy="50%" r="25" stroke="currentColor" :stroke-dasharray="circleCircumference"
                        :stroke-dashoffset="getStrokeOffset(user.accuracy)" stroke-width="4" fill="none"
                        :class="getAccuracyColorClass(user.accuracy)" class="transition-all duration-300" />
                    </svg>
                    <!-- Accuracy Text in the Center -->
                    <span class="absolute text-gray-800 dark:text-gray-200 font-bold"
                      :style="{ fontSize: user.accuracy > 99 ? '10px' : '14px' }">
                      {{ user.accuracy }}%
                    </span>
                  </div>
                </div>


                <!-- Expanded Daily Accuracy Section -->
                <div class="mt-4 px-1 gap-y-2.5 grid grid-cols-4">
                  <div v-for="(acc, date) in user.latestDailyAccuracy" :key="date"
                    class="text-center w-12 lg:w-16 border border-gray-200 bg-gray-50 dark:bg-transparent flex flex-col items-center justify-center font-bold rounded-md text-xs">
                    <span class="hidden lg:block text-[10px] font-light text-gray-500 dark:text-gray-200">
                      {{ date }}
                    </span>
                    <span :class="{
                      'text-green-600 dark:text-green-300': acc >= 70,
                      'text-yellow-500 dark:text-yellow-200': acc >= 40 && acc < 70,
                      'text-red-600 dark:text-red-300': acc < 40
                    }">{{ acc.toFixed(1) }}%</span>
                  </div>
                </div>
                <!-- <div class="mt-4 px-1 grid grid-cols-2 text-xs">
                  <div v-for="(p, abbr) in user.picksByTeam" :key="abbr" class="flex items-center">
                    <img :src="getTeamImageUrlByAbr(p.abbreviation)" alt="away-logo"
                      class="w-10 h-10 object-contain" />
                    <span>{{ p.correct }} / {{ p.total }}</span>
                  </div>
                </div> -->
              </div>

              <!-- Indicator for Logged-in User on the Right -->
              <div v-if="user.id === userId"
                class=" text-xs font-bold bg-blue-600 text-white px-2 py-1 rounded-md -ml-8">
                YOU
              </div>
            </div>
          </div>
          <div class="flex w-full justify-center mt-6">
            <!-- <button @click="getUsers"
              class="rounded px-4 py-1 bg-white border border-gray-200 text-gray-400 hover:underline underline-offset-2 transition-all">Refresh leaderboard</button> -->
            <button @click="signOut"
              class="rounded px-4 py-1 bg-white border border-gray-200 text-gray-400 hover:underline underline-offset-2 transition-all">Sign
              out</button>
          </div>
        </div>
        <div v-else class="h-80 bg-white shadow-md flex flex-col items-center justify-center gap-8">
          <p class="font-thin">Please log in to vote and access leaderboard 🥞</p>
          <div id="google-signin-container">
            <div id="g_id_onload" :data-client_id="getGoogleClientId()" data-context="signin" data-ux_mode="popup"
              data-callback="handleSignInWithGoogle" data-auto_prompt="false" data-use_fedcm_for_prompt="true">
            </div>

            <div class="g_id_signin" data-type="standard" data-shape="rectangular" data-theme="outline"
              data-text="signin_with" data-size="large" data-logo_alignment="left">
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

</template>

<style scoped></style>
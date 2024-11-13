  <script setup>
  import { ref, onMounted, watch } from 'vue'
  // import { useRoute } from 'vue-router'

  import { supabase } from './lib/supabaseClient'

  // const route = useRoute()

  const games = ref([])

  const injuries = ref()

  const session = ref()

  const userId = ref()

  const users = ref()

  const selectedDate = ref(new Date().toISOString().split('T')[0]); // Sets today's date by default
  // const selectedDate = ref('2024-11-13'); // Sets today's date by default

  const selectedDateMobile = ref(new Date().toISOString().split('T')[0]); // Sets today's date by default

  const leaderboard = ref([])

  const datePicker = ref(null);

  const allowPastVotes = ref(false)

  const yesterdayReport = ref()

  const loading = ref(false)

  const nbaCupGroupDates = ['2024-11-12', '2024-11-15', '2024-11-19', '2024-11-22', '2024-11-26', '2024-11-29', '2024-12-03']

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
      if (isValidDate(game.status)) {
        game.home_team.injuries = injuries.value.filter(i => i.team === game.home_team.abbreviation).map(i => ({ playerName: i.player, injury: i.injury, position: i.position, status: i.status }))
        game.away_team.injuries = injuries.value.filter(i => i.team === game.away_team.abbreviation).map(i => ({ playerName: i.player, injury: i.injury, position: i.position, status: i.status }))
      }

      return game;
    })
  })

  function formatYesterdayToDateString() {
    const date = new Date()
    date.setDate(date.getDate() - 1)
    return date.toISOString().split('T')[0]
  }

  async function getUsers() {
    let { data } = await supabase.from('profiles').select('id,avatar_url,full_name,picks(id,correct,game_date:games(date))')
    users.value = data.map(u => ({ ...u, 'picks': u.picks.map(p => ({ ...p, 'game_date': p.game_date.date })) }))
    leaderboard.value = data.map(user => ({
      id: user.id,
      name: user.full_name,
      avatar_url: user.avatar_url,
      points: user.picks.filter(p => p.correct).length,
      totalPicks: user.picks.filter(p => p.correct !== null).length
    }))
    sortByPoints()
  }

  function updateYesterdayReport() {
    const picksFromYesterady = users.value.find(u => u.id === userId.value)?.picks.filter(p => p.game_date === formatYesterdayToDateString() && p.correct !== null);
    if (picksFromYesterady && picksFromYesterady.length) {
      const correct = picksFromYesterady.filter(p => p.correct).length;
      yesterdayReport.value = {
        correct: correct,
        total: picksFromYesterady.length,
        accuracy: (correct * 100 / picksFromYesterady.length).toPrecision(3)
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
    let { data } = await supabase.from('games')
      .select('\
      *, \
      home_team:home_team_id(*),\
      away_team:away_team_id(*),\
      picks(*,\
        user:user_id(full_name),\
        picked_team_name:picked_team(name)))')
      .eq('date', selectedDate.value)
      .order('date', { ascending: true })
      .order('status');


    const { data: teamGames, error: teamError } = await supabase
      .from('games')
      .select(`
      home_team_id,
      away_team_id,
      home_team_score,
      away_team_score
    `)
      .eq('status', 'Final').order('date', { ascending: true });

    const teamRecords = {};
    teamGames.forEach(game => {

      const { home_team_id, away_team_id, home_team_score, away_team_score } = game;

      if (!teamRecords[home_team_id]) teamRecords[home_team_id] = { wins: 0, losses: 0, record: [] };
      if (!teamRecords[away_team_id]) teamRecords[away_team_id] = { wins: 0, losses: 0, record: [] };

      if (home_team_score > away_team_score) {
        teamRecords[home_team_id].wins += 1;
        teamRecords[away_team_id].losses += 1;
        teamRecords[home_team_id].record.push('W');
        teamRecords[away_team_id].record.push('L');
      } else if (away_team_score > home_team_score) {
        teamRecords[away_team_id].wins += 1;
        teamRecords[home_team_id].losses += 1;
        teamRecords[away_team_id].record.push('W');
        teamRecords[home_team_id].record.push('L');
      }
    });

    data = data.map(g => {
      g.home_team.picks = g.picks.reduce((acc, pick) => {
        if (pick.picked_team === g.home_team.id) {
          acc[pick.user_id] = pick;
        }
        return acc;
      }, {})
      g.away_team.picks = g.picks.reduce((acc, pick) => {
        if (pick.picked_team === g.away_team.id) {
          acc[pick.user_id] = pick;
        }
        return acc;
      }, {})
      g.picks = g.picks.reduce((acc, pick) => {
        acc[pick.user_id] = pick;
        return acc;
      }, {});


      g.home_team.wins = teamRecords[g.home_team.id].wins || 0
      g.home_team.losses = teamRecords[g.home_team.id].losses || 0
      g.away_team.wins = teamRecords[g.away_team.id].wins || 0
      g.away_team.losses = teamRecords[g.away_team.id].losses || 0
      g.home_team.record = teamRecords[g.home_team.id].record.slice(-5) || []
      g.away_team.record = teamRecords[g.away_team.id].record.slice(-5) || []
      if (isValidDate(g.status)) {
        g.home_team.injuries = injuries.value?.filter(i => i.team === g.home_team.abbreviation).map(i => ({ playerName: i.player, injury: i.injury, position: i.position, status: i.status }))
        g.away_team.injuries = injuries.value?.filter(i => i.team === g.away_team.abbreviation).map(i => ({ playerName: i.player, injury: i.injury, position: i.position, status: i.status }))
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

  async function init() {
    allowPastVotes.value = import.meta.env.VITE_ALLOW_PAST_VOTES === 'true';
    getUsers()
    getGames()
    getInjuryReport()

    const { data } = await supabase.auth.getSession();
    session.value = data.session;

    if (session.value) {
      userId.value = session.value.user.id;
    } else { userId.value = null }
  }

  async function getInjuryReport() {
    console.log('making request to injuries')
    const injuriesApiUrl = `${import.meta.env.VITE_APP_ENV === 'local' ? 'https://corsproxy.io/?' : ''}https://www.rotowire.com/basketball/tables/injury-report.php?team=ALL&pos=ALL`
    const injuriesResponse = await fetch(injuriesApiUrl);
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

  function getTeamImageUrl(team) {
    return new URL(`./assets/${team.abbreviation}/logo.svg`, import.meta.url).href;
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
    if (isValidDate(game.status)) {
      return formatISOTo24HourTime(new Date(game.status));
    }
    return game.status;
  }

  function isValidDate(date) {
    date = new Date(date)
    return date.toString() !== 'Invalid Date';
  }

  async function submitPick(game, picked_team_id) {
    if (!userId.value) {
      return;
    }
    if (!allowPastVotes.value && !isValidDate(game.status)) {
      return;
    }
    const toUpsert = { game_id: game.id, picked_team: picked_team_id, user_id: userId.value };

    if (allowPastVotes.value && game.status === 'Final') {
      const winner =
        game.home_team_score > game.away_team_score
          ? game.home_team
          : game.away_team
      toUpsert.correct = picked_team_id === winner.id
    }

    if (game.picks[userId.value]) {
      toUpsert.id = game.picks[userId.value].id;
    }
    const { data } = await supabase.from('picks')
      .upsert([toUpsert]).select('*,user:user_id(full_name),\
        picked_team_name:picked_team(name)');

    games.value = games.value.map(g => {
      if (g.id === game.id) {
        return {
          ...g,
          picks: {
            ...g.picks,
            [userId.value]: data[0],
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

  const getClass = (game, team) => {
    const hoverClasses = 'hover:bg-blue-50 hover:cursor-pointer ';
    let classes = '';
    if (session.value && (isValidDate(game.status) || allowPastVotes.value)) {
      classes = classes.concat(hoverClasses);
    }

    const pick = game.picks[userId.value];
    if (!pick) { return classes }
    if (pick.correct && pick.picked_team === team.id) {
      classes = classes.concat('bg-green-50 border-2 border-green-300')
    } else if (pick.correct === false && pick.picked_team === team.id) {
      classes = classes.concat('bg-red-50 border-2 border-red-300');
    } else if (pick.picked_team === team.id) {
      classes = classes.concat('bg-blue-50 border-2 border-blue-300');
    } else {
      classes = classes.concat('bg-gray-50 border-2 border-gray-50');
    }

    return classes;
  };

  function getGoogleClientId() {
    return import.meta.env.VITE_GOOGLE_CLIENT_ID;
  }

</script>


  <template>


    <div class="min-h-screen bg-gray-50 p-6 flex justify-between transition-all">
      <div class="container mx-auto grid grid-cols-1 lg:grid-cols-3 gap-20">

        <!-- Left Column: Date Picker and Game Cards -->
        <div class="lg:col-span-2 space-y-6">
          <div class="h-20 md:flex hidden justify-between items-center w-full bg-white px-6 py-4 shadow-md">
            <h4 class="text-2xl uppercase">Games</h4>
            <div class="flex justify-between items-center space-x-3 select-none">
              <span class="underline hover:scale-110 transition-all cursor-pointer hover:underline-offset-1 rotate-90"
                @click="goToPreviousDay">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500 hover:text-blue-500 transition"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
              <h4 class="text-2xl">
                {{ selectedDate }}
              </h4>
              <span class="underline hover:scale-110 transition-all cursor-pointer hover:underline-offset-1 -rotate-90"
                @click="goToNextDay">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500 hover:text-blue-500 transition"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </div>
            <div class="relative w-14">
              <!-- Button wrapping the entire input area for click anywhere functionality -->
              <button @click="toggleDatePicker"
                class="w-full z-20 bg-gray-100 text-center rounded-md py-2 px-3 text-gray-700 border border-gray-300 flex items-center justify-between transition">
                <!-- Calendar Icon -->
                <svg xmlns="http://www.w3.org/2000/svg"
                  class="h-7 w-7 text-gray-500 hover:text-blue-500 transition z-20" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 7V3m8 4V3M3 10h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>

              <!-- Hidden Date Picker Input -->
              <input ref="datePicker" type="date" v-model="selectedDate"
                class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" />
            </div>
          </div>
          <div class="h-20 flex md:hidden justify-center items-center w-full bg-white px-6 py-4 shadow-md">
            <input type="date" v-model="selectedDateMobile"
              class="p-2 border rounded-lg text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-300" />
          </div>

          <div v-if="nbaCupGroupDates.includes(selectedDate)"
            class="rounded-lg transition-all border-gray-600 mb-6flex flex-col items-center">
            <img :src="createAssetUrl('image002.webp')" alt="" class="rounded-lg shadow-sm ">
          </div>

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
              class="bg-white rounded-xl shadow-md overflow-hidden transform transition duration-100">
              <!-- Game Header -->
              <div class="flex justify-between items-center bg-gray-100 px-6 py-3 border-b border-gray-200">
                <p class="text-xs font-medium text-gray-500">{{ game.date }}</p>
                <p class="text-xs font-semibold text-red-500 uppercase tracking-wide">{{ getStatus(game) }}</p>
              </div>

              <!-- Teams Section -->
              <div
                class="flex flex-col md:flex-row items-center md:items-start px-6 py-6 space-y-4 md:space-y-0 md:space-x-4">
                <!-- Away Team -->
                <div
                  :class="['w-full md:w-1/2 flex justify-between items-center p-4 rounded-lg shadow-sm ', getClass(game, game.away_team)]"
                  @click="submitPick(game, game.away_team.id)">
                  <div class="flex items-center space-x-3">
                    <img :src="getTeamImageUrl(game.away_team)" alt="away-logo" class="w-20 h-20 object-contain" />
                    <div class="flex flex-col">
                      <p class="font-semibold text-lg text-gray-800">{{ game.away_team.name }} <span
                          class="text-sm font-medium">
                          ({{ game.away_team.wins }} - {{ game.away_team.losses }})
                        </span>
                      </p>
                      <p class="text-gray-500 text-xs">away team</p>
                      <p class="text-xs flex items-center gap-3 font-semibold mt-2">
                        <span v-for="(wl, index) in game.away_team.record" :key="index"
                          :class="{ 'text-red-600': wl === 'L', 'text-green-600': wl === 'W' }">{{ wl }}</span>
                      </p>
                    </div>
                  </div>
                  <p class="ml-auto font-extrabold text-2xl text-gray-700">{{ game.away_team_score }}</p>
                </div>

                <!-- Home Team -->
                <div
                  :class="['w-full md:w-1/2 flex justify-between items-center p-4 rounded-lg shadow-sm', getClass(game, game.home_team)]"
                  @click="submitPick(game, game.home_team.id)">
                  <div class="flex items-center space-x-3">
                    <img :src="getTeamImageUrl(game.home_team)" alt="home-logo" class="w-20 h-20 object-contain" />
                    <div class="flex flex-col">
                      <p class="font-semibold text-lg text-gray-800">{{ game.home_team.name }} <span
                          class="text-sm font-medium">
                          ({{ game.home_team.wins }} - {{ game.home_team.losses }})
                        </span>
                      </p>
                      <p class="text-gray-500 text-xs">home team</p>
                      <p class="text-gray-500 text-xs"></p>
                      <p class="text-xs flex items-center gap-3 font-semibold mt-2">
                        <span v-for="(wl, index) in game.home_team.record" :key="index"
                          :class="{ 'text-red-600': wl === 'L', 'text-green-600': wl === 'W' }">{{ wl }}</span>
                      </p>
                    </div>
                  </div>
                  <p class="ml-auto font-extrabold text-2xl text-gray-700">{{ game.home_team_score }}</p>
                </div>
              </div>

              <!-- Team Leaders Section -->
              <!-- <div class="grid grid-cols-2 gap-4 -mt-4 mb-2 px-6" v-if="game.scoreboard"> -->
                <!-- Team 1 Leader -->
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
                </div> -->

                <!-- Team 2 Leader -->
                <!-- <div class="bg-gray-50 p-4 rounded-xl shadow-sm border-t-2 border-gray-600">
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
                class="px-4 py-2 bg-gray-100 text-sm text-gray-700 border-t border-gray-200 flex flex-col md:flex-row"
                v-show="game.status === 'Final'">
                <div class="w-full md:w-1/2 mb-4 md:mb-0 pl-4 text-xs">
                  <div class="overflow-x-auto">
                    <table class="w-full table-fixed text-left border-collapse">
                      <thead>
                        <tr class="bg-gray-100">
                          <th class="px-4 py-2 text-gray-600 font-medium">Voted for {{ game.away_team.name }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr class="border-t" v-for="(pick, index) in game.away_team.picks" :key="index">
                          <td class="px-4 py-2 text-gray-800">{{ pick.user.full_name }}</td>
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
                        <tr class="bg-gray-100">
                          <th class="px-4 py-2 text-gray-600 font-medium">Voted for {{ game.home_team.name }}</th>
                        </tr>
                        <tr></tr>
                      </thead>
                      <tbody>
                        <tr class="border-t" v-for="(pick, index) in game.home_team.picks" :key="index">
                          <td class="px-4 py-2 text-gray-800">{{ pick.user.full_name }}</td>
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
                class="px-4 py-2 bg-gray-100 text-sm text-gray-700 border-t border-gray-200 flex flex-col md:flex-row"
                v-show="isValidDate(game.status)">
                <div class="w-full md:w-1/2 mb-4 md:mb-0 pl-4 text-xs">
                  <div class="overflow-x-auto">
                    <table class="w-full table-fixed text-left border-collapse">
                      <thead>
                        <tr class="bg-gray-100">
                          <th class="px-4 py-2 text-gray-600 font-medium">Player</th>
                          <th class="px-4 py-2 text-gray-600 font-medium">Injury</th>
                          <th class="px-4 py-2 text-gray-600 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr class="border-t" v-for="(injury, index) in game.away_team.injuries" :key="index">
                          <td class="px-4 py-2 text-gray-800">{{ injury.playerName }}</td>
                          <td class="px-4 py-2 text-gray-500">{{ injury.injury }}</td>
                          <td class="px-4 py-2 "
                            :class="{ 'text-red-500': injury.status.includes('Out'), 'text-yellow-500': !injury.status.includes('Out') }">
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
                <div class="w-full md:w-1/2 pl-4 text-xs">
                  <div class="overflow-x-auto">
                    <table class="w-full table-fixed text-left border-collapse">
                      <thead>
                        <tr class="bg-gray-100">
                          <th class="px-4 py-2 text-gray-600 font-medium">Player</th>
                          <th class="px-4 py-2 text-gray-600 font-medium">Injury</th>
                          <th class="px-4 py-2 text-gray-600 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr class="border-t" v-for="(injury, index) in game.home_team.injuries" :key="index">
                          <td class="px-4 py-2 text-gray-800">{{ injury.playerName }}</td>
                          <td class="px-4 py-2 text-gray-500">{{ injury.injury }}</td>
                          <td class="px-4 py-2 "
                            :class="{ 'text-red-500': injury.status.includes('Out'), 'text-yellow-500': !injury.status.includes('Out') }">
                            <span class="hidden md:block">
                              {{ injury.status }}
                            </span>
                            <span class="md:hidden opacity-80">
                              <span v-if="injury.status.includes('Out')">
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
            <div class="bg-white w-full rounded-xl shadow-md py-20 px-4 flex flex-col items-center justify-center"
              v-if="!games.length">
              <div v-if="selectedDate === '2024-11-05'"
                class="border-dashed border-2 rounded-lg hover:border-dotted hover:scale-110 transition-all border-gray-600 mb-6 -mt-10 p-6 flex flex-col items-center">
                <p class="text-2xl font-bold text-blue-600">ELECTION</p>
                <p class="text-2xl font-bold text-red-600">DAY</p>
                <img :src="createAssetUrl('donut_election.avif')" alt="" class="rounded-lg shadow-sm ">
              </div>
              <p class="text-2xl font-light uppercase">No games scheduled</p>
            </div>
          </div>
        </div>



        <!-- Right Column: Leaderboard Table -->
        <div class="bg-gray-50">
          <div class="flex h-20 justify-center items-center w-full bg-white px-6 py-4 shadow-md mb-4">
            <h4 class="text-2xl uppercase">Leaderboard</h4>
          </div>
          <div
            class="bg-white mb-4 rounded-xl shadow-md px-4 py-6 font-thin text-lg flex flex-col justify-center items-center leading-relaxed"
            v-if="yesterdayReport">
            <p>
              You got <strong>{{ yesterdayReport.correct }}</strong> out of <strong>{{ yesterdayReport.total }}</strong>
              picks correct from <span class="hover:underline cursor-pointer text-blue-500"
                @click="selectedDate = formatYesterdayToDateString()">last night!</span>
            </p>
            <p class="text-green-600 text-md" v-if="yesterdayReport.accuracy >= 70">That is a very impressive {{
              yesterdayReport.accuracy }}% ! Keep it up!</p>
            <p class="text-yellow-600 text-md" v-if="yesterdayReport.accuracy < 70 && yesterdayReport.accuracy >= 40">
              That is a decent {{ yesterdayReport.accuracy }}% ! Let's try to do better tomorrow!</p>
            <p class="text-red-600 text-md" v-if="yesterdayReport.accuracy < 40">Uh-oh! That is a sub-par {{
              yesterdayReport.accuracy }}% ! One off day doesn't define you, let's try again tomorrow!</p>
          </div>
          <div v-if="session">
            <div class="bg-white shadow-md rounded pb-40 overflow-hidden">
              <table class="w-full text-sm ">
                <thead>
                  <tr class="bg-gray-100 text-lg md:text-xl">
                    <th class="text-left px-4 py-2 text-gray-600">Name</th>
                    <th class="text-left px-4 py-2 text-gray-600">
                      <div class="flex items-center gap-2">
                        <span>Points</span>
                        <span class="underline text-xs cursor-pointer hover:underline-offset-1" @click="sortByPoints">
                          <svg xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4 text-gray-500 hover:text-blue-500 transition" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </th>
                    <th class="text-left px-4 py-2 text-gray-600">
                      <div class="flex items-center gap-2">
                        <span>Accuracy</span>
                        <span class="underline text-xs cursor-pointer hover:underline-offset-1" @click="sortByAccuracy">
                          <svg xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4 text-gray-500 hover:text-blue-500 transition" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="user in leaderboard" :key="user.id"
                    class="p-8 border-b last:border-0 transform transition duration-100 text-md md:text-lg"
                    :class="{ ' bg-gray-50': user.id === userId }">
                    <td class="px-4 py-6 flex items-center gap-2">
                      <img :src="user.avatar_url" alt="" class="rounded-full w-6 h-6">
                      {{ user.name }}
                    </td>
                    <td class="px-4 py-2 font-bold">{{ user.points }} <span class="text-gray-500 font-light">({{
                      user.totalPicks
                        }})</span>
                    </td>
                    <td class="px-4 py-2 text-gray-500">{{ (user.points * 100 / user.totalPicks).toPrecision(3) }}%
                    </td>
                  </tr>
                </tbody>
              </table>
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
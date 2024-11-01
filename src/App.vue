  <script setup>
  import { ref, onMounted, watch } from 'vue'

  import { supabase } from './lib/supabaseClient'

  const games = ref([])

  const session = ref()

  const userId = ref()

  const users = ref()

  const selectedDate = ref(new Date().toISOString().split('T')[0]); // Sets today's date by default

  const leaderboard = ref([])

  const datePicker = ref(null);

  const allowPastVotes = ref(false)

  window.handleSignInWithGoogle = handleSignInWithGoogle

  function sortByAccuracy() {
    leaderboard.value = leaderboard.value.sort((a, b) => {
      return (b.points * 100 / b.totalPicks).toPrecision(2) - (a.points * 100 / a.totalPicks).toPrecision(2);
    })
  }

  function sortByPoints() {
    leaderboard.value = leaderboard.value.sort((a, b) => {
      if (b.points === a.points) return a.totalPicks - b.totalPicks;
      return b.points - a.points;
    })
  }

  watch(selectedDate, () => {
    getGames()
  })

  async function getUsers() {
    let { data } = await supabase.from('profiles').select('id, full_name,picks(id,correct)')
    users.value = data
    leaderboard.value = data.map(user => ({
      name: user.full_name,
      points: user.picks.filter(p => p.correct).length,
      totalPicks: user.picks.filter(p => p.correct !== null).length
    }))
    sortByPoints()
  }

  const toggleDatePicker = () => {
    datePicker.value.showPicker();
  };

  async function getGames() {
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

    data = data.map(g => {
      g.picks = g.picks.reduce((acc, pick) => {
        acc[pick.user_id] = pick;
        return acc;
      }, {});

      return g;
    });
    games.value = data;
  }

  onMounted(async () => {
    init()
  })

  async function init() {
    allowPastVotes.value = import.meta.env.VITE_ALLOW_PAST_VOTES === 'true';
    getUsers()
    getGames()

    const { data } = await supabase.auth.getSession();
    session.value = data.session;

    if (session.value) {
      userId.value = session.value.user.id;
    } else { userId.value = null }
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

  function getImageUrl(team) {
    return new URL(`./assets/${team.abbreviation}/logo.svg`, import.meta.url).href;
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
    if (!allowPastVotes.value && !isValidDate(game.status)) {
      alert('This game is already in progress or over, you cannot vote anymore :)')
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


    <div class="min-h-screen bg-gray-50 p-6 flex justify-between">
      <div class="container mx-auto grid grid-cols-1 lg:grid-cols-3 gap-20">

        <!-- Left Column: Date Picker and Game Cards -->
        <div class="lg:col-span-2 space-y-6">
          <div class="h-20 flex justify-between items-center w-full bg-white px-6 py-4 shadow-md">
            <h4 class="text-2xl uppercase">Games</h4>
            <h4 class="text-2xl">
              {{ selectedDate }}
            </h4>
            <div class="relative w-14">
              <!-- Button wrapping the entire input area for click anywhere functionality -->
              <button @click="toggleDatePicker"
                class="w-full z-20 bg-gray-100 text-center rounded-md py-2 px-3 text-gray-700 border border-gray-300 flex items-center justify-between transition">
                <!-- Displayed Date Text -->
                <!-- <span>{{ formattedDate }}</span> -->

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
                :class="['w-full md:w-1/2 flex justify-between items-center p-4 rounded-lg shadow-sm', getClass(game, game.away_team)]"
                @click="submitPick(game, game.away_team.id)">
                <div class="flex items-center space-x-3">
                  <img :src="getImageUrl(game.away_team)" alt="away-logo" class="w-20 h-20 object-contain " />
                  <div class="flex flex-col">
                    <p class="font-semibold text-lg text-gray-800">{{ game.away_team.name }}</p>
                    <p class="text-gray-500 text-xs">away team</p>
                  </div>
                </div>
                <p class="ml-auto font-extrabold text-2xl text-gray-700">{{ game.away_team_score }}</p>
              </div>

              <!-- Home Team -->
              <div
                :class="['w-full md:w-1/2 flex justify-between items-center p-4 rounded-lg shadow-sm', getClass(game, game.home_team)]"
                @click="submitPick(game, game.home_team.id)">
                <div class="flex items-center space-x-3">
                  <img :src="getImageUrl(game.home_team)" alt="home-logo" class="w-20 h-20 object-contain" />
                  <div class="flex flex-col">
                    <p class="font-semibold text-lg text-gray-800">{{ game.home_team.name }}</p>
                    <p class="text-gray-500 text-xs">home team</p>
                  </div>
                </div>
                <p class="ml-auto font-extrabold text-2xl text-gray-700">{{ game.home_team_score }}</p>
              </div>
            </div>

            <!-- User Pick -->
            <div class="px-4 py-2 bg-gray-100 text-sm text-gray-700 border-t border-gray-200"
              v-show="game.status === 'Final'">
              <p v-for="(pick, index) in game.picks" :key="index">
                <b>{{ pick.user.full_name }}</b> voted for <b>{{ pick.picked_team_name.name }}</b>
              </p>
            </div>
          </div>
          <div class="bg-white w-full rounded shadow-md py-20 px-4 flex justify-center" v-if="!games.length">
            <p class="text-2xl font-light uppercase">No games this day</p>
          </div>
        </div>


        <!-- Right Column: Leaderboard Table -->
        <div class="bg-gray-50">
          <div class="flex h-20 justify-center items-center w-full bg-white px-6 py-4 shadow-md mb-4">
            <h4 class="text-2xl uppercase">Leaderboard</h4>
          </div>
          <div v-if="session">
            <div class="bg-white shadow-md rounded pb-40">
              <table class="w-full text-sm ">
                <thead>
                  <tr class="bg-gray-100 text-xl">
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
                    class="even:bg-gray-50 border-b last:border-0 transform transition duration-100 text-lg">
                    <td class="px-4 py-2">{{ user.name }}</td>
                    <td class="px-4 py-2 font-bold">{{ user.points }} <span class="text-gray-500 font-light">({{
                      user.totalPicks
                        }})</span>
                    </td>
                    <td class="px-4 py-2 text-gray-500">{{ (user.points * 100 / user.totalPicks).toPrecision(2) }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="flex w-full justify-center mt-20">
              <button @click="signOut"
                class="px-4 py-1 bg-white border border-gray-400 hover:underline underline-offset-2 transition-all">Sign
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
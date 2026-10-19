<script setup>
import { computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useGamesStore } from '../stores/games'
import { useGlobalStore } from '../stores/global'
import { useInsightsStore } from '../stores/insights'
import GameTicket from '../components/GameTicket.vue'
import AllStarBoard from '../components/AllStarBoard.vue'
import TopPerformers from '../components/TopPerformers.vue'
import DayStrip from '../components/DayStrip.vue'
import GameSpotlight from '../components/GameSpotlight.vue'
import InjuryWire from '../components/InjuryWire.vue'
import StandingsSnapshot from '../components/StandingsSnapshot.vue'
import LeagueLeaders from '../components/LeagueLeaders.vue'
import PeriodChampions from '../components/PeriodChampions.vue'
import NewBadgePanel from '../components/NewBadgePanel.vue'
import LastNightStub from '../components/LastNightStub.vue'
import { useDailyResultsStore } from '../stores/dailyResults'
import { weekStart } from '../lib/season'

const gamesStore = useGamesStore()
const globalStore = useGlobalStore()
const insightsStore = useInsightsStore()

const {
  games,
  allStarMarkets,
  selectedDate,
  loading,
  maxConfidencePerDay,
  usedConfidenceToday,
  remainingConfidence,
  isAllStarWeekend,
} = storeToRefs(gamesStore)
const { session, userId } = storeToRefs(globalStore)
const dailyResultsStore = useDailyResultsStore()

onMounted(async () => {
  insightsStore.fetchLeagueContext()
  await gamesStore.initializeGames()
})

watch(games, value => insightsStore.fetchLines(selectedDate.value, value), {
  immediate: true,
})

// Dates are 'YYYY-MM-DD' strings on the US game day, matching the games store
const todayIso = computed(() => gamesStore.today)

const isTodayOrFuture = computed(() => selectedDate.value >= todayIso.value)

// Your score on each game day of the week, written on the day strip, and
// last game day's result on a stub under today's date
const stripWeek = computed(() => weekStart(selectedDate.value))
watch(
  [userId, stripWeek, todayIso],
  ([id, week]) => dailyResultsStore.fetchWeekScores(id, week),
  { immediate: true },
)
watch(
  [userId, todayIso],
  ([id]) => {
    if (id) dailyResultsStore.initializeDailyResults(id)
  },
  { immediate: true },
)
const dayScores = computed(
  () =>
    dailyResultsStore.weekScores[`${userId.value}-${stripWeek.value}`] || {},
)

const hasPickMarkets = computed(
  () => games.value.length > 0 || allStarMarkets.value.length > 0,
)

const headline = computed(() => {
  const date = new Date(`${selectedDate.value}T00:00:00Z`)
  const fmt = options =>
    date.toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })
  return {
    weekday: fmt({ weekday: 'long' }),
    month: fmt({ month: 'short' }),
    day: date.getUTCDate(),
    year: date.getUTCFullYear(),
  }
})

const slateLabel = computed(() => {
  if (loading.value) return 'Loading games…'
  const count = games.value.length
  if (!count) return 'No games scheduled'
  return `${count} game${count === 1 ? '' : 's'}`
})

const handleDateChange = newDate => {
  gamesStore.setSelectedDate(newDate)
}

function createAssetUrl(assetPath) {
  return new URL(`../assets/${assetPath}`, import.meta.url).href
}
</script>

<template>
  <div>
    <!-- Date hero -->
    <section
      class="grid items-end gap-6 border-b-[1.5px] border-edge pb-6 lg:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div class="reveal">
        <p class="kicker flex items-center gap-3 text-xl sm:text-2xl">
          {{ headline.weekday }}
          <span
            v-if="selectedDate === todayIso"
            class="bg-accent-fill px-2 py-0.5 font-sans text-[0.6875rem] font-extrabold uppercase not-italic tracking-[0.18em] text-white"
            >Today</span
          >
        </p>
        <h1 class="display text-[clamp(4.5rem,15vw,10.5rem)]">
          <Transition name="flip" mode="out-in">
            <span :key="selectedDate" class="inline-block">
              {{ headline.month }}
              <span>{{ headline.day }}</span>
              <span
                class="outline-text ml-1 hidden align-top text-[0.45em] sm:inline"
                >{{ headline.year }}</span
              >
            </span>
          </Transition>
        </h1>
        <p class="label mt-4 flex items-center gap-2">
          <span class="inline-block h-2 w-2 bg-ink" />
          {{ slateLabel }}
        </p>
        <LastNightStub v-if="session && selectedDate === todayIso" />
      </div>

      <DayStrip
        class="reveal"
        style="--i: 2"
        :model-value="selectedDate"
        :today="todayIso"
        :scores="dayScores"
        @update:model-value="handleDateChange"
      />
    </section>

    <div
      class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr]"
    >
      <!-- Rail: personal (above the feed on mobile) -->
      <aside class="space-y-6 empty:hidden lg:col-start-2 lg:row-start-1">
        <section
          v-if="session && hasPickMarkets && isTodayOrFuture"
          class="sheet reveal p-5"
          style="--i: 1"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="display text-3xl">Confidence</h2>
              <p class="label mt-1.5 !tracking-[0.14em]">
                {{ usedConfidenceToday }} used · {{ remainingConfidence }} left
              </p>
            </div>
            <p class="display num text-5xl">
              {{ remainingConfidence
              }}<span class="text-2xl text-muted"
                >/{{ maxConfidencePerDay }}</span
              >
            </p>
          </div>
          <div
            class="mt-4 flex flex-wrap gap-1.5"
            :aria-label="`${usedConfidenceToday} of ${maxConfidencePerDay} confidence used`"
          >
            <span
              v-for="n in maxConfidencePerDay"
              :key="n"
              class="token"
              :class="{ 'is-spent': n <= usedConfidenceToday }"
            />
          </div>
          <p
            v-if="isAllStarWeekend"
            class="mt-4 inline-block bg-gold px-2 py-0.5 text-[0.6875rem] font-extrabold uppercase tracking-[0.16em] text-black"
          >
            +1 All-Star bonus
          </p>
        </section>
        <NewBadgePanel v-if="session" />
        <PeriodChampions />
      </aside>

      <!-- Feed -->
      <div
        class="min-w-0 space-y-8 lg:col-start-1 lg:row-span-2 lg:row-start-1"
      >
        <AllStarBoard />

        <div v-if="loading" class="space-y-8" aria-busy="true">
          <div v-for="n in 3" :key="n" class="skeleton" :style="{ '--i': n }" />
        </div>

        <template v-else>
          <p
            v-if="allStarMarkets.length && games.length"
            class="section-rule label"
          >
            Games
          </p>

          <GameTicket
            v-for="(game, index) in games"
            :key="game.game_id ?? index"
            :game="game"
            :index="index"
          />

          <div
            v-if="!games.length && !allStarMarkets.length"
            class="flex flex-col items-center border-[1.5px] border-dashed border-ink/30 px-6 py-20 text-center"
          >
            <div
              v-if="selectedDate === '2024-11-05'"
              class="mb-8 flex flex-col items-center"
            >
              <p class="display text-4xl text-court">Election</p>
              <p class="display text-4xl text-loss">Day</p>
              <img
                :src="createAssetUrl('donut_election.avif')"
                alt="election"
                class="mt-4 max-w-xs"
              />
            </div>
            <p
              class="display text-[clamp(3rem,10vw,6rem)] text-ink/15"
              aria-hidden="true"
            >
              No games
            </p>
            <p class="kicker mt-3 text-lg">No games scheduled for this date.</p>
            <button
              v-if="selectedDate !== todayIso"
              type="button"
              class="btn-ink mt-6"
              @click="handleDateChange(todayIso)"
            >
              Go to today
            </button>
          </div>
        </template>
      </div>

      <!-- Rail: league context (below the feed on mobile) -->
      <aside class="space-y-6 self-start lg:col-start-2 lg:row-start-2">
        <section v-if="!session" class="sheet reveal p-5" style="--i: 1">
          <h2 class="display text-3xl">How it works</h2>
          <ol class="mt-4 space-y-2 text-sm">
            <li class="flex gap-3">
              <span class="display text-xl text-muted">01</span> Pick a winner
              for each game before tip-off.
            </li>
            <li class="flex gap-3">
              <span class="display text-xl text-muted">02</span> Set your
              confidence from 1 to 3 per pick.
            </li>
            <li class="flex gap-3">
              <span class="display text-xl text-muted">03</span> Correct picks
              score their confidence in points.
            </li>
            <li class="flex gap-3">
              <span class="display text-xl text-muted">04</span> Call an upset:
              a correct pick on a team given under 30% to win scores +1.
            </li>
          </ol>
          <p class="label mt-5">Sign in with Google to start picking</p>
        </section>
        <GameSpotlight />
        <TopPerformers />
        <InjuryWire />
        <StandingsSnapshot />
        <LeagueLeaders />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.token {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 1.5px solid rgb(var(--c-ink) / 0.3);
  transition: background-color 0.3s ease;
}
.token.is-spent {
  background: rgb(var(--c-accent-fill));
  border-color: rgb(var(--c-accent-fill));
  border-style: dashed;
  box-shadow:
    inset 0 0 0 2.5px rgb(var(--c-card)),
    0 2px 0 rgb(var(--c-ink) / 0.7);
}

.skeleton {
  height: 190px;
  border: 1.5px solid rgb(var(--c-ink) / 0.15);
  background: linear-gradient(
      100deg,
      transparent 30%,
      rgb(var(--c-ink) / 0.06) 50%,
      transparent 70%
    )
    0 0 / 200% 100%;
  animation: shimmer 1.3s linear infinite;
  animation-delay: calc(var(--i) * 120ms);
}
@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}

/* Headline date change */
.flip-enter-active,
.flip-leave-active {
  transition:
    transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 0.28s ease;
}
.flip-enter-from {
  transform: translateY(35%);
  opacity: 0;
}
.flip-leave-to {
  transform: translateY(-35%);
  opacity: 0;
}
</style>

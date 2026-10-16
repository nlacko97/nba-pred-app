<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useLeaderboardStatsStore } from '../stores/leaderboardStats'
import { useGlobalStore } from '../stores/global'
import { useScoutingStore } from '../stores/scouting'
import {
  periodLabel,
  periodRange,
  seasonLabel as formatSeason,
} from '../lib/season'
import BadgeShelf from '../components/BadgeShelf.vue'
import HitRateCard from '../components/HitRateCard.vue'
import TeamLedger from '../components/TeamLedger.vue'
import PickerCard from '../components/PickerCard.vue'
import SeasonReceipt from '../components/SeasonReceipt.vue'
import { useBadgesStore } from '../stores/badges'

const props = defineProps({
  id: String,
})

const router = useRouter()
const leaderboardStore = useLeaderboardStatsStore()
const globalStore = useGlobalStore()
const scoutingStore = useScoutingStore()
const badgesStore = useBadgesStore()

// The standings scope: the regular season, the postseason, or one week or
// month (both phases). The card, receipt and ledgers all follow it.
const isPeriod = computed(() => leaderboardStore.mode !== 'season')
const range = computed(() =>
  isPeriod.value && leaderboardStore.periodStart
    ? periodRange(leaderboardStore.mode, leaderboardStore.periodStart)
    : null,
)
const postseason = computed(() =>
  isPeriod.value ? null : leaderboardStore.isPostseason,
)

// Opening night numbers the weeks
const openingNight = ref(null)
watch(
  () => leaderboardStore.selectedSeason,
  async season => {
    const bounds = await leaderboardStore.fetchSeasonBounds(season)
    openingNight.value = bounds?.openingNight || null
  },
  { immediate: true },
)

// 'Regular season', 'Week 3 · Oct 20–26' or 'October 2026'
const scopeLabel = computed(() => {
  if (!range.value) {
    return leaderboardStore.isPostseason ? 'Postseason' : 'Regular season'
  }
  return periodLabel(
    leaderboardStore.mode,
    range.value.start,
    openingNight.value,
  )
})
// Short enough for the trading card's header
const cardLabel = computed(() => {
  if (!range.value) return null
  return scopeLabel.value.split(' · ')[0]
})
// A week or month has far fewer picks to set the league norm with
const minPicks = computed(
  () => ({ week: 4, month: 15 })[leaderboardStore.mode] ?? 50,
)

const scopeKey = computed(() => [
  leaderboardStore.selectedSeason,
  postseason.value,
  range.value,
])

// Every player's traits, so the trading card can compare with the league
const league = ref([])
watch(
  scopeKey,
  async ([season, phase, dates]) => {
    league.value = await scoutingStore.fetchLeagueTraits(season, phase, dates)
  },
  { immediate: true },
)

// Loaded by the badge shelf; the receipt reads streak and badge totals.
// Badges are season-long, so a week or month leaves them off and takes the
// streak from that period's picks.
const badgeData = computed(
  () =>
    badgesStore.userBadges[`${props.id}-${leaderboardStore.selectedSeason}`],
)
const bestStreak = computed(() =>
  isPeriod.value
    ? league.value.find(row => row.user_id === props.id)?.heat || 0
    : badgeData.value?.progress?.['hot-hand']?.best || 0,
)
const badgeCount = computed(() =>
  isPeriod.value
    ? null
    : Object.values(badgeData.value?.counts || {}).reduce((a, b) => a + b, 0),
)

const isMe = computed(() => globalStore.userId === props.id)

// How this player picks, for the same scope as the stat line
const report = ref(null)
watch(
  () => [props.id, ...scopeKey.value],
  async ([id, season, phase, dates]) => {
    report.value = null
    report.value = await scoutingStore.fetchReport(id, season, phase, dates)
  },
  { immediate: true },
)

const loading = ref(true)

const seasonIndex = computed(() =>
  leaderboardStore.sortedStats.findIndex(u => u.user_id === props.id),
)
const periodRow = computed(() =>
  leaderboardStore.periodStats.find(u => u.user_id === props.id),
)

// In a week or month the stat line is that period's; a player with no graded
// picks in it keeps their name and photo with an empty line
const user = computed(() => {
  if (isPeriod.value && periodRow.value) return periodRow.value
  const row = leaderboardStore.sortedStats[seasonIndex.value]
  if (!row) return null
  if (!isPeriod.value) return row
  return {
    ...row,
    total_picks: 0,
    correct_picks: 0,
    total_score: 0,
    accuracy: 0,
  }
})
const rank = computed(() => {
  if (isPeriod.value) return periodRow.value?.rank ?? null
  if (seasonIndex.value === -1) return null
  return user.value?.rank ?? seasonIndex.value + 1
})

const navigateBack = () => {
  router.push({ name: 'leaderboard' })
}

onMounted(async () => {
  loading.value = true
  try {
    if (!user.value) await leaderboardStore.fetchStats()
  } catch (error) {
    console.error('Error loading user details:', error)
  } finally {
    loading.value = false
  }
})

const displayName = computed(
  () => user.value?.full_name || user.value?.username || 'Unknown',
)

const seasonLabel = computed(() =>
  formatSeason(leaderboardStore.selectedSeason),
)
</script>

<template>
  <div>
    <button
      type="button"
      class="label mb-6 inline-flex items-center gap-2 !text-ink transition-colors hover:!text-accent"
      @click="navigateBack"
    >
      <svg
        class="h-4 w-4"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="square" d="M15 19l-7-7 7-7" />
      </svg>
      Back to standings
    </button>

    <div
      v-if="loading"
      class="flex flex-col items-center justify-center gap-4 py-24"
    >
      <span class="spinner" />
      <p class="kicker text-lg">Loading player…</p>
    </div>

    <div v-else-if="!user" class="py-24 text-center">
      <p class="display text-[clamp(3rem,10vw,6rem)] text-ink/15">Not found</p>
      <p class="kicker mt-3 text-lg">
        This player isn't in the current standings.
      </p>
      <button type="button" class="btn-ink mt-8" @click="navigateBack">
        Return to standings
      </button>
    </div>

    <div v-else>
      <!-- Player card hero -->
      <section
        class="relative overflow-hidden border-b-[1.5px] border-edge pb-8"
      >
        <span v-if="rank" class="rank-ghost" aria-hidden="true">{{
          String(rank).padStart(2, '0')
        }}</span>
        <div class="relative flex flex-col gap-6 sm:flex-row sm:items-end">
          <div class="reveal relative w-fit">
            <span
              class="avatar h-32 w-32 rotate-[-3deg] border-[1.5px] border-edge text-6xl shadow-[6px_6px_0_rgb(var(--c-shadow))] sm:h-40 sm:w-40"
            >
              <img
                v-if="user.avatar_url"
                :src="user.avatar_url"
                :alt="`${user.username}'s avatar`"
                referrerpolicy="no-referrer"
              />
              <template v-else>{{ displayName.charAt(0) }}</template>
            </span>
            <span v-if="rank" class="rank-badge">#{{ rank }}</span>
          </div>
          <div class="reveal min-w-0" style="--i: 1">
            <p class="kicker text-xl">{{ seasonLabel }} · {{ scopeLabel }}</p>
            <h1 class="display break-words text-[clamp(3rem,9vw,7rem)]">
              {{ displayName }}
            </h1>
          </div>
        </div>
      </section>

      <!-- Three across: the trading card, hit rate, and the season receipt -->
      <div
        class="mt-12 grid items-start justify-items-center gap-10 md:grid-cols-2 xl:grid-cols-[20rem_minmax(0,1fr)_23rem] xl:gap-8"
      >
        <PickerCard
          class="w-full max-w-[20rem]"
          style="--i: 6"
          :user="user"
          :rank="rank"
          :season="leaderboardStore.selectedSeason"
          :period="cardLabel"
          :min-picks="minPicks"
          :league="league"
        />
        <HitRateCard
          class="w-full self-stretch md:order-3 md:col-span-2 xl:order-none xl:col-span-1"
          style="--i: 7"
          :report="report"
          :is-me="isMe"
        />
        <SeasonReceipt
          style="--i: 8"
          :user="user"
          :rank="rank"
          :season="leaderboardStore.selectedSeason"
          :scope="scopeLabel"
          :report="report"
          :badge-count="badgeCount"
          :best-streak="bestStreak"
        />
      </div>

      <BadgeShelf
        class="mt-10"
        style="--i: 8"
        :user-id="id"
        :season="leaderboardStore.selectedSeason"
      />

      <TeamLedger class="mt-10" style="--i: 9" :report="report" :is-me="isMe" />
    </div>
  </div>
</template>

<style scoped>
.rank-ghost {
  position: absolute;
  right: -0.05em;
  top: -0.12em;
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: clamp(10rem, 32vw, 22rem);
  line-height: 1;
  color: transparent;
  -webkit-text-stroke: 2px rgb(var(--c-ink) / 0.12);
  pointer-events: none;
  user-select: none;
}
.rank-badge {
  position: absolute;
  right: -14px;
  bottom: -10px;
  padding: 0.15rem 0.55rem;
  background: rgb(var(--c-ink));
  color: rgb(var(--c-paper));
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 1.6rem;
  transform: rotate(6deg);
  box-shadow: 3px 3px 0 rgb(var(--c-shadow));
}
</style>

<script setup>
import { onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLeaderboardStatsStore } from '../stores/leaderboardStats'
import { useGlobalStore } from '../stores/global'
import FilterControls from '../components/FilterControls.vue'
import LeaderboardCard from '../components/LeaderboardCard.vue'
import { seasonLabel as formatSeason } from '../lib/season'

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

const aggregatedStats = computed(() => leaderboardStore.aggregatedStats)
const podium = computed(() => sortedStats.value.slice(0, 3))
const field = computed(() => sortedStats.value.slice(3))
const leaderScore = computed(() => sortedStats.value[0]?.total_score || 0)
const seasonLabel = computed(() => formatSeason(selectedSeason.value))

const displayName = user => user.full_name || user.username || 'Unknown'

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
  <div>
    <!-- Headline -->
    <section
      class="flex flex-col gap-6 border-b-[1.5px] border-edge pb-6 lg:flex-row lg:items-end lg:justify-between"
    >
      <div class="reveal">
        <p class="kicker text-xl sm:text-2xl">
          {{ seasonLabel }} ·
          {{ isPostseason ? 'Postseason' : 'Regular season' }}
        </p>
        <h1 class="display text-[clamp(4rem,13vw,9.5rem)]">
          Stand<span class="outline-text">ings</span>
        </h1>
      </div>
      <FilterControls
        v-if="session"
        class="reveal"
        style="--i: 2"
        :selected-season="selectedSeason"
        :is-postseason="isPostseason"
        @update-filters="handleFilterChange"
      />
    </section>

    <template v-if="session">
      <div
        v-if="loading"
        class="flex flex-col items-center justify-center gap-4 py-24"
      >
        <span class="spinner" />
        <p class="kicker text-lg">Loading standings…</p>
      </div>

      <template v-else-if="sortedStats.length > 0">
        <!-- League numbers -->
        <dl class="grid grid-cols-2 border-b border-ink/15 md:grid-cols-4">
          <div
            v-for="(stat, i) in [
              { label: 'Players', value: aggregatedStats.totalPlayers },
              { label: 'Picks graded', value: aggregatedStats.totalPicks },
              {
                label: 'League hit rate',
                value: `${aggregatedStats.avgAccuracy}%`,
              },
              { label: 'Points paid out', value: aggregatedStats.totalScore },
            ]"
            :key="stat.label"
            class="reveal border-ink/15 px-1 py-5 md:px-5 [&:not(:first-child)]:md:border-l"
            :style="{ '--i': i + 1 }"
          >
            <dt class="label">{{ stat.label }}</dt>
            <dd class="display num mt-2 text-4xl sm:text-5xl">
              {{ stat.value }}
            </dd>
          </div>
        </dl>

        <!-- Top three -->
        <section class="mt-10 grid gap-5 md:grid-cols-3">
          <div
            v-for="(user, index) in podium"
            :key="user.user_id"
            class="reveal flex"
            :class="['md:order-2', 'md:order-1', 'md:order-3'][index]"
            :style="{ '--i': index + 2 }"
          >
            <button
              type="button"
              class="podium-card w-full"
              :class="[
                `podium-card--${index + 1}`,
                { 'is-me': user.user_id === userId },
              ]"
              @click="navigateToUser(user.user_id)"
            >
              <span class="podium-card__rank">{{ index + 1 }}</span>
              <span class="relative flex items-center gap-3">
                <span
                  class="avatar h-14 w-14 border-[1.5px] border-current text-2xl"
                >
                  <img
                    v-if="user.avatar_url"
                    :src="user.avatar_url"
                    :alt="`${user.username}'s avatar`"
                    referrerpolicy="no-referrer"
                  />
                  <template v-else>{{ displayName(user).charAt(0) }}</template>
                </span>
                <span class="min-w-0 text-left">
                  <span
                    v-if="user.user_id === userId"
                    class="block text-[0.6875rem] font-extrabold uppercase tracking-[0.18em] opacity-75"
                  >
                    You
                  </span>
                  <span class="display block truncate text-2xl">{{
                    displayName(user)
                  }}</span>
                </span>
              </span>
              <span class="relative mt-8 flex items-end justify-between">
                <span>
                  <span class="display num block text-7xl">{{
                    user.total_score
                  }}</span>
                  <span
                    class="text-[0.6875rem] font-bold uppercase tracking-[0.2em] opacity-70"
                    >points</span
                  >
                </span>
                <span class="text-right text-xs font-semibold">
                  <span class="num block"
                    >{{ user.correct_picks }}–{{
                      user.total_picks - user.correct_picks
                    }}</span
                  >
                  <span class="num block opacity-70"
                    >{{ user.accuracy.toFixed(1) }}% hit</span
                  >
                </span>
              </span>
            </button>
          </div>
        </section>

        <!-- The field -->
        <section v-if="field.length" class="sheet mt-10">
          <div
            class="flex items-center justify-between border-b-[1.5px] border-edge px-4 py-3 md:px-6"
          >
            <span class="label">Rank · Player</span>
            <span class="label">Pts</span>
          </div>
          <LeaderboardCard
            v-for="(user, index) in field"
            :key="user.user_id"
            :user="user"
            :rank="index + 4"
            :leader-score="leaderScore"
            :is-current-user="user.user_id === userId"
            @click="navigateToUser(user.user_id)"
          />
        </section>
      </template>

      <div v-else class="py-24 text-center">
        <p class="display text-[clamp(3rem,10vw,6rem)] text-ink/15">
          No results
        </p>
        <p class="kicker mt-3 text-lg">No results for this season yet.</p>
      </div>
    </template>

    <!-- Login prompt -->
    <div v-else class="py-24 text-center">
      <p class="display text-[clamp(3rem,10vw,6rem)] text-ink/15">Sign in</p>
      <p class="kicker mt-3 text-lg">
        Sign in with Google to view the standings.
      </p>
    </div>
  </div>
</template>

<style scoped>
.podium-card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 1.4rem;
  text-align: left;
  border: 1.5px solid rgb(var(--c-edge));
  background: rgb(var(--c-card));
  box-shadow: 6px 6px 0 rgb(var(--c-shadow));
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}
.podium-card:hover {
  transform: translate(-3px, -3px);
  box-shadow: 9px 9px 0 rgb(var(--c-shadow));
}
.podium-card--1 {
  background: rgb(var(--c-ink));
  color: rgb(var(--c-paper));
}
@media (min-width: 768px) {
  .podium-card--1 {
    transform: translateY(-18px);
  }
  .podium-card--1:hover {
    transform: translate(-3px, -21px);
  }
}
.podium-card.is-me:not(.podium-card--1) {
  box-shadow: 6px 6px 0 rgb(var(--c-accent));
}
.podium-card__rank {
  position: absolute;
  right: -0.08em;
  bottom: -0.22em;
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 13rem;
  line-height: 1;
  color: transparent;
  -webkit-text-stroke: 2px currentColor;
  opacity: 0.18;
  pointer-events: none;
}
</style>

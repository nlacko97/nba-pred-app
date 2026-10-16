<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLeaderboardStatsStore } from '../stores/leaderboardStats'
import { seasonLabel as formatSeason } from '../lib/season'

const props = defineProps({
  id: String,
})

const router = useRouter()
const leaderboardStore = useLeaderboardStatsStore()

const user = ref(null)
const rank = ref(null)
const loading = ref(true)

const navigateBack = () => {
  router.push({ name: 'leaderboard' })
}

onMounted(async () => {
  loading.value = true
  try {
    const stats = leaderboardStore.sortedStats
    const userIndex = stats.findIndex(u => u.user_id === props.id)

    if (userIndex !== -1) {
      user.value = stats[userIndex]
      rank.value = userIndex + 1
    } else {
      await leaderboardStore.fetchStats()
      const updatedStats = leaderboardStore.sortedStats
      const updatedIndex = updatedStats.findIndex(u => u.user_id === props.id)

      if (updatedIndex !== -1) {
        user.value = updatedStats[updatedIndex]
        rank.value = updatedIndex + 1
      }
    }
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

const missed = computed(() =>
  user.value ? user.value.total_picks - user.value.correct_picks : 0,
)

// 10×10 waffle: one square per percentage point of accuracy
const waffleFilled = computed(() =>
  user.value ? Math.round(user.value.accuracy) : 0,
)

const statBlocks = computed(() => {
  if (!user.value) return []
  return [
    {
      label: 'Total score',
      value: user.value.total_score,
    },
    {
      label: 'Correct',
      value: user.value.correct_picks,
      tone: 'text-win',
    },
    {
      label: 'Missed',
      value: missed.value,
      tone: 'text-loss',
    },
    {
      label: 'Avg per win',
      value: (user.value.total_score / (user.value.correct_picks || 1)).toFixed(
        1,
      ),
    },
  ]
})
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
        <span class="rank-ghost" aria-hidden="true">{{
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
            <span class="rank-badge">#{{ rank }}</span>
          </div>
          <div class="reveal min-w-0" style="--i: 1">
            <p class="kicker text-xl">
              {{ seasonLabel }} ·
              {{
                leaderboardStore.isPostseason ? 'Postseason' : 'Regular season'
              }}
            </p>
            <h1 class="display break-words text-[clamp(3rem,9vw,7rem)]">
              {{ displayName }}
            </h1>
          </div>
        </div>
      </section>

      <!-- Stat line -->
      <dl class="grid grid-cols-2 border-b border-ink/15 md:grid-cols-4">
        <div
          v-for="(stat, i) in statBlocks"
          :key="stat.label"
          class="reveal border-ink/15 px-1 py-6 md:px-6 [&:not(:first-child)]:md:border-l"
          :style="{ '--i': i + 2 }"
        >
          <dt class="label">{{ stat.label }}</dt>
          <dd class="display num mt-2 text-6xl" :class="stat.tone">
            {{ stat.value }}
          </dd>
        </div>
      </dl>

      <!-- Accuracy -->
      <section
        class="sheet reveal mt-10 grid gap-8 p-6 sm:p-8 md:grid-cols-[auto_minmax(0,1fr)] md:items-center"
        style="--i: 6"
      >
        <div
          class="waffle"
          :aria-label="`${user.accuracy.toFixed(1)}% accuracy`"
          role="img"
        >
          <span
            v-for="n in 100"
            :key="n"
            class="waffle__cell"
            :class="{ 'is-on': n <= waffleFilled }"
            :style="{ '--d': `${n * 8}ms` }"
          />
        </div>
        <div>
          <p class="label">Hit rate</p>
          <p class="display num mt-2 text-[clamp(4.5rem,12vw,8rem)]">
            {{ user.accuracy.toFixed(1) }}<span class="text-muted">%</span>
          </p>

          <div class="mt-6">
            <div class="mb-1.5 flex justify-between">
              <span class="label">{{ user.correct_picks }} correct</span>
              <span class="label">{{ user.total_picks }} total picks</span>
            </div>
            <div class="flex h-3 border-[1.5px] border-edge">
              <span
                class="bg-win transition-[width] duration-700"
                :style="{
                  width: `${(user.correct_picks / (user.total_picks || 1)) * 100}%`,
                }"
              />
              <span class="flex-1 bg-loss/70" />
            </div>
          </div>
        </div>
      </section>
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
.waffle {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 4px;
  width: min(100%, 260px);
}
.waffle__cell {
  aspect-ratio: 1;
  background: rgb(var(--c-ink) / 0.1);
}
.waffle__cell.is-on {
  background: rgb(var(--c-win));
  animation: cell-in 0.4s ease both;
  animation-delay: var(--d);
}
@keyframes cell-in {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}
</style>

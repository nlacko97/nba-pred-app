<script setup>
import { onMounted, onUnmounted, computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDailyResultsStore } from '../stores/dailyResults'
import { useGlobalStore } from '../stores/global'

const dailyResultsStore = useDailyResultsStore()
const globalStore = useGlobalStore()
const { userId } = storeToRefs(globalStore)
const { allPlayerResults, userResults, loading, formattedDate } =
  storeToRefs(dailyResultsStore)

const isCollapsed = ref(false)
let stalenessCheckInterval = null

const checkAndRefreshIfStale = () => {
  if (dailyResultsStore.isCacheStale() && userId.value) {
    dailyResultsStore.refreshDailyResults(userId.value)
  }
}

const handleVisibilityChange = () => {
  // When user returns to the tab/window, immediately check for stale data
  if (!document.hidden) {
    checkAndRefreshIfStale()
  }
}

onMounted(() => {
  if (userId.value) {
    // Check if cache is stale and refresh if needed
    if (dailyResultsStore.isCacheStale()) {
      dailyResultsStore.refreshDailyResults(userId.value)
    } else {
      dailyResultsStore.initializeDailyResults(userId.value)
    }
  }

  // Listen for page visibility changes (tab switching, laptop wake, etc.)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // Also listen for focus event (when window regains focus)
  window.addEventListener('focus', checkAndRefreshIfStale)

  // Background check every 5 minutes as fallback
  // (in case user keeps page visible but inactive)
  stalenessCheckInterval = setInterval(() => {
    checkAndRefreshIfStale()
  }, 300000) // Check every 5 minutes
})

onUnmounted(() => {
  if (stalenessCheckInterval) {
    clearInterval(stalenessCheckInterval)
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('focus', checkAndRefreshIfStale)
})

const topThree = computed(() => {
  return allPlayerResults.value.slice(0, 3)
})

const userInTopThree = computed(() => {
  if (!userResults.value) return false
  return topThree.value.some(p => p.user_id === userResults.value.user_id)
})

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

// Podium order: silver, gold, bronze
const podium = computed(() => {
  const [first, second, third] = topThree.value
  return [
    second && { player: second, place: 2 },
    first && { player: first, place: 1 },
    third && { player: third, place: 3 },
  ].filter(Boolean)
})

const initial = player =>
  (player.username || player.user_full_name || '?').charAt(0).toUpperCase()
</script>

<template>
  <section v-if="!loading && topThree.length > 0" class="sheet reveal">
    <button
      type="button"
      class="flex w-full items-start justify-between gap-3 p-5 text-left"
      :aria-expanded="!isCollapsed"
      @click="toggleCollapse"
    >
      <span>
        <span class="display block text-3xl">Top performers</span>
        <span class="label mt-2 block !tracking-[0.14em]">{{
          formattedDate
        }}</span>
      </span>
      <svg
        class="mt-1 h-5 w-5 shrink-0 transition-transform duration-300"
        :class="{ 'rotate-180': !isCollapsed }"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="square" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div v-show="!isCollapsed" class="px-5 pb-5">
      <!-- Podium -->
      <div class="grid grid-cols-3 items-end gap-2">
        <div
          v-for="step in podium"
          :key="step.player.user_id"
          class="flex min-w-0 flex-col items-center text-center"
        >
          <span
            class="avatar mb-2 h-11 w-11 border-[1.5px] border-edge"
            :class="{
              '!h-14 !w-14': step.place === 1,
              'outline outline-2 outline-offset-2 outline-accent':
                step.player.user_id === userId,
            }"
          >
            <img
              v-if="step.player.avatar_url"
              :src="step.player.avatar_url"
              :alt="step.player.username"
              referrerpolicy="no-referrer"
            />
            <template v-else>{{ initial(step.player) }}</template>
          </span>
          <p class="w-full truncate text-xs font-bold">
            {{ step.player.user_full_name }}
          </p>
          <p class="num text-[0.6875rem] text-muted">
            {{ step.player.correct_picks }}/{{ step.player.total_picks }} ·
            {{ Math.round(step.player.accuracy) }}%
          </p>
          <div class="step mt-2" :class="`step--${step.place}`">
            <span class="step__place">{{ step.place }}</span>
            <span class="step__pts num"
              >{{ step.player.points }}<small>pts</small></span
            >
          </div>
        </div>
      </div>

      <!-- User comparison (if not in top 3) -->
      <div
        v-if="userResults && !userInTopThree"
        class="mt-4 flex items-center gap-3 border-[1.5px] border-dashed border-accent p-3"
      >
        <span class="display num w-10 text-3xl text-accent">{{
          dailyResultsStore.userRank
        }}</span>
        <span class="avatar h-9 w-9">
          <img
            v-if="userResults.avatar_url"
            :src="userResults.avatar_url"
            alt=""
            referrerpolicy="no-referrer"
          />
          <template v-else>{{ initial(userResults) }}</template>
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold leading-none">You</p>
          <p class="num mt-1 text-xs text-muted">
            {{ userResults.correct_picks }}/{{ userResults.total_picks }} ·
            {{ Math.round(userResults.accuracy) }}%
          </p>
        </div>
        <span class="display num text-2xl"
          >{{ userResults.points || 0
          }}<small class="ml-0.5 text-xs font-bold normal-case text-muted"
            >pts</small
          ></span
        >
      </div>
    </div>
  </section>
</template>

<style scoped>
.step {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0 0.5rem;
  border: 1.5px solid rgb(var(--c-edge));
  background: repeating-linear-gradient(
      -45deg,
      rgb(var(--c-ink) / 0.07) 0 2px,
      transparent 2px 6px
    ),
    rgb(var(--c-paper));
  transform-origin: bottom;
  animation: rise 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.step--1 {
  height: 112px;
  background: rgb(var(--c-ink));
  color: rgb(var(--c-paper));
  animation-delay: 0.25s;
}
.step--2 {
  height: 84px;
  animation-delay: 0.1s;
}
.step--3 {
  height: 64px;
  animation-delay: 0.4s;
}
.step__place {
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 2rem;
  line-height: 1;
}
.step--1 .step__place {
  font-size: 2.8rem;
}
.step__pts {
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 800;
  font-size: 1rem;
  line-height: 1;
}
.step__pts small {
  margin-left: 2px;
  font-size: 0.65rem;
  opacity: 0.75;
}
@keyframes rise {
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
}
</style>

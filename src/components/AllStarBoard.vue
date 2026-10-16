<script setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useGamesStore } from '../stores/games'
import { useGlobalStore } from '../stores/global'
import ConfidenceSelector from './ConfidenceSelector.vue'

const gamesStore = useGamesStore()
const globalStore = useGlobalStore()
const { allStarMarkets } = storeToRefs(gamesStore)
const { session, userId } = storeToRefs(globalStore)

const allStarSearch = ref({})

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function getStatus(market) {
  if (market.status === 'resolved') return 'Resolved'
  if (gamesStore.isAllStarMarketLocked(market)) return 'Locked'
  if (gamesStore.isValidDate(market.lock_at)) {
    return `Locks ${formatTime(new Date(market.lock_at))}`
  }
  return 'Open'
}

function getStatusTone(market) {
  if (market.status === 'resolved') return 'is-resolved'
  if (gamesStore.isAllStarMarketLocked(market)) return 'is-locked'
  return 'is-open'
}

function formatMarketLockAt(market) {
  if (!gamesStore.isValidDate(market.lock_at)) return 'No lock time'
  return new Date(market.lock_at).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function marketTypeLabel(market) {
  if (market.category === 'asg_winner') return 'ASG Winner'
  if (market.category === 'asg_mvp') return 'ASG MVP'
  return 'Contest Winner'
}

function getOptions(market) {
  const searchTerm = (allStarSearch.value[market.id] || '').trim().toLowerCase()
  if (!searchTerm) return market.options
  return market.options.filter(option =>
    `${option.label} ${option.subtitle || ''}`
      .toLowerCase()
      .includes(searchTerm),
  )
}

function isLocked(market) {
  return !session.value || gamesStore.isAllStarMarketLocked(market)
}

function getOptionState(market, option) {
  const pick = market.picks[userId.value]
  const states = [isLocked(market) ? 'is-locked' : 'is-open']

  if (pick && pick.option_id === option.id) {
    if (pick.correct === true) states.push('is-won')
    else if (pick.correct === false) states.push('is-lost')
    else states.push('is-picked')
  } else if (market.winning_option_id === option.id) {
    states.push('is-winner')
  }

  return states
}

async function submitAllStarPick(market, optionId) {
  delete removedPicks.value[market.id]
  const userPick = market.picks[userId.value]
  if (userPick && userPick.option_id === optionId) return
  await gamesStore.submitAllStarPick(market, optionId, userId.value)
}

async function updateAllStarConfidence(market, confidenceScore) {
  const userPick = market.picks[userId.value]
  if (!userPick) return
  await gamesStore.submitAllStarPick(
    market,
    userPick.option_id,
    userId.value,
    confidenceScore,
  )
}

// Removing a pick is undoable, so it happens immediately with an inline Undo
const removedPicks = ref({})

function removeAllStarPick(market) {
  const pick = market.picks[userId.value]
  if (gamesStore.isAllStarMarketLocked(market) || !pick) return
  removedPicks.value[market.id] = {
    optionId: pick.option_id,
    confidence: pick.confidence_score || 1,
  }
  gamesStore.cancelAllStarPick(market, userId.value)
}

async function undoRemove(market) {
  const removed = removedPicks.value[market.id]
  delete removedPicks.value[market.id]
  await gamesStore.submitAllStarPick(
    market,
    removed.optionId,
    userId.value,
    removed.confidence,
  )
}

const showUndo = market =>
  !!session.value &&
  !market.picks[userId.value] &&
  !!removedPicks.value[market.id] &&
  !gamesStore.isAllStarMarketLocked(market)
</script>

<template>
  <section v-if="allStarMarkets.length" class="space-y-6">
    <!-- Marquee banner -->
    <div class="asg-banner reveal">
      <h2 class="display text-5xl sm:text-7xl">All-Star Weekend</h2>
    </div>

    <article
      v-for="(market, idx) in allStarMarkets"
      :key="market.id"
      class="sheet reveal"
      :style="{ '--i': idx + 1 }"
    >
      <header
        class="flex flex-wrap items-start justify-between gap-4 border-b-[1.5px] border-edge p-5 sm:p-6"
      >
        <div class="min-w-0 flex-1">
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <span class="tag">{{ marketTypeLabel(market) }}</span>
            <span class="tag tag--accent"
              >{{ market.multiplier || 1 }}× confidence</span
            >
          </div>
          <h3 class="display text-3xl sm:text-4xl">{{ market.title }}</h3>
          <p v-if="market.subtitle" class="kicker mt-2 text-base">
            {{ market.subtitle }}
          </p>
          <p class="label mt-3 !tracking-[0.14em]">
            {{ formatMarketLockAt(market) }} ·
            {{ market.options?.length || 0 }} options
          </p>
        </div>
        <span class="status" :class="getStatusTone(market)">{{
          getStatus(market)
        }}</span>
      </header>

      <div class="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row">
        <div class="min-w-0 flex-1">
          <input
            v-if="market.category === 'asg_mvp'"
            v-model="allStarSearch[market.id]"
            type="text"
            class="input mb-4 w-full md:max-w-sm"
            placeholder="Search MVP player…"
          />

          <div
            class="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
            :class="
              market.category === 'asg_mvp'
                ? 'scrollbar-thin max-h-[32rem] overflow-y-auto pr-1 lg:grid-cols-3'
                : ''
            "
          >
            <button
              v-for="option in getOptions(market)"
              :key="option.id"
              type="button"
              class="option"
              :class="getOptionState(market, option)"
              :disabled="isLocked(market)"
              @click="submitAllStarPick(market, option.id)"
            >
              <span class="min-w-0 flex-1 text-left">
                <span
                  class="block truncate font-display text-xl font-extrabold uppercase leading-none"
                >
                  {{ option.label }}
                </span>
                <span
                  v-if="option.subtitle"
                  class="mt-1 block truncate text-xs opacity-70"
                >
                  {{ option.subtitle }}
                </span>
                <span
                  v-if="market.status === 'resolved'"
                  class="mt-1 block text-[0.6875rem] font-semibold uppercase tracking-wider opacity-70"
                >
                  {{ option.picks?.length || 0 }} picks
                </span>
              </span>
              <span
                v-if="market.picks[userId]?.option_id === option.id"
                class="option__check"
                aria-label="Your pick"
                >✓</span
              >
              <span
                v-else-if="market.winning_option_id === option.id"
                class="option__check"
                aria-label="Winner"
                >★</span
              >
            </button>
          </div>
        </div>

        <aside
          v-if="session && market.picks[userId]"
          class="flex shrink-0 flex-col gap-4 border-t border-dashed border-ink/25 pt-5 lg:w-72 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
        >
          <ConfidenceSelector
            :model-value="market.picks[userId].confidence_score || 1"
            :disabled="gamesStore.isAllStarMarketLocked(market)"
            @update:model-value="updateAllStarConfidence(market, $event)"
          />
          <button
            type="button"
            class="btn-line"
            :disabled="gamesStore.isAllStarMarketLocked(market)"
            @click="removeAllStarPick(market)"
          >
            Remove pick
          </button>
        </aside>
        <aside
          v-else-if="showUndo(market)"
          class="flex shrink-0 items-center justify-between gap-3 border-t border-dashed border-ink/25 pt-5 lg:w-72 lg:flex-col lg:items-stretch lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
          role="status"
        >
          <span class="text-sm font-semibold">Pick removed</span>
          <button type="button" class="btn-ink" @click="undoRemove(market)">
            Undo
          </button>
        </aside>
      </div>
    </article>
  </section>
</template>

<style scoped>
.asg-banner {
  position: relative;
  overflow: hidden;
  padding: 2rem 1.5rem;
  text-align: center;
  color: #fff;
  border: 1.5px solid rgb(var(--c-edge));
  box-shadow: 6px 6px 0 rgb(var(--c-shadow));
  background:
    radial-gradient(
        circle at 15% 20%,
        rgb(255 255 255 / 0.22) 0 1.5px,
        transparent 2px
      )
      0 0 / 22px 22px,
    linear-gradient(115deg, #c8102e 0%, #c8102e 48%, #1d428a 52%, #1d428a 100%);
}

.tag {
  display: inline-flex;
  padding: 0.2rem 0.55rem;
  border: 1.5px solid rgb(var(--c-ink) / 0.8);
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.tag--accent {
  border-color: rgb(var(--c-ink));
  background: rgb(var(--c-ink));
  color: rgb(var(--c-paper));
}

.status {
  flex-shrink: 0;
  padding: 0.3rem 0.7rem;
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 2px solid currentColor;
  transform: rotate(3deg);
}
.status.is-open {
  color: rgb(var(--c-win));
}
.status.is-locked {
  color: rgb(var(--c-muted));
}
.status.is-resolved {
  color: rgb(var(--c-court));
}

.option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border: 1.5px solid rgb(var(--c-ink) / 0.2);
  background: rgb(var(--c-paper) / 0.6);
  transition:
    transform 0.2s ease,
    background-color 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.2s ease;
}
.option.is-open:hover {
  border-color: rgb(var(--c-ink));
  transform: translate(-2px, -2px);
  box-shadow: 3px 3px 0 rgb(var(--c-ink));
}
.option.is-locked:not(.is-picked):not(.is-won):not(.is-lost):not(.is-winner) {
  opacity: 0.75;
}
.option.is-picked,
.option.is-won,
.option.is-lost {
  color: #fff;
  border-color: transparent;
}
.option.is-picked {
  background: rgb(var(--c-accent-fill));
}
.option.is-won {
  background: rgb(var(--c-win-fill));
}
.option.is-lost {
  background: rgb(var(--c-loss-fill));
}
.option.is-winner {
  border-color: rgb(var(--c-gold));
  background: rgb(var(--c-gold) / 0.16);
}
.option__check {
  display: flex;
  width: 1.6rem;
  height: 1.6rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 2px solid currentColor;
  font-weight: 900;
  font-size: 0.8rem;
}
</style>

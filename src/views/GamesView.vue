<script setup>
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useGamesStore } from '../stores/games'
import { useGlobalStore } from '../stores/global'
import ConfidenceSelector from '../components/ConfidenceSelector.vue'

import TopPerformers from '../components/TopPerformers.vue'

const gamesStore = useGamesStore()
const globalStore = useGlobalStore()

// Reactive computed properties from stores
const {
  games,
  allStarMarkets,
  selectedDate,
  selectedDateMobile,
  loading,
  maxConfidencePerDay,
  usedConfidenceToday,
  isAllStarWeekend,
} = storeToRefs(gamesStore)
const { session, userId } = storeToRefs(globalStore)

const expandedInjuries = ref({})
const allStarSearch = ref({})

// Check if selected date is today or future
const isTodayOrFuture = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const selected = new Date(selectedDate.value)
  selected.setHours(0, 0, 0, 0)
  return selected >= today
})

const hasPickMarkets = computed(
  () => games.value.length > 0 || allStarMarkets.value.length > 0,
)

// Handle date changes
const handleDateChange = newDate => {
  gamesStore.selectedDate = newDate
  gamesStore.selectedDateMobile = newDate
}

const handleMobileDateChange = newDate => {
  gamesStore.selectedDateMobile = newDate
  gamesStore.selectedDate = newDate
}

onMounted(async () => {
  await gamesStore.initializeGames()
})

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
  if (gamesStore.isValidDate(game.game_status)) {
    return formatISOTo24HourTime(new Date(game.game_status))
  }
  return game.game_status
}

function isCupGame(game) {
  return (
    !!game.stage &&
    typeof game.stage === 'string' &&
    game.stage.toUpperCase().includes('NBA CUP')
  )
}

function cupStageDetail(stage) {
  if (!stage || typeof stage !== 'string') return ''
  const cleaned = stage.replace(/nba\s*cup/gi, '').trim()
  return cleaned
}

async function submitPick(game, picked_team_id) {
  const userPick = game.picks[userId.value]
  if (userPick && userPick.picked_team === picked_team_id) {
    return
  }
  await gamesStore.submitPick(game, picked_team_id, userId.value)
}

async function updateConfidence(game, confidence_score) {
  const userPick = game.picks[userId.value]
  if (userPick) {
    await gamesStore.submitPick(
      game,
      userPick.picked_team,
      userId.value,
      confidence_score,
    )
  }
}

function toggleInjuries(gameIndex) {
  expandedInjuries.value[gameIndex] = !expandedInjuries.value[gameIndex]
}

function hasInjuries(game) {
  return (
    game.away_team.injuries?.length > 0 || game.home_team.injuries?.length > 0
  )
}

const getClass = (game, teamId) => {
  const pick = game.picks[userId.value]
  const isGameActive =
    session.value &&
    (gamesStore.isValidDate(game.game_status) || gamesStore.allowPastVotes)
  const hoverClasses = isGameActive
    ? `hover:cursor-pointer dark:hover:bg-blue-900/40 hover:border-blue-300 dark:hover:border-blue-700 `
    : ''

  let classes = hoverClasses

  if (!pick) {
    return classes
  }

  if (pick.correct && pick.picked_team === teamId) {
    classes = classes.concat(
      'bg-green-50 border-2 border-green-300 dark:bg-green-900 dark:border-green-700 dark:text-gray-100',
    )
  } else if (pick.correct === false && pick.picked_team === teamId) {
    classes = classes.concat(
      'bg-red-50 border-2 border-red-300 dark:bg-red-900 dark:border-red-700 dark:text-gray-100',
    )
  } else if (pick.picked_team === teamId) {
    classes = classes.concat(
      'bg-blue-50 border-2 border-blue-400 dark:bg-blue-900 dark:border-blue-600 dark:text-gray-100',
    )
  } else {
    classes = classes.concat(
      'bg-gray-50 border-2 border-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100',
    )
  }

  return classes
}

function getAllStarStatus(market) {
  if (market.status === 'resolved') {
    return 'Resolved'
  }
  if (gamesStore.isAllStarMarketLocked(market)) {
    return 'Locked'
  }
  if (gamesStore.isValidDate(market.lock_at)) {
    return `Locks ${formatISOTo24HourTime(new Date(market.lock_at))}`
  }
  return 'Open'
}

function getAllStarStatusClass(market) {
  if (market.status === 'resolved')
    return 'allstar-status allstar-status-resolved'
  if (gamesStore.isAllStarMarketLocked(market))
    return 'allstar-status allstar-status-locked'
  return 'allstar-status allstar-status-open'
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

function marketPointsHint(market) {
  const multiplier = market.multiplier || 1
  return `${multiplier}x confidence`
}

function getAllStarOptions(market) {
  const searchTerm = (allStarSearch.value[market.id] || '').trim().toLowerCase()
  if (!searchTerm) return market.options
  return market.options.filter(option =>
    `${option.label} ${option.subtitle || ''}`
      .toLowerCase()
      .includes(searchTerm),
  )
}

function getAllStarOptionClass(market, option) {
  const pick = market.picks[userId.value]
  const isLocked = !session.value || gamesStore.isAllStarMarketLocked(market)

  if (!pick) {
    return isLocked
      ? 'allstar-option opacity-70'
      : 'allstar-option allstar-option-active'
  }

  if (pick.option_id === option.id && pick.correct === true) {
    return isLocked
      ? 'allstar-option allstar-option-correct'
      : 'allstar-option allstar-option-correct allstar-option-active'
  }

  if (pick.option_id === option.id && pick.correct === false) {
    return isLocked
      ? 'allstar-option allstar-option-wrong'
      : 'allstar-option allstar-option-wrong allstar-option-active'
  }

  if (pick.option_id === option.id) {
    return isLocked
      ? 'allstar-option allstar-option-picked'
      : 'allstar-option allstar-option-picked allstar-option-active'
  }

  if (market.winning_option_id === option.id) {
    return isLocked
      ? 'allstar-option allstar-option-winner'
      : 'allstar-option allstar-option-winner allstar-option-active'
  }

  return isLocked
    ? 'allstar-option opacity-70'
    : 'allstar-option allstar-option-active'
}

async function submitAllStarPick(market, optionId) {
  const userPick = market.picks[userId.value]
  if (userPick && userPick.option_id === optionId) {
    return
  }
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

function onCancelAllStarClick(market) {
  if (gamesStore.isAllStarMarketLocked(market)) return
  if (confirm('Cancel your pick for this market?')) {
    gamesStore.cancelAllStarPick(market, userId.value)
  }
}

function onCancelClick(game) {
  if (
    !gamesStore.isValidDate(game.game_status) ||
    new Date(game.game_status) < new Date()
  )
    return
  if (confirm('Cancel your pick for this game?')) {
    gamesStore.cancelPick(game, userId.value)
  }
}
</script>

<template>
  <div class="py-4 space-y-6">
    <!-- Top Performers Section -->
    <TopPerformers />

    <!-- Date Picker Card -->
    <section class="card">
      <div class="card-body">
        <div
          class="flex flex-col md:flex-row justify-between items-center gap-4"
        >
          <h1 class="text-2xl font-bold tracking-tight">Games</h1>

          <!-- Desktop Date Navigation -->
          <div class="hidden md:flex items-center gap-3">
            <button
              class="icon-btn rotate-90"
              @click="gamesStore.goToPreviousDay()"
              aria-label="Previous day"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
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
            </button>
            <div class="text-lg font-semibold tabular-nums">
              {{ selectedDate }}
            </div>
            <button
              class="icon-btn -rotate-90"
              @click="gamesStore.goToNextDay()"
              aria-label="Next day"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
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
            </button>
          </div>

          <!-- Desktop Date Picker -->
          <div class="hidden md:block">
            <input
              type="date"
              :value="selectedDate"
              @input="handleDateChange($event.target.value)"
              class="input"
            />
          </div>

          <!-- Mobile Date Picker -->
          <div class="md:hidden w-full max-w-xs">
            <input
              type="date"
              :value="selectedDateMobile"
              @input="handleMobileDateChange($event.target.value)"
              class="input w-full"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Confidence Display -->
    <section v-if="session && hasPickMarkets && isTodayOrFuture" class="kpi">
      <div class="text-center">
        <div class="flex items-center justify-center gap-2 mb-2">
          <p
            class="text-sm font-medium text-gray-600 dark:text-gray-300 leading-4"
          >
            Daily Confidence Budget ({{ usedConfidenceToday }}/{{
              maxConfidencePerDay
            }})
          </p>
          <span
            v-if="isAllStarWeekend"
            class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-red-500/20 via-amber-500/20 to-blue-500/20 text-slate-700 dark:text-slate-300 border border-blue-200 dark:border-blue-800"
          >
            +1 All-Star Bonus
          </span>
        </div>
        <div
          class="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3 overflow-hidden"
        >
          <div
            class="h-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 dark:from-blue-400 dark:to-indigo-400 transition-all duration-200"
            :style="{
              width: `${maxConfidencePerDay > 0 ? (usedConfidenceToday / maxConfidencePerDay) * 100 : 0}%`,
            }"
          ></div>
        </div>
      </div>
    </section>

    <!-- All-Star Markets -->
    <section v-if="allStarMarkets.length" class="space-y-5">
      <!-- All-Star Weekend Header Badge -->
      <div class="flex items-center justify-center mb-6">
        <div
          class="inline-flex items-center gap-3 px-6 py-3 rounded-2xl shadow-lg"
          style="
            background: linear-gradient(
              135deg,
              rgba(239, 68, 68, 0.08) 0%,
              rgba(245, 158, 11, 0.1) 50%,
              rgba(29, 78, 216, 0.08) 100%
            );
            border: 1.5px solid rgba(226, 232, 240, 0.8);
          "
        >
          <span class="allstar-dot"></span>
          <div class="flex flex-col items-center gap-0.5">
            <span
              class="text-xs font-black uppercase tracking-[0.15em]"
              style="
                background: linear-gradient(
                  90deg,
                  #e11d48 0%,
                  #f59e0b 50%,
                  #1d4ed8 100%
                );
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
              "
              >NBA All-Star Weekend</span
            >
            <span
              class="text-[10px] font-semibold text-slate-600 dark:text-slate-400 tracking-wider"
              >SAN FRANCISCO 2026</span
            >
          </div>
          <span class="allstar-dot"></span>
        </div>
      </div>
      <div
        v-for="market in allStarMarkets"
        :key="market.id"
        class="allstar-card-container"
      >
        <!-- Main Card -->
        <div class="allstar-card-main">
          <!-- Header with diagonal accent -->
          <div class="allstar-header-wrapper">
            <div class="allstar-header-accent"></div>
            <div class="allstar-header-content">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="allstar-type">{{ marketTypeLabel(market) }}</span>
                    <span class="allstar-multiplier">{{ marketPointsHint(market) }}</span>
                  </div>
                  <h3 class="allstar-title">
                    {{ market.title }}
                  </h3>
                  <p v-if="market.subtitle" class="allstar-subtitle">
                    {{ market.subtitle }}
                  </p>
                </div>
                <div :class="getAllStarStatusClass(market)" class="shrink-0 mt-1">
                  {{ getAllStarStatus(market) }}
                </div>
              </div>

              <div class="allstar-meta-row mt-4">
                <span class="allstar-meta-chip">
                  <svg class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ formatMarketLockAt(market) }}
                </span>
                <span class="allstar-meta-chip">
                  <svg class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  {{ market.options?.length || 0 }} options
                </span>
              </div>
            </div>
          </div>

          <!-- Options Grid with integrated confidence selector -->
          <div class="allstar-content-wrapper">
            <div class="allstar-options-section">
              <div v-if="market.category === 'asg_mvp'" class="allstar-search-wrap">
                <input
                  v-model="allStarSearch[market.id]"
                  type="text"
                  class="input allstar-search"
                  placeholder="Search MVP player..."
                />
              </div>

              <div
                :class="[
                  'allstar-options-grid',
                  market.category === 'asg_mvp' ? 'allstar-options-grid-mvp' : '',
                ]"
              >
                <button
                  v-for="option in getAllStarOptions(market)"
                  :key="option.id"
                  type="button"
                  :class="getAllStarOptionClass(market, option)"
                  :disabled="!session || gamesStore.isAllStarMarketLocked(market)"
                  @click="submitAllStarPick(market, option.id)"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="text-left min-w-0 flex-1">
                      <div class="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {{ option.label }}
                      </div>
                      <div
                        v-if="option.subtitle"
                        class="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate"
                      >
                        {{ option.subtitle }}
                      </div>
                    </div>
                    <span
                      v-if="market.picks[userId]?.option_id === option.id"
                      class="allstar-your-pick-badge"
                    >
                      <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                      </svg>
                    </span>
                  </div>
                  <div
                    v-if="market.status === 'resolved'"
                    class="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {{ option.picks?.length || 0 }} picks
                  </div>
                </button>
              </div>
            </div>

            <!-- Integrated Confidence Sidebar -->
            <div
              v-if="session && market.picks[userId]"
              class="allstar-confidence-sidebar"
            >
              <div class="allstar-confidence-inner">
                <div class="allstar-confidence-header">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                  <span class="font-bold text-sm">Your Confidence</span>
                </div>
                
                <div class="allstar-confidence-selector">
                  <ConfidenceSelector
                    :model-value="market.picks[userId].confidence_score || 1"
                    :disabled="gamesStore.isAllStarMarketLocked(market)"
                    @update:model-value="updateAllStarConfidence(market, $event)"
                  />
                </div>

                <button
                  type="button"
                  class="allstar-cancel-btn"
                  :disabled="gamesStore.isAllStarMarketLocked(market)"
                  @click="onCancelAllStarClick(market)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel Pick
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <svg
        class="animate-spin h-10 w-10 text-blue-600"
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
    <div v-else class="space-y-4">
      <div
        v-for="(game, index) in games"
        :key="index"
        :class="['card overflow-hidden', isCupGame(game) ? 'cup-card' : '']"
      >
        <!-- Game Header -->
        <div class="card-header">
          <p class="text-xs font-medium text-gray-500 flex items-center gap-2">
            <span class="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
            {{ game.game_date }}
          </p>
          <p
            class="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide"
          >
            {{ getStatus(game) }}
          </p>
        </div>

        <div v-if="isCupGame(game)" class="cup-header">
          <!-- Trophy icon only -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M7 4a1 1 0 0 0-1 1v2a4 4 0 0 1-3 3.873V12a5 5 0 0 0 5 5h3v2H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2h3a5 5 0 0 0 5-5v-1.127A4 4 0 0 1 18 7V5a1 1 0 0 0-1-1H7zm1 2h8v1a2 2 0 0 0 2 2h1.063A2 2 0 0 1 18 11.873V12a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-.127A2 2 0 0 1 4.937 9H6a2 2 0 0 0 2-2V6z"
            />
          </svg>
          <span class="cup-badge">NBA Cup</span>
          <span v-if="cupStageDetail(game.stage)"
            >• {{ cupStageDetail(game.stage) }}</span
          >
        </div>
        <div
          v-else-if="game.stage"
          class="px-6 py-3 text-center text-sm text-gray-500 dark:text-gray-300 border-b border-gray-200 dark:border-gray-800"
        >
          {{ game.stage }}
        </div>

        <!-- Main Content Grid -->
        <div class="flex flex-col lg:flex-row">
          <!-- Teams Section -->
          <div class="flex-1 flex flex-col md:flex-row items-stretch gap-4 p-6">
            <!-- Away Team -->
            <div
              :class="[
                'panel transition-all duration-300 flex-1 flex flex-col md:flex-row md:items-center p-5 relative',
                getClass(game, game.away_team_id),
                isCupGame(game) ? 'cup-panel' : '',
              ]"
              @click="submitPick(game, game.away_team_id)"
            >
              <span
                v-if="
                  game.picks[userId] &&
                  game.picks[userId].picked_team === game.away_team_id
                "
                class="absolute top-2 left-2 pill pill-blue z-20"
                >Your Pick</span
              >
              <button
                v-if="
                  game.picks[userId] &&
                  game.picks[userId].picked_team === game.away_team_id &&
                  gamesStore.isValidDate(game.game_status)
                "
                class="absolute top-2 right-2 z-20 text-[11px] px-2 py-1 rounded-md border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 bg-white/70 dark:bg-gray-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 backdrop-blur select-none"
                :class="[
                  !gamesStore.isValidDate(game.game_status) ||
                  new Date(game.game_status) < new Date()
                    ? 'opacity-50 cursor-not-allowed'
                    : '',
                ]"
                @click.stop="onCancelClick(game)"
                aria-label="Cancel pick"
              >
                Cancel
              </button>
              <span
                class="panel__watermark"
                :style="{
                  backgroundImage: `url(${getTeamImageUrl(game.away_team_abbreviation)})`,
                }"
              />
              <img
                :src="getTeamImageUrl(game.away_team_abbreviation)"
                alt="away-logo"
                :class="[
                  'w-14 h-14 object-contain mb-3 md:mb-0 md:mr-4',
                  isCupGame(game) ? 'cup-logo' : '',
                ]"
              />
              <div class="flex flex-col flex-1 relative z-10">
                <p class="font-bold text-lg leading-tight">
                  {{ game.away_team_name }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  away team
                </p>
                <div class="flex items-center gap-2 mt-2">
                  <span
                    class="text-xs text-gray-600 dark:text-gray-300 font-medium"
                  >
                    {{ game.away_team.wins }}-{{ game.away_team.losses }}
                  </span>
                  <span class="text-xs flex items-center gap-1">
                    <span
                      v-for="(wl, idx) in game.away_team.record"
                      :key="idx"
                      :class="{
                        'text-red-600 dark:text-red-400': wl === 'L',
                        'text-green-600 dark:text-green-400': wl === 'W',
                      }"
                      >{{ wl }}</span
                    >
                  </span>
                </div>
              </div>
              <div
                class="mt-3 md:mt-0 md:ml-auto md:text-right relative z-10 flex md:flex-col items-center md:items-end"
              >
                <span
                  class="text-xs text-gray-500 dark:text-gray-400 mr-2 md:mr-0"
                  >Score:</span
                >
                <p
                  class="font-black text-2xl md:text-3xl text-blue-600 dark:text-blue-400"
                >
                  {{ game.away_team_score }}
                </p>
              </div>
            </div>

            <!-- Home Team -->
            <div
              :class="[
                'panel transition-all duration-300 flex-1 flex flex-col md:flex-row md:items-center p-5 relative',
                getClass(game, game.home_team_id),
                isCupGame(game) ? 'cup-panel' : '',
              ]"
              @click="submitPick(game, game.home_team_id)"
            >
              <span
                v-if="
                  game.picks[userId] &&
                  game.picks[userId].picked_team === game.home_team_id
                "
                class="absolute top-2 left-2 pill pill-blue z-20"
                >Your Pick</span
              >
              <button
                v-if="
                  game.picks[userId] &&
                  game.picks[userId].picked_team === game.home_team_id &&
                  gamesStore.isValidDate(game.game_status)
                "
                class="absolute top-2 right-2 z-20 text-[11px] px-2 py-1 rounded-md border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 bg-white/70 dark:bg-gray-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 backdrop-blur select-none"
                :class="[
                  !gamesStore.isValidDate(game.game_status) ||
                  new Date(game.game_status) < new Date()
                    ? 'opacity-50 cursor-not-allowed'
                    : '',
                ]"
                :disabled="
                  !gamesStore.isValidDate(game.game_status) ||
                  new Date(game.game_status) < new Date()
                "
                @click.stop="onCancelClick(game)"
                aria-label="Cancel pick"
              >
                Cancel
              </button>
              <span
                class="panel__watermark"
                :style="{
                  backgroundImage: `url(${getTeamImageUrl(game.home_team_abbreviation)})`,
                }"
              />
              <img
                :src="getTeamImageUrl(game.home_team_abbreviation)"
                alt="home-logo"
                :class="[
                  'w-14 h-14 object-contain mb-3 md:mb-0 md:mr-4',
                  isCupGame(game) ? 'cup-logo' : '',
                ]"
              />
              <div class="flex flex-col flex-1 relative z-10">
                <p class="font-bold text-lg leading-tight">
                  {{ game.home_team_name }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  home team
                </p>
                <div class="flex items-center gap-2 mt-2">
                  <span
                    class="text-xs text-gray-600 dark:text-gray-300 font-medium"
                  >
                    {{ game.home_team.wins }}-{{ game.home_team.losses }}
                  </span>
                  <span class="text-xs flex items-center gap-1">
                    <span
                      v-for="(wl, idx) in game.home_team.record"
                      :key="idx"
                      :class="{
                        'text-red-600 dark:text-red-400': wl === 'L',
                        'text-green-600 dark:text-green-400': wl === 'W',
                      }"
                      >{{ wl }}</span
                    >
                  </span>
                </div>
              </div>
              <div
                class="mt-3 md:mt-0 md:ml-auto md:text-right relative z-10 flex md:flex-col items-center md:items-end"
              >
                <span
                  class="text-xs text-gray-500 dark:text-gray-400 mr-2 md:mr-0"
                  >Score:</span
                >
                <p
                  class="font-black text-2xl md:text-3xl text-purple-600 dark:text-purple-400"
                >
                  {{ game.home_team_score }}
                </p>
              </div>
            </div>
          </div>

          <!-- Confidence Selector Sidebar (Desktop) -->
          <div
            v-if="session && game.picks[userId]"
            :class="[
              'hidden lg:flex flex-col justify-center px-6 py-6 border-l border-gray-200 dark:border-gray-800 bg-gradient-to-b from-blue-50/50 to-purple-50/50 dark:from-blue-950/30 dark:to-purple-950/30',
              isCupGame(game) ? 'cup-side' : '',
            ]"
          >
            <ConfidenceSelector
              :model-value="game.picks[userId].confidence_score || 1"
              :disabled="
                !gamesStore.isValidDate(game.game_status) ||
                new Date(game.game_status) < new Date()
              "
              @update:model-value="updateConfidence(game, $event)"
            />
          </div>
        </div>

        <!-- Confidence Selector Mobile -->
        <div
          v-if="session && game.picks[userId]"
          :class="[
            'lg:hidden px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/30 dark:to-purple-950/30',
            isCupGame(game) ? 'cup-side' : '',
          ]"
        >
          <ConfidenceSelector
            :model-value="game.picks[userId].confidence_score || 1"
            :disabled="
              !gamesStore.isValidDate(game.game_status) ||
              new Date(game.game_status) < new Date()
            "
            @update:model-value="updateConfidence(game, $event)"
          />
        </div>

        <!-- User Picks -->
        <div
          class="px-4 py-3 bg-gray-50 dark:bg-transparent text-sm text-gray-700 border-t border-gray-200 dark:border-gray-800 flex flex-col md:flex-row"
          v-show="game.game_status === 'Final'"
        >
          <div class="w-full md:w-1/2 mb-4 md:mb-0 pl-4 text-xs">
            <div class="overflow-x-auto">
              <table class="w-full table-fixed text-left border-collapse">
                <thead>
                  <tr>
                    <th
                      class="px-4 py-2 text-gray-600 dark:text-white font-medium"
                    >
                      Voted for {{ game.away_team_name }}
                    </th>
                    <th
                      class="px-4 py-2 text-gray-600 dark:text-white font-medium text-center"
                    >
                      Conf.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    class="border-t border-gray-200 dark:border-gray-800"
                    v-for="(pick, index) in game.away_team.picks"
                    :key="index"
                  >
                    <td class="px-4 py-2 text-gray-800 dark:text-white">
                      {{ pick.user_full_name }}
                    </td>
                    <td class="px-4 py-2 text-center text-yellow-500">
                      <div class="flex justify-center">
                        <span
                          v-for="star in pick.confidence_score || 1"
                          :key="star"
                          class="text-xs"
                          >★</span
                        >
                      </div>
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
                  <tr>
                    <th
                      class="px-4 py-2 text-gray-600 dark:text-gray-100 font-medium"
                    >
                      Voted for {{ game.home_team_name }}
                    </th>
                    <th
                      class="px-4 py-2 text-gray-600 dark:text-gray-100 font-medium text-center"
                    >
                      Conf.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    class="border-t border-gray-200 dark:border-gray-800"
                    v-for="(pick, index) in game.home_team.picks"
                    :key="index"
                  >
                    <td class="px-4 py-2 text-gray-800 dark:text-gray-100">
                      {{ pick.user_full_name }}
                    </td>
                    <td class="px-4 py-2 text-center text-yellow-500">
                      <div class="flex justify-center">
                        <span
                          v-for="star in pick.confidence_score || 1"
                          :key="star"
                          class="text-xs"
                          >★</span
                        >
                      </div>
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

        <!-- Injury Report Toggle -->
        <div
          v-if="hasInjuries(game) && gamesStore.isValidDate(game.game_status)"
          class="border-t border-gray-200 dark:border-gray-800"
        >
          <button
            @click="toggleInjuries(index)"
            class="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200"
          >
            <div class="flex items-center gap-2">
              <svg
                :class="[
                  'h-5 w-5 transition-transform duration-200',
                  expandedInjuries[index] ? 'rotate-180' : '',
                ]"
                xmlns="http://www.w3.org/2000/svg"
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
              <span
                class="text-sm font-semibold text-gray-700 dark:text-gray-300"
              >
                Injury Report
              </span>
            </div>
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {{ game.away_team.injuries?.length || 0 }} +
              {{ game.home_team.injuries?.length || 0 }}
            </span>
          </button>

          <!-- Expanded Injury Content -->
          <div
            v-if="expandedInjuries[index]"
            class="px-4 py-4 bg-gray-50/50 dark:bg-gray-800/30 text-sm text-gray-700 dark:text-gray-200 flex flex-col md:flex-row gap-6 border-t border-gray-200 dark:border-gray-800 transition-all duration-200"
          >
            <!-- Away Team Injuries -->
            <div class="flex-1">
              <h4
                class="font-semibold text-sm mb-3 text-gray-700 dark:text-gray-200"
              >
                {{ game.away_team_name }}
              </h4>
              <div
                v-if="game.away_team.injuries?.length"
                class="overflow-x-auto"
              >
                <table
                  class="w-full table-fixed text-left border-collapse text-xs"
                >
                  <thead>
                    <tr class="text-gray-600 dark:text-gray-400">
                      <th class="px-2 py-1 font-medium">Player</th>
                      <th class="px-2 py-1 font-medium">Injury</th>
                      <th class="px-2 py-1 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      class="border-t border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                      v-for="(injury, idx) in game.away_team.injuries"
                      :key="idx"
                    >
                      <td class="px-2 py-1">{{ injury.playerName }}</td>
                      <td class="px-2 py-1">{{ injury.injury }}</td>
                      <td
                        class="px-2 py-1 font-medium"
                        :class="{
                          'text-red-500 dark:text-red-400':
                            injury.status.includes('Out'),
                          'text-yellow-500 dark:text-yellow-400':
                            !injury.status.includes('Out'),
                        }"
                      >
                        {{ injury.status }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="text-gray-500 dark:text-gray-400 text-xs">
                No injuries reported
              </div>
            </div>

            <!-- Home Team Injuries -->
            <div class="flex-1">
              <h4
                class="font-semibold text-sm mb-3 text-gray-700 dark:text-gray-200"
              >
                {{ game.home_team_name }}
              </h4>
              <div
                v-if="game.home_team.injuries?.length"
                class="overflow-x-auto"
              >
                <table
                  class="w-full table-fixed text-left border-collapse text-xs"
                >
                  <thead>
                    <tr class="text-gray-600 dark:text-gray-400">
                      <th class="px-2 py-1 font-medium">Player</th>
                      <th class="px-2 py-1 font-medium">Injury</th>
                      <th class="px-2 py-1 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      class="border-t border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                      v-for="(injury, idx) in game.home_team.injuries"
                      :key="idx"
                    >
                      <td class="px-2 py-1">{{ injury.playerName }}</td>
                      <td class="px-2 py-1">{{ injury.injury }}</td>
                      <td
                        class="px-2 py-1 font-medium"
                        :class="{
                          'text-red-500 dark:text-red-400':
                            injury.status.includes('Out'),
                          'text-yellow-500 dark:text-yellow-400':
                            !injury.status.includes('Out'),
                        }"
                      >
                        {{ injury.status }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="text-gray-500 dark:text-gray-400 text-xs">
                No injuries reported
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No Games Message -->
      <div
        v-if="!games.length && !allStarMarkets.length"
        class="card py-16 px-6 flex flex-col items-center justify-center"
      >
        <div
          v-if="selectedDate === '2024-11-05'"
          class="border-dashed border-2 rounded-lg border-gray-600 mb-6 -mt-6 p-6 flex flex-col items-center"
        >
          <p class="text-2xl font-bold text-blue-600">ELECTION</p>
          <p class="text-2xl font-bold text-red-600">DAY</p>
          <img
            :src="createAssetUrl('donut_election.avif')"
            alt="election"
            class="rounded-lg"
          />
        </div>
        <p class="text-2xl font-light uppercase">No games scheduled</p>
      </div>
    </div>
  </div>
</template>

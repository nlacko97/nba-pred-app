<script setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useGamesStore } from '../stores/games'
import { useGlobalStore } from '../stores/global'
import { useInsightsStore } from '../stores/insights'
import { matchupKey } from '../lib/insights'
import { getTeamImageUrl } from '../lib/teamLogo'
import ConfidenceSelector from './ConfidenceSelector.vue'

const props = defineProps({
  game: {
    type: Object,
    required: true,
  },
  index: {
    type: Number,
    default: 0,
  },
})

const gamesStore = useGamesStore()
const globalStore = useGlobalStore()
const insightsStore = useInsightsStore()
const { session, userId } = storeToRefs(globalStore)

const showBallots = ref(false)
const showInjuries = ref(false)

const pick = computed(() => props.game.picks[userId.value])
const isScheduled = computed(() =>
  gamesStore.isValidDate(props.game.game_status),
)
const isFinal = computed(() => props.game.game_status === 'Final')
const isLocked = computed(
  () => !isScheduled.value || new Date(props.game.game_status) < new Date(),
)
const canPick = computed(
  () => !!session.value && (isScheduled.value || gamesStore.allowPastVotes),
)

const isCup = computed(
  () =>
    typeof props.game.stage === 'string' &&
    props.game.stage.toUpperCase().includes('NBA CUP'),
)
const cupStageDetail = computed(() =>
  isCup.value
    ? props.game.stage
        .replace(/nba\s*cup/gi, '')
        .replace(/^[\s·:–-]+/, '')
        .trim()
    : '',
)

const tipTime = computed(() => {
  if (!isScheduled.value) return null
  const date = new Date(props.game.game_status)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
})

const hasScore = side =>
  side.score !== null && side.score !== undefined && side.score !== ''

const winnerId = computed(() => {
  if (!isFinal.value) return null
  const away = Number(props.game.away_team_score)
  const home = Number(props.game.home_team_score)
  if (Number.isNaN(away) || Number.isNaN(home) || away === home) return null
  return away > home ? props.game.away_team_id : props.game.home_team_id
})

const sides = computed(() => [
  {
    key: 'away',
    label: 'Away',
    id: props.game.away_team_id,
    abbr: props.game.away_team_abbreviation,
    name: props.game.away_team_name,
    team: props.game.away_team,
    score: props.game.away_team_score,
  },
  {
    key: 'home',
    label: 'Home',
    id: props.game.home_team_id,
    abbr: props.game.home_team_abbreviation,
    name: props.game.home_team_name,
    team: props.game.home_team,
    score: props.game.home_team_score,
  },
])

function sideState(side) {
  if (!pick.value) return canPick.value ? 'is-open' : ''
  if (pick.value.picked_team !== side.id) {
    return canPick.value && !isLocked.value ? 'is-other is-open' : 'is-other'
  }
  if (pick.value.correct === true) return 'is-won'
  if (pick.value.correct === false) return 'is-lost'
  return 'is-picked'
}

function stampText(side) {
  if (!pick.value || pick.value.picked_team !== side.id) return null
  if (pick.value.correct === true) return 'Correct'
  if (pick.value.correct === false) return 'Missed'
  return 'Picked'
}

async function submitPick(side) {
  if (!canPick.value) return
  if (pick.value && pick.value.picked_team === side.id) return
  // Switching sides keeps the confidence already put on the game
  await gamesStore.submitPick(
    props.game,
    side.id,
    userId.value,
    pick.value?.confidence_score || 1,
  )
}

async function updateConfidence(confidenceScore) {
  if (!pick.value) return
  await gamesStore.submitPick(
    props.game,
    pick.value.picked_team,
    userId.value,
    confidenceScore,
  )
}

// Removing a pick is undoable, so it happens immediately with an inline Undo
const removedPick = ref(null)

function removePick() {
  if (isLocked.value || !pick.value) return
  removedPick.value = {
    team: pick.value.picked_team,
    confidence: pick.value.confidence_score || 1,
  }
  gamesStore.cancelPick(props.game, userId.value)
}

async function undoRemove() {
  const removed = removedPick.value
  removedPick.value = null
  await gamesStore.submitPick(
    props.game,
    removed.team,
    userId.value,
    removed.confidence,
  )
}

watch(pick, value => {
  if (value) removedPick.value = null
})

const showUndo = computed(
  () => session.value && !pick.value && removedPick.value && !isLocked.value,
)

const crowd = computed(() => {
  const away = props.game.away_team.picks?.length || 0
  const home = props.game.home_team.picks?.length || 0
  const total = away + home
  return {
    away,
    home,
    total,
    awayPct: total ? Math.round((away / total) * 100) : 50,
  }
})

const injuryCount = computed(
  () =>
    (props.game.away_team.injuries?.length || 0) +
    (props.game.home_team.injuries?.length || 0),
)
const showInjuryToggle = computed(
  () => injuryCount.value > 0 && isScheduled.value,
)
const showBallotToggle = computed(() => isFinal.value && crowd.value.total > 0)
// Pre-game lines (spread, total, win probability) from the insights provider
const lines = computed(() => {
  if (!isScheduled.value) return null
  return insightsStore.linesFor(
    gamesStore.selectedDate,
    matchupKey(
      props.game.away_team_abbreviation,
      props.game.home_team_abbreviation,
    ),
  )
})

// ESPN's pre-tip snapshot, the same number the upset bonus is scored on
const homeWinPct = computed(() =>
  props.game.home_win_prob != null ? Number(props.game.home_win_prob) : null,
)

// 'DET leads 2–1' or 'Tied 1–1', from earlier meetings this season
const seriesSummary = computed(() => {
  const home = props.game.series_home_wins || 0
  const away = props.game.series_away_wins || 0
  if (!home && !away) return null
  if (home === away) return `Tied ${home}–${away}`
  return home > away
    ? `${props.game.home_team_abbreviation} leads ${home}–${away}`
    : `${props.game.away_team_abbreviation} leads ${away}–${home}`
})

const UPSET_LINE = 30

function sideWinPct(side) {
  if (props.game.home_win_prob == null) return null
  const home = Number(props.game.home_win_prob)
  return side.key === 'home' ? home : 100 - home
}

// Before tip: flag the side that would earn the upset bonus
function isUpsetSide(side) {
  if (!props.game.upset_bonus || isLocked.value) return false
  const pct = sideWinPct(side)
  return pct !== null && pct < UPSET_LINE
}

function earnedUpset(side) {
  return (
    pick.value?.picked_team === side.id &&
    pick.value.correct === true &&
    (pick.value.bonus_reasons || []).includes('upset')
  )
}

const showLines = computed(
  () =>
    isScheduled.value &&
    (!!lines.value || homeWinPct.value != null || !!seriesSummary.value),
)

const hasFooter = computed(
  () =>
    showLines.value ||
    showUndo.value ||
    (session.value && pick.value) ||
    showBallotToggle.value ||
    showInjuryToggle.value,
)
</script>

<template>
  <article
    class="ticket reveal"
    :class="{ 'ticket--cup': isCup }"
    :style="{ '--i': index }"
  >
    <!-- Stage band -->
    <div v-if="isCup" class="ticket__band ticket__band--cup">
      <svg
        class="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          d="M7 4a1 1 0 0 0-1 1v2a4 4 0 0 1-3 3.873V12a5 5 0 0 0 5 5h3v2H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2h3a5 5 0 0 0 5-5v-1.127A4 4 0 0 1 18 7V5a1 1 0 0 0-1-1H7z"
        />
      </svg>
      <span>NBA Cup</span>
      <span v-if="cupStageDetail" class="opacity-80"
        >· {{ cupStageDetail }}</span
      >
    </div>
    <div v-else-if="game.stage" class="ticket__band">
      {{ game.stage }}
    </div>

    <div class="ticket__grid">
      <!-- Team sides -->
      <div
        v-for="side in sides"
        :key="side.key"
        class="side"
        :class="[
          `side--${side.key}`,
          sideState(side),
          winnerId && winnerId !== side.id ? 'is-beaten' : '',
        ]"
        :role="canPick ? 'button' : undefined"
        :tabindex="canPick ? 0 : undefined"
        :aria-label="
          canPick
            ? `Pick ${side.name}${isUpsetSide(side) ? ', upset worth +1' : ''}`
            : undefined
        "
        @click="submitPick(side)"
        @keydown.enter.prevent="submitPick(side)"
        @keydown.space.prevent="submitPick(side)"
      >
        <span class="side__ghost" aria-hidden="true">{{ side.abbr }}</span>

        <span v-if="stampText(side)" :key="stampText(side)" class="stamp">
          {{ stampText(side) }}
        </span>

        <div class="side__body">
          <span class="puck">
            <img :src="getTeamImageUrl(side.abbr)" :alt="`${side.name} logo`" />
          </span>

          <div class="min-w-0">
            <p class="side__label">
              {{ side.label }}
              <span
                v-if="isUpsetSide(side)"
                class="upset-tag"
                :title="`${Math.round(sideWinPct(side))}% to win: a correct pick scores +1`"
                >Upset +1</span
              >
              <span v-else-if="earnedUpset(side)" class="upset-tag is-earned"
                >+1 upset</span
              >
            </p>
            <p class="side__name">{{ side.name }}</p>
            <div class="side__record">
              <span class="num"
                >{{ side.team.wins }}–{{ side.team.losses }}</span
              >
              <span
                v-if="side.team.record?.length"
                class="flex gap-[3px]"
                :aria-label="`Last games: ${side.team.record.join(' ')}`"
              >
                <span
                  v-for="(wl, idx) in side.team.record"
                  :key="idx"
                  class="form-dot"
                  :class="wl === 'W' ? 'is-w' : 'is-l'"
                />
              </span>
            </div>
          </div>

          <p v-if="hasScore(side)" class="side__score num">{{ side.score }}</p>
        </div>
      </div>

      <!-- Center stub -->
      <div class="stub">
        <span class="notch notch--tl" /><span class="notch notch--tr" />
        <span class="notch notch--bl" /><span class="notch notch--br" />

        <template v-if="isScheduled">
          <span class="label hidden sm:block">Tip-off</span>
          <span class="stub__time num">{{ tipTime }}</span>
        </template>
        <template v-else-if="isFinal">
          <span class="stub__final">Final</span>
        </template>
        <template v-else>
          <span class="stub__live">
            <span class="live-dot" />
            {{ game.game_status }}
          </span>
        </template>

        <span class="stub__at">@</span>
        <span class="label hidden !tracking-[0.12em] md:block">{{
          game.game_date
        }}</span>
      </div>
    </div>

    <!-- Footer -->
    <div v-if="hasFooter" class="ticket__foot">
      <!-- Pre-game lines -->
      <div v-if="showLines" class="lines">
        <div v-if="homeWinPct != null" class="lines__prob">
          <div class="mb-1.5 flex justify-between">
            <span class="label">
              {{ game.away_team_abbreviation }}
              <span class="num text-ink"
                >{{ Math.round(100 - homeWinPct) }}%</span
              >
            </span>
            <span class="label">Win probability</span>
            <span class="label">
              <span class="num text-ink">{{ Math.round(homeWinPct) }}%</span>
              {{ game.home_team_abbreviation }}
            </span>
          </div>
          <div class="flex h-1.5">
            <span class="bg-ink" :style="{ width: `${100 - homeWinPct}%` }" />
            <span class="flex-1 bg-ink/20" />
          </div>
        </div>
        <dl v-if="lines || seriesSummary" class="lines__facts">
          <div v-if="lines?.spread">
            <dt class="label">Spread</dt>
            <dd class="num">{{ lines.spread }}</dd>
          </div>
          <div v-if="lines?.total">
            <dt class="label">Total</dt>
            <dd class="num">{{ lines.total }}</dd>
          </div>
          <div v-if="lines?.venue" class="hidden sm:block">
            <dt class="label">Arena</dt>
            <dd class="truncate">{{ lines.venue }}</dd>
          </div>
          <div v-if="seriesSummary" class="hidden sm:block">
            <dt class="label">Series</dt>
            <dd class="truncate">{{ seriesSummary }}</dd>
          </div>
        </dl>
      </div>

      <div
        v-if="session && pick"
        class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"
      >
        <ConfidenceSelector
          :model-value="pick.confidence_score || 1"
          :disabled="isLocked"
          @update:model-value="updateConfidence"
        />
        <button
          v-if="isScheduled"
          type="button"
          class="btn-line"
          :disabled="isLocked"
          @click="removePick"
        >
          Remove pick
        </button>
      </div>

      <div
        v-if="showUndo"
        class="flex items-center justify-between gap-3 px-4 py-3 sm:px-6"
        role="status"
      >
        <span class="text-sm font-semibold">Pick removed</span>
        <button type="button" class="btn-ink" @click="undoRemove">Undo</button>
      </div>

      <!-- Crowd split -->
      <div v-if="showBallotToggle" class="px-4 pb-1 pt-3 sm:px-6">
        <div class="mb-1.5 flex justify-between">
          <span class="label"
            >{{ game.away_team_abbreviation }} · {{ crowd.away }}</span
          >
          <span class="label">Picks</span>
          <span class="label"
            >{{ crowd.home }} · {{ game.home_team_abbreviation }}</span
          >
        </div>
        <div class="split">
          <span class="split__away" :style="{ width: `${crowd.awayPct}%` }">
            <span v-if="crowd.awayPct >= 15" class="num"
              >{{ crowd.awayPct }}%</span
            >
          </span>
          <span class="split__home">
            <span v-if="crowd.awayPct <= 85" class="num"
              >{{ 100 - crowd.awayPct }}%</span
            >
          </span>
        </div>
      </div>

      <div
        v-if="showBallotToggle || showInjuryToggle"
        class="flex flex-wrap gap-2 px-4 py-3 sm:px-6"
      >
        <button
          v-if="showBallotToggle"
          type="button"
          class="toggle"
          :class="{ 'is-on': showBallots }"
          :aria-expanded="showBallots"
          @click="showBallots = !showBallots"
        >
          Who picked <span class="num text-muted">{{ crowd.total }}</span>
        </button>
        <button
          v-if="showInjuryToggle"
          type="button"
          class="toggle"
          :class="{ 'is-on': showInjuries }"
          :aria-expanded="showInjuries"
          @click="showInjuries = !showInjuries"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-loss" />
          Injury report <span class="num text-muted">{{ injuryCount }}</span>
        </button>
      </div>

      <!-- Who picked -->
      <div
        v-if="showBallots && showBallotToggle"
        class="grid gap-6 border-t border-dashed border-ink/25 px-4 py-4 sm:grid-cols-2 sm:px-6"
      >
        <div v-for="side in sides" :key="side.key">
          <p class="label mb-2">Backed {{ side.name }}</p>
          <ul class="space-y-1">
            <li
              v-for="(ballot, idx) in side.team.picks"
              :key="idx"
              class="flex items-center gap-2 text-sm"
            >
              <span
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold text-white"
                :class="ballot.correct ? 'bg-win-fill' : 'bg-loss-fill'"
                :aria-label="ballot.correct ? 'correct' : 'incorrect'"
                >{{ ballot.correct ? '✓' : '✕' }}</span
              >
              <span class="min-w-0 flex-1 truncate">{{
                ballot.user_full_name
              }}</span>
              <span
                class="flex gap-0.5"
                :aria-label="`confidence ${ballot.confidence_score || 1}`"
              >
                <span
                  v-for="c in ballot.confidence_score || 1"
                  :key="c"
                  class="h-2.5 w-2.5 rounded-full bg-accent"
                />
              </span>
            </li>
            <li v-if="!side.team.picks?.length" class="kicker text-sm">
              No picks
            </li>
          </ul>
        </div>
      </div>

      <!-- Injuries -->
      <div
        v-if="showInjuries && showInjuryToggle"
        class="grid gap-6 border-t border-dashed border-ink/25 px-4 py-4 sm:grid-cols-2 sm:px-6"
      >
        <div v-for="side in sides" :key="side.key">
          <p class="label mb-2">{{ side.name }}</p>
          <ul v-if="side.team.injuries?.length" class="divide-y divide-ink/10">
            <li
              v-for="(injury, idx) in side.team.injuries"
              :key="idx"
              class="grid grid-cols-[1fr_auto] gap-x-3 py-1.5 text-sm"
            >
              <span class="truncate font-semibold">{{
                injury.playerName
              }}</span>
              <span
                class="text-[0.6875rem] font-bold uppercase tracking-wider"
                :class="
                  injury.status.includes('Out') ? 'text-loss' : 'text-gold'
                "
                >{{ injury.status }}</span
              >
              <span class="col-span-2 truncate text-xs text-muted">{{
                injury.injury
              }}</span>
            </li>
          </ul>
          <p v-else class="kicker text-sm">No injuries reported.</p>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.ticket {
  --stub-w: 68px;
  position: relative;
  background: rgb(var(--c-card));
  border: 1.5px solid rgb(var(--c-edge));
  box-shadow: 6px 6px 0 rgb(var(--c-shadow));
}
@media (min-width: 640px) {
  .ticket {
    --stub-w: 120px;
  }
}
@media (min-width: 1024px) {
  .ticket {
    --stub-w: 148px;
  }
}

.ticket__band {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.4rem 1rem;
  border-bottom: 1.5px solid rgb(var(--c-edge));
  background: rgb(var(--c-ink));
  color: rgb(var(--c-paper));
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
.ticket__band--cup {
  color: #1a1206;
  background: repeating-linear-gradient(
      -45deg,
      rgb(255 255 255 / 0.18) 0 6px,
      transparent 6px 12px
    ),
    linear-gradient(90deg, #d9a93a, #f3d57a 50%, #d9a93a);
}
.ticket--cup {
  box-shadow: 6px 6px 0 #d9a93a;
}

.ticket__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--stub-w) minmax(0, 1fr);
  min-height: 168px;
}

/* ─── Team side ─── */
.side {
  position: relative;
  overflow: hidden;
  padding: 1rem 0.85rem 1.1rem;
  transition:
    background-color 0.25s ease,
    color 0.25s ease,
    opacity 0.25s ease;
}
@media (min-width: 640px) {
  .side {
    padding: 1.4rem 1.6rem 1.5rem;
  }
}
.side--away {
  order: 1;
}
.side--home {
  order: 3;
  text-align: right;
}

.side__ghost {
  position: absolute;
  bottom: -0.2em;
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: clamp(5rem, 13vw, 9.5rem);
  line-height: 1;
  color: transparent;
  -webkit-text-stroke: 1.5px rgb(var(--c-ink) / 0.09);
  pointer-events: none;
  user-select: none;
  transition:
    -webkit-text-stroke-color 0.25s ease,
    transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.side--away .side__ghost {
  left: -0.06em;
}
.side--home .side__ghost {
  right: -0.06em;
}

.side__body {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  height: 100%;
}
.side--home .side__body {
  align-items: flex-end;
}

.puck {
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #fbf8f1;
  border: 1.5px solid rgb(var(--c-edge));
  padding: 7px;
  transition: transform 0.35s cubic-bezier(0.5, 1.8, 0.4, 1);
}
.puck img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
@media (min-width: 640px) {
  .puck {
    width: 60px;
    height: 60px;
    padding: 9px;
  }
}

.side__label {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgb(var(--c-muted));
}
.side__name {
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 800;
  font-size: 1.15rem;
  line-height: 0.95;
  text-transform: uppercase;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
@media (min-width: 640px) {
  .side__name {
    font-size: 1.7rem;
  }
}
.side__record {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
}
.side--home .side__record {
  justify-content: flex-end;
}
/* Shape carries the result, color reinforces it: W filled, L hollow */
.form-dot {
  width: 8px;
  height: 8px;
}
.form-dot.is-w {
  background: rgb(var(--c-win));
}
.form-dot.is-l {
  border: 1.5px solid rgb(var(--c-loss));
}

.side__score {
  margin-top: auto;
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 2.9rem;
  line-height: 0.8;
  letter-spacing: -0.02em;
}
@media (min-width: 640px) {
  .side__score {
    font-size: 4.6rem;
  }
}
.side.is-beaten .side__score {
  opacity: 0.55;
}

/* States */
.side.is-open {
  cursor: pointer;
}
.side.is-open:hover {
  background: rgb(var(--c-accent) / 0.08);
}
.side.is-open:hover .side__ghost {
  -webkit-text-stroke-color: rgb(var(--c-accent) / 0.55);
  transform: translateY(-6px);
}
.side.is-open:hover .puck {
  transform: rotate(-12deg) scale(1.06);
}
/* The side you didn't pick recedes without dropping text below 4.5:1 */
.side.is-other .puck {
  filter: grayscale(1);
  opacity: 0.6;
}
.side.is-other .side__name,
.side.is-other .side__score {
  color: rgb(var(--c-muted));
}
.side.is-picked,
.side.is-won,
.side.is-lost {
  color: #fff;
}
.side.is-picked {
  background: rgb(var(--c-accent-fill));
}
.side.is-won {
  background: rgb(var(--c-win-fill));
}
.side.is-lost {
  background: repeating-linear-gradient(
      -45deg,
      rgb(0 0 0 / 0.12) 0 3px,
      transparent 3px 10px
    ),
    rgb(var(--c-loss-fill));
}
.side.is-picked .side__label,
.side.is-won .side__label,
.side.is-lost .side__label {
  color: #fff;
}
.side.is-picked .form-dot.is-w,
.side.is-won .form-dot.is-w,
.side.is-lost .form-dot.is-w {
  background: #fff;
}
.side.is-picked .form-dot.is-l,
.side.is-won .form-dot.is-l,
.side.is-lost .form-dot.is-l {
  border-color: #fff;
}
.side.is-picked .side__ghost,
.side.is-won .side__ghost,
.side.is-lost .side__ghost {
  -webkit-text-stroke-color: rgb(255 255 255 / 0.35);
}
.side.is-picked .side__score,
.side.is-won .side__score,
.side.is-lost .side__score {
  opacity: 1;
}

/* Rubber stamp */
.stamp {
  --r: -9deg;
  position: absolute;
  top: 0.7rem;
  z-index: 2;
  padding: 0.15rem 0.45rem;
  border: 2px solid currentColor;
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
  box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0);
  animation: stamp-in 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
}
.side--away .stamp {
  right: 0.7rem;
}
.side--home .stamp {
  --r: 8deg;
  left: 0.7rem;
}
@media (min-width: 640px) {
  .stamp {
    font-size: 1rem;
    padding: 0.2rem 0.6rem;
    top: 1rem;
  }
  .side--away .stamp {
    right: 1rem;
  }
  .side--home .stamp {
    left: 1rem;
  }
}

/* Upset bonus tag: accent ink on the open ticket, white on a filled side */
.upset-tag {
  display: inline-block;
  margin-left: 0.35rem;
  padding: 0 0.3rem;
  border: 1.5px solid currentColor;
  color: rgb(var(--c-accent));
  letter-spacing: 0.1em;
  white-space: nowrap;
}
.side.is-picked .upset-tag,
.side.is-won .upset-tag,
.side.is-lost .upset-tag {
  color: #fff;
}
.upset-tag.is-earned {
  background: #fff;
  color: rgb(var(--c-win-fill)) !important;
  border-color: #fff;
}

/* ─── Stub ─── */
.stub {
  order: 2;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 1rem 0.25rem;
  text-align: center;
  border-left: 2px dashed rgb(var(--c-ink) / 0.28);
  border-right: 2px dashed rgb(var(--c-ink) / 0.28);
}
.notch {
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: rgb(var(--c-paper));
  border: 1.5px solid rgb(var(--c-edge));
  z-index: 3;
}
.notch--tl,
.notch--tr {
  top: -11px;
  clip-path: inset(50% 0 0 0);
}
.notch--bl,
.notch--br {
  bottom: -11px;
  clip-path: inset(0 0 50% 0);
}
.notch--tl,
.notch--bl {
  left: -11px;
}
.notch--tr,
.notch--br {
  right: -11px;
}
.stub__time {
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 1.35rem;
  line-height: 1;
}
@media (min-width: 640px) {
  .stub__time {
    font-size: 2.1rem;
  }
}
.stub__final {
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 1rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.1rem 0.45rem;
  background: rgb(var(--c-ink));
  color: rgb(var(--c-paper));
}
@media (min-width: 640px) {
  .stub__final {
    font-size: 1.3rem;
  }
}
.stub__live {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--c-accent));
}
.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: currentColor;
  animation: pulse-dot 1.2s ease-in-out infinite;
}
.stub__at {
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 800;
  font-size: 1.6rem;
  line-height: 1;
  color: rgb(var(--c-muted));
}
@media (min-width: 640px) {
  .stub__at {
    font-size: 2.2rem;
  }
}

/* ─── Footer ─── */
.ticket__foot {
  border-top: 1.5px solid rgb(var(--c-edge));
}
.lines {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.9rem 1.75rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px dashed rgb(var(--c-ink) / 0.25);
}
@media (min-width: 640px) {
  .lines {
    padding: 0.85rem 1.5rem;
  }
}
.lines__prob {
  flex: 1 1 220px;
}
.lines__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
}
.lines__facts dd {
  margin-top: 0.15rem;
  max-width: 11rem;
  font-weight: 600;
  font-size: 0.875rem;
}
.split {
  display: flex;
  height: 22px;
  border: 1.5px solid rgb(var(--c-edge));
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 800;
  font-size: 0.85rem;
}
.split > span {
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  transition: width 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.split__away {
  background: rgb(var(--c-ink));
  color: rgb(var(--c-paper));
}
.split__home {
  flex: 1;
  justify-content: flex-end;
  background: repeating-linear-gradient(
    -45deg,
    rgb(var(--c-ink) / 0.14) 0 2px,
    transparent 2px 6px
  );
}
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.7rem;
  border: 1.5px solid rgb(var(--c-ink) / 0.25);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}
.toggle:hover {
  border-color: rgb(var(--c-ink));
}
.toggle.is-on {
  background: rgb(var(--c-ink));
  border-color: rgb(var(--c-ink));
  color: rgb(var(--c-paper));
}
</style>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDailyResultsStore } from '../stores/dailyResults'
import { useGamesStore } from '../stores/games'
import { addDays } from '../lib/season'

// The stub torn off last night's ticket: how you did on the previous game
// day, stamped with a verdict, without leaving today's slate. Tap it to go
// to that day's results.
const gamesStore = useGamesStore()
const { today } = storeToRefs(gamesStore)
const { userResults, lastGameDate, allPlayerResults } = storeToRefs(
  useDailyResultsStore(),
)

const result = computed(() => userResults.value)

const dayLabel = computed(() => {
  if (!lastGameDate.value) return ''
  if (lastGameDate.value === addDays(today.value, -1)) return 'Last night'
  return new Date(`${lastGameDate.value}T00:00:00Z`).toLocaleDateString(
    'en-US',
    { timeZone: 'UTC', weekday: 'long' },
  )
})

const shortDate = computed(() =>
  lastGameDate.value
    ? new Date(`${lastGameDate.value}T00:00:00Z`).toLocaleDateString('en-US', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
      })
    : '',
)

const record = computed(() => {
  const { correct_picks: correct, total_picks: picks } = result.value
  return `${correct}–${picks - correct}`
})

// The rubber stamp across the stub
const verdict = computed(() => {
  const { correct_picks: correct, total_picks: picks, rank } = result.value
  if (picks >= 2 && correct === picks) return { text: 'Perfect', tone: 'gold' }
  if (rank === 1) return { text: 'Top of the night', tone: 'gold' }
  if (correct === 0) return { text: 'Blanked', tone: 'loss' }
  if (correct * 2 >= picks) return { text: 'Cashed', tone: 'win' }
  return { text: 'Rough one', tone: 'loss' }
})

const field = computed(() => allPlayerResults.value.length)

const open = () => gamesStore.setSelectedDate(lastGameDate.value)
</script>

<template>
  <button
    v-if="result && lastGameDate"
    type="button"
    class="stub"
    :aria-label="`${dayLabel}: ${record} for ${result.points} points, ${verdict.text}. See ${shortDate} results`"
    @click="open"
  >
    <span class="stub__day">
      <span class="label !text-inherit">{{ dayLabel }}</span>
      <span class="stub__date num">{{ shortDate }}</span>
    </span>
    <span class="stub__body">
      <span class="stub__points num">+{{ result.points }}</span>
      <span class="stub__meta">
        <span class="num">{{ record }}</span>
        <span v-if="result.rank" class="num"
          >#{{ result.rank }}<span class="opacity-60">/{{ field }}</span></span
        >
      </span>
    </span>
    <span class="stub__stamp" :class="`is-${verdict.tone}`">{{
      verdict.text
    }}</span>
    <span class="stub__go" aria-hidden="true">→</span>
  </button>
</template>

<style scoped>
/* A ticket stub: perforated edge, notches, and a stamp across it */
.stub {
  --notch: 9px;
  position: relative;
  display: inline-flex;
  align-items: stretch;
  max-width: 100%;
  margin-top: 1rem;
  border: 1.5px solid rgb(var(--c-edge));
  background: rgb(var(--c-card));
  box-shadow: 4px 4px 0 rgb(var(--c-shadow));
  text-align: left;
  transform: rotate(-1deg);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  animation: stub-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.3s both;
}
.stub:hover {
  transform: rotate(0deg) translate(-2px, -2px);
  box-shadow: 6px 6px 0 rgb(var(--c-shadow));
}
.stub:focus-visible {
  outline: 2px solid rgb(var(--c-accent));
  outline-offset: 3px;
}
.stub__day {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.15rem;
  padding: 0.55rem 0.9rem 0.55rem 0.8rem;
  background: rgb(var(--c-ink));
  color: rgb(var(--c-paper));
}
.stub__date {
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 1.35rem;
  line-height: 1;
  text-transform: uppercase;
}
/* The perforation between the dark tab and the body */
.stub__body {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.4rem 1rem 0.4rem 1.1rem;
  border-left: 2px dashed rgb(var(--c-ink) / 0.35);
}
.stub__body::before,
.stub__body::after {
  content: '';
  position: absolute;
  left: calc(var(--notch) / -2 - 1px);
  width: var(--notch);
  height: var(--notch);
  border-radius: 999px;
  background: rgb(var(--c-paper));
  border: 1.5px solid rgb(var(--c-edge));
}
.stub__body::before {
  top: calc(var(--notch) / -2 - 1.5px);
}
.stub__body::after {
  bottom: calc(var(--notch) / -2 - 1.5px);
}
.stub__points {
  color: rgb(var(--c-accent));
  font-family: 'Permanent Marker', 'Big Shoulders Display', cursive;
  font-size: 2rem;
  line-height: 1;
  transform: rotate(-3deg);
}
.stub__meta {
  display: flex;
  flex-direction: column;
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.25;
}
.stub__stamp {
  --r: -10deg;
  align-self: center;
  margin: 0 0.6rem 0 -0.2rem;
  padding: 0.1rem 0.45rem;
  border: 3px double currentColor;
  border-radius: 3px;
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-transform: uppercase;
  white-space: nowrap;
  opacity: 0.9;
  animation: stamp-in 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.8s both;
}
.stub__stamp.is-win {
  color: rgb(var(--c-win));
}
.stub__stamp.is-loss {
  color: rgb(var(--c-loss));
}
.stub__stamp.is-gold {
  color: rgb(var(--c-gold));
}
.stub__go {
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  border-left: 1.5px solid rgb(var(--c-ink) / 0.12);
  font-weight: 900;
  transition: transform 0.2s ease;
}
.stub:hover .stub__go {
  transform: translateX(3px);
}
/* Narrow phones: the stamp sits over the body instead of beside it */
@media (max-width: 420px) {
  .stub__stamp {
    position: absolute;
    right: 2.6rem;
    top: -0.7rem;
    margin: 0;
    background: rgb(var(--c-card));
  }
}
@keyframes stub-in {
  from {
    opacity: 0;
    transform: translateY(-8px) rotate(-4deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .stub,
  .stub__stamp {
    animation: none;
  }
}
</style>

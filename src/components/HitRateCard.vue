<script setup>
import { computed } from 'vue'

// Hit rate at a glance, then how it holds up at each confidence level
// against the player's own average, and one honest sentence about it
const props = defineProps({
  report: {
    type: Object,
    default: null,
  },
  isMe: {
    type: Boolean,
    default: false,
  },
})

const MIN_PICKS = 5

const picks = computed(() => props.report?.overall?.picks || 0)
const correct = computed(() => props.report?.overall?.correct || 0)
const average = computed(() =>
  picks.value ? (correct.value / picks.value) * 100 : null,
)

const levels = computed(() =>
  (props.report?.confidence || []).map(row => {
    const rate = row.picks ? (row.correct / row.picks) * 100 : null
    return {
      ...row,
      rate,
      enough: row.picks >= MIN_PICKS,
      beats: rate !== null && average.value !== null && rate >= average.value,
    }
  }),
)

const verdict = computed(() => {
  const [ones, , threes] = levels.value
  const w = props.isMe
    ? { Your: 'Your', your: 'your', you: 'you', youre: "you're" }
    : { Your: 'Their', your: 'their', you: 'they', youre: "they're" }
  if (!threes || picks.value < MIN_PICKS) return null
  if (!threes.enough) return 'Too few 3s yet to judge the nerve.'
  const r3 = Math.round(threes.rate)
  if (
    ones?.enough &&
    threes.rate >= ones.rate + 8 &&
    threes.rate >= average.value
  )
    return `${w.Your} 3s hit ${r3}%. When ${w.you} feel it, ${w.youre} right.`
  if (threes.rate < average.value - 3)
    return `${w.Your} 3s hit ${r3}%, below ${w.your} average. Easy on the big calls.`
  if (ones?.enough && ones.rate > threes.rate)
    return `${w.Your} 1s out-hit ${w.your} 3s. Trust the quiet hunches.`
  return `${w.Your} 3s hit ${r3}%, right on ${w.your} average.`
})
</script>

<template>
  <section class="sheet reveal flex flex-col p-5 sm:p-6">
    <h2 class="display text-3xl sm:text-4xl">Hit rate</h2>

    <p v-if="!picks" class="kicker mt-6">No graded picks yet.</p>

    <template v-else>
      <p class="big display num">
        {{ average.toFixed(1) }}<span class="text-muted">%</span>
      </p>
      <div class="mt-3 flex justify-between">
        <span class="label !text-win">{{ correct }} correct</span>
        <span class="label !text-loss">{{ picks - correct }} missed</span>
      </div>
      <div class="split" aria-hidden="true">
        <span class="split__hit" :style="{ width: `${average}%` }" />
        <span class="split__miss" />
      </div>

      <p class="label mt-7">By confidence</p>
      <ul class="mt-3 space-y-3.5">
        <li v-for="row in levels" :key="row.level" class="level">
          <span class="pips" :aria-label="`Confidence ${row.level}`">
            <i v-for="n in 3" :key="n" :class="{ on: n <= row.level }" />
          </span>
          <span class="level__track">
            <span
              class="level__bar"
              :class="{ 'is-up': row.beats, 'is-thin': !row.enough }"
              :style="{
                width: `${row.rate ?? 0}%`,
                '--d': `${row.level * 120}ms`,
              }"
            />
            <!-- The player's average across all picks -->
            <i class="level__avg" :style="{ left: `${average}%` }" />
          </span>
          <span class="level__rate display num"
            >{{ row.rate === null ? '–' : Math.round(row.rate)
            }}<small>%</small></span
          >
          <span class="level__picks num">{{ row.picks }} picks</span>
        </li>
      </ul>
      <p class="legend"><i aria-hidden="true" /> average</p>

      <p v-if="verdict" class="verdict mt-auto">{{ verdict }}</p>
    </template>
  </section>
</template>

<style scoped>
.big {
  margin-top: 1rem;
  font-size: clamp(4.5rem, 9vw, 6.5rem);
}
.split {
  display: flex;
  height: 12px;
  margin-top: 0.4rem;
  border: 1.5px solid rgb(var(--c-edge));
}
.split__hit {
  background: rgb(var(--c-win));
  animation: grow-x 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.split__miss {
  flex: 1;
  background: rgb(var(--c-loss) / 0.7);
}

.level {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 3.2rem;
  grid-template-rows: auto auto;
  align-items: center;
  column-gap: 0.75rem;
}
.pips {
  display: inline-flex;
  gap: 3px;
}
.pips i {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  border: 1.5px solid rgb(var(--c-ink) / 0.3);
}
.pips i.on {
  background: rgb(var(--c-accent));
  border-color: rgb(var(--c-accent));
}
.level__track {
  position: relative;
  height: 16px;
  background: rgb(var(--c-ink) / 0.08);
}
.level__bar {
  display: block;
  height: 100%;
  background: rgb(var(--c-ink) / 0.4);
  transform-origin: left;
  animation: grow-x 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: var(--d);
}
.level__bar.is-up {
  background: rgb(var(--c-win));
}
.level__bar.is-thin {
  opacity: 0.45;
}
.level__avg {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 2px;
  margin-left: -1px;
  background: rgb(var(--c-ink));
}
.level__rate {
  text-align: right;
  font-size: 1.6rem;
}
.level__rate small {
  font-size: 0.55em;
  color: rgb(var(--c-muted));
}
.level__picks {
  grid-column: 2 / 4;
  margin-top: 0.15rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: rgb(var(--c-muted));
}
.legend {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.75rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgb(var(--c-muted));
}
.legend i {
  width: 2px;
  height: 10px;
  background: rgb(var(--c-ink));
}
.verdict {
  padding-top: 1.25rem;
  font-family: 'Permanent Marker', cursive;
  font-size: 1.15rem;
  line-height: 1.35;
  color: rgb(var(--c-accent));
}
@keyframes grow-x {
  from {
    transform: scaleX(0);
  }
}
.split__hit {
  transform-origin: left;
}
@media (prefers-reduced-motion: reduce) {
  .split__hit,
  .level__bar {
    animation: none;
  }
}
</style>

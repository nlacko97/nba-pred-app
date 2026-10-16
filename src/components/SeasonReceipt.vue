<script setup>
import { computed } from 'vue'
import { gameDayIso, seasonLabel } from '../lib/season'

// The season, itemised on a till receipt that prints out of a slot
const props = defineProps({
  user: {
    type: Object,
    required: true,
  },
  rank: {
    type: Number,
    default: null,
  },
  season: {
    type: [String, Number],
    required: true,
  },
  // 'Regular season', 'Postseason', 'Week 3 · Oct 20–26' or 'October 2026'
  scope: {
    type: String,
    default: 'Regular season',
  },
  report: {
    type: Object,
    default: null,
  },
  // Left off for a week or month; badges are season-long
  badgeCount: {
    type: Number,
    default: null,
  },
  bestStreak: {
    type: Number,
    default: 0,
  },
})

const shortDate = iso =>
  new Date(`${iso}T00:00:00Z`)
    .toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
    })
    .toUpperCase()

const printedOn = shortDate(gameDayIso())

const favourite = computed(() => {
  const teams = [...(props.report?.teams || [])].sort(
    (a, b) => b.for_picks - a.for_picks,
  )
  return teams[0]?.for_picks ? teams[0] : null
})

const picks = computed(() => props.report?.overall?.picks || 0)
const correct = computed(() => props.report?.overall?.correct || 0)
const levels = computed(() => props.report?.confidence || [])
const nights = computed(() => props.report?.nights || null)
const gamePoints = computed(() =>
  levels.value.reduce((sum, row) => sum + row.points, 0),
)
const total = computed(() => Number(props.user.total_score) || 0)
// All-Star markets and anything else outside game picks
const otherPoints = computed(() => Math.max(0, total.value - gamePoints.value))

const items = computed(() => {
  const best = nights.value?.best
  return [
    { label: 'Game nights', value: nights.value?.count ?? 0 },
    { label: 'Picks', value: picks.value },
    ...levels.value.map(row => ({
      label: `  @ confidence ${row.level}`,
      value: `${row.picks}`,
      sub: true,
      pips: row.level,
    })),
    { label: 'Correct', value: correct.value, tone: 'win' },
    { label: 'Missed', value: picks.value - correct.value, tone: 'loss' },
    best && {
      label: `Best night ${shortDate(best.game_date)}`,
      value: `${best.correct}/${best.picks}`,
      tone: 'highlight',
    },
    { label: 'Longest streak', value: props.bestStreak },
    favourite.value && {
      label: `Favourite team ${favourite.value.abbreviation}`,
      value: `x${favourite.value.for_picks}`,
    },
    nights.value && {
      label: 'Nights going all in',
      value: nights.value.with_max,
    },
    props.badgeCount !== null && { label: 'Badges', value: props.badgeCount },
  ].filter(Boolean)
})

const pointLines = computed(() => [
  ...levels.value.map(row => ({
    label: `${row.correct} hits @ ${row.level}`,
    value: row.points,
  })),
  ...(otherPoints.value
    ? [{ label: 'Bonus & All-Star', value: otherPoints.value }]
    : []),
])

// The rubber stamp across the middle
const stamp = computed(() => {
  if (props.rank === 1) return 'Champion'
  if (props.rank) return `#${props.rank} in the league`
  return 'Paid in full'
})

const hitRate = computed(() =>
  picks.value ? ((correct.value / picks.value) * 100).toFixed(1) : '0.0',
)
</script>

<template>
  <div class="till reveal">
    <!-- The printer's slot the receipt comes out of -->
    <div class="slot" aria-hidden="true" />
    <article class="receipt" :aria-label="`Season receipt: ${total} points`">
      <span class="stripe" aria-hidden="true" />
      <span class="stamp" aria-hidden="true">{{ stamp }}</span>
      <header class="center">
        <p class="brand">THE PICK SHEET</p>
        <p>NBA PREDICTOR · EST. 2024</p>
        <p>
          {{ seasonLabel(season) }}
          {{ scope.toUpperCase() }}
        </p>
      </header>

      <p class="rule" aria-hidden="true" />

      <div class="meta">
        <span>RECEIPT #{{ String(rank || 0).padStart(6, '0') }}</span>
        <span>{{ printedOn }}</span>
      </div>
      <p class="customer">{{ (user.full_name || 'Player').toUpperCase() }}</p>

      <p class="rule" aria-hidden="true" />

      <ul>
        <li
          v-for="item in items"
          :key="item.label"
          :class="[{ sub: item.sub }, item.tone && `is-${item.tone}`]"
        >
          <span class="label-text">{{ item.label.toUpperCase() }}</span>
          <span v-if="item.pips" class="pips" aria-hidden="true">
            <i v-for="n in 3" :key="n" :class="{ on: n <= item.pips }" />
          </span>
          <span class="dots" aria-hidden="true" />
          <span class="value">{{ item.value }}</span>
        </li>
      </ul>

      <p class="rule" aria-hidden="true" />

      <ul>
        <li v-for="line in pointLines" :key="line.label">
          <span class="label-text">{{ line.label.toUpperCase() }}</span>
          <span class="dots" aria-hidden="true" />
          <span>{{ line.value }}</span>
        </li>
        <li>
          <span class="label-text">HIT RATE</span>
          <span class="dots" aria-hidden="true" />
          <span>{{ hitRate }}%</span>
        </li>
      </ul>

      <p class="rule rule--double" aria-hidden="true" />

      <p class="total">
        <span>TOTAL</span>
        <span class="marker">{{ total }} PTS</span>
      </p>

      <p class="rule rule--double" aria-hidden="true" />

      <footer class="center thanks">
        <p>*** THANK YOU FOR PICKING ***</p>
        <p>NO REFUNDS ON MISSED PICKS</p>
        <p class="barcode" aria-hidden="true" />
        <p>{{ String(picks).padStart(4, '0') }} {{ correct }} {{ total }}</p>
      </footer>
    </article>
  </div>
</template>

<style scoped>
.till {
  width: min(100%, 23rem);
  filter: drop-shadow(0 10px 14px rgb(0 0 0 / 0.22));
}
.slot {
  position: relative;
  z-index: 2;
  height: 14px;
  margin: 0 -0.75rem;
  border-radius: 7px;
  background: rgb(var(--c-ink));
  box-shadow: inset 0 -4px 0 rgb(0 0 0 / 0.35);
}

/* Thermal paper: same in both themes, zig-zag torn bottom */
.receipt {
  --paper: #fdfcf6;
  --print: #2a2722;
  --orange: #d03808;
  --green: #188046;
  --red: #c82822;
  --blue: #2242aa;
  --gold: #e8b62a;
  --highlight: rgb(255 214 64 / 0.75);
  position: relative;
  margin-top: -6px;
  padding: 1.6rem 1.25rem 2rem;
  background: var(--paper);
  color: var(--print);
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 0.78rem;
  line-height: 1.55;
  letter-spacing: 0.02em;
  -webkit-mask:
    linear-gradient(#000 0 0) top / 100% calc(100% - 10px) no-repeat,
    conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg)
      bottom / 14px 10px repeat-x;
  mask:
    linear-gradient(#000 0 0) top / 100% calc(100% - 10px) no-repeat,
    conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg)
      bottom / 14px 10px repeat-x;
  transform-origin: top;
  animation: print 1.6s steps(24, end) both;
}
@keyframes print {
  from {
    clip-path: inset(0 0 100% 0);
    transform: translateY(-12px);
  }
  to {
    clip-path: inset(0 0 0 0);
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .receipt {
    animation: none;
  }
}

.center {
  text-align: center;
}
/* A coloured edge like the end-of-roll stripe on till paper */
.stripe {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 7px;
  background: repeating-linear-gradient(
    90deg,
    var(--orange) 0 18px,
    var(--gold) 18px 36px,
    var(--blue) 36px 54px,
    var(--green) 54px 72px
  );
}
.brand {
  color: var(--orange);
}
.stamp {
  /* Over the barcode, where it hides nothing that needs reading */
  position: absolute;
  bottom: 2.6rem;
  left: 1.1rem;
  z-index: 1;
  padding: 0.25rem 0.6rem;
  border: 3px double var(--red);
  border-radius: 4px;
  color: var(--red);
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 1.25rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transform: rotate(-9deg);
  opacity: 0.85;
  mix-blend-mode: multiply;
  pointer-events: none;
  animation: stamp-in 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2) 1.4s both;
  --r: -9deg;
}
.pips {
  display: inline-flex;
  gap: 2px;
  margin-left: 0.15rem;
}
.pips i {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  border: 1px solid rgb(42 39 34 / 0.4);
}
.pips i.on {
  background: var(--orange);
  border-color: var(--orange);
}
li.is-win .value {
  color: var(--green);
  font-weight: 700;
}
li.is-loss .value {
  color: var(--red);
  font-weight: 700;
}
li.is-highlight .label-text,
li.is-highlight .value {
  background: linear-gradient(
    100deg,
    transparent 2%,
    var(--highlight) 4% 96%,
    transparent 98%
  );
}
.marker {
  padding: 0 0.3rem;
  color: var(--orange);
  background: linear-gradient(
    100deg,
    transparent 2%,
    var(--highlight) 4% 96%,
    transparent 98%
  );
}
.thanks p:first-child {
  color: var(--blue);
  font-weight: 700;
}
.brand {
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 1.6rem;
  line-height: 1.1;
  letter-spacing: 0.08em;
}
.rule {
  height: 0;
  margin: 0.65rem 0;
  border-top: 1.5px dashed rgb(42 39 34 / 0.55);
}
.rule--double {
  height: 4px;
  border-top: 1.5px solid var(--print);
  border-bottom: 1.5px solid var(--print);
}
.meta {
  display: flex;
  justify-content: space-between;
}
.customer {
  font-weight: 700;
}
li {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}
li.sub {
  opacity: 0.75;
}
.label-text {
  white-space: pre;
}
.dots {
  flex: 1;
  min-width: 1rem;
  border-bottom: 1.5px dotted rgb(42 39 34 / 0.5);
  transform: translateY(-0.25em);
}
.total {
  display: flex;
  justify-content: space-between;
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 1.9rem;
  line-height: 1.1;
  letter-spacing: 0.04em;
}
.barcode {
  height: 38px;
  margin: 0.75rem auto 0.25rem;
  width: 80%;
  background: repeating-linear-gradient(
    90deg,
    var(--print) 0 2px,
    transparent 2px 4px,
    var(--print) 4px 5px,
    transparent 5px 8px,
    var(--print) 8px 11px,
    transparent 11px 12px
  );
}
</style>

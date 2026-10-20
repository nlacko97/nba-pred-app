<script setup>
import { computed } from 'vue'

// Hit rate at a glance, then a shot chart: every graded pick is a jumper,
// taken from further out the more confidence was on it (1s in the paint,
// 2s from midrange, 3s from deep), and one honest sentence about it
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
// Most marks drawn per zone; past that the zone shows a sample, same split
const MAX_MARKS = 40

// Court in tenths of a foot, baseline at the top, hoop 5.25ft in
const HOOP = { x: 250, y: 52.5 }
const ARC = 237.5
const CORNER_Y = 142

const ZONES = {
  1: {
    name: 'Paint',
    badge: { x: 250, y: 120 },
    box: [176, 44, 324, 184],
    accepts: (x, y) => x >= 176 && x <= 324 && y >= 44 && y <= 184,
  },
  2: {
    name: 'Mid',
    badge: { x: 250, y: 224 },
    box: [44, 10, 456, 280],
    accepts: (x, y, d) =>
      y >= 10 &&
      d <= ARC - 14 &&
      Math.abs(x - 250) <= 206 &&
      !(x >= 162 && x <= 338 && y <= 198),
  },
  3: {
    name: 'Three',
    badge: { x: 250, y: 340 },
    box: [8, 8, 492, 352],
    accepts: (x, y, d) =>
      x >= 8 &&
      x <= 492 &&
      y >= 8 &&
      d <= ARC + 62 &&
      (y <= CORNER_Y ? Math.abs(x - 250) >= 230 : d >= ARC + 12),
  },
}

const BADGE = { w: 96, h: 50 }
const underBadge = (x, y, badge) =>
  Math.abs(x - badge.x) <= BADGE.w / 2 + 8 &&
  Math.abs(y - badge.y) <= BADGE.h / 2 + 8

// Small seeded generator so a player's chart looks the same every visit
const seeded = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Spots spread evenly over a zone: each new spot is the best of a few
// random tries, the one furthest from every spot already taken
const spots = (level, count) => {
  const zone = ZONES[level]
  const rand = seeded(level * 7919)
  const taken = []
  const [x0, y0, x1, y1] = zone.box
  while (taken.length < count) {
    let best = null
    let bestGap = -1
    let candidates = 0
    for (let tries = 0; tries < 500 && candidates < 12; tries++) {
      const x = x0 + rand() * (x1 - x0)
      const y = y0 + rand() * (y1 - y0)
      const d = Math.hypot(x - HOOP.x, y - HOOP.y)
      if (!zone.accepts(x, y, d) || underBadge(x, y, zone.badge)) continue
      candidates++
      const gap = Math.min(
        Infinity,
        ...taken.map(p => Math.hypot(p.x - x, p.y - y)),
      )
      if (gap > bestGap) {
        best = { x, y }
        bestGap = gap
      }
    }
    if (!best) break
    taken.push(best)
  }
  return taken
}

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

const zones = computed(() =>
  levels.value
    .filter(row => ZONES[row.level])
    .map(row => {
      const zone = ZONES[row.level]
      const count = Math.min(row.picks, MAX_MARKS)
      const makes = row.picks
        ? Math.round((count * row.correct) / row.picks)
        : 0
      // Makes and misses interleaved evenly, not clumped
      const marks = spots(row.level, count).map((p, i) => ({
        ...p,
        hit:
          Math.floor(((i + 1) * makes) / count) >
          Math.floor((i * makes) / count),
      }))
      return {
        ...row,
        ...zone,
        marks,
        tone: !row.enough ? 'thin' : row.beats ? 'hot' : 'cold',
      }
    }),
)

const sampled = computed(() => levels.value.some(row => row.picks > MAX_MARKS))

const chartLabel = computed(() =>
  zones.value
    .map(
      z =>
        `${z.name} (confidence ${z.level}): ${z.correct} of ${z.picks}` +
        (z.rate === null ? '' : `, ${Math.round(z.rate)}%`),
    )
    .join('. '),
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

      <p class="label mt-7">Shot chart · by confidence</p>
      <svg
        class="court mt-3"
        viewBox="0 0 500 470"
        role="img"
        :aria-label="`Shot chart. ${chartLabel}`"
      >
        <!-- Zones, warm where they beat the player's average -->
        <g class="zones">
          <path
            v-for="z in zones"
            :key="z.level"
            :class="`zone--${z.tone}`"
            fill-rule="evenodd"
            :d="
              z.level === 1
                ? 'M170 0h160v190H170Z'
                : z.level === 2
                  ? 'M30 0V142A237.5 237.5 0 0 0 470 142V0ZM170 0h160v190H170Z'
                  : 'M0 0h500v470H0ZM30 0V142A237.5 237.5 0 0 0 470 142V0Z'
            "
          />
        </g>

        <g class="lines" fill="none">
          <rect x="1" y="1" width="498" height="468" />
          <path d="M170 0v190h160V0" />
          <circle cx="250" cy="190" r="60" />
          <path d="M30 0v142a237.5 237.5 0 0 0 440 0V0" />
          <path d="M210 52.5a40 40 0 0 0 80 0" />
          <path d="M190 470a60 60 0 0 1 120 0" />
          <path class="rim-board" d="M220 40h60" />
          <circle class="rim" cx="250" cy="52.5" r="7.5" />
        </g>

        <g v-for="z in zones" :key="z.level" class="shots">
          <template v-for="(m, i) in z.marks" :key="i">
            <circle
              v-if="m.hit"
              class="shot shot--make"
              :cx="m.x"
              :cy="m.y"
              r="6"
              :style="{ '--d': `${z.level * 160 + i * 14}ms` }"
            />
            <path
              v-else
              class="shot shot--miss"
              :d="`M${m.x - 5} ${m.y - 5}l10 10m0 -10l-10 10`"
              :style="{ '--d': `${z.level * 160 + i * 14}ms` }"
            />
          </template>
        </g>

        <g
          v-for="z in zones"
          :key="z.level"
          class="badge"
          :class="`badge--${z.tone}`"
          :transform="`translate(${z.badge.x} ${z.badge.y})`"
        >
          <rect
            :x="-BADGE.w / 2"
            :y="-BADGE.h / 2"
            :width="BADGE.w"
            :height="BADGE.h"
          />
          <text class="badge__name" y="-9">
            {{ z.name }} · {{ z.correct }}/{{ z.picks }}
          </text>
          <text class="badge__rate" y="19">
            {{ z.rate === null ? '–' : Math.round(z.rate) }}
            <tspan>%</tspan>
          </text>
        </g>
      </svg>

      <p class="legend">
        <span><i class="legend__make" aria-hidden="true" /> hit</span>
        <span><i class="legend__miss" aria-hidden="true">×</i> miss</span>
        <span>1 = paint · 2 = mid · 3 = deep</span>
        <span v-if="sampled">up to {{ MAX_MARKS }} shown per zone</span>
      </p>

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
  transform-origin: left;
  animation: grow-x 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.split__miss {
  flex: 1;
  background: rgb(var(--c-loss) / 0.7);
}

.court {
  display: block;
  width: 100%;
  max-width: 26rem;
  margin-inline: auto;
  overflow: visible;
}
.zones path {
  fill: transparent;
}
.zones .zone--hot {
  fill: rgb(var(--c-win) / 0.09);
}
.zones .zone--cold {
  fill: rgb(var(--c-loss) / 0.07);
}
.lines {
  stroke: rgb(var(--c-ink) / 0.55);
  stroke-width: 2;
}
.lines .rim-board {
  stroke: rgb(var(--c-ink));
  stroke-width: 3.5;
}
.lines .rim {
  stroke: rgb(var(--c-accent));
  stroke-width: 2.5;
}

.shot {
  transform-box: fill-box;
  transform-origin: center;
  animation: swish 0.45s cubic-bezier(0.2, 0.8, 0.2, 1.4) both;
  animation-delay: var(--d);
}
.shot--make {
  fill: rgb(var(--c-win) / 0.28);
  stroke: rgb(var(--c-win));
  stroke-width: 2;
}
.shot--miss {
  fill: none;
  stroke: rgb(var(--c-loss));
  stroke-width: 2.25;
  stroke-linecap: round;
}

.badge rect {
  fill: rgb(var(--c-card));
  stroke: rgb(var(--c-edge));
  stroke-width: 1.5;
}
.badge text {
  text-anchor: middle;
  fill: rgb(var(--c-ink));
}
.badge__name {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  fill: rgb(var(--c-muted)) !important;
}
.badge__rate {
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 30px;
  font-variant-numeric: tabular-nums;
}
.badge__rate tspan {
  font-size: 0.55em;
  fill: rgb(var(--c-muted));
}
.badge--hot .badge__rate {
  fill: rgb(var(--c-win));
}
.badge--cold .badge__rate {
  fill: rgb(var(--c-loss));
}
.badge--thin {
  opacity: 0.6;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35rem 1rem;
  margin-top: 0.75rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgb(var(--c-muted));
}
.legend span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.legend__make {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  border: 1.5px solid rgb(var(--c-win));
  background: rgb(var(--c-win) / 0.28);
}
.legend__miss {
  font-style: normal;
  font-size: 0.9rem;
  line-height: 0;
  color: rgb(var(--c-loss));
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
@keyframes swish {
  from {
    opacity: 0;
    transform: scale(0.2);
  }
}
@media (prefers-reduced-motion: reduce) {
  .split__hit,
  .shot {
    animation: none;
  }
}
</style>

<script setup>
import { computed, ref } from 'vue'
import { seasonLabel } from '../lib/season'

// The player as a collectible trading card: an archetype read from how they
// actually pick, four trait meters, and a foil that follows the pointer
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
  // The week or month shown instead of the season, if any
  period: {
    type: String,
    default: null,
  },
  // Players with this many graded picks set the league norm
  minPicks: {
    type: Number,
    default: 50,
  },
  // get_league_traits rows: every player's traits for the same scope
  league: {
    type: Array,
    default: () => [],
  },
})

const name = computed(
  () => props.user.full_name || props.user.username || 'Unknown',
)

// Each trait, what a high and a low reading make you, and how to show it
const TRAITS = [
  {
    key: 'eye',
    label: 'Eye',
    hint: 'hit rate',
    high: ['The Oracle', 'Quietly right, again and again.'],
    low: ['The Optimist', 'Believes every pick is the one.'],
  },
  {
    key: 'nerve',
    label: 'Nerve',
    hint: 'nights with a max-confidence call',
    high: ['The Gambler', 'Goes all in most nights.'],
    low: ['The Accountant', 'Keeps the 3s in the drawer.'],
  },
  {
    key: 'homer',
    label: 'Homer',
    hint: 'picks on the home team',
    high: ['The Homer', 'Trusts the home crowd. Every time.'],
    low: ['The Road Warrior', 'Loves a team in a hostile building.'],
  },
  {
    key: 'heat',
    label: 'Heat',
    hint: 'longest run of correct picks',
    scale: value => Math.min(100, (value / 20) * 100),
    show: value => value,
    high: ['The Streaker', "When it's on, it's on."],
    low: ['The Slow Burner', 'Steady. Never streaky.'],
  },
  {
    key: 'loyalty',
    label: 'Loyal',
    hint: 'picks on their five favourite teams',
    high: ['The Loyalist', 'Rides with the same few teams.'],
    low: ['The Tourist', 'Picks across the whole league.'],
  },
  {
    key: 'grind',
    label: 'Grind',
    hint: 'game nights with a pick',
    high: ['The Regular', 'Never misses a night.'],
    low: ['The Drop-In', 'Shows up when it counts.'],
  },
  {
    key: 'lone',
    label: 'Lone',
    hint: 'picks against most of the league',
    high: ['The Lone Wolf', 'Happy to stand alone.'],
    low: ['The Crowd Pleaser', 'Goes where the crowd goes.'],
  },
  {
    key: 'clutch',
    label: 'Clutch',
    hint: 'hit rate on confidence 3',
    high: ['The Closer', 'When it is a 3, it cashes.'],
    low: ['The Overthinker', 'The big calls wobble.'],
  },
]

const me = computed(() =>
  props.league.find(row => row.user_id === props.user.user_id),
)

// How far each trait sits from the league average, in standard deviations
const readings = computed(() => {
  if (!me.value) return []
  const field = props.league.filter(
    row => row.picks >= props.minPicks || row.user_id === me.value.user_id,
  )
  return TRAITS.map(trait => {
    const values = field
      .map(row => row[trait.key])
      .filter(value => value !== null && value !== undefined)
      .map(Number)
    const value = me.value[trait.key]
    if (value === null || value === undefined || values.length < 2) return null
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    const sd = Math.sqrt(
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length,
    )
    const scale = trait.scale || (v => v)
    return {
      ...trait,
      value: Number(value),
      shown: Math.round((trait.show || scale)(Number(value))),
      fill: Math.round(scale(Number(value))),
      average: Math.round(scale(mean)),
      z: sd > 0 ? (Number(value) - mean) / sd : 0,
    }
  })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
})

// Named after the trait where the player stands out most, either way
const archetype = computed(() => {
  const top = readings.value[0]
  if (!top || Math.abs(top.z) < 0.25) {
    return me.value
      ? { title: 'The Grinder', line: 'Shows up. Picks. Repeats.' }
      : { title: 'The Rookie', line: 'No graded picks yet. Watch this space.' }
  }
  const [title, line] = top.z > 0 ? top.high : top.low
  return { title, line, key: top.key }
})

const meters = computed(() => readings.value.slice(0, 4))

const rarity = computed(() => {
  const eye = Number(me.value?.eye ?? 0)
  if (props.rank === 1 || eye >= 68) return 'legendary'
  if (eye >= 62) return 'rare'
  return 'common'
})

// ─── Tilt and foil ───

const tilt = ref({ rx: 0, ry: 0, mx: 50, my: 50, active: false })
const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function onMove(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  tilt.value = {
    rx: reduceMotion ? 0 : (0.5 - y) * 14,
    ry: reduceMotion ? 0 : (x - 0.5) * 18,
    mx: Math.round(x * 100),
    my: Math.round(y * 100),
    active: true,
  }
}

function onLeave() {
  tilt.value = { rx: 0, ry: 0, mx: 50, my: 50, active: false }
}

const cardStyle = computed(() => ({
  '--rx': `${tilt.value.rx}deg`,
  '--ry': `${tilt.value.ry}deg`,
  '--mx': `${tilt.value.mx}%`,
  '--my': `${tilt.value.my}%`,
}))

const stats = computed(() => [
  { label: 'Pts', value: props.user.total_score },
  { label: 'Hit', value: `${Number(props.user.accuracy).toFixed(1)}%` },
  { label: 'Picks', value: props.user.total_picks },
])
</script>

<template>
  <div
    class="scene reveal"
    @pointermove="onMove"
    @pointerleave="onLeave"
    @pointercancel="onLeave"
  >
    <article
      class="card"
      :class="[`is-${rarity}`, { 'is-active': tilt.active }]"
      :style="cardStyle"
      :aria-label="`${name}, ${archetype.title}: ${archetype.line}`"
    >
      <header class="card__top">
        <span class="card__rarity">
          {{ rarity === 'legendary' ? '★' : rarity === 'rare' ? '✦' : '●' }}
          {{ rarity }}
        </span>
        <span class="num">{{ period || seasonLabel(season) }}</span>
        <span v-if="rank" class="card__rank num">#{{ rank }}</span>
      </header>

      <div class="card__photo">
        <img
          v-if="user.avatar_url"
          :src="user.avatar_url"
          :alt="`${name}'s photo`"
          referrerpolicy="no-referrer"
        />
        <span v-else class="card__initial">{{ name.charAt(0) }}</span>
        <span class="card__halftone" aria-hidden="true" />
        <span class="card__name">{{ name }}</span>
      </div>

      <p class="card__type">{{ archetype.title }}</p>
      <p class="card__line">{{ archetype.line }}</p>

      <ul class="traits">
        <li
          v-for="meter in meters"
          :key="meter.key"
          :class="{ 'is-defining': meter.key === archetype.key }"
          :title="`${meter.label}: ${meter.hint}. League average ${meter.average}.`"
        >
          <span class="traits__label">{{ meter.label }}</span>
          <span class="traits__bar" aria-hidden="true">
            <span
              v-for="n in 10"
              :key="n"
              :class="{ 'is-on': n <= Math.round(meter.fill / 10) }"
            />
            <!-- Where the league sits -->
            <i class="traits__avg" :style="{ left: `${meter.average}%` }" />
          </span>
          <span class="traits__value num">{{ meter.shown }}</span>
        </li>
      </ul>
      <p v-if="meters.length" class="traits__key">
        <i aria-hidden="true" /> league average
      </p>

      <footer class="card__foot">
        <span v-for="stat in stats" :key="stat.label">
          <strong class="num">{{ stat.value }}</strong> {{ stat.label }}
        </span>
      </footer>

      <span class="card__foil" aria-hidden="true" />
      <span class="card__glare" aria-hidden="true" />
    </article>
  </div>
</template>

<style scoped>
/* The card is printed stock: the same cream and ink in both themes */
.scene {
  perspective: 1000px;
  display: flex;
  justify-content: center;
  touch-action: pan-y;
}
.card {
  --paper: #fbf8f1;
  --ink: #16130f;
  --accent: #d03808;
  --edge: #b88a1e;
  position: relative;
  width: min(100%, 20rem);
  padding: 0.85rem;
  overflow: hidden;
  border: 1.5px solid var(--ink);
  border-radius: 10px;
  background: var(--paper);
  color: var(--ink);
  box-shadow:
    0 0 0 5px var(--paper),
    0 0 0 6.5px var(--ink),
    10px 14px 0 rgb(var(--c-shadow));
  transform: rotateX(var(--rx)) rotateY(var(--ry));
  transform-style: preserve-3d;
  transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.card.is-active {
  transition: transform 0.08s linear;
}

.card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.card__rarity {
  padding: 0.1rem 0.4rem;
  background: var(--ink);
  color: var(--paper);
}
.is-legendary .card__rarity {
  background: linear-gradient(90deg, #b88a1e, #f3d57a, #b88a1e);
  color: var(--ink);
}
.card__rank {
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 1.3rem;
  letter-spacing: 0;
}

.card__photo {
  position: relative;
  aspect-ratio: 1 / 1;
  margin-top: 0.6rem;
  overflow: hidden;
  border: 1.5px solid var(--ink);
  background: var(--accent);
}
.card__photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: contrast(1.1) saturate(1.1);
}
.card__initial {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 9rem;
  color: var(--paper);
}
/* Printed-dot texture over the photo */
.card__halftone {
  position: absolute;
  inset: 0;
  background: radial-gradient(rgb(0 0 0 / 0.22) 1px, transparent 1.4px) 0 0 /
    5px 5px;
  mix-blend-mode: multiply;
}
.card__name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0.35rem 0.6rem;
  background: var(--ink);
  color: var(--paper);
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 1.6rem;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card__type {
  margin-top: 0.7rem;
  font-family: 'Permanent Marker', cursive;
  font-size: 1.55rem;
  line-height: 1.05;
  color: var(--accent);
  transform: rotate(-1.5deg);
}
.card__line {
  margin-top: 0.2rem;
  font-size: 0.8125rem;
  font-style: italic;
  font-weight: 500;
}

.traits {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.75rem;
  padding-top: 0.65rem;
  border-top: 1.5px dashed rgb(22 19 15 / 0.35);
}
.traits li {
  display: grid;
  grid-template-columns: 3.4rem 1fr 1.8rem;
  align-items: center;
  gap: 0.5rem;
}
.traits__label {
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.traits__bar {
  position: relative;
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 2px;
}
.traits__bar > span {
  height: 9px;
  border: 1px solid rgb(22 19 15 / 0.35);
}
.traits__bar > span.is-on {
  background: var(--ink);
  border-color: var(--ink);
}
.traits__avg {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  margin-left: -1px;
  background: var(--accent);
}
.traits li.is-defining .traits__label {
  color: var(--accent);
}
.traits li.is-defining .traits__bar > span.is-on {
  background: var(--accent);
  border-color: var(--accent);
}
.traits__key {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.4rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgb(22 19 15 / 0.6);
}
.traits__key i {
  width: 2px;
  height: 10px;
  background: var(--accent);
}
.traits__value {
  text-align: right;
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 1.05rem;
}

.card__foot {
  display: flex;
  justify-content: space-between;
  margin-top: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1.5px solid var(--ink);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.card__foot strong {
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-size: 1rem;
  letter-spacing: 0;
}

/* Foil: rainbow bands that slide with the pointer, plus a soft glare */
.card__foil,
.card__glare {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
}
.card__foil {
  background: repeating-linear-gradient(
    115deg,
    hsl(0 90% 65% / 0.55) 0%,
    hsl(50 95% 60% / 0.55) 6%,
    hsl(140 80% 55% / 0.55) 12%,
    hsl(200 90% 60% / 0.55) 18%,
    hsl(280 85% 65% / 0.55) 24%,
    hsl(0 90% 65% / 0.55) 30%
  );
  background-size: 300% 300%;
  background-position: var(--mx) var(--my);
  mix-blend-mode: color-burn;
  opacity: 0.12;
  transition: opacity 0.3s ease;
  animation: drift 7s ease-in-out infinite alternate;
}
.card.is-active .card__foil {
  animation: none;
  opacity: 0.32;
}
.is-rare .card__foil {
  opacity: 0.22;
}
.is-legendary .card__foil {
  opacity: 0.28;
  mix-blend-mode: color-dodge;
}
.card.is-common .card__foil {
  opacity: 0.06;
}
.card.is-common.is-active .card__foil {
  opacity: 0.14;
}
.card__glare {
  background: radial-gradient(
    circle at var(--mx) var(--my),
    rgb(255 255 255 / 0.65),
    transparent 45%
  );
  mix-blend-mode: soft-light;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.card.is-active .card__glare {
  opacity: 1;
}
@keyframes drift {
  from {
    background-position: 0% 30%;
  }
  to {
    background-position: 100% 70%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .card__foil {
    animation: none;
  }
}
</style>

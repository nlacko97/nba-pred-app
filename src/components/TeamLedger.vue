<script setup>
import { computed, ref } from 'vue'
import { getTeamImageUrl } from '../lib/teamLogo'

// Every team as a sticker on the sheet, tinted by how well the player reads
// them: picking a team, or picking against it (taking its opponent)
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

const view = ref('for') // 'for' | 'against'
const selected = ref(null)

const pct = (correct, picks) => (picks ? (correct / picks) * 100 : null)

const teams = computed(() =>
  (props.report?.teams || []).map(team => {
    const forLine = {
      picks: team.for_picks,
      correct: team.for_correct,
      rate: pct(team.for_correct, team.for_picks),
    }
    const againstLine = {
      picks: team.against_picks,
      correct: team.against_correct,
      rate: pct(team.against_correct, team.against_picks),
    }
    return { ...team, for: forLine, against: againstLine }
  }),
)

// Best reads first, by a hit rate pulled toward 50% for small samples, so
// 27–3 outranks 1–0; teams never picked this way go last
const steadyRate = line => ((line.correct + 2.5) / (line.picks + 5)) * 100

const tiles = computed(() =>
  [...teams.value].sort((a, b) => {
    const x = a[view.value]
    const y = b[view.value]
    if (!x.picks || !y.picks) return y.picks - x.picks
    return steadyRate(y) - steadyRate(x) || y.picks - x.picks
  }),
)

// Red below 50%, green above: stronger the further from a coin flip, and
// faint until there are about 10 picks to go on
function tint(line) {
  if (!line.picks) return null
  const strength = Math.min(1, Math.abs(line.rate - 50) / 40)
  const sample = Math.min(1, line.picks / 10)
  const alpha = ((0.08 + strength * 0.55) * (0.35 + 0.65 * sample)).toFixed(2)
  const tone = line.rate >= 50 ? '--c-win' : '--c-loss'
  return `rgb(var(${tone}) / ${alpha})`
}

const record = line => `${line.correct}–${line.picks - line.correct}`

const qualified = computed(() =>
  teams.value.filter(team => team[view.value].picks >= MIN_PICKS),
)

const callouts = computed(() => {
  const list = qualified.value
  if (!list.length) return []
  const byRate = [...list].sort(
    (a, b) =>
      steadyRate(b[view.value]) - steadyRate(a[view.value]) ||
      b[view.value].picks - a[view.value].picks,
  )
  const best = byRate[0]
  const worst = byRate[byRate.length - 1]
  const picking = view.value === 'for'
  const you = props.isMe ? 'you' : 'they'
  const out = [
    {
      key: 'best',
      title: picking ? 'Trusts' : 'Has their number',
      team: best,
      line: best[view.value],
      text: picking ? `when ${you} pick them` : `picking against them`,
    },
  ]
  if (worst !== best) {
    out.push({
      key: 'worst',
      title: picking ? 'Blind spot' : `Can't read them`,
      team: worst,
      line: worst[view.value],
      text: picking ? `when ${you} pick them` : `picking against them`,
    })
  }
  return out
})

const detail = computed(() =>
  selected.value ? teams.value.find(team => team.id === selected.value) : null,
)

const toggle = id => {
  selected.value = selected.value === id ? null : id
}

// Home/away and favourite/underdog as two-sided bars
const splits = computed(() => {
  const out = []
  const sides = props.report?.sides
  if (sides && sides.home.picks + sides.away.picks > 0) {
    out.push({
      key: 'sides',
      left: { label: 'Home teams', ...sides.home },
      right: { label: 'Road teams', ...sides.away },
    })
  }
  const odds = props.report?.odds
  if (odds && odds.favorite.picks + odds.underdog.picks > 0) {
    out.push({
      key: 'odds',
      left: { label: 'Favourites', ...odds.favorite },
      right: { label: 'Underdogs', ...odds.underdog },
    })
  }
  return out.map(split => {
    const total = split.left.picks + split.right.picks
    return {
      ...split,
      leftShare: Math.round((split.left.picks / total) * 100),
      leftRate: pct(split.left.correct, split.left.picks),
      rightRate: pct(split.right.correct, split.right.picks),
    }
  })
})

const rateText = rate => (rate === null ? '–' : `${Math.round(rate)}%`)
</script>

<template>
  <section class="sheet reveal p-5 sm:p-6">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="display text-3xl sm:text-4xl">Team ledger</h2>
        <p class="label mt-1.5 !tracking-[0.14em]">
          {{
            view === 'for'
              ? 'Record when picking each team'
              : 'Record when picking against each team'
          }}
        </p>
      </div>
      <div class="seg" role="group" aria-label="Ledger view">
        <button
          type="button"
          :class="{ 'is-on': view === 'for' }"
          :aria-pressed="view === 'for'"
          @click="view = 'for'"
        >
          Picking them
        </button>
        <button
          type="button"
          :class="{ 'is-on': view === 'against' }"
          :aria-pressed="view === 'against'"
          @click="view = 'against'"
        >
          Picking against
        </button>
      </div>
    </header>

    <!-- Callouts -->
    <div v-if="callouts.length" class="mt-5 grid gap-3 sm:grid-cols-2">
      <div
        v-for="call in callouts"
        :key="call.key"
        class="callout"
        :class="`callout--${call.key}`"
      >
        <span class="callout__title">{{ call.title }}</span>
        <span class="puck">
          <img
            :src="getTeamImageUrl(call.team.abbreviation)"
            :alt="`${call.team.name} logo`"
          />
        </span>
        <span class="min-w-0">
          <span class="display num block text-4xl leading-none">{{
            record(call.line)
          }}</span>
          <span class="mt-1 block text-sm">
            <strong>{{ call.team.abbreviation }}</strong> · {{ call.text }}
          </span>
        </span>
      </div>
    </div>
    <p v-else-if="report" class="kicker mt-5">
      Needs {{ MIN_PICKS }} picks on a team before calling a favourite.
    </p>

    <!-- The sheet of teams -->
    <ul class="grid-teams mt-5">
      <li v-for="team in tiles" :key="team.id">
        <button
          type="button"
          class="tile"
          :class="{
            'is-empty': !team[view].picks,
            'is-selected': selected === team.id,
          }"
          :style="{ '--tint': tint(team[view]) }"
          :aria-pressed="selected === team.id"
          :aria-label="`${team.name}: ${record(team[view])}${team[view].picks ? `, ${Math.round(team[view].rate)}%` : ''}`"
          @click="toggle(team.id)"
        >
          <img
            class="tile__logo"
            :src="getTeamImageUrl(team.abbreviation)"
            alt=""
          />
          <span class="tile__abbr">{{ team.abbreviation }}</span>
          <span class="tile__record num">{{
            team[view].picks ? record(team[view]) : '—'
          }}</span>
        </button>
      </li>
    </ul>

    <div v-if="detail" class="detail" role="status">
      <img
        class="h-10 w-10"
        :src="getTeamImageUrl(detail.abbreviation)"
        :alt="`${detail.name} logo`"
      />
      <div class="min-w-0 flex-1">
        <p class="display text-2xl">{{ detail.name }}</p>
        <p class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span
            >Picking them
            <strong class="num">{{ record(detail.for) }}</strong>
            <span class="ml-1 text-muted">{{ rateText(detail.for.rate) }}</span>
          </span>
          <span
            >Against
            <strong class="num">{{ record(detail.against) }}</strong>
            <span class="ml-1 text-muted">{{
              rateText(detail.against.rate)
            }}</span>
          </span>
          <span
            ><strong class="num">{{ detail.points }}</strong>
            <span class="ml-1 text-muted">pts from their games</span></span
          >
        </p>
      </div>
    </div>

    <!-- Splits -->
    <div
      v-if="splits.length"
      class="mt-6 grid gap-5"
      :class="{ 'md:grid-cols-2': splits.length > 1 }"
    >
      <div v-for="split in splits" :key="split.key">
        <div class="mb-1.5 flex justify-between gap-3">
          <span class="label"
            >{{ split.left.label }} ·
            <span class="num text-ink">{{ rateText(split.leftRate) }}</span>
            hit</span
          >
          <span class="label text-right"
            ><span class="num text-ink">{{ rateText(split.rightRate) }}</span>
            hit · {{ split.right.label }}</span
          >
        </div>
        <div class="split">
          <span class="split__left" :style="{ width: `${split.leftShare}%` }">
            <span v-if="split.leftShare >= 18" class="num"
              >{{ split.left.picks }} picks</span
            >
          </span>
          <span class="split__right">
            <span v-if="split.leftShare <= 82" class="num"
              >{{ split.right.picks }} picks</span
            >
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.callout {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 1.1rem 1rem 0.9rem;
  border: 1.5px solid rgb(var(--c-edge));
  background: rgb(var(--c-paper));
}
.callout--best {
  box-shadow: 4px 4px 0 rgb(var(--c-win));
}
.callout--worst {
  box-shadow: 4px 4px 0 rgb(var(--c-loss));
}
.callout__title {
  position: absolute;
  top: -0.7rem;
  left: 0.75rem;
  padding: 0.05rem 0.45rem;
  background: rgb(var(--c-ink));
  color: rgb(var(--c-paper));
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transform: rotate(-2deg);
}
.puck {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #fbf8f1;
  border: 1.5px solid rgb(var(--c-edge));
  padding: 8px;
}
.puck img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.grid-teams {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(66px, 1fr));
  gap: 6px;
}
.tile {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.55rem 0.25rem 0.45rem;
  border: 1.5px solid rgb(var(--c-ink) / 0.2);
  background: var(--tint, transparent);
  transition:
    transform 0.15s ease,
    border-color 0.15s ease;
}
.tile:hover {
  transform: translateY(-2px);
  border-color: rgb(var(--c-ink));
}
.tile.is-selected {
  border-color: rgb(var(--c-ink));
  box-shadow: 3px 3px 0 rgb(var(--c-shadow));
}
.tile.is-empty {
  border-style: dashed;
}
.tile.is-empty .tile__logo {
  filter: grayscale(1);
  opacity: 0.35;
}
.tile__logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.tile__abbr {
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}
.tile__record {
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 1.15rem;
  line-height: 1;
}
.tile.is-empty .tile__record {
  color: rgb(var(--c-muted));
}

.detail {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-top: 0.85rem;
  padding: 0.85rem 1rem;
  border: 1.5px solid rgb(var(--c-edge));
  background: rgb(var(--c-paper));
}

.split {
  display: flex;
  height: 24px;
  border: 1.5px solid rgb(var(--c-edge));
  font-size: 0.75rem;
  font-weight: 700;
}
.split > span {
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  white-space: nowrap;
  overflow: hidden;
}
.split__left {
  background: rgb(var(--c-ink));
  color: rgb(var(--c-paper));
}
.split__right {
  flex: 1;
  justify-content: flex-end;
  background: repeating-linear-gradient(
    -45deg,
    rgb(var(--c-ink) / 0.14) 0 2px,
    transparent 2px 6px
  );
}
</style>

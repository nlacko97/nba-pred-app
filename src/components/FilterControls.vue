<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import {
  CURRENT_SEASON,
  FIRST_SEASON,
  gameDayIso,
  periodLabel,
  periodRange,
  seasonLabel,
  weekNumber,
} from '@/lib/season'

// The standings scope as a filled-in line on the pick sheet:
//   Who's winning [the regular season] of [2025–26]?
//   Who's winning [‹ week 3 ›] of [2025–26]?  Nov 2–8 · Live
// Each blank opens a small menu; the arrows step through weeks or months.

const props = defineProps({
  mode: {
    type: String,
    default: 'season',
  },
  selectedSeason: {
    type: String,
    required: true,
  },
  isPostseason: {
    type: Boolean,
    required: true,
  },
  periodStart: {
    type: String,
    default: null,
  },
  openingNight: {
    type: String,
    default: null,
  },
  periodNav: {
    type: Object,
    default: () => ({ previous: null, next: null }),
  },
})

const emit = defineEmits(['select-scope', 'select-season', 'step'])

const scopes = [
  { value: 'regular', label: 'The regular season' },
  { value: 'post', label: 'The postseason' },
  { value: 'week', label: 'A week', hint: 'Mon–Sun' },
  { value: 'month', label: 'A month' },
]

const seasons = Array.from(
  { length: CURRENT_SEASON - FIRST_SEASON + 1 },
  (_, i) => CURRENT_SEASON - i,
).map(season => ({ value: String(season), label: seasonLabel(season) }))

const isPeriod = computed(() => props.mode !== 'season')

const currentScope = computed(() => {
  if (isPeriod.value) return props.mode
  return props.isPostseason ? 'post' : 'regular'
})

const scopeText = computed(() => {
  if (props.mode === 'week' && props.periodStart) {
    return props.openingNight
      ? `week ${weekNumber(props.periodStart, props.openingNight)}`
      : 'this week'
  }
  if (props.mode === 'month' && props.periodStart) {
    return new Date(`${props.periodStart}T00:00:00Z`).toLocaleDateString(
      'en-US',
      { timeZone: 'UTC', month: 'long' },
    )
  }
  return props.isPostseason ? 'the postseason' : 'the regular season'
})

const today = gameDayIso()
const range = computed(() =>
  isPeriod.value && props.periodStart
    ? periodRange(props.mode, props.periodStart)
    : null,
)
const dates = computed(() => {
  if (!range.value) return null
  return props.mode === 'week'
    ? periodLabel('week', props.periodStart).split(' · ').pop()
    : periodLabel('month', props.periodStart)
})
const isLive = computed(
  () => !!range.value && range.value.start <= today && range.value.end >= today,
)
const isUpcoming = computed(() => !!range.value && range.value.start > today)

// ─── Menus ───

const open = ref(null) // 'scope' | 'season' | null
const alignRight = ref(false)
const root = ref(null)

function onDocumentPointer(event) {
  if (root.value && !root.value.contains(event.target)) close()
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    const which = open.value
    close()
    root.value?.querySelector(`[data-blank="${which}"]`)?.focus()
  }
}

async function toggle(which, event) {
  if (open.value === which) {
    close()
    return
  }
  // Keep the menu on screen: open leftwards from blanks on the right half
  const rect = event.currentTarget.getBoundingClientRect()
  alignRight.value = rect.left > window.innerWidth / 2
  open.value = which
  document.addEventListener('pointerdown', onDocumentPointer)
  document.addEventListener('keydown', onKeydown)
  await nextTick()
  root.value
    ?.querySelector('.menu [aria-checked="true"], .menu button')
    ?.focus()
}

function close() {
  open.value = null
  document.removeEventListener('pointerdown', onDocumentPointer)
  document.removeEventListener('keydown', onKeydown)
}

onBeforeUnmount(close)

function moveFocus(event, step) {
  const items = [
    ...event.currentTarget.closest('.menu').querySelectorAll('button'),
  ]
  const index = items.indexOf(event.target)
  items[(index + step + items.length) % items.length]?.focus()
}

function chooseScope(value) {
  close()
  if (value !== currentScope.value) emit('select-scope', value)
}

function chooseSeason(value) {
  close()
  if (value !== props.selectedSeason) emit('select-season', value)
}
</script>

<template>
  <div ref="root" class="sentence">
    <p class="sentence__line">
      <span class="sentence__ink">Who's winning</span>

      <span class="blank-group">
        <button
          v-if="isPeriod"
          type="button"
          class="nudge"
          :disabled="!periodNav.previous"
          :aria-label="`Previous ${mode}`"
          @click="emit('step', 'previous')"
        >
          ‹
        </button>
        <span class="blank-wrap">
          <button
            type="button"
            class="blank"
            data-blank="scope"
            aria-haspopup="menu"
            :aria-expanded="open === 'scope'"
            :aria-label="`Standings for ${scopeText}. Change`"
            @click="toggle('scope', $event)"
          >
            <span :key="scopeText" class="blank__value">{{ scopeText }}</span>
            <span class="blank__caret" aria-hidden="true">▾</span>
          </button>
          <ul
            v-if="open === 'scope'"
            class="menu"
            :class="{ 'menu--right': alignRight }"
            role="menu"
            aria-label="Standings for"
          >
            <li v-for="scope in scopes" :key="scope.value" role="none">
              <button
                type="button"
                role="menuitemradio"
                :aria-checked="scope.value === currentScope"
                @click="chooseScope(scope.value)"
                @keydown.down.prevent="moveFocus($event, 1)"
                @keydown.up.prevent="moveFocus($event, -1)"
              >
                <span>{{ scope.label }}</span>
                <span v-if="scope.value === currentScope" class="menu__tick"
                  >✓</span
                >
                <span v-else-if="scope.hint" class="menu__hint">{{
                  scope.hint
                }}</span>
              </button>
            </li>
          </ul>
        </span>
        <button
          v-if="isPeriod"
          type="button"
          class="nudge"
          :disabled="!periodNav.next"
          :aria-label="`Next ${mode}`"
          @click="emit('step', 'next')"
        >
          ›
        </button>
      </span>

      <span class="sentence__ink">of</span>

      <!-- The question mark stays with the season when the line wraps -->
      <span class="blank-group">
        <span class="blank-wrap">
          <button
            type="button"
            class="blank"
            data-blank="season"
            aria-haspopup="menu"
            :aria-expanded="open === 'season'"
            :aria-label="`Season ${seasonLabel(selectedSeason)}. Change`"
            @click="toggle('season', $event)"
          >
            <span :key="selectedSeason" class="blank__value num">{{
              seasonLabel(selectedSeason)
            }}</span>
            <span class="blank__caret" aria-hidden="true">▾</span>
          </button>
          <ul
            v-if="open === 'season'"
            class="menu"
            :class="{ 'menu--right': alignRight }"
            role="menu"
            aria-label="Season"
          >
            <li v-for="season in seasons" :key="season.value" role="none">
              <button
                type="button"
                role="menuitemradio"
                :aria-checked="season.value === selectedSeason"
                @click="chooseSeason(season.value)"
                @keydown.down.prevent="moveFocus($event, 1)"
                @keydown.up.prevent="moveFocus($event, -1)"
              >
                <span class="num">{{ season.label }}</span>
                <span v-if="season.value === selectedSeason" class="menu__tick"
                  >✓</span
                >
              </button>
            </li>
          </ul>
        </span>
        <span class="sentence__ink">?</span>
      </span>
    </p>

    <p v-if="dates" class="sentence__meta">
      <span class="num">{{ dates }}</span>
      <span v-if="isLive" class="live"><span class="live__dot" />Live</span>
      <span v-else-if="isUpcoming" class="label !text-ink">Up next</span>
    </p>
  </div>
</template>

<style scoped>
/* Above the stat tiles below, whose reveal animation stacks them on top */
.sentence {
  position: relative;
  z-index: 20;
}
.sentence__line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.15em 0.45em;
  font-size: clamp(1.35rem, 4.2vw, 2rem);
  line-height: 1.5;
}
.sentence__ink {
  color: rgb(var(--c-muted));
  font-weight: 500;
}

/* A blank on the sheet, filled in by hand */
.blank-group {
  display: inline-flex;
  align-items: baseline;
  gap: 0.2em;
}
.blank-wrap {
  position: relative;
  display: inline-flex;
}
.blank {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3em;
  padding: 0 0.15em 0.05em;
  border-bottom: 2px dashed rgb(var(--c-ink) / 0.4);
  color: rgb(var(--c-accent));
  font-family: 'Permanent Marker', 'Big Shoulders Display', cursive;
  font-size: 1.12em;
  line-height: 1.15;
  white-space: nowrap;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}
.blank:hover,
.blank[aria-expanded='true'] {
  border-bottom-style: solid;
  border-color: rgb(var(--c-ink));
  background: rgb(var(--c-accent) / 0.08);
}
.blank:focus-visible,
.nudge:focus-visible,
.menu button:focus-visible {
  outline: 2px solid rgb(var(--c-accent));
  outline-offset: 2px;
}
.blank__value {
  display: inline-block;
  transform: rotate(-1.5deg);
  animation: write-in 0.5s cubic-bezier(0.3, 0.7, 0.3, 1) both;
}
.blank__caret {
  font-family: 'Archivo', sans-serif;
  font-size: 0.5em;
  color: rgb(var(--c-muted));
  transform: translateY(-0.15em);
}
@keyframes write-in {
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .blank__value {
    animation: none;
  }
}

/* Nudge arrows for weeks and months */
.nudge {
  align-self: center;
  width: 1.6em;
  height: 1.6em;
  border: 1.5px solid rgb(var(--c-edge));
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 0.75em;
  line-height: 1;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}
.nudge:not(:disabled):hover {
  background: rgb(var(--c-ink));
  color: rgb(var(--c-paper));
}
.nudge:disabled {
  border-color: rgb(var(--c-ink) / 0.15);
  color: rgb(var(--c-muted) / 0.4);
  cursor: not-allowed;
}
/* Small to look at, 44px to tap */
.nudge {
  position: relative;
}
.nudge::before {
  content: '';
  position: absolute;
  inset: -0.6rem;
}

/* The menu: a torn-off slip with a stamp on the current choice */
.menu {
  position: absolute;
  top: calc(100% + 0.6rem);
  left: 0;
  z-index: 30;
  min-width: 15rem;
  max-width: calc(100vw - 2rem);
  padding: 0.35rem;
  border: 1.5px solid rgb(var(--c-edge));
  background: rgb(var(--c-card));
  box-shadow: 6px 6px 0 rgb(var(--c-shadow));
  font-size: 1rem;
  line-height: 1.3;
  animation: menu-in 0.18s ease-out both;
}
.menu--right {
  left: auto;
  right: 0;
}
.menu button {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 40px;
  padding: 0.5rem 0.75rem;
  text-align: left;
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 800;
  font-size: 1.2rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.menu li + li button {
  border-top: 1px dashed rgb(var(--c-ink) / 0.2);
}
.menu button:hover {
  background: rgb(var(--c-ink));
  color: rgb(var(--c-paper));
}
.menu button[aria-checked='true'] {
  color: rgb(var(--c-accent));
}
.menu button[aria-checked='true']:hover {
  color: rgb(var(--c-paper));
}
.menu__tick {
  font-family: 'Permanent Marker', cursive;
  font-size: 1.1rem;
}
.menu__hint {
  font-family: 'Archivo', sans-serif;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: rgb(var(--c-muted));
}
@media (pointer: coarse) {
  .menu button {
    min-height: 44px;
  }
}
@keyframes menu-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

.sentence__meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.35rem;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgb(var(--c-muted));
}
.live {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: rgb(var(--c-accent));
}
.live__dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: currentColor;
  animation: pulse-dot 1.2s ease-in-out infinite;
}
</style>

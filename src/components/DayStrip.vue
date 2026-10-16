<script setup>
import { computed, ref, watch } from 'vue'
import { addDays, gameDayIso, weekStart as mondayOf } from '../lib/season'

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue'])

// Dates are 'YYYY-MM-DD' strings, matching the games store
const todayIso = gameDayIso()
const toUtcDate = iso => new Date(`${iso}T00:00:00Z`)

// Monday-first week containing the selected date, like the period standings
const weekStart = computed(() => mondayOf(props.modelValue))
const selectedIndex = computed(
  () => (toUtcDate(props.modelValue).getUTCDay() + 6) % 7,
)

const week = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(weekStart.value, i)
    const date = toUtcDate(iso)
    return {
      iso,
      dow: date.toLocaleDateString('en-US', {
        weekday: 'short',
        timeZone: 'UTC',
      }),
      day: date.getUTCDate(),
      isToday: iso === todayIso,
    }
  }),
)

const direction = ref('next')
watch(
  () => props.modelValue,
  (next, prev) => {
    direction.value = next > prev ? 'next' : 'prev'
  },
)

const select = iso => {
  if (iso && iso !== props.modelValue) emit('update:modelValue', iso)
}
</script>

<template>
  <div class="strip">
    <button
      type="button"
      class="strip__nav"
      aria-label="Previous day"
      @click="select(addDays(modelValue, -1))"
    >
      <svg
        class="h-4 w-4"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="square" d="M15 19l-7-7 7-7" />
      </svg>
    </button>

    <div class="strip__window">
      <Transition :name="`week-${direction}`">
        <div :key="weekStart" class="strip__week">
          <span
            class="strip__indicator"
            :style="{ transform: `translateX(${selectedIndex * 100}%)` }"
            aria-hidden="true"
          />
          <button
            v-for="(day, i) in week"
            :key="day.iso"
            type="button"
            class="strip__day"
            :class="{ 'is-selected': i === selectedIndex }"
            :aria-pressed="i === selectedIndex"
            :aria-label="day.iso"
            @click="select(day.iso)"
          >
            <span class="strip__dow">{{ day.dow }}</span>
            <span class="strip__num num">{{ day.day }}</span>
            <span class="strip__today" :class="{ 'opacity-0': !day.isToday }" />
          </button>
        </div>
      </Transition>
    </div>

    <button
      type="button"
      class="strip__nav"
      aria-label="Next day"
      @click="select(addDays(modelValue, 1))"
    >
      <svg
        class="h-4 w-4"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="square" d="M9 5l7 7-7 7" />
      </svg>
    </button>

    <label class="strip__nav strip__nav--cal" title="Jump to date">
      <svg
        class="h-4 w-4"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        viewBox="0 0 24 24"
      >
        <rect x="3.5" y="5" width="17" height="15.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </svg>
      <span class="sr-only">Jump to date</span>
      <input
        type="date"
        class="absolute inset-0 cursor-pointer opacity-0"
        :value="modelValue"
        @input="select($event.target.value)"
      />
    </label>
  </div>
</template>

<style scoped>
.strip {
  display: flex;
  align-items: stretch;
  gap: 4px;
  width: 100%;
}
@media (min-width: 1024px) {
  .strip {
    width: 480px;
  }
}
.strip__nav {
  position: relative;
  display: flex;
  width: 40px;
  min-height: 44px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1.5px solid rgb(var(--c-edge));
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}
.strip__nav:hover {
  background: rgb(var(--c-ink));
  color: rgb(var(--c-paper));
}
.strip__nav--cal {
  cursor: pointer;
  background: rgb(var(--c-ink));
  color: rgb(var(--c-paper));
}
.strip__nav--cal:focus-within {
  outline: 2px solid rgb(var(--c-accent));
  outline-offset: 2px;
}
.strip__nav--cal:hover {
  background: rgb(var(--c-accent-fill));
  color: #fff;
}

.strip__window {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  border: 1.5px solid rgb(var(--c-ink) / 0.15);
}
.strip__week {
  position: relative;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}
.strip__indicator {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: calc(100% / 7);
  background: rgb(var(--c-ink));
  transition: transform 0.4s cubic-bezier(0.3, 1.3, 0.5, 1);
}
.strip__day {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.5rem 0 0.4rem;
  transition: color 0.2s ease 0.12s;
}
.strip__day:not(.is-selected):hover {
  background: rgb(var(--c-ink) / 0.06);
}
.strip__day.is-selected {
  color: rgb(var(--c-paper));
}
.strip__dow {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.7;
}
.strip__num {
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 1.6rem;
  line-height: 1;
}
@media (min-width: 640px) {
  .strip__dow {
    font-size: 0.6875rem;
    letter-spacing: 0.18em;
  }
  .strip__num {
    font-size: 1.9rem;
  }
}
.strip__today {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: rgb(var(--c-accent));
}

/* Week-to-week slide */
.week-next-enter-active,
.week-next-leave-active,
.week-prev-enter-active,
.week-prev-leave-active {
  transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.week-next-leave-active,
.week-prev-leave-active {
  position: absolute;
  inset: 0;
}
.week-next-enter-from,
.week-prev-leave-to {
  transform: translateX(100%);
}
.week-next-leave-to,
.week-prev-enter-from {
  transform: translateX(-100%);
}
</style>

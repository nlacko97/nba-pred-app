<script setup>
import { computed } from 'vue'

// A streak told in words and dots: how long it is, what it's worth, and how
// far it is from the badge it leads to
const props = defineProps({
  kind: {
    type: String,
    required: true, // 'correct' | 'days'
  },
  current: {
    type: Number,
    default: 0,
  },
  best: {
    type: Number,
    default: 0,
  },
  target: {
    type: Number,
    required: true,
  },
  badgeName: {
    type: String,
    required: true,
  },
  // Iron Man is once a season; Hot Hand can be earned again
  earned: {
    type: Boolean,
    default: false,
  },
})

const copy = computed(() =>
  props.kind === 'correct'
    ? {
        unit: props.current === 1 ? 'correct pick' : 'correct picks',
        tail: 'in a row',
        empty: 'Last graded pick missed',
      }
    : {
        unit: props.current === 1 ? 'game day' : 'game days',
        tail: 'in a row with a pick',
        empty: 'No pick on the last game day',
      },
)

const filled = computed(() => Math.min(props.current, props.target))
const toGo = computed(() => Math.max(0, props.target - props.current))

const status = computed(() => {
  if (props.kind === 'days' && props.earned) return `${props.badgeName} earned`
  if (props.current >= props.target) return `${props.badgeName} run`
  if (!props.current) return copy.value.empty
  return `${toGo.value} more for ${props.badgeName}`
})
const isHot = computed(
  () =>
    props.current >= props.target || (props.kind === 'days' && props.earned),
)
</script>

<template>
  <div class="meter" :class="[`meter--${kind}`, { 'is-hot': isHot }]">
    <div class="flex items-end justify-between gap-3">
      <p class="min-w-0">
        <span class="meter__count display num">{{ current }}</span>
        <span class="meter__unit">
          {{ copy.unit }} <span class="text-muted">{{ copy.tail }}</span>
        </span>
      </p>
      <p class="label shrink-0 text-right">
        Best <span class="num text-ink">{{ best }}</span>
      </p>
    </div>

    <div
      class="meter__track"
      :style="{ '--n': target }"
      role="img"
      :aria-label="`${current} of ${target} toward ${badgeName}`"
    >
      <span
        v-for="n in target"
        :key="n"
        class="meter__cell"
        :class="{ 'is-on': n <= filled }"
        :style="{ '--d': `${n * 30}ms` }"
      />
    </div>

    <p class="meter__status">{{ status }}</p>
  </div>
</template>

<style scoped>
.meter {
  --tone: var(--c-accent);
  padding: 0.9rem 1rem 0.85rem;
  border: 1.5px solid rgb(var(--c-ink) / 0.2);
  background: rgb(var(--c-paper));
}
.meter--days {
  --tone: var(--c-court);
}
.meter.is-hot {
  border-color: rgb(var(--tone));
  box-shadow: 4px 4px 0 rgb(var(--tone));
}
.meter__count {
  font-size: 3rem;
  line-height: 0.85;
  color: rgb(var(--tone));
  margin-right: 0.35rem;
}
.meter__unit {
  font-weight: 700;
  font-size: 0.9rem;
}
.meter__track {
  display: grid;
  grid-template-columns: repeat(var(--n), minmax(0, 1fr));
  gap: 3px;
  margin-top: 0.75rem;
}
.meter__cell {
  height: 12px;
  border: 1.5px solid rgb(var(--c-ink) / 0.25);
}
.meter--days .meter__cell {
  height: 12px;
  border-width: 1px;
}
.meter__cell.is-on {
  background: rgb(var(--tone));
  border-color: rgb(var(--tone));
  animation: cell-pop 0.3s ease both;
  animation-delay: var(--d);
}
@keyframes cell-pop {
  from {
    transform: scaleY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .meter__cell.is-on {
    animation: none;
  }
}
.meter__status {
  margin-top: 0.55rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgb(var(--c-muted));
}
.meter.is-hot .meter__status {
  color: rgb(var(--tone));
}
</style>

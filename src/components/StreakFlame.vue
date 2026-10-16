<script setup>
import { computed } from 'vue'

// Flame + number: correct picks in a row (accent) or game days in a row
// with a pick (court blue, "d" suffix)
const props = defineProps({
  count: {
    type: Number,
    default: 0,
  },
  label: {
    type: String,
    required: true,
  },
  kind: {
    type: String,
    default: 'correct',
  },
  size: {
    type: String,
    default: 'sm',
  },
})

const isCold = computed(() => props.count === 0)
</script>

<template>
  <span
    class="flame"
    :class="[`flame--${kind}`, `flame--${size}`, { 'is-cold': isCold }]"
    :title="`${count} ${label}`"
    :aria-label="`${count} ${label}`"
    role="img"
  >
    <svg viewBox="0 0 16 20" aria-hidden="true">
      <path
        d="M8 0c.6 3.2 4.8 5.4 4.8 10.6A4.8 4.8 0 0 1 8 15.4a4.8 4.8 0 0 1-4.8-4.8c0-2.4 1.3-3.8 2.3-4.9.2 1.6.9 2.6 1.9 3C7.7 6 6.9 2.9 8 0Z"
        transform="translate(0 2.4)"
      />
    </svg>
    <span class="num"
      >{{ count }}<template v-if="kind === 'days'">d</template></span
    >
  </span>
</template>

<style scoped>
.flame {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}
.flame svg {
  fill: currentColor;
}
.flame--correct {
  color: rgb(var(--c-accent));
}
.flame--days {
  color: rgb(var(--c-court));
}
.flame.is-cold {
  color: rgb(var(--c-muted));
}
.flame--sm {
  font-size: 0.95rem;
}
.flame--sm svg {
  width: 10px;
  height: 13px;
}
.flame--lg {
  font-size: 2rem;
}
.flame--lg svg {
  width: 18px;
  height: 24px;
}
</style>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Number,
    default: 1,
    validator: value => value >= 1 && value <= 3,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  maxStars: {
    type: Number,
    default: 3,
  },
})

const emit = defineEmits(['update:modelValue'])

const hoverRating = ref(0)

const chips = computed(() =>
  Array.from({ length: props.maxStars }, (_, i) => i + 1),
)

const shownRating = computed(() => hoverRating.value || props.modelValue)

const levelLabel = computed(() => {
  switch (shownRating.value) {
    case 1:
      return 'Low'
    case 2:
      return 'Medium'
    case 3:
      return 'High'
    default:
      return 'Select'
  }
})

const handleMouseEnter = chip => {
  if (!props.disabled) hoverRating.value = chip
}

const handleMouseLeave = () => {
  hoverRating.value = 0
}

const handleClick = chip => {
  if (!props.disabled) emit('update:modelValue', chip)
}
</script>

<template>
  <div
    class="flex items-center gap-3"
    :class="{ 'opacity-60': disabled }"
    @mouseleave="handleMouseLeave"
  >
    <div class="flex flex-col leading-none">
      <span class="label">Confidence</span>
      <span class="mt-1 font-display text-lg font-extrabold uppercase">
        <span class="num text-accent">{{ shownRating }}×</span>
        {{ levelLabel }}
      </span>
    </div>

    <div
      class="flex items-center gap-1.5"
      role="radiogroup"
      aria-label="Confidence level"
    >
      <button
        v-for="chip in chips"
        :key="chip"
        type="button"
        role="radio"
        class="chip"
        :class="{
          'is-filled': chip <= shownRating,
          'is-preview': hoverRating && chip <= hoverRating,
        }"
        :aria-checked="modelValue === chip"
        :aria-label="`Confidence ${chip}`"
        :disabled="disabled"
        @mouseenter="handleMouseEnter(chip)"
        @focus="handleMouseEnter(chip)"
        @blur="handleMouseLeave"
        @click="handleClick(chip)"
      >
        <span class="num">{{ chip }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chip {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 1rem;
  color: rgb(var(--c-muted));
  border: 1.5px solid rgb(var(--c-ink) / 0.3);
  background: transparent;
  transition:
    transform 0.25s cubic-bezier(0.5, 1.8, 0.4, 1),
    background-color 0.15s ease,
    color 0.15s ease;
}
.chip::before {
  /* the dashed edge-spots of a casino chip */
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: inherit;
  border: 2px dashed transparent;
  transition: border-color 0.15s ease;
}
.chip:not(:disabled) {
  cursor: pointer;
}
.chip:not(:disabled):hover {
  transform: translateY(-3px);
}
.chip.is-filled {
  color: #fff;
  background: rgb(var(--c-accent-fill));
  border-color: rgb(var(--c-accent-fill));
  box-shadow: 0 3px 0 rgb(var(--c-ink) / 0.85);
}
.chip.is-filled::before {
  border-color: rgb(255 255 255 / 0.75);
}
.chip.is-preview {
  background: rgb(var(--c-accent-fill) / 0.85);
}
@media (pointer: coarse) {
  .chip {
    width: 44px;
    height: 44px;
  }
}
.chip:disabled {
  cursor: not-allowed;
}
</style>

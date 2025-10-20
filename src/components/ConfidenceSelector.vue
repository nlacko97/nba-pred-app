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

const stars = computed(() =>
  Array.from({ length: props.maxStars }, (_, i) => i + 1),
)

const confidenceBadge = computed(() => {
  const rating = hoverRating.value || props.modelValue
  switch (rating) {
    case 1:
      return {
        label: 'Conservative',
        color: 'from-blue-500 to-blue-600',
        light: 'bg-blue-50 text-blue-700',
      }
    case 2:
      return {
        label: 'Moderate',
        color: 'from-purple-500 to-purple-600',
        light: 'bg-purple-50 text-purple-700',
      }
    case 3:
      return {
        label: 'High Confidence',
        color: 'from-amber-500 to-amber-600',
        light: 'bg-amber-50 text-amber-700',
      }
    default:
      return {
        label: 'Select',
        color: 'from-gray-500 to-gray-600',
        light: 'bg-gray-50 text-gray-700',
      }
  }
})

const handleMouseEnter = starNumber => {
  if (!props.disabled) {
    hoverRating.value = starNumber
  }
}

const handleMouseLeave = () => {
  if (!props.disabled) {
    hoverRating.value = 0
  }
}

const handleClick = starNumber => {
  if (!props.disabled) {
    emit('update:modelValue', starNumber)
  }
}
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <div class="flex w-full justify-center">
      <span class="text-sm font-semibold text-gray-700 dark:text-gray-200"
        >Confidence</span
      >
    </div>

    <!-- Segmented control -->
    <div
      class="flex justify-center"
      role="radiogroup"
      aria-label="Confidence level"
    >
      <div
        class="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 p-1 bg-white dark:bg-gray-900 shadow-sm"
      >
        <button
          v-for="star in stars"
          :key="star"
          type="button"
          :aria-checked="(hoverRating || modelValue) === star"
          role="radio"
          :disabled="disabled"
          @mouseenter="handleMouseEnter(star)"
          @mouseleave="handleMouseLeave"
          @click="handleClick(star)"
          :class="[
            'px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-gray-900',
            disabled ? 'cursor-not-allowed opacity-60' : 'hover:shadow',
            (hoverRating || modelValue) === 1 && star === 1
              ? 'text-white bg-gradient-to-r from-blue-500 to-blue-600 shadow'
              : '',
            (hoverRating || modelValue) === 2 && star === 2
              ? 'text-white bg-gradient-to-r from-purple-500 to-purple-600 shadow'
              : '',
            (hoverRating || modelValue) === 3 && star === 3
              ? 'text-white bg-gradient-to-r from-amber-500 to-amber-600 shadow'
              : '',
            (hoverRating || modelValue) !== star
              ? 'text-gray-700 dark:text-gray-300'
              : '',
          ]"
        >
          <span class="inline-flex items-center gap-1">
            <span class="font-semibold tabular-nums">{{ star }}</span>
            <span class="text-amber-400">★</span>
            <span class="hidden sm:inline text-xs opacity-80">{{
              star === 1 ? 'Low' : star === 2 ? 'Medium' : 'High'
            }}</span>
          </span>
        </button>
      </div>
    </div>

    <!-- Descriptor badge -->
    <div
      :class="[
        'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-center',
        confidenceBadge.light,
        disabled ? 'opacity-50' : '',
      ]"
    >
      {{ confidenceBadge.label }}
    </div>
  </div>
</template>

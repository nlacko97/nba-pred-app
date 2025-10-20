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

const getStarClass = starNumber => {
  const isActive = starNumber <= (hoverRating.value || props.modelValue)
  return {
    'text-blue-400': starNumber === 1 && isActive && !props.disabled,
    'text-purple-400': starNumber === 2 && isActive && !props.disabled,
    'text-amber-400': starNumber === 3 && isActive && !props.disabled,
    'text-gray-200 dark:text-gray-700': !isActive || props.disabled,
    'cursor-pointer': !props.disabled,
    'cursor-not-allowed': props.disabled,
    'transition-all duration-200': true,
  }
}

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

    <div class="flex gap-3 justify-center">
      <button
        v-for="star in stars"
        :key="star"
        :class="getStarClass(star)"
        :disabled="disabled"
        @mouseenter="handleMouseEnter(star)"
        @mouseleave="handleMouseLeave"
        @click="handleClick(star)"
        class="text-5xl p-1 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 dark:focus:ring-offset-gray-900 rounded-lg transition-all duration-200"
        type="button"
      >
        ★
      </button>
    </div>

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

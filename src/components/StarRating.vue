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

const getStarClass = starNumber => {
  const isActive = starNumber <= (hoverRating.value || props.modelValue)
  return {
    'text-yellow-400': isActive && !props.disabled,
    'text-gray-300 dark:text-gray-600': !isActive || props.disabled,
    'cursor-pointer': !props.disabled,
    'cursor-not-allowed': props.disabled,
    'hover:scale-105': !props.disabled,
    'active:scale-95': !props.disabled,
    'transition-all duration-150': true,
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
  <div class="flex items-center space-x-2">
    <button
      v-for="star in stars"
      :key="star"
      :class="getStarClass(star)"
      :disabled="disabled"
      @mouseenter="handleMouseEnter(star)"
      @mouseleave="handleMouseLeave"
      @click="handleClick(star)"
      class="text-3xl p-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded"
      type="button"
    >
      ★
    </button>
    <span class="ml-3 text-sm font-medium text-gray-600 dark:text-gray-300">
      {{ modelValue }}/3
    </span>
  </div>
</template>

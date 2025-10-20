<script setup>
import { computed } from 'vue'

const props = defineProps({
  user: {
    type: Object,
    required: true,
  },
  rank: {
    type: Number,
    required: true,
  },
  isCurrentUser: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['click'])

const medalEmoji = computed(() => {
  const medals = ['🥇', '🥈', '🥉']
  return medals[props.rank - 1] || null
})

const getAccuracyGradientDashoffset = accuracy => {
  const circumference = 2 * Math.PI * 45
  return circumference - (accuracy / 100) * circumference
}
</script>

<template>
  <button
    @click="emit('click')"
    :class="[
      'w-full text-left transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 py-4 px-4 sm:px-6 border-b border-gray-200 dark:border-gray-700/50 last:border-b-0',
      isCurrentUser && 'bg-blue-50 dark:bg-gray-700/30',
    ]"
  >
    <div class="flex items-center gap-3 sm:gap-4">
      <!-- Rank Badge -->
      <div class="flex-shrink-0 w-8 text-center">
        <div v-if="medalEmoji" class="text-xl">
          {{ medalEmoji }}
        </div>
        <div v-else class="text-sm font-bold text-gray-500 dark:text-gray-400">
          #{{ rank }}
        </div>
      </div>

      <!-- Avatar -->
      <div class="flex-shrink-0">
        <img
          v-if="user.avatar_url"
          :src="user.avatar_url"
          :alt="`${user.username}'s avatar`"
          class="w-11 h-11 rounded-lg object-cover"
        />
        <div
          v-else
          class="w-11 h-11 rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm"
        >
          {{ user.username.charAt(0).toUpperCase() }}
        </div>
      </div>

      <!-- User Info -->
      <div class="flex-1 min-w-0">
        <h3
          class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate"
        >
          {{ user.full_name }}
        </h3>
        <p
          v-if="isCurrentUser"
          class="text-xs font-medium text-blue-700 dark:text-blue-400"
        >
          Your entry
        </p>
      </div>

      <!-- Stats - Desktop -->
      <div class="hidden md:flex items-center gap-8 flex-shrink-0">
        <!-- Score -->
        <div class="text-right">
          <div
            class="text-base font-bold text-gray-900 dark:text-white font-mono"
          >
            {{ user.total_score }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">Score</div>
        </div>

        <!-- Record -->
        <div class="text-right">
          <div
            class="text-base font-bold text-gray-900 dark:text-white font-mono"
          >
            {{ user.correct_picks }}-{{ user.total_picks - user.correct_picks }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">Record</div>
        </div>

        <!-- Accuracy Circle -->
        <div class="flex-shrink-0 w-20">
          <svg class="w-full h-auto" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              :stroke="
                user.accuracy >= 70
                  ? '#3b82f6'
                  : user.accuracy >= 50
                    ? '#f59e0b'
                    : '#ef4444'
              "
              stroke-width="2.5"
              stroke-dasharray="282.7"
              :stroke-dashoffset="getAccuracyGradientDashoffset(user.accuracy)"
              stroke-linecap="round"
              class="transition-all duration-500"
              style="transform: rotate(-90deg); transform-origin: 50% 50%"
            />
            <text
              x="50"
              y="50"
              text-anchor="middle"
              dominant-baseline="middle"
              class="fill-gray-900 dark:fill-white"
              style="font-size: 22px; font-weight: 700"
            >
              {{ user.accuracy.toFixed(1) }}
            </text>
            <text
              x="50"
              y="67"
              text-anchor="middle"
              dominant-baseline="middle"
              class="fill-gray-500 dark:fill-gray-400"
              style="font-size: 9px; font-weight: 500"
            >
              %
            </text>
          </svg>
        </div>
      </div>

      <!-- Stats - Mobile -->
      <div class="flex md:hidden items-center gap-3 flex-shrink-0">
        <div class="text-right">
          <div
            class="text-sm font-bold text-gray-900 dark:text-white font-mono"
          >
            {{ user.total_score }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">Pts</div>
        </div>

        <div class="flex-shrink-0 w-16">
          <svg class="w-full h-auto" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              :stroke="
                user.accuracy >= 70
                  ? '#3b82f6'
                  : user.accuracy >= 50
                    ? '#f59e0b'
                    : '#ef4444'
              "
              stroke-width="2.5"
              stroke-dasharray="282.7"
              :stroke-dashoffset="getAccuracyGradientDashoffset(user.accuracy)"
              stroke-linecap="round"
              style="transform: rotate(-90deg); transform-origin: 50% 50%"
            />
            <text
              x="50"
              y="53"
              text-anchor="middle"
              dominant-baseline="middle"
              class="fill-gray-900 dark:fill-white"
              style="font-size: 18px; font-weight: 700"
            >
              {{ user.accuracy.toFixed(1) }}
            </text>
          </svg>
        </div>
      </div>

      <!-- Chevron -->
      <div
        class="hidden md:block flex-shrink-0 text-gray-300 dark:text-gray-600"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </div>
  </button>
</template>

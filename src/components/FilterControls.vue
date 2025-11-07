<script setup>
import { ref } from 'vue'

defineProps({
  selectedSeason: {
    type: String,
    required: true,
  },
  isPostseason: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['update-filters'])

const localSeason = ref(null)
const localPostseason = ref(null)

const seasons = [
  { value: '2025', label: '2025-26' },
  { value: '2024', label: '2024-25' },
]

const handleSeasonChange = season => {
  localSeason.value = season
  emit('update-filters', season, localPostseason.value ?? false)
}

const handleModeChange = postseason => {
  localPostseason.value = postseason
  const season = localSeason.value ?? '2025'
  emit('update-filters', season, postseason)
}
</script>

<template>
  <div
    class="mb-8 flex flex-col sm:flex-row gap-4 items-center justify-between"
  >
    <!-- Season Selector -->
    <div class="flex gap-2">
      <button
        v-for="season in seasons"
        :key="season.value"
        @click="handleSeasonChange(season.value)"
        :class="[
          'px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200',
          selectedSeason === season.value
            ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
        ]"
      >
        {{ season.label }}
      </button>
    </div>

    <div class="w-px h-6 bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>

    <!-- Mode Selector -->
    <div class="flex gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      <button
        @click="handleModeChange(false)"
        :class="[
          'px-5 py-1.5 rounded-md font-medium text-sm transition-all duration-200',
          !isPostseason
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300',
        ]"
      >
        Regular
      </button>
      <button
        @click="handleModeChange(true)"
        :class="[
          'px-5 py-1.5 rounded-md font-medium text-sm transition-all duration-200',
          isPostseason
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300',
        ]"
      >
        Postseason
      </button>
    </div>
  </div>
</template>

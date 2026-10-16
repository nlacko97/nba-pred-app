<script setup>
import { CURRENT_SEASON, FIRST_SEASON, seasonLabel } from '@/lib/season'

const props = defineProps({
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

// Newest first: 2026–27, 2025–26, …
const seasons = Array.from(
  { length: CURRENT_SEASON - FIRST_SEASON + 1 },
  (_, i) => {
    const season = CURRENT_SEASON - i
    return { value: String(season), label: seasonLabel(season) }
  },
)

const handleSeasonChange = season => {
  emit('update-filters', season, props.isPostseason)
}

const handleModeChange = postseason => {
  emit('update-filters', props.selectedSeason, postseason)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <div class="seg" role="group" aria-label="Season">
      <button
        v-for="season in seasons"
        :key="season.value"
        type="button"
        :class="{ 'is-on': selectedSeason === season.value }"
        :aria-pressed="selectedSeason === season.value"
        @click="handleSeasonChange(season.value)"
      >
        {{ season.label }}
      </button>
    </div>

    <div class="seg" role="group" aria-label="Season phase">
      <button
        type="button"
        :class="{ 'is-on': !isPostseason }"
        :aria-pressed="!isPostseason"
        @click="handleModeChange(false)"
      >
        Regular
      </button>
      <button
        type="button"
        :class="{ 'is-on': isPostseason }"
        :aria-pressed="isPostseason"
        @click="handleModeChange(true)"
      >
        Postseason
      </button>
    </div>
  </div>
</template>

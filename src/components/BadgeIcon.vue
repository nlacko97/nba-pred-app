<script setup>
import { computed } from 'vue'

// Inline SVG so the badge text renders in Big Shoulders Display; an <img>
// cannot load web fonts and would fall back to Impact
const sources = import.meta.glob('../assets/badges/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const svgBySlug = Object.fromEntries(
  Object.entries(sources).map(([path, svg]) => [
    path.split('/').pop().replace('.svg', ''),
    svg,
  ]),
)

const props = defineProps({
  slug: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    default: 64,
  },
  locked: {
    type: Boolean,
    default: false,
  },
})

const svg = computed(() => svgBySlug[props.slug] || '')
</script>

<template>
  <span
    v-if="svg"
    class="badge-icon"
    :class="{ 'is-locked': locked }"
    :style="{ width: `${size}px`, height: `${size}px` }"
    v-html="svg"
  />
</template>

<style scoped>
.badge-icon {
  display: inline-block;
  flex-shrink: 0;
  line-height: 0;
}
.badge-icon :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
.badge-icon.is-locked {
  filter: grayscale(1);
  opacity: 0.35;
}
</style>

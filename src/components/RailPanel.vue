<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  meta: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <section class="sheet reveal p-5">
    <header class="mb-4 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="display text-3xl">{{ title }}</h2>
        <p v-if="meta" class="label mt-1.5 !tracking-[0.14em]">{{ meta }}</p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </section>
</template>

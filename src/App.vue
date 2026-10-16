<template>
  <div class="relative min-h-screen">
    <!-- Faint half-court drawn behind everything -->
    <svg
      class="pointer-events-none fixed inset-x-0 top-0 -z-0 mx-auto h-[100vh] w-full max-w-[1400px] text-ink opacity-[0.045]"
      viewBox="0 0 1400 1000"
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      preserveAspectRatio="xMidYMin slice"
      aria-hidden="true"
    >
      <rect x="40" y="-10" width="1320" height="1020" />
      <path d="M40 500h1320" />
      <circle cx="700" cy="500" r="180" />
      <circle cx="700" cy="500" r="60" />
      <path d="M520 -10v290h360V-10M520 1010V720h360v290" />
      <path d="M580 280a120 120 0 0 0 240 0M580 720a120 120 0 0 1 240 0" />
      <path d="M140 -10v120a560 560 0 0 0 1120 0V-10" />
      <path d="M140 1010V890a560 560 0 0 1 1120 0v120" />
    </svg>

    <SiteMasthead />

    <main class="wrap relative pb-32 pt-6 md:pb-24 md:pt-10">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <MobileTabBar />
  </div>
</template>

<script setup>
import SiteMasthead from './components/SiteMasthead.vue'
import MobileTabBar from './components/MobileTabBar.vue'
</script>

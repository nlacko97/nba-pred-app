<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useDark, useToggle } from '@vueuse/core'

const route = useRoute()
const isDark = useDark()
const toggleDarkMode = useToggle(isDark)
const mobileOpen = ref(false)

const pageTitle = computed(() => {
  const name = route.name
  if (name === 'games') return 'Games'
  if (name === 'leaderboard') return 'Leaderboard'
  if (name === 'user') return 'User'
  return 'NBA Predictor'
})

const navItems = [
  { name: 'Games', path: '/games', icon: '🏀' },
  { name: 'Leaderboard', path: '/leaderboard', icon: '🏆' },
]

const isActive = path => route.path === path
const closeMobile = () => (mobileOpen.value = false)

const onKeydown = e => {
  if (e.key === 'Escape') closeMobile()
}

watch(mobileOpen, v => {
  if (typeof document === 'undefined') return
  const body = document.body
  if (v) {
    body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeydown)
  } else {
    body.style.overflow = ''
    window.removeEventListener('keydown', onKeydown)
  }
})

onUnmounted(() => {
  if (typeof document !== 'undefined') document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <header
    class="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-800">
    <div class="container mx-auto px-4">
      <div class="h-16 flex items-center justify-between">
        <div class="flex items-center space-x-3 min-w-0">
          <span class="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">NBA Predictor</span>
          <span class="hidden sm:inline text-gray-400">/</span>
          <span class="hidden sm:inline text-sm text-gray-500 dark:text-gray-400 truncate">{{ pageTitle }}</span>
        </div>

        <div class="flex items-center space-x-2">
          <!-- Mobile menu button -->
          <button @click="mobileOpen = true" class="icon-btn md:hidden" aria-label="Open menu">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <!-- Dark mode toggle -->
          <button @click="toggleDarkMode()" class="icon-btn" aria-label="Toggle dark mode">
            <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile Bottom Sheet -->
    <Teleport to="body">
      <div v-if="mobileOpen" class="fixed inset-0 z-[70] md:hidden">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px]" @click="closeMobile" />
        <!-- Sheet -->
        <aside
          class="absolute left-0 right-0 bottom-0 h-[78vh] max-h-[600px] rounded-t-2xl bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-2xl translate-y-0 transition-transform duration-300">
          <!-- Drag handle -->
          <div class="flex items-center justify-center pt-3">
            <div class="h-1.5 w-10 rounded-full bg-gray-300 dark:bg-gray-700" />
          </div>
          <div class="px-4 py-3 flex items-center justify-between">
            <span class="text-base font-bold">Menu</span>
            <button @click="closeMobile" class="icon-btn" aria-label="Close menu">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav class="px-3 pb-3 space-y-1 overflow-y-auto max-h-[calc(78vh-96px)]">
            <RouterLink v-for="item in navItems" :key="item.path" :to="item.path" @click="closeMobile" :class="[
              'flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium',
              isActive(item.path)
                ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
            ]">
              <span class="text-lg">{{ item.icon }}</span>
              <span class="truncate">{{ item.name }}</span>
            </RouterLink>
          </nav>
          <div class="p-3 border-t border-gray-200 dark:border-gray-800">
            <button @click="
              toggleDarkMode(),
              closeMobile()
              " class="btn btn-muted w-full">
              Toggle Dark Mode
            </button>
          </div>
        </aside>
      </div>
    </Teleport>
  </header>
</template>

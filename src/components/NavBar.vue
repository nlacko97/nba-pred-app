<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useDark, useToggle } from '@vueuse/core'

const route = useRoute()
const isMenuOpen = ref(false)
const isDark = useDark()
const toggleDarkMode = useToggle(isDark)

const navItems = [
  { name: 'Games', path: '/games', icon: '🏀' },
  { name: 'Leaderboard', path: '/leaderboard', icon: '🏆' },
]

const isActive = path => {
  return route.path === path
}

const closeMenu = () => {
  isMenuOpen.value = false
}
</script>

<template>
  <nav
    class="bg-white dark:bg-gradient-to-r dark:from-blue-950 dark:to-indigo-950 shadow-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <!-- Logo/Brand -->
        <div class="flex items-center">
          <div class="flex-shrink-0 flex items-center">
            <span class="text-xl font-bold text-gray-900 dark:text-white"
              >NBA Predictor</span
            >
          </div>
        </div>

        <!-- Desktop Navigation Links -->
        <div class="hidden md:flex items-center space-x-4">
          <RouterLink
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            :class="[
              'flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              isActive(item.path)
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white',
            ]"
          >
            <span class="mr-2">{{ item.icon }}</span>
            {{ item.name }}
          </RouterLink>
        </div>

        <!-- Desktop Dark Mode Toggle -->
        <div class="hidden md:flex items-center">
          <button
            @click="toggleDarkMode()"
            class="p-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg
              v-if="isDark"
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <svg
              v-else
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          </button>
        </div>

        <!-- Mobile menu button -->
        <div class="md:hidden flex items-center space-x-2">
          <!-- Mobile Dark Mode Toggle -->
          <button
            @click="toggleDarkMode()"
            class="p-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg
              v-if="isDark"
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <svg
              v-else
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          </button>

          <!-- Hamburger Menu Button -->
          <button
            @click="isMenuOpen = !isMenuOpen"
            class="p-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                v-if="!isMenuOpen"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
              <path
                v-else
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile Navigation Menu -->
      <div
        v-if="isMenuOpen"
        class="md:hidden border-t border-gray-200 dark:border-gray-700"
      >
        <div
          class="px-2 pt-2 pb-3 space-y-1 bg-white dark:bg-gradient-to-r dark:from-blue-950 dark:to-indigo-950"
        >
          <RouterLink
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            @click="closeMenu"
            :class="[
              'flex items-center px-3 py-2 rounded-md text-base font-medium transition-all duration-200',
              isActive(item.path)
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white',
            ]"
          >
            <span class="mr-3">{{ item.icon }}</span>
            {{ item.name }}
          </RouterLink>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useDark, useToggle } from '@vueuse/core'
import { useGlobalStore } from '../stores/global'
import { supabase } from '../lib/supabaseClient'

const route = useRoute()
const isMenuOpen = ref(false)
const isDark = useDark()
const toggleDarkMode = useToggle(isDark)

const globalStore = useGlobalStore()
const { session } = storeToRefs(globalStore)

const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })
  if (error) console.error('Error signing in:', error)
}

const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) console.error('Error signing out:', error)
  globalStore.initializeAuth()
}

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

        <!-- Desktop Auth and Dark Mode Toggle -->
        <div class="hidden md:flex items-center space-x-2">
          <!-- Login/Logout -->
          <div v-if="!session" class="flex items-center">
            <button
              @click="signInWithGoogle"
              class="flex items-center px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in
            </button>
          </div>
          <div v-else class="flex items-center">
            <button
              @click="signOut"
              class="p-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Sign out"
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>

          <!-- Dark Mode Toggle -->
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
          <!-- Mobile Auth -->
          <div v-if="!session">
            <button
              @click="signInWithGoogle"
              class="flex items-center px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <svg class="w-3 h-3 mr-1" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in
            </button>
          </div>
          <div v-else>
            <button
              @click="signOut"
              class="p-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Sign out"
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>

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

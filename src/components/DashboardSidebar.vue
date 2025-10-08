<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { name: 'Games', path: '/games', icon: '🏀' },
  { name: 'Leaderboard', path: '/leaderboard', icon: '🏆' },
]

const isActive = path => route.path === path
</script>

<template>
  <aside
    class="hidden md:block w-60 shrink-0 h-[calc(100vh-64px)] sticky top-16 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
  >
    <div class="px-3 py-4">
      <nav class="space-y-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          :class="[
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium',
            isActive(item.path)
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
          ]"
        >
          <span class="text-lg">{{ item.icon }}</span>
          <span class="truncate">{{ item.name }}</span>
        </RouterLink>
      </nav>
    </div>
  </aside>
</template>

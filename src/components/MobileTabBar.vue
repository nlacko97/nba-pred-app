<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

const tabs = [
  { name: 'Games', path: '/games', icon: 'ball' },
  { name: 'Standings', path: '/leaderboard', icon: 'trophy' },
]

const isActive = path =>
  route.path === path || (path === '/leaderboard' && route.name === 'user')
</script>

<template>
  <nav class="tabbar" aria-label="Primary">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.path"
      :to="tab.path"
      class="tabbar__tab"
      :class="{ 'is-active': isActive(tab.path) }"
    >
      <svg
        v-if="tab.icon === 'ball'"
        class="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
      >
        <circle cx="12" cy="12" r="9.5" />
        <path
          d="M2.5 12h19M12 2.5v19M5.5 5.2c2.6 2 3.8 4.2 3.8 6.8s-1.2 4.8-3.8 6.8M18.5 5.2c-2.6 2-3.8 4.2-3.8 6.8s1.2 4.8 3.8 6.8"
        />
      </svg>
      <svg
        v-else
        class="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linejoin="round"
      >
        <path
          d="M7 4h10v5a5 5 0 01-10 0V4zM7 6H4v1.5A3.5 3.5 0 007.5 11M17 6h3v1.5a3.5 3.5 0 01-3.5 3.5M12 14v4M8 20h8"
        />
      </svg>
      <span>{{ tab.name }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  left: 50%;
  bottom: calc(14px + env(safe-area-inset-bottom, 0px));
  z-index: 60;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  padding: 5px;
  background: rgb(var(--c-ink));
  box-shadow: 0 14px 30px -10px rgb(0 0 0 / 0.5);
}
@media (min-width: 768px) {
  .tabbar {
    display: none;
  }
}
.tabbar__tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 44px;
  padding: 0.7rem 1.2rem;
  color: rgb(var(--c-paper) / 0.6);
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 800;
  font-size: 1.05rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}
.tabbar__tab.is-active {
  background: rgb(var(--c-paper));
  color: rgb(var(--c-ink));
}
</style>

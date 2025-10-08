<template>
  <div class="min-h-screen">
    <DashboardTopBar />
    <div class="container mx-auto px-4">
      <div
        class="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-6 mt-6"
      >
        <DashboardSidebar />
        <main class="min-w-0">
          <RouterView />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import DashboardTopBar from './components/DashboardTopBar.vue'
import DashboardSidebar from './components/DashboardSidebar.vue'
</script>

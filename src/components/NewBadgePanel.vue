<script setup>
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useBadgesStore } from '../stores/badges'
import { useGlobalStore } from '../stores/global'
import BadgeIcon from './BadgeIcon.vue'
import RailPanel from './RailPanel.vue'

// The "new badge" moment: badges the signed-in player has not seen yet
const badgesStore = useBadgesStore()
const { userId } = storeToRefs(useGlobalStore())

watch(
  userId,
  async id => {
    await badgesStore.fetchCatalog()
    await badgesStore.fetchUnseen(id)
  },
  { immediate: true },
)

const newest = computed(() => badgesStore.unseen[0] || null)
const badge = computed(() =>
  newest.value ? badgesStore.badgeFor(newest.value.badge_slug) : null,
)
const others = computed(() => badgesStore.unseen.slice(1, 6))
const moreCount = computed(() => Math.max(0, badgesStore.unseen.length - 6))

const formatDate = iso =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  })

const dismiss = () => badgesStore.markSeen(userId.value)
</script>

<template>
  <RailPanel
    v-if="newest && badge"
    :title="badgesStore.unseen.length > 1 ? 'New badges' : 'New badge'"
    :meta="`Earned ${formatDate(newest.earned_on)}`"
  >
    <div class="flex items-center gap-4">
      <BadgeIcon class="badge-pop" :slug="badge.slug" :size="96" />
      <div class="min-w-0">
        <p class="display text-2xl">{{ badge.name }}</p>
        <p class="mt-1 text-sm">{{ badge.description }}</p>
      </div>
    </div>
    <div v-if="others.length" class="mt-4 flex flex-wrap items-center gap-1.5">
      <BadgeIcon
        v-for="row in others"
        :key="row.id"
        :slug="row.badge_slug"
        :size="36"
      />
      <span v-if="moreCount" class="label">+{{ moreCount }} more</span>
    </div>
    <div class="mt-5 flex items-center justify-between gap-3">
      <RouterLink
        :to="{ name: 'user', params: { id: userId } }"
        class="label !text-ink underline underline-offset-4 hover:!text-accent"
        >See your shelf</RouterLink
      >
      <button type="button" class="btn-ink" @click="dismiss">Nice</button>
    </div>
  </RailPanel>
</template>

<style scoped>
.badge-pop {
  animation: stamp-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
}
</style>

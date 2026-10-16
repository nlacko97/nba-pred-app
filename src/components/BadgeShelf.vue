<script setup>
import { computed, ref, watch } from 'vue'
import { FAMILIES, useBadgesStore } from '../stores/badges'
import BadgeIcon from './BadgeIcon.vue'
import StreakMeter from './StreakMeter.vue'

const props = defineProps({
  userId: {
    type: String,
    required: true,
  },
  season: {
    type: [String, Number],
    required: true,
  },
})

const badgesStore = useBadgesStore()
const data = ref(null)
const loading = ref(true)
const selected = ref(null)

watch(
  () => [props.userId, props.season],
  async () => {
    loading.value = true
    selected.value = null
    await badgesStore.fetchCatalog()
    data.value = await badgesStore.fetchUserBadges(props.userId, props.season)
    loading.value = false
  },
  { immediate: true },
)

const counts = computed(() => data.value?.counts || {})
const progress = computed(() => data.value?.progress || {})
const hotHand = computed(() => progress.value['hot-hand'] || {})
const ironMan = computed(() => progress.value['iron-man'] || {})

const lastEarned = slug =>
  (data.value?.earned || []).find(row => row.badge_slug === slug)

// "7 / 10" toward the badges that track a number
function progressLine(slug) {
  const p = progress.value[slug]
  if (!p) return null
  if (slug === 'oracle') {
    if (!p.picks) return `0 / ${p.picks_target} picks`
    return `${p.picks} / ${p.picks_target} picks · ${Math.round(p.accuracy)}%`
  }
  if (slug === 'team-whisperer' && p.team) {
    return `${Math.min(p.current, p.target)} / ${p.target} ${p.team}`
  }
  return `${Math.min(p.current, p.target)} / ${p.target}`
}

// Earned first, then the catalog order
const rows = computed(() =>
  FAMILIES.map(family => ({
    ...family,
    badges: badgesStore.catalog
      .filter(badge => badge.family === family.value)
      .map(badge => ({ ...badge, count: counts.value[badge.slug] || 0 }))
      .sort(
        (a, b) => (b.count > 0) - (a.count > 0) || a.sort_order - b.sort_order,
      ),
  })),
)

const earnedTotal = computed(() =>
  Object.values(counts.value).reduce((sum, n) => sum + n, 0),
)

const formatDate = iso =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const detail = computed(() => {
  if (!selected.value) return null
  const badge = badgesStore.badgeFor(selected.value)
  if (!badge) return null
  const count = counts.value[badge.slug] || 0
  const last = lastEarned(badge.slug)
  return {
    ...badge,
    count,
    earnedLine: count
      ? `${count > 1 ? `Earned ×${count} · last` : 'Earned'} ${formatDate(last.earned_on)}`
      : null,
    progressLine: count ? null : progressLine(badge.slug),
  }
})

const toggle = slug => {
  selected.value = selected.value === slug ? null : slug
}
</script>

<template>
  <section class="sheet reveal p-5 sm:p-6">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="display text-3xl sm:text-4xl">Badges</h2>
        <p class="label mt-1.5 !tracking-[0.14em]">
          {{ earnedTotal }} earned this season
        </p>
      </div>
    </header>

    <!-- Live streaks, and the run badges they lead to -->
    <div v-if="!loading" class="mt-5 grid gap-3 md:grid-cols-2">
      <StreakMeter
        kind="correct"
        :current="hotHand.current || 0"
        :best="hotHand.best || 0"
        :target="hotHand.target || 10"
        badge-name="Hot Hand"
      />
      <StreakMeter
        kind="days"
        :current="ironMan.current || 0"
        :best="ironMan.best || 0"
        :target="ironMan.target || 30"
        badge-name="Iron Man"
        :earned="(counts['iron-man'] || 0) > 0"
      />
    </div>

    <div v-if="loading" class="flex justify-center py-10">
      <span class="spinner" />
    </div>

    <template v-else>
      <div
        v-for="row in rows"
        :key="row.value"
        class="mt-6 border-t border-dashed border-ink/25 pt-4"
      >
        <p class="label mb-3">
          {{ row.label }} <span class="text-muted">· {{ row.hint }}</span>
        </p>
        <ul class="shelf">
          <li v-for="badge in row.badges" :key="badge.slug">
            <button
              type="button"
              class="shelf__item"
              :class="{ 'is-selected': selected === badge.slug }"
              :aria-expanded="selected === badge.slug"
              :aria-label="`${badge.name}${badge.count ? `, earned ${badge.count} times` : ', not earned yet'}`"
              @click="toggle(badge.slug)"
            >
              <BadgeIcon :slug="badge.slug" :size="72" :locked="!badge.count" />
              <span v-if="badge.count > 1" class="shelf__count num"
                >×{{ badge.count }}</span
              >
              <span
                v-if="!badge.count && progressLine(badge.slug)"
                class="shelf__progress num"
                >{{ progressLine(badge.slug) }}</span
              >
            </button>
          </li>
        </ul>
        <div
          v-if="detail && detail.family === row.value"
          class="detail"
          role="status"
        >
          <p class="display text-2xl">{{ detail.name }}</p>
          <p class="mt-1 text-sm">{{ detail.description }}</p>
          <p v-if="detail.earnedLine" class="label mt-2 !text-win">
            {{ detail.earnedLine }}
          </p>
          <p v-else-if="detail.progressLine" class="label mt-2">
            Progress · {{ detail.progressLine }}
          </p>
          <p v-else class="label mt-2">Not earned yet</p>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.shelf {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.75rem 0.5rem;
}
.shelf__item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  padding: 0.25rem 0 0.35rem;
  border: 1.5px solid transparent;
  transition:
    transform 0.2s ease,
    border-color 0.15s ease;
}
.shelf__item:hover {
  transform: translateY(-2px);
}
.shelf__item.is-selected {
  border-color: rgb(var(--c-ink));
}
.shelf__count {
  position: absolute;
  top: 0;
  right: 0.25rem;
  padding: 0 0.3rem;
  background: rgb(var(--c-ink));
  color: rgb(var(--c-paper));
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 0.95rem;
  line-height: 1.3;
}
.shelf__progress {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgb(var(--c-muted));
  white-space: nowrap;
}
.detail {
  margin-top: 0.85rem;
  padding: 0.85rem 1rem;
  border: 1.5px solid rgb(var(--c-edge));
  background: rgb(var(--c-paper));
}
</style>

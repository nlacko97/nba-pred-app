<script setup>
import { computed } from 'vue'
import BadgeIcon from './BadgeIcon.vue'
import StreakFlame from './StreakFlame.vue'

const props = defineProps({
  user: {
    type: Object,
    required: true,
  },
  rank: {
    type: Number,
    required: true,
  },
  isCurrentUser: {
    type: Boolean,
    default: false,
  },
  leaderScore: {
    type: Number,
    default: 0,
  },
  // Up to three most recent badge slugs
  badges: {
    type: Array,
    default: () => [],
  },
  // { correct_streak, day_streak } from get_streaks
  streak: {
    type: Object,
    default: null,
  },
})

// Streaks start to mean something at 2
const correctStreak = computed(() => props.streak?.correct_streak || 0)
const dayStreak = computed(() => props.streak?.day_streak || 0)
const hasExtras = computed(
  () =>
    props.badges.length > 0 || correctStreak.value > 1 || dayStreak.value > 1,
)

const emit = defineEmits(['click'])

const pointsBack = computed(() => props.leaderScore - props.user.total_score)
const displayName = computed(
  () => props.user.full_name || props.user.username || 'Unknown',
)
</script>

<template>
  <button
    type="button"
    class="row reveal"
    :class="{ 'is-me': isCurrentUser }"
    :style="{ '--i': Math.min(rank, 14) }"
    @click="emit('click')"
  >
    <span class="row__rank num">{{ String(rank).padStart(2, '0') }}</span>

    <span class="avatar h-10 w-10 text-base">
      <img
        v-if="user.avatar_url"
        :src="user.avatar_url"
        :alt="`${user.username}'s avatar`"
        referrerpolicy="no-referrer"
      />
      <template v-else>{{ displayName.charAt(0) }}</template>
    </span>

    <span class="min-w-0 flex-1 text-left">
      <span class="flex items-center gap-2">
        <span class="truncate font-semibold">{{ displayName }}</span>
        <span
          v-if="isCurrentUser"
          class="shrink-0 bg-accent-fill px-1.5 text-[0.6875rem] font-extrabold uppercase tracking-[0.14em] text-white"
          >You</span
        >
      </span>
      <span
        class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1"
        :class="{ 'md:hidden': !hasExtras }"
      >
        <span class="bar w-20 md:hidden"
          ><span :style="{ width: `${user.accuracy}%` }"
        /></span>
        <span class="num text-[0.6875rem] text-muted md:hidden"
          >{{ user.accuracy.toFixed(1) }}%</span
        >
        <span v-if="badges.length" class="flex items-center gap-0.5">
          <BadgeIcon
            v-for="slug in badges"
            :key="slug"
            :slug="slug"
            :size="24"
          />
        </span>
        <StreakFlame
          v-if="correctStreak > 1"
          :count="correctStreak"
          label="correct in a row"
        />
        <StreakFlame
          v-if="dayStreak > 1"
          :count="dayStreak"
          label="game days in a row"
          kind="days"
        />
      </span>
    </span>

    <span class="hidden w-20 text-right md:block">
      <span class="num block font-semibold"
        >{{ user.correct_picks }}–{{
          user.total_picks - user.correct_picks
        }}</span
      >
      <span class="label !tracking-[0.14em]">Record</span>
    </span>

    <span class="hidden w-36 md:block">
      <span class="flex items-baseline justify-between">
        <span class="label !tracking-[0.14em]">Hit rate</span>
        <span class="num text-sm font-semibold"
          >{{ user.accuracy.toFixed(1) }}%</span
        >
      </span>
      <span class="bar mt-1.5"
        ><span :style="{ width: `${user.accuracy}%` }"
      /></span>
    </span>

    <span class="hidden w-14 text-right md:block">
      <span class="num block font-semibold text-muted">{{
        pointsBack > 0 ? `−${pointsBack}` : '—'
      }}</span>
      <span class="label !tracking-[0.14em]">Behind</span>
    </span>

    <span class="row__score num">{{ user.total_score }}</span>
  </button>
</template>

<style scoped>
.row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.9rem;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid rgb(var(--c-ink) / 0.12);
  text-align: left;
  transition:
    background-color 0.15s ease,
    padding 0.2s ease;
}
@media (min-width: 768px) {
  .row {
    gap: 1.5rem;
    padding: 0.9rem 1.5rem;
  }
}
.row:hover {
  background: rgb(var(--c-ink) / 0.04);
}
.row:hover .row__rank {
  color: rgb(var(--c-accent));
}
.row.is-me {
  background: rgb(var(--c-accent) / 0.08);
  box-shadow: inset 5px 0 0 rgb(var(--c-accent));
}
.row__rank {
  width: 2.4rem;
  flex-shrink: 0;
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 1.9rem;
  line-height: 1;
  color: rgb(var(--c-ink) / 0.55);
  transition: color 0.15s ease;
}
.row__score {
  min-width: 3.5rem;
  text-align: right;
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 900;
  font-size: 1.9rem;
  line-height: 1;
}
.bar {
  display: block;
  height: 6px;
  background: rgb(var(--c-ink) / 0.1);
}
.bar > span {
  display: block;
  height: 100%;
  background: rgb(var(--c-ink));
}
.row.is-me .bar > span {
  background: rgb(var(--c-accent));
}
</style>

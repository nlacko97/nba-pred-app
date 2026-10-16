<script setup>
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useDark, useToggle, onClickOutside } from '@vueuse/core'
import { useGlobalStore } from '../stores/global'
import { supabase } from '../lib/supabaseClient'

const route = useRoute()
const isDark = useDark()
const toggleDarkMode = useToggle(isDark)

const globalStore = useGlobalStore()
const { session } = storeToRefs(globalStore)

const menuOpen = ref(false)
const menuRef = ref(null)
onClickOutside(menuRef, () => (menuOpen.value = false))

const navItems = [
  { name: 'Games', path: '/games' },
  { name: 'Standings', path: '/leaderboard' },
]

const isActive = path =>
  route.path === path || (path === '/leaderboard' && route.name === 'user')

const userName = computed(() => {
  const meta = session.value?.user?.user_metadata || {}
  return meta.full_name || meta.name || session.value?.user?.email || 'You'
})
const userAvatar = computed(
  () => session.value?.user?.user_metadata?.avatar_url || null,
)

const signOut = async () => {
  menuOpen.value = false
  const { error } = await supabase.auth.signOut()
  if (error) console.error('Error signing out:', error)
}

async function handleSignInWithGoogle(response) {
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: response.credential,
  })

  if (error) {
    console.error('Google Sign-In Error:', error)
  }
}

let googleInitialized = false

function renderGoogleButtons() {
  if (!googleInitialized) return
  nextTick(() => {
    document.querySelectorAll('.g_id_signin').forEach(button => {
      if (button.hasChildNodes()) return
      const isIcon = button.dataset.type === 'icon'
      window.google.accounts.id.renderButton(button, {
        theme: 'outline',
        size: button.dataset.size || 'medium',
        type: isIcon ? 'icon' : 'standard',
        text: 'signin_with',
        shape: isIcon ? 'circle' : 'rectangular',
        logo_alignment: 'left',
      })
    })
  })
}

function initializeGoogleSignIn() {
  if (googleInitialized) return
  try {
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: handleSignInWithGoogle,
      auto_select: false,
      cancel_on_tap_outside: true,
    })
    googleInitialized = true
    renderGoogleButtons()
  } catch (error) {
    console.error('Google Sign-In initialization error:', error)
  }
}

onMounted(async () => {
  await globalStore.initializeAuth()

  const waitForGoogle = () => {
    if (window.google && window.google.accounts) {
      initializeGoogleSignIn()
    } else {
      setTimeout(waitForGoogle, 100)
    }
  }
  waitForGoogle()
})

// Sign-in slots are re-mounted empty after signing out
watch(session, value => {
  if (!value) renderGoogleButtons()
})
</script>

<template>
  <header class="glass-bar sticky top-0 z-50 border-b-[1.5px] border-edge">
    <div class="wrap flex h-14 items-center justify-between gap-4 md:h-[72px]">
      <!-- Wordmark -->
      <RouterLink
        to="/games"
        class="group flex items-center gap-3"
        aria-label="NBA Predictor home"
      >
        <svg
          class="h-8 w-8 shrink-0 text-accent transition-transform duration-500 group-hover:rotate-[200deg] md:h-10 md:w-10"
          viewBox="0 0 40 40"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="20" cy="20" r="18.5" fill="currentColor" />
          <g stroke="rgb(var(--c-paper))" stroke-width="1.8">
            <path d="M1.5 20h37M20 1.5v37" />
            <path d="M7 7c5 4 7 8 7 13s-2 9-7 13M33 7c-5 4-7 8-7 13s2 9 7 13" />
          </g>
        </svg>
        <span class="flex items-baseline gap-1.5 leading-none">
          <span class="display text-[28px] md:text-[40px]">NBA</span>
          <span
            class="text-[1.15rem] font-semibold tracking-tight text-muted md:text-[1.5rem]"
            >Predictor</span
          >
        </span>
      </RouterLink>

      <!-- Desktop nav -->
      <nav class="hidden items-stretch self-stretch md:flex">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-link"
          :class="{ 'is-active': isActive(item.path) }"
        >
          {{ item.name }}
        </RouterLink>
      </nav>

      <div class="flex items-center gap-2 md:gap-3">
        <!-- Day / Night switch -->
        <button
          type="button"
          class="theme-switch"
          :aria-label="
            isDark ? 'Switch to light theme' : 'Switch to dark theme'
          "
          @click="toggleDarkMode()"
        >
          <span class="theme-switch__knob" :class="{ 'is-night': isDark }">
            <svg
              v-if="isDark"
              class="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
            <svg
              v-else
              class="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <circle cx="12" cy="12" r="4" />
              <path
                stroke-linecap="round"
                d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
              />
            </svg>
          </span>
        </button>

        <!-- Auth -->
        <template v-if="!session">
          <div class="g_id_signin hidden md:block" data-size="medium"></div>
          <div
            class="g_id_signin md:hidden"
            data-type="icon"
            data-size="medium"
          ></div>
        </template>
        <div v-else ref="menuRef" class="relative">
          <button
            type="button"
            class="flex items-center gap-2 border-[1.5px] border-edge bg-card py-1 pl-1 pr-1 transition-colors hover:border-accent md:pr-3"
            :aria-expanded="menuOpen"
            aria-label="Account menu"
            @click="menuOpen = !menuOpen"
          >
            <span class="avatar h-7 w-7 text-sm">
              <img
                v-if="userAvatar"
                :src="userAvatar"
                alt=""
                referrerpolicy="no-referrer"
              />
              <template v-else>{{ userName.charAt(0) }}</template>
            </span>
            <span
              class="hidden max-w-[9rem] truncate text-xs font-semibold md:inline"
            >
              {{ userName.split(' ')[0] }}
            </span>
          </button>
          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            leave-active-class="transition duration-100 ease-in"
            leave-to-class="opacity-0"
          >
            <div
              v-if="menuOpen"
              class="sheet absolute right-0 top-[calc(100%+10px)] z-10 w-56 p-4"
            >
              <p class="label">Signed in as</p>
              <p class="mt-1 truncate font-semibold">{{ userName }}</p>
              <button
                type="button"
                class="btn-ink mt-4 w-full"
                @click="signOut"
              >
                Sign out
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.nav-link {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 1.25rem;
  font-family: 'Big Shoulders Display', Impact, sans-serif;
  font-weight: 800;
  font-size: 1.35rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: rgb(var(--c-muted));
  transition: color 0.15s ease;
}
.nav-link:hover {
  color: rgb(var(--c-ink));
}
.nav-link::after {
  content: '';
  position: absolute;
  left: 1.25rem;
  right: 1.25rem;
  bottom: -1.5px;
  height: 5px;
  background: rgb(var(--c-accent));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.nav-link.is-active {
  color: rgb(var(--c-ink));
}
.nav-link.is-active::after {
  transform: scaleX(1);
}

.theme-switch {
  position: relative;
  width: 52px;
  height: 28px;
  border: 1.5px solid rgb(var(--c-edge));
  background: rgb(var(--c-card));
  background-image: repeating-linear-gradient(
    -45deg,
    rgb(var(--c-ink) / 0.08) 0 2px,
    transparent 2px 6px
  );
}
.theme-switch__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 21px;
  height: 21px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--c-ink));
  color: rgb(var(--c-paper));
  transition: transform 0.35s cubic-bezier(0.5, 1.6, 0.4, 1);
}
.theme-switch__knob.is-night {
  transform: translateX(24px);
}
</style>

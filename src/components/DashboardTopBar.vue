<script setup>
import { computed, ref, watch, onUnmounted, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useDark, useToggle } from '@vueuse/core'
import { useGlobalStore } from '../stores/global'
import { supabase } from '../lib/supabaseClient'

const route = useRoute()
const isDark = useDark()
const toggleDarkMode = useToggle(isDark)
const mobileOpen = ref(false)

const globalStore = useGlobalStore()
const { session } = storeToRefs(globalStore)

const signOut = async () => {
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

function getGoogleClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID
}

onMounted(async () => {
  await globalStore.initializeAuth()

  // Initialize Google Sign-In
  const initializeGoogleSignIn = () => {
    if (window.google && window.google.accounts) {
      try {
        window.google.accounts.id.initialize({
          client_id: getGoogleClientId(),
          callback: handleSignInWithGoogle,
          auto_select: false,
          cancel_on_tap_outside: true,
        })

        // Render buttons after initialization
        nextTick(() => {
          const signInButtons = document.querySelectorAll('.g_id_signin')
          signInButtons.forEach(button => {
            if (!button.hasChildNodes()) {
              window.google.accounts.id.renderButton(button, {
                theme: 'outline',
                size: button.dataset.size || 'medium',
                type: 'standard',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left',
              })
            }
          })
        })
      } catch (error) {
        console.error('Google Sign-In initialization error:', error)
      }
    }
  }

  nextTick(() => {
    initializeGoogleSignIn()
  })

  const checkGoogleLoaded = () => {
    if (window.google && window.google.accounts) {
      initializeGoogleSignIn()
    } else {
      setTimeout(checkGoogleLoaded, 100)
    }
  }
  checkGoogleLoaded()
})

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

const openMobile = () => {
  mobileOpen.value = true
  // Re-render Google Sign-In buttons when mobile menu opens
  nextTick(() => {
    if (window.google && window.google.accounts) {
      const signInButtons = document.querySelectorAll('.g_id_signin')
      signInButtons.forEach(button => {
        if (!button.hasChildNodes()) {
          window.google.accounts.id.renderButton(button, {
            theme: 'outline',
            size: button.dataset.size || 'medium',
            type: 'standard',
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left',
          })
        }
      })
    }
  })
}

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
    class="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-800"
  >
    <div class="container mx-auto px-4">
      <div class="h-16 flex items-center justify-between">
        <div class="flex items-center space-x-3 min-w-0">
          <span
            class="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white"
            >NBA Predictor</span
          >
          <span class="hidden sm:inline text-gray-400">/</span>
          <span
            class="hidden sm:inline text-sm text-gray-500 dark:text-gray-400 truncate"
            >{{ pageTitle }}</span
          >
        </div>

        <div class="flex items-center space-x-2">
          <!-- Auth buttons -->
          <div v-if="!session" class="hidden md:flex items-center">
            <div
              class="g_id_signin"
              data-type="standard"
              data-shape="rectangular"
              data-theme="outline"
              data-text="signin_with"
              data-size="medium"
              data-logo_alignment="left"
            ></div>
          </div>
          <div v-else class="hidden md:flex items-center">
            <button @click="signOut" class="icon-btn" title="Sign out">
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

          <!-- Mobile menu button -->
          <button
            @click="openMobile"
            class="icon-btn md:hidden"
            aria-label="Open menu"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <!-- Dark mode toggle -->
          <button
            @click="toggleDarkMode()"
            class="icon-btn"
            aria-label="Toggle dark mode"
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
      </div>
    </div>

    <!-- Mobile Bottom Sheet -->
    <Teleport to="body">
      <div v-if="mobileOpen" class="fixed inset-0 z-[70] md:hidden">
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          @click="closeMobile"
        />
        <!-- Sheet -->
        <aside
          class="absolute left-0 right-0 bottom-0 h-[78vh] max-h-[600px] rounded-t-2xl bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-2xl translate-y-0 transition-transform duration-300"
        >
          <!-- Drag handle -->
          <div class="flex items-center justify-center pt-3">
            <div class="h-1.5 w-10 rounded-full bg-gray-300 dark:bg-gray-700" />
          </div>
          <div class="px-4 py-3 flex items-center justify-between">
            <span class="text-base font-bold">Menu</span>
            <button
              @click="closeMobile"
              class="icon-btn"
              aria-label="Close menu"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <nav
            class="px-3 pb-3 space-y-1 overflow-y-auto max-h-[calc(78vh-96px)]"
          >
            <RouterLink
              v-for="item in navItems"
              :key="item.path"
              :to="item.path"
              @click="closeMobile"
              :class="[
                'flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium',
                isActive(item.path)
                  ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
              ]"
            >
              <span class="text-lg">{{ item.icon }}</span>
              <span class="truncate">{{ item.name }}</span>
            </RouterLink>
          </nav>
          <div
            class="p-3 border-t border-gray-200 dark:border-gray-800 space-y-2"
          >
            <!-- Mobile Auth -->
            <div v-if="!session">
              <div
                class="g_id_signin"
                data-type="standard"
                data-shape="rectangular"
                data-theme="outline"
                data-text="signin_with"
                data-size="large"
                data-logo_alignment="left"
              ></div>
            </div>
            <div v-else>
              <button
                @click="signOut"
                class="flex items-center justify-center w-full px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <svg
                  class="w-4 h-4 mr-2"
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
                Sign out
              </button>
            </div>
          </div>
        </aside>
      </div>
    </Teleport>
  </header>
</template>

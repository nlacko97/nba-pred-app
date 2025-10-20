import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabaseClient'

export const useGlobalStore = defineStore('global', () => {
  const session = ref(null)
  const userId = ref(null)

  // Initialize session on store creation
  const initializeAuth = async () => {
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    if (data.session) {
      userId.value = data.session.user.id
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange((event, newSession) => {
      session.value = newSession
      if (newSession) {
        userId.value = newSession.user.id
      } else {
        userId.value = null
      }
    })
  }

  return {
    session,
    userId,
    initializeAuth,
  }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabaseClient'

export const FAMILIES = [
  { value: 'night', label: 'Night', hint: 'One-night feats' },
  { value: 'run', label: 'Run', hint: 'Streaks and consistency' },
  { value: 'title', label: 'Title', hint: 'Periods and competitions' },
]

export const useBadgesStore = defineStore('badges', () => {
  const catalog = ref([])
  const userBadges = ref({}) // `${userId}-${season}` → get_user_badges result
  const streaks = ref({}) // season → { userId: { correct_streak, day_streak } }
  const recent = ref({}) // season → { userId: [slug, …] }
  const unseen = ref([])

  const fetchCatalog = async () => {
    if (catalog.value.length) return catalog.value
    const { data, error } = await supabase
      .from('badges')
      .select('slug, name, description, family, sort_order')
      .order('sort_order')
    if (error) {
      // Missing table should not break the page
      if (error.code !== '42P01') console.error('Error fetching badges:', error)
      return []
    }
    catalog.value = data || []
    return catalog.value
  }

  const badgeFor = slug => catalog.value.find(badge => badge.slug === slug)

  const fetchUserBadges = async (userId, season) => {
    const key = `${userId}-${season}`
    const { data, error } = await supabase.rpc('get_user_badges', {
      p_user_id: userId,
      p_season: Number(season),
    })
    if (error) {
      console.error('Error fetching player badges:', error)
      return null
    }
    userBadges.value[key] = data
    return data
  }

  const fetchStreaks = async season => {
    const { data, error } = await supabase.rpc('get_streaks', {
      p_season: Number(season),
    })
    if (error) {
      console.error('Error fetching streaks:', error)
      return {}
    }
    streaks.value[season] = Object.fromEntries(
      (data || []).map(row => [row.user_id, row]),
    )
    return streaks.value[season]
  }

  // The three most recent different badges per player, for leaderboard rows
  const fetchRecent = async season => {
    const { data, error } = await supabase
      .from('user_badges')
      .select('user_id, badge_slug, earned_on')
      .eq('season', Number(season))
      .order('earned_on', { ascending: false })
      .order('id', { ascending: false })
      .limit(1000)
    if (error) {
      if (error.code !== '42P01') {
        console.error('Error fetching recent badges:', error)
      }
      return {}
    }
    const byUser = {}
    for (const row of data || []) {
      const slugs = (byUser[row.user_id] ||= [])
      if (slugs.length < 3 && !slugs.includes(row.badge_slug)) {
        slugs.push(row.badge_slug)
      }
    }
    recent.value[season] = byUser
    return byUser
  }

  const fetchUnseen = async userId => {
    if (!userId) {
      unseen.value = []
      return
    }
    const { data, error } = await supabase
      .from('user_badges')
      .select('id, badge_slug, earned_on, context')
      .eq('user_id', userId)
      .is('seen_at', null)
      .order('earned_on', { ascending: false })
      .order('id', { ascending: false })
    if (error) {
      if (error.code !== '42P01') {
        console.error('Error fetching new badges:', error)
      }
      return
    }
    unseen.value = data || []
  }

  const markSeen = async userId => {
    const ids = unseen.value.map(row => row.id)
    if (!ids.length) return
    const { error } = await supabase
      .from('user_badges')
      .update({ seen_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('id', ids)
    if (error) {
      console.error('Error marking badges seen:', error)
      return
    }
    unseen.value = []
  }

  return {
    catalog,
    userBadges,
    streaks,
    recent,
    unseen,
    fetchCatalog,
    badgeFor,
    fetchUserBadges,
    fetchStreaks,
    fetchRecent,
    fetchUnseen,
    markSeen,
  }
})

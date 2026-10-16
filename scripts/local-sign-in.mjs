// Signs you in to the app running against the LOCAL Supabase stack
// (npm run dev -- --mode localdb, port 5174), where Google sign-in is not
// available. Works only with the local stack's keys from `supabase status`.
//
//   npm run local:sign-in            list local players
//   npm run local:sign-in -- laszlo  open the app signed in as that player

import { execSync } from 'node:child_process'
import process from 'node:process'

const APP_URL = 'http://localhost:5174/games'

const status = Object.fromEntries(
  execSync('npx supabase status -o env', { encoding: 'utf8', stdio: 'pipe' })
    .split('\n')
    .map(line => line.match(/^([A-Z_]+)="?([^"]*)"?$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value]),
)

const apiUrl = status.API_URL
const serviceKey = status.SERVICE_ROLE_KEY
if (!apiUrl || !serviceKey) {
  console.error(
    'Local Supabase is not running. Start it with: npx supabase start',
  )
  process.exit(1)
}
// Never point this at a hosted project
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(apiUrl)) {
  console.error(`Refusing to run against ${apiUrl}: local stack only`)
  process.exit(1)
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
}

async function call(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, { headers, ...options })
  const body = await response.json()
  if (!response.ok) {
    throw new Error(`${path}: ${response.status} ${JSON.stringify(body)}`)
  }
  return body
}

const profiles = await call(
  '/rest/v1/profiles?select=id,full_name,username&order=full_name',
)
const query = process.argv.slice(2).join(' ').toLowerCase()

if (!query) {
  console.log('Local players (pass part of a name):')
  for (const p of profiles) console.log(`  ${p.full_name || p.username}`)
  process.exit(0)
}

const matches = profiles.filter(p =>
  [p.full_name, p.username, p.id].some(v => v?.toLowerCase().includes(query)),
)
if (matches.length !== 1) {
  console.error(
    matches.length
      ? `"${query}" matches ${matches.map(p => p.full_name).join(', ')}`
      : `No local player matches "${query}"`,
  )
  process.exit(1)
}
const player = matches[0]

const { users } = await call('/auth/v1/admin/users?per_page=1000')
const user = users.find(u => u.id === player.id)
if (!user?.email) {
  console.error(`${player.full_name} has no local auth user with an email`)
  process.exit(1)
}

// A one-time magic link, redeemed here; the app reads the session from the
// URL hash (supabase-js detectSessionInUrl)
const link = await call('/auth/v1/admin/generate_link', {
  method: 'POST',
  body: JSON.stringify({ type: 'magiclink', email: user.email }),
})
const session = await call('/auth/v1/verify', {
  method: 'POST',
  body: JSON.stringify({
    type: 'magiclink',
    token_hash: link.hashed_token ?? link.properties?.hashed_token,
  }),
})

const hash = new URLSearchParams({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
  expires_in: String(session.expires_in),
  expires_at: String(Math.floor(Date.now() / 1000) + session.expires_in),
  token_type: 'bearer',
  type: 'magiclink',
})
const url = `${APP_URL}#${hash}`

console.log(`Signing in as ${player.full_name} on ${APP_URL}`)
const opener = process.platform === 'darwin' ? 'open' : 'xdg-open'
execSync(`${opener} '${url}'`)

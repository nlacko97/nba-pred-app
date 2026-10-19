// The LOCAL Supabase stack's API, for the local-* scripts. Refuses to run
// against anything but localhost, so a hosted project is never touched.

import { execSync } from 'node:child_process'
import process from 'node:process'

const status = Object.fromEntries(
  execSync('npx supabase status -o env', { encoding: 'utf8', stdio: 'pipe' })
    .split('\n')
    .map(line => line.match(/^([A-Z_]+)="?([^"]*)"?$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value]),
)

export const apiUrl = status.API_URL
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

export const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
}

export async function call(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, { headers, ...options })
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(`${path}: ${response.status} ${JSON.stringify(body)}`)
  }
  return body
}

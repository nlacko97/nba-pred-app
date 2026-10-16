import * as mockProvider from './mockProvider'
import * as espnProvider from './espnProvider'

export { matchupKey } from './teams'

// Pick the data source for rail modules and per-game lines.
//   VITE_INSIGHTS_SOURCE=mock  (default) deterministic sample data
//   VITE_INSIGHTS_SOURCE=espn  ESPN public site API, straight from the browser
// A provider exposes getGameLines(date, games), getStandings(), getLeaders().
const providers = {
  mock: mockProvider,
  espn: espnProvider,
}

export const insightsProvider =
  providers[import.meta.env.VITE_INSIGHTS_SOURCE] || mockProvider

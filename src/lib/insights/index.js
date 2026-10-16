export { matchupKey } from './teams'

// Data source for rail modules and per-game lines. A provider exposes
// getGameLines(date, games), getStandings(season) and getLeaders(season);
// swap this export to use another source (e.g. balldontlie via an edge function).
export * as insightsProvider from './espnProvider'

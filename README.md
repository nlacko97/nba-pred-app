# nba-pred-app
Vote on NBA games from the 2024 season. Vue SPA + Supabase backend

# nba-pred-app

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## Game insights & demo data

The Games page rail (closest matchup, league standings, league leaders) and the
per-game lines strip (spread, total, win probability, TV) read from a pluggable
provider in `src/lib/insights/`:

| `VITE_INSIGHTS_SOURCE` | Source |
| --- | --- |
| `mock` (default) | Deterministic sample data, labelled "Sample" in the UI |
| `espn` | ESPN public site API (no key, CORS-enabled, unofficial) |

A provider exports `getGameLines(date, games)`, `getStandings()` and
`getLeaders()`; add another file with the same shape to use a different source
(e.g. balldontlie GOAT tier via a Supabase edge function).

The injury report module uses the existing RotoWire feed (`get-injuries`).

Set `VITE_DEMO_GAMES=true` to add a local-only preview slate to today's date
(one live game, three upcoming). Picks on demo games never reach Supabase.

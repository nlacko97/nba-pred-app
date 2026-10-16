# nba-pred-app
Pick NBA games every night with confidence points. Vue SPA + Supabase backend

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

## Game insights

The Games page rail (closest matchup, league standings, league leaders) and the
per-game lines strip (spread, total, win probability, arena) read from ESPN's
public site API (no key, CORS-enabled, unofficial) in
`src/lib/insights/espnProvider.js`. Before a season's first game, standings and
leaders fall back to the previous season's final numbers, labelled as such.

The injury report module uses the existing RotoWire feed (`get-injuries`).

The schedule comes from balldontlie via the `refresh-schedule` edge function.
It loads the next 30 days by default; call it with `?full=1` to load the
whole season.

# Agent Guidelines for NBA Prediction App

## Build/Lint/Test Commands

- **Build**: `npm run build` (Vite production build)
- **Dev server**: `npm run dev` (Vite dev server)
- **Lint**: `npm run lint` (ESLint with auto-fix)
- **Format**: `npm run format` (Prettier on src/)
- **No test framework configured** - run lint after changes

## Code Style Guidelines

### Framework & Language

- **Vue 3** with Composition API (`<script setup>`)
- **JavaScript** (not TypeScript)
- **Pinia** for state management
- **Vue Router** for routing
- **Tailwind CSS** for styling

### Imports & Structure

- Group imports: Vue/React → third-party → local
- Use path aliases: `@/*` maps to `./src/*`
- Single quotes, no semicolons, avoid arrow parens (Prettier)

### Naming Conventions

- **Variables/functions**: camelCase
- **Components**: PascalCase
- **Files**: kebab-case for Vue files, camelCase for JS
- **Stores**: `useXxxStore` pattern

### Error Handling

- API errors: `console.error()` + early return
- User-facing errors: `alert()` messages
- Async operations: check for error objects from Supabase calls

### Vue Patterns

- Use Composition API with `<script setup>`
- Reactive refs for state, computed for derived values
- Watchers for side effects
- Template logic in computed properties when possible

### Security

- Never log or commit secrets/keys
- Use environment variables for sensitive data
- Validate user input before API calls

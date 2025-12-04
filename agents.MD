# Engineering Playbook

Guidelines for keeping the app fast, stable, and consistent across iOS and Android.

## Architecture & Files
- Default to feature-first inside `src/features/<feature>`, grouping that feature’s `screens`, `components`, `hooks`, `services`, and `constants` together; keep true cross-feature pieces in `components`, `utils`, and app-wide config in `constants`.
- Keep navigation-only code in `navigation/`; route-aware UI lives with its feature, not the navigator.
- Export types from the module that owns them; avoid deep relative imports by re-exporting through an index when it improves clarity.
- Delete unused code and props promptly; do not leave commented-out blocks.

## SOLID & Design
- Single Responsibility: keep screens, hooks, and services focused on one concern; split mixed logic instead of adding flags.
- Open/Closed + Liskov: extend behavior via composition/props and compatible interfaces instead of editing shared bases.
- Interface Segregation: prefer small, purpose-built interfaces/hooks over “god” contexts; keep dependencies narrow.
- Dependency Inversion: inject services/config into features and hooks rather than hard-coding globals to keep units testable.

## Constants & Copy
- Centralize static strings and enums in `src/constants` (e.g., `strings.ts`, `errors.ts`, `events.ts`) instead of hardcoding in components.
- Keep endpoint paths, feature flags, pagination sizes, and magic numbers in constants; co-locate when truly feature-specific.
- Gate noisy logs behind `__DEV__` and keep user-facing messages friendly and concise.

## Data Fetching & State
- Prefer a single source of truth per entity; cache paginated results and merge incrementally instead of re-sorting full arrays.
- Make fetchers resilient: GraphQL first, then REST fallback, with proper cursor handling (`hasNextPage`, `endCursor`) and deduping by message id/timestamp.
- Avoid duplicate requests: guard with refs/flags, throttle scroll-triggered pagination, and debounce rapid calls.
- Keep React state minimal; use refs for ephemeral fetch flags and avoid state writes inside tight scroll handlers.
- Memoize render props (`useCallback`/`useMemo`) and avoid recreating inline functions for list rows.

## UI/UX & Platform Parity
- Verify layouts on both iOS and Android: safe areas, keyboard avoidance, touch targets, and platform-specific shadows/ripples.
- Use virtualization (`FlatList`/`FlashList`) with stable keys and estimated sizes; keep list item components pure and memoized.
- Respect theme (`light/dark`), accessibility (roles, labels, hitSlop), and dynamic type where applicable.
- Handle loading, empty, and error states consistently; show actionable retry where it makes sense.

## Performance
- Strip heavy synchronous work from render paths; move expensive logic to memoized selectors or background tasks.
- Batch state updates, prefer immutable-but-stable references for unchanged list items, and avoid logging inside animation/scroll loops.
- Reuse images/avatars with caching where possible; avoid unnecessary re-measurement of list items.

## Error Handling & Resilience
- Always handle network errors with user-friendly copy and console context in dev builds.
- Validate inputs before API calls; fail fast with clear messages.
- Gracefully handle missing access groups/keys by refetching once and surfacing status.

## Testing & Quality Gates
- Add unit tests for utilities and parsers; add component/integration tests for critical flows (message send/receive, pagination).
- Run lint/type checks locally; keep CI green before merging.
- Code review checklist: platform parity, pagination guards, memoization for lists, constants extracted, accessibility, and error paths covered.

## Git & Change Hygiene
- Small, focused commits with clear messages.
- Keep PRs scoped: feature or refactor, not both. Remove dead code and unused imports in the same pass.

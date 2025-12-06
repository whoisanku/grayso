# Engineering Playbook

Guidelines for keeping the app fast, stable, and consistent across iOS, Android, and Web.

## Architecture & Structure

We follow a layer-based architecture similar to Bluesky's `social-app`, designed for scalability and code reuse.

-   **`src/view`**: Contains all UI-related code.
    -   `screens/`: Top-level screen components, grouped by feature if necessary (e.g., `auth/`, `profile/`).
    -   `components/`: Reusable UI components.
    -   `hooks/`: View-logic hooks (e.g., animations, form handling, local UI state).
-   **`src/state`**: Global state management (React Query, Context, Stores).
    -   `queries/`: React Query definitions/hooks, grouped by domain (e.g., `messages/`, `feed/`).
    -   `mutations/`: Mutation hooks for data modification.
-   **`src/services`**: API clients, backend interactions, and third-party service wrappers (e.g., DeSo protocol, Storage).
-   **`src/alf`**: Application Layout & Foundations. Design system abstraction layer (theming, typography, atoms).
-   **`src/lib`**: Generic utilities and helpers (e.g., string formatting, date parsing) that are not domain-specific.
-   **`src/navigation`**: Navigation configuration (stacks, tabs).

## SOLID & Design

-   **Single Responsibility**: Keep screens, hooks, and services focused on one concern.
-   **Dependency Inversion**: Inject services/config into features and hooks rather than hard-coding globals.
-   **Composition**: Extend behavior via composition/props instead of inheritance.

## Styling (NativeWind)

-   **Always use NativeWind `className`** for styling.
-   Avoid `StyleSheet.create` unless absolutely necessary for dynamic values that Tailwind cannot express.
-   Use `className` props directly: `<View className="flex-1 bg-white dark:bg-black" />`.
-   Support Dark Mode using the `dark:` prefix.
-   Use `src/alf` helpers or atoms if established for common patterns.

## Data Fetching & State

-   **React Query**: Use `@tanstack/react-query` for all async server state.
-   **Query Keys**: Define query keys in a dedicated file (e.g., `src/state/queries/keys.ts`) or collocated with the hook factory.
-   **Optimistic Updates**: Implement optimistic updates for better UX on mutations (e.g., sending messages).
-   **Pagination**: Use `useInfiniteQuery` for lists.

## Platform Parity (Web Support)

-   **Mobile First, Web Compatible**: Ensure all code runs on Web.
-   **Native Modules**: Guard native-only modules (like `react-native-keyboard-controller`, `expo-haptics`) with platform checks (`Platform.OS !== 'web'`) or lazy imports.
-   **Navigation**: Ensure deep linking and browser history work correctly on Web.

## Testing

-   Add unit tests for utilities and parsers.
-   Use integration tests for critical flows (authentication, messaging).

## Git Hygiene

-   Small, focused commits.
-   Clear commit messages.
-   Delete unused code immediately.

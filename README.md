# Grayso

A universal, open-source social app built on the [DeSo Protocol](https://deso.org). Runs natively on iOS and Android and in the browser from a single codebase, powered by Expo and React Native.

## Overview

Grayso is a decentralized social application that connects to the DeSo blockchain. It provides a full social experience including a content feed, direct messaging, notifications, wallet management, and user profiles, all without a centralized server controlling your data or identity.

The app is built as a universal application, meaning the same TypeScript source compiles to a native iOS app, a native Android app, and a progressive web app.

## Features

- Decentralized authentication via the DeSo identity system (no seed phrases stored)
- Social feed with posts, likes, and comments
- Direct messaging backed by Supabase real-time channels
- Notifications
- On-chain wallet with DeSo token support
- User profile browsing and editing
- Search
- Settings and theme control
- Dark mode support
- Runs on iOS, Android, and Web from one codebase

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54 / React Native 0.81 |
| Language | TypeScript (strict mode) |
| Routing | Expo Router (file-based) |
| Styling | NativeWind v4 (Tailwind CSS) |
| Server State | TanStack Query v5 |
| Client State | Zustand + react-native-mmkv |
| Blockchain | DeSo Protocol SDK |
| Backend / Realtime | Supabase |
| Lists | Shopify FlashList |
| Animations | React Native Reanimated 4 |
| Validation | Zod v4 |

## Project Structure

The codebase follows a modified Feature-Sliced Design (FSD) pattern adapted for Expo Router.

```
src/
  app/              # File-system routing only (no business logic)
  features/         # Self-contained domain modules
    auth/
    feed/
    messaging/
    notifications/
    profile/
    search/
    settings/
    wallet/
  components/ui/    # Reusable design system atoms
  lib/              # Third-party wrappers (DeSo SDK, Supabase, MMKV)
  state/            # Global Zustand stores
  hooks/            # Shared custom hooks
  utils/            # Shared utility functions
  types/            # Shared TypeScript types
  theme/            # Design tokens and theme config
  constants/        # App-wide constants
```

Each feature module contains its own `api/`, `components/`, `hooks/`, and `screens/` subdirectories to keep concerns co-located and self-contained.

## Prerequisites

- Node.js 20 or later
- Yarn 1.22 or later
- Expo CLI (`npm install -g expo-cli`) or use `npx expo`
- For iOS builds: macOS with Xcode 15 or later
- For Android builds: Android Studio with SDK 34

## Getting Started

**1. Clone the repository**

```bash
git clone https://github.com/your-username/grayso.git
cd grayso
```

**2. Install dependencies**

```bash
yarn install
```

**3. Configure environment variables**

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

You will need a free [Supabase](https://supabase.com) project for real-time messaging. The DeSo blockchain integration works out of the box with no additional API key.

**4. Start the development server**

```bash
# Interactive Expo dev server (scan QR with Expo Go)
yarn start

# Web only
yarn web

# Android (requires emulator or connected device)
yarn android

# iOS (macOS only)
yarn ios
```

## Running on a Physical Device

Install the [Expo Go](https://expo.dev/go) app on your phone, start the dev server with `yarn start`, and scan the QR code shown in the terminal.

For a production-like native build, use EAS Build:

```bash
npx eas build --platform android
npx eas build --platform ios
```

## Code Quality

```bash
# Type checking
yarn typecheck

# Lint
yarn lint

# Lint and auto-fix
yarn lint:fix
```

## Authentication

Grayso uses the DeSo identity system. Users log in by opening the official DeSo identity window (via `expo-web-browser` on mobile, via a redirect on web). The app requests a **Derived Key** for signing transactions. The user's seed phrase is never requested or stored.

Derived keys are stored in `expo-secure-store` on mobile and in `localStorage` on web.

## Contributing

Contributions are welcome. Please open an issue before submitting a pull request so the proposed change can be discussed first.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes with a clear message
4. Push and open a pull request against `main`

Please follow the existing code style. All new API responses must be validated with Zod. No `any` types. Named exports only.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

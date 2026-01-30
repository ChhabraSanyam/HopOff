# HopOff! - Location-based Transport Alarms

A React Native mobile application that helps public transport users avoid missing their stops by providing location-based alarms.

## Project Overview

This project uses **Expo SDK 54** with **Expo Router** for modern file-based routing and follows current Expo development best practices.

### Technology Stack

- **Framework**: Expo SDK 54.0.31, React Native 0.81.5, React 19.1.0
- **Navigation**: Expo Router 6.0.21 (file-based routing)
- **State Management**: Redux Toolkit 2.11.2, React Redux 9.2.0
- **Location Services**: Expo Location, Expo Task Manager
- **Maps**: React Native Maps 1.20.1
- **Notifications**: Expo Notifications
- **Storage**: Async Storage, Expo SQLite
- **Development**: TypeScript 5.9.2, ESLint

### Project Structure

```
app/
├── _layout.tsx                 # Root layout with providers
├── index.tsx                   # Entry point (redirect logic)
├── (tabs)/
│   ├── _layout.tsx             # Tab navigation layout
│   ├── index.tsx               # Map screen (main tab)
│   ├── alarm.tsx               # Alarm management screen
│   ├── destinations.tsx        # Saved destinations screen
│   └── settings.tsx            # Settings screen
├── (onboarding)/
│   ├── _layout.tsx             # Onboarding layout
│   └── index.tsx               # Onboarding screen
└── +not-found.tsx              # 404 page

components/                     # Reusable UI components
services/                       # Business logic services
store/                          # Redux store and slices
types/                          # TypeScript type definitions
utils/                          # Utility functions
hooks/                          # Custom React hooks
contexts/                       # React contexts
metro/                          # Metro components
```

### Key Features

- **Location-based Alarms**: Smart alarms that trigger based on proximity to destinations
- **Interactive Map**: Touch-to-select destinations with real-time location tracking
- **Geofencing**: Battery-efficient location monitoring using native geofencing APIs
- **Metro Integration**: Specialized support for metro/subway systems with route calculation
- **Customizable Settings**: Adjustable alarm distances, vibration, and notification preferences (sounds managed via system notification settings)
- **Saved Destinations**: Quick access to frequently used locations
- **Background Processing**: Reliable alarm triggering even when app is backgrounded
- **Cross-Platform**: Native iOS and Android support with platform-specific optimizations

### Architecture Highlights

- **File-based Routing**: Modern navigation with Expo Router
- **Type Safety**: Full TypeScript integration with auto-generated route types
- **State Management**: Centralized state with Redux Toolkit and RTK Query
- **Service Layer**: Modular business logic with dedicated service classes
- **Native Integration**: Direct access to iOS CoreLocation and Android GeofencingClient
- **Performance Optimized**: React Compiler enabled for improved performance

### Development

```bash
# Start the development server
npm start

# Lint code
npm run lint

# Type check
npx tsc --noEmit
```

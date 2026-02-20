# HopOff! – Geo Alarm

**HopOff!** is a cross-platform mobile application, which provides customizable location-based alerts designed to help public transport commuters (with a focus on Delhi Metro passengers) avoid missing their stops by triggering alarms(notifications, sound, and haptics) when they approach their destination.


## Features

- **Offline First**: Works fully offline after a location is saved. Uses local SQLite for metro route data and search history.
- **Smart Notifications**: Persistent notifications showing real-time distance to your destination, coupled with sound and haptic alerts.
- **Interactive Map & Search**: Integrated search for addresses with real-time feedback and the ability to pin destinations directly on the map.
- **Hybrid Location Monitoring**: Combines native OS-level geofencing with background distance polling to ensure high reliability even in high-speed transit environments.
- **Adaptive Battery Optimization**: Dynamic polling frequency that adjusts based on distance to minimize battery drain when far from the destination.
- **Delhi Metro Integration**: Specialized offline support for the Delhi Metro system, including automatic detection and alarm configuration for interchange stops.
- **GPS-Denied Fallback**: Predictive alert mechanism using last known speed and ETA for underground/tunnel segments (Currently under refinement).


## Technical Implementation

### 1. Hybrid Monitoring Model
Standard geofencing can sometimes fail in high-speed environments like Metro. HopOff! solves this by implementing a hybrid model:
- **OS Geofencing**: Low-power monitoring for broad arrival detection.
- **Background Polling**: Uses the **Haversine Formula** to calculate great-circle distances in a background task, providing precise UI updates and triggering alerts if geofencing is missed.

### 2. Battery & Performance Optimization
- **Adaptive Polling**: The application adjusts the location check frequency based on the remaining distance to the destination (higher frequency when near, lower when far).
- **Foreground Services**: Uses Android Foreground Services to ensure the background task remains active even when the app is closed or the screen is off.

### Offline-First Architecture
HopOff! is designed to be functional in data-poor environments:
-   **SQLite**: Stores the entire Delhi Metro station network and interchange logic.
-   **Search History**: Previous destinations are cached for one-tap access.
-   **Geocoding**: Required only during the initial search; all subsequent monitoring logic is local.


## Tech Stack

- **Framework**: React Native + Expo SDK 54
- **Navigation**: Expo Router (file-based navigation)
- **State Management**: Redux Toolkit (global state), React Context (UI-specific state)
- **Maps**: React Native Maps
- **Geocoding**: Nominatim (OpenStreetMap)
- **Persistence**: Expo SQLite, AsyncStorage
- **Notifications**: Expo Notifications
- **Task Management**: Expo Task Manager


## Project Structure

```text
├── app/                  # Expo Router screens and layouts
│   ├── (onboarding)/     # First-time user experience
│   ├── (tabs)/           # Main application tabs (Map, Alarms, History, Settings)
│   └── _layout.tsx       # Root layout and context providers
├── components/           # Reusable UI components
├── contexts/             # React Contexts (e.g., Toast notifications)
├── services/             # Business logic layer (AlarmManager, LocationManager, etc.)
├── store/                # Redux store, slices, and hooks
├── types/                # TypeScript interfaces and type definitions
├── utils/                # Helper functions and shared utilities
└── assets/               # Static assets (images, icons, fonts)
```


## 📄 License
This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

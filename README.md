# HopOff! - Location-based Transport Alarms

A React Native mobile application that helps public transport users avoid missing their stops by providing location-based alarms.

## Project Setup

This project was initialized with Expo CLI using TypeScript template and includes all necessary dependencies for the HopOff! application.

### Dependencies Installed

- **Core Framework**: Expo SDK, React Native with TypeScript
- **State Management**: Redux Toolkit, React Redux
- **Location Services**: Expo Location, Expo Task Manager
- **Maps**: React Native Maps
- **Notifications**: Expo Notifications
- **Storage**: Expo Secure Store, Expo SQLite
- **Development**: TypeScript types for React Native Maps

### Project Structure

```
src/
├── components/          # Reusable UI components
├── screens/            # Screen components
├── services/           # Business logic services
├── store/              # Redux store and slices
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── hooks/              # Custom React hooks
```

### Key Features

- Location-based alarms for public transport
- Interactive map for destination selection
- Geofencing for battery-efficient monitoring
- Customizable alarm settings
- Saved destinations management
- Offline functionality
- Battery optimization

### Development

```bash
# Start the development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web
npm run web
```

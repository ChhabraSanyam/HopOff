# Redux Store Documentation

This directory contains the Redux store configuration and state management for the HopOff! application.

## Structure

```
store/
├── index.ts              # Main store configuration
├── hooks.ts              # Typed Redux hooks
├── api/
│   └── apiSlice.ts       # RTK Query API slice for future integrations
├── slices/
│   ├── alarmSlice.ts     # Alarm state management
│   ├── locationSlice.ts  # Location state management
│   ├── destinationSlice.ts # Destination state management
│   ├── settingsSlice.ts  # User settings state management
│   └── uiSlice.ts        # UI state management
└── __tests__/            # Unit tests for Redux logic
```

## Store Configuration

The store is configured with Redux Toolkit and includes:

- **Redux Toolkit**: Modern Redux with simplified syntax
- **RTK Query**: For future API integrations (Google Places, Delhi Metro)
- **TypeScript**: Full type safety for state and actions
- **Middleware**: Default RTK middleware plus RTK Query middleware

## State Structure

```typescript
interface AppState {
  alarm: AlarmState;
  location: LocationState;
  destinations: DestinationState;
  settings: UserSettings;
  ui: UIState;
  api: RTKQueryState;
}
```

## Slices Overview

### AlarmSlice

Manages alarm lifecycle and state:

- Active alarm tracking
- Alarm history
- Loading states and error handling
- Async actions for create/cancel/trigger

**Key Actions:**

- `setActiveAlarm` - Set or clear active alarm
- `createAlarm` - Async action to create new alarm
- `cancelAlarm` - Async action to cancel alarm
- `triggerAlarm` - Async action when alarm is triggered
- `updateAlarmSettings` - Update alarm configuration

### LocationSlice

Manages location services and permissions:

- Current location tracking
- Permission status
- Location accuracy and timestamps
- Error handling

**Key Actions:**

- `setCurrentLocation` - Update current location
- `setLocationPermission` - Update permission status
- `requestLocationPermission` - Async permission request
- `getCurrentLocation` - Async location fetch

### DestinationSlice

Manages saved and recent destinations:

- Saved destinations (favorites)
- Recent destinations history
- CRUD operations
- Loading states

**Key Actions:**

- `addSavedDestination` - Add to saved destinations
- `removeSavedDestination` - Remove from saved
- `addRecentDestination` - Add to recent history
- `loadSavedDestinations` - Async load from storage
- `saveDestination` - Async save to storage

### SettingsSlice

Manages user preferences:

- Default alarm settings
- App configuration
- Battery optimization preferences

**Key Actions:**

- `updateSettings` - Update user preferences
- `resetSettings` - Reset to defaults

### UISlice

Manages UI state and navigation:

- Selected destinations
- Map region and state
- Modal visibility
- Active screen tracking

**Key Actions:**

- `setSelectedDestination` - Set map selection
- `setMapRegion` - Update map viewport
- `showDestinationModal` / `hideDestinationModal` - Modal control
- `setActiveScreen` - Navigation state

## Usage

### Basic Usage

```typescript
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setActiveAlarm } from '../store/slices/alarmSlice';

function MyComponent() {
  const dispatch = useAppDispatch();
  const activeAlarm = useAppSelector(state => state.alarm.activeAlarm);

  const handleSetAlarm = () => {
    dispatch(setActiveAlarm(alarm));
  };

  return (
    <View>
      {activeAlarm && <Text>Alarm active for {activeAlarm.destination.name}</Text>}
    </View>
  );
}
```

### Using Convenience Hooks

```typescript
import { useActiveAlarm, useCurrentLocation } from '../store/hooks';

function AlarmStatus() {
  const activeAlarm = useActiveAlarm();
  const currentLocation = useCurrentLocation();

  return (
    <View>
      {activeAlarm && (
        <Text>
          Alarm set for {activeAlarm.destination.name}
          {currentLocation && ` - Current location: ${currentLocation.latitude}, ${currentLocation.longitude}`}
        </Text>
      )}
    </View>
  );
}
```

### Async Actions

```typescript
import { createAlarm } from '../store/slices/alarmSlice';

function CreateAlarmButton() {
  const dispatch = useAppDispatch();

  const handleCreateAlarm = async () => {
    try {
      await dispatch(createAlarm({ destination, settings })).unwrap();
      // Alarm created successfully
    } catch (error) {
      // Handle error
    }
  };

  return <Button onPress={handleCreateAlarm} title="Create Alarm" />;
}
```

## RTK Query Integration

The API slice is set up for future integrations:

```typescript
// Google Places search (future implementation)
const { data: places, isLoading } = useSearchPlacesQuery("search term");

// Delhi Metro stations (future implementation)
const { data: stations } = useGetMetroStationsQuery();
```

## Testing

Unit tests are provided for all slices:

```bash
npm test -- --testPathPatterns="store"
```

Tests cover:

- Action creators and reducers
- State transitions
- Error handling
- Async action lifecycle
- Initial state validation

## Best Practices

1. **Use Typed Hooks**: Always use `useAppDispatch` and `useAppSelector`
2. **Convenience Selectors**: Use provided convenience hooks for common selections
3. **Async Actions**: Use RTK's `createAsyncThunk` for side effects
4. **Error Handling**: Always handle loading and error states
5. **Immutability**: RTK uses Immer internally, write "mutative" logic safely
6. **Type Safety**: Leverage TypeScript for compile-time safety

## Future Enhancements

- Google Places API integration
- Delhi Metro data integration
- Cloud sync for saved destinations
- Offline state management
- Performance optimizations

## Dependencies

- `@reduxjs/toolkit` - Modern Redux
- `react-redux` - React bindings
- `typescript` - Type safety

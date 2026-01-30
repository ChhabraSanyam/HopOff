// Typed hooks for Redux usage
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "./index";

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Convenience selectors
export const useAlarmState = () => useAppSelector((state) => state.alarm);
export const useLocationState = () => useAppSelector((state) => state.location);
export const useDestinationState = () =>
  useAppSelector((state) => state.destinations);
export const useSettingsState = () => useAppSelector((state) => state.settings);
export const useUIState = () => useAppSelector((state) => state.ui);

// Specific selectors for common use cases
export const useActiveAlarm = () =>
  useAppSelector((state) => state.alarm.activeAlarm);
export const useCurrentLocation = () =>
  useAppSelector((state) => state.location.currentLocation);
export const useLocationPermission = () =>
  useAppSelector((state) => state.location.locationPermission);
export const useSavedDestinations = () =>
  useAppSelector((state) => state.destinations.saved);
export const useRecentDestinations = () =>
  useAppSelector((state) => state.destinations.recent);
export const useSearchHistory = () =>
  useAppSelector((state) => state.destinations.searchHistory);
export const useSelectedDestination = () =>
  useAppSelector((state) => state.ui.selectedDestination);
export const useMapRegion = () => useAppSelector((state) => state.ui.mapRegion);
export const useUserSettings = () => useAppSelector((state) => state.settings);

// Loading state selectors
export const useIsAlarmLoading = () =>
  useAppSelector((state) => state.alarm.isLoading);
export const useIsLocationLoading = () =>
  useAppSelector(
    (state) =>
      state.location.currentLocation === null &&
      state.location.locationPermission === "granted",
  );
export const useIsDestinationLoading = () =>
  useAppSelector((state) => state.destinations.isLoading);

// Error selectors
export const useAlarmError = () => useAppSelector((state) => state.alarm.error);
export const useLocationError = () =>
  useAppSelector((state) => state.location.error);
export const useDestinationError = () =>
  useAppSelector((state) => state.destinations.error);

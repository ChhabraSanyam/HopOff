// Custom hook for alarm monitoring and real-time updates
import { useCallback, useEffect, useRef } from "react";
import { locationManager } from "../services/LocationManager";
import { notificationManager } from "../services/NotificationManager";
import {
  useActiveAlarms,
  useAppDispatch,
  useCurrentLocation,
  useHasActiveAlarms,
  useUserSettings,
} from "../store/hooks";
import { getCurrentLocation } from "../store/slices/locationSlice";
import { Alarm, Coordinate } from "../types";

interface UseAlarmMonitoringOptions {
  updateInterval?: number; // milliseconds
  enablePersistentNotification?: boolean;
}

export const useAlarmMonitoring = (options: UseAlarmMonitoringOptions = {}) => {
  const {
    updateInterval = 10000, // 10 seconds default
    enablePersistentNotification = true,
  } = options;

  const dispatch = useAppDispatch();
  const activeAlarms = useActiveAlarms();
  const hasActiveAlarms = useHasActiveAlarms();
  const currentLocation = useCurrentLocation();
  const userSettings = useUserSettings();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMonitoringRef = useRef(false);

  // Calculate distance between current location and a specific coordinate
  const calculateDistanceToCoordinate = useCallback(
    (coordinate: Coordinate): number | null => {
      if (!currentLocation) return null;

      try {
        return locationManager.calculateDistance(currentLocation, coordinate);
      } catch (error) {
        console.error("Error calculating distance:", error);
        return null;
      }
    },
    [currentLocation],
  );

  // Update persistent notification with all alarm distances
  const updatePersistentNotification = useCallback(async () => {
    if (!enablePersistentNotification || !userSettings.persistentNotificationEnabled || activeAlarms.length === 0) return;

    // Check if any alarm has persistent notification enabled
    const alarmsWithNotification = activeAlarms.filter(
      (alarm) => alarm.settings.persistentNotification,
    );

    if (alarmsWithNotification.length === 0) return;

    try {
      // Calculate distances for all alarms with notification enabled
      const alarmDistances = alarmsWithNotification
        .map((alarm) => {
          const distance = calculateDistanceToCoordinate(
            alarm.destination.coordinate,
          );
          return distance !== null ? { alarm, distance } : null;
        })
        .filter(
          (item): item is { alarm: Alarm; distance: number } => item !== null,
        );

      if (alarmDistances.length === 0) return;

      // Use the new multiple alarms notification method
      await notificationManager.showMultipleAlarmsPersistentNotification(
        alarmDistances,
      );
    } catch (error) {
      console.error("Error updating persistent notification:", error);
    }
  }, [
    activeAlarms,
    enablePersistentNotification,
    userSettings.persistentNotificationEnabled,
    calculateDistanceToCoordinate,
  ]);

  // Start monitoring location updates
  const startMonitoring = useCallback(() => {
    if (isMonitoringRef.current || !hasActiveAlarms) return;

    console.log("Starting alarm monitoring with interval:", updateInterval);
    isMonitoringRef.current = true;

    // Get initial location
    dispatch(getCurrentLocation());

    // Start foreground location updates
    locationManager.startForegroundLocationUpdates();

    // Set up periodic location updates
    intervalRef.current = setInterval(() => {
      dispatch(getCurrentLocation());
    }, updateInterval) as unknown as NodeJS.Timeout;
  }, [hasActiveAlarms, dispatch, updateInterval]);

  // Stop monitoring location updates
  const stopMonitoring = useCallback(() => {
    if (!isMonitoringRef.current) return;

    console.log("Stopping alarm monitoring");
    isMonitoringRef.current = false;

    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Stop foreground location updates
    locationManager.stopForegroundLocationUpdates();
  }, []);

  // Effect to start/stop monitoring based on active alarms
  useEffect(() => {
    if (hasActiveAlarms) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    // Cleanup on unmount
    return () => {
      stopMonitoring();
    };
  }, [hasActiveAlarms, startMonitoring, stopMonitoring]);

  // Effect to update persistent notification when distance changes
  useEffect(() => {
    if (hasActiveAlarms) {
      updatePersistentNotification();
    }
  }, [hasActiveAlarms, updatePersistentNotification]);
};

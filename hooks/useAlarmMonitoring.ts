// Custom hook for alarm monitoring and real-time updates
import { useCallback, useEffect, useRef } from "react";
import { locationManager } from "../services/LocationManager";
import { notificationManager } from "../services/NotificationManager";
import {
  useActiveAlarms,
  useAppDispatch,
  useCurrentLocation,
  useHasActiveAlarms,
} from "../store/hooks";
import { getCurrentLocation } from "../store/slices/locationSlice";
import { Alarm, Coordinate } from "../types";

interface UseAlarmMonitoringOptions {
  updateInterval?: number; // milliseconds
  enablePersistentNotification?: boolean;
}

interface AlarmDistance {
  alarmId: string;
  distance: number;
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

  // Calculate distances to all active alarms
  const calculateAllDistances = useCallback((): AlarmDistance[] => {
    if (!currentLocation || activeAlarms.length === 0) return [];

    return activeAlarms
      .map((alarm) => ({
        alarmId: alarm.id,
        distance:
          calculateDistanceToCoordinate(alarm.destination.coordinate) ??
          Infinity,
      }))
      .filter((d) => d.distance !== Infinity);
  }, [activeAlarms, currentLocation, calculateDistanceToCoordinate]);

  // Get the closest alarm (for notification purposes)
  const getClosestAlarm = useCallback((): {
    alarm: Alarm;
    distance: number;
  } | null => {
    if (!currentLocation || activeAlarms.length === 0) return null;

    let closest: { alarm: Alarm; distance: number } | null = null;

    for (const alarm of activeAlarms) {
      const distance = calculateDistanceToCoordinate(
        alarm.destination.coordinate,
      );
      if (
        distance !== null &&
        (closest === null || distance < closest.distance)
      ) {
        closest = { alarm, distance };
      }
    }

    return closest;
  }, [activeAlarms, currentLocation, calculateDistanceToCoordinate]);

  // Update persistent notification with closest alarm distance
  const updatePersistentNotification = useCallback(async () => {
    if (!enablePersistentNotification || activeAlarms.length === 0) return;

    const closest = getClosestAlarm();
    if (!closest) return;

    try {
      if (closest.alarm.settings.persistentNotification) {
        await notificationManager.showPersistentNotification(
          closest.alarm,
          closest.distance,
        );
      }
    } catch (error) {
      console.error("Error updating persistent notification:", error);
    }
  }, [activeAlarms, enablePersistentNotification, getClosestAlarm]);

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

  return {
    distances: calculateAllDistances(),
    closestAlarm: getClosestAlarm(),
    isMonitoring: isMonitoringRef.current,
    startMonitoring,
    stopMonitoring,
    calculateDistanceToCoordinate,
  };
};

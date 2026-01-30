// Custom hook for alarm monitoring and real-time updates
import { useCallback, useEffect, useRef } from 'react';
import { locationManager } from '../services/LocationManager';
import { notificationManager } from '../services/NotificationManager';
import { useActiveAlarm, useAppDispatch, useCurrentLocation } from '../store/hooks';
import { getCurrentLocation } from '../store/slices/locationSlice';

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
  const activeAlarm = useActiveAlarm();
  const currentLocation = useCurrentLocation();
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMonitoringRef = useRef(false);

  // Calculate distance between current location and destination
  const calculateDistance = useCallback(() => {
    if (!activeAlarm || !currentLocation) return null;
    
    try {
      return locationManager.calculateDistance(
        currentLocation,
        activeAlarm.destination.coordinate
      );
    } catch (error) {
      console.error('Error calculating distance:', error);
      return null;
    }
  }, [activeAlarm, currentLocation]);

  // Update persistent notification with current distance
  const updatePersistentNotification = useCallback(async (distance: number) => {
    if (!activeAlarm || !enablePersistentNotification) return;
    
    try {
      if (activeAlarm.settings.persistentNotification) {
        await notificationManager.showPersistentNotification(activeAlarm, distance);
      }
    } catch (error) {
      console.error('Error updating persistent notification:', error);
    }
  }, [activeAlarm, enablePersistentNotification]);

  // Start monitoring location updates
  const startMonitoring = useCallback(() => {
    if (isMonitoringRef.current || !activeAlarm) return;

    console.log('Starting alarm monitoring with interval:', updateInterval);
    isMonitoringRef.current = true;

    // Get initial location
    dispatch(getCurrentLocation());

    // Start foreground location updates
    locationManager.startForegroundLocationUpdates();

    // Set up periodic location updates
    intervalRef.current = setInterval(() => {
      dispatch(getCurrentLocation());
    }, updateInterval) as unknown as NodeJS.Timeout;
  }, [activeAlarm, dispatch, updateInterval]);

  // Stop monitoring location updates
  const stopMonitoring = useCallback(() => {
    if (!isMonitoringRef.current) return;

    console.log('Stopping alarm monitoring');
    isMonitoringRef.current = false;

    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Stop foreground location updates
    locationManager.stopForegroundLocationUpdates();
  }, []);

  // Effect to start/stop monitoring based on active alarm
  useEffect(() => {
    if (activeAlarm) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    // Cleanup on unmount
    return () => {
      stopMonitoring();
    };
  }, [activeAlarm, startMonitoring, stopMonitoring]);

  // Effect to update persistent notification when distance changes
  useEffect(() => {
    const distance = calculateDistance();
    if (distance !== null) {
      updatePersistentNotification(distance);
    }
  }, [calculateDistance, updatePersistentNotification]);

  return {
    distance: calculateDistance(),
    isMonitoring: isMonitoringRef.current,
    startMonitoring,
    stopMonitoring,
  };
};
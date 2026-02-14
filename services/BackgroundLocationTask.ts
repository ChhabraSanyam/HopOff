/**
 * Background Location Task Service
 *
 * Uses expo-location's startLocationUpdatesAsync with an Android foreground service
 * to ensure location monitoring continues when the app is in the background or
 * the screen is off.
 *
 * CRITICAL: TaskManager.defineTask MUST be called at module level (top of file),
 * not inside a class or function. This file must be imported early in the app
 * lifecycle (e.g., in _layout.tsx).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { AppState } from "react-native";
import { store } from "../store";
import { setCurrentLocation } from "../store/slices/locationSlice";
import { Alarm } from "../types";
import { calculateDistance } from "../utils";
import { notificationManager } from "./NotificationManager";

// ─── Constants ───────────────────────────────────────────────────────────────

const BACKGROUND_LOCATION_TASK = "hopoff-background-location-task";
const ACTIVE_ALARMS_STORAGE_KEY = "hopoff_active_alarms";
const SETTINGS_STORAGE_KEY = "user_settings";
const PERSISTENT_NOTIFICATION_ID = "hop-off-persistent";

// ─── Read/write persisted alarms (same key as AlarmManager) ─────────────────
// These cannot be imported from AlarmManager to avoid a circular dependency
// (AlarmManager → BackgroundLocationTask → AlarmManager).

async function getPersistedAlarms(): Promise<Alarm[]> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_ALARMS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Alarm[];
  } catch {
    return [];
  }
}

// ─── Remove a triggered alarm from persisted storage ────────────────────────

async function removePersistedAlarm(alarmId: string): Promise<void> {
  try {
    const alarms = await getPersistedAlarms();
    const remaining = alarms.filter((a) => a.id !== alarmId);
    await AsyncStorage.setItem(
      ACTIVE_ALARMS_STORAGE_KEY,
      JSON.stringify(remaining),
    );
  } catch (e) {
    console.error("BackgroundLocationTask: failed to remove alarm", e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Core alarm-check logic — used by the task callback AND the immediate first check
// ═══════════════════════════════════════════════════════════════════════════════

async function performAlarmCheck(currentCoord: {
  latitude: number;
  longitude: number;
}): Promise<void> {
  // Sync location to Redux only when the app is in the foreground,
  // so we don't cause needless React re-renders while backgrounded.
  if (AppState.currentState === "active") {
    try {
      store.dispatch(setCurrentLocation(currentCoord));
    } catch {
      // Store may not be ready yet during early boot — not critical
    }
  }

  // Read active alarms from persistent storage (AlarmManager writes here)
  const alarms = await getPersistedAlarms();

  if (alarms.length === 0) {
    await BackgroundLocationManager.stop();
    return;
  }

  // Check each alarm
  const triggeredAlarmIds: string[] = [];

  for (const alarm of alarms) {
    const dist = calculateDistance(currentCoord, alarm.destination.coordinate);

    console.log(
      `BG check: ${dist.toFixed(0)}m to ${alarm.destination.name} (trigger at ${alarm.settings.triggerRadius}m)`,
    );

    if (dist <= alarm.settings.triggerRadius) {
      triggeredAlarmIds.push(alarm.id);
      await notificationManager.showAlarmNotification(alarm);
      await removePersistedAlarm(alarm.id);
      console.log(`BG alarm triggered: ${alarm.destination.name}`);
    }
  }

  // Update persistent notification with remaining alarms (only if enabled)
  const remaining = alarms.filter((a) => !triggeredAlarmIds.includes(a.id));

  let persistentEnabled = true;
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const settings = JSON.parse(raw);
      if (settings.persistentNotificationEnabled === false) {
        persistentEnabled = false;
      }
    }
  } catch {
    // fall back to showing
  }

  if (persistentEnabled && remaining.length > 0) {
    const alarmDistances = remaining.map((alarm) => ({
      alarm,
      distance: calculateDistance(currentCoord, alarm.destination.coordinate),
    }));
    await notificationManager.showMultipleAlarmsPersistentNotification(
      alarmDistances,
    );
  } else {
    await Notifications.dismissNotificationAsync(PERSISTENT_NOTIFICATION_ID);
  }

  if (remaining.length === 0) {
    await BackgroundLocationManager.stop();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFINE BACKGROUND TASK — must be at module level
// ═══════════════════════════════════════════════════════════════════════════════

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error("BackgroundLocationTask error:", error.message);
    return;
  }

  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  const latest = locations[locations.length - 1];
  const { latitude, longitude } = latest.coords;
  await performAlarmCheck({ latitude, longitude });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BackgroundLocationManager — public API
// ═══════════════════════════════════════════════════════════════════════════════

export class BackgroundLocationManager {
  private static _isRunning = false;

  /**
   * Start background location updates with an Android foreground service.
   * Safe to call multiple times — will skip if already running.
   */
  static async start(): Promise<void> {
    try {
      // Check if already running
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        BACKGROUND_LOCATION_TASK,
      );
      if (isRegistered) {
        console.log("BackgroundLocationTask: already running");
        BackgroundLocationManager._isRunning = true;
        return;
      }

      // Ensure we have background permission
      const { status: bgStatus } =
        await Location.getBackgroundPermissionsAsync();
      if (bgStatus !== "granted") {
        const { status } = await Location.requestBackgroundPermissionsAsync();
        if (status !== "granted") {
          console.warn(
            "BackgroundLocationTask: background permission denied — cannot start",
          );
          return;
        }
      }

      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 50, // metres — update every 50m moved
        timeInterval: 15_000, // minimum 15s between updates
        showsBackgroundLocationIndicator: true, // iOS blue bar
        pausesUpdatesAutomatically: false, // never auto-pause

        // Android foreground service — this is what keeps the process alive
        foregroundService: {
          notificationTitle: "",
          notificationBody: "",
        },
      });

      BackgroundLocationManager._isRunning = true;
      console.log("BackgroundLocationTask: started");

      // Perform an immediate first check so the persistent notification
      // appears right away instead of waiting for the first OS location update.
      try {
        const loc = await Location.getLastKnownPositionAsync();
        if (loc) {
          const coord = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          await performAlarmCheck(coord);
        }
      } catch {
        // Non-critical — the regular task callback will fire soon
      }
    } catch (e) {
      console.error("BackgroundLocationTask: failed to start", e);
    }
  }

  /**
   * Stop background location updates and remove the foreground service.
   */
  static async stop(): Promise<void> {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        BACKGROUND_LOCATION_TASK,
      );
      if (!isRegistered) {
        BackgroundLocationManager._isRunning = false;
        return;
      }

      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      BackgroundLocationManager._isRunning = false;

      // Clear persistent notification when monitoring stops
      await Notifications.dismissNotificationAsync(PERSISTENT_NOTIFICATION_ID);

      console.log("BackgroundLocationTask: stopped");
    } catch (e) {
      console.error("BackgroundLocationTask: failed to stop", e);
      BackgroundLocationManager._isRunning = false;
    }
  }

  /**
   * Check whether the background task is currently running.
   */
  static async isRunning(): Promise<boolean> {
    try {
      return await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    } catch {
      return false;
    }
  }

  /**
   * Restart — useful after alarm list changes to ensure task picks up new data.
   * The task reads from AsyncStorage each cycle so a pure restart isn't strictly
   * necessary, but it guarantees immediate re-evaluation.
   */
  static async restart(): Promise<void> {
    // No need to fully stop/start — just ensure it's running.
    // The task reads alarms from AsyncStorage on every tick already.
    const running = await BackgroundLocationManager.isRunning();
    if (!running) {
      await BackgroundLocationManager.start();
    }
  }
}

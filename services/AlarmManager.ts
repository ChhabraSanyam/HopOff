// Alarm management service for HopOff app
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alarm, AlarmSettings, Coordinate, Destination } from "../types";
import { calculateDistance } from "../utils";
import { ErrorHandler, handleAsyncOperation } from "../utils/ErrorHandler";
import { BackgroundLocationManager } from "./BackgroundLocationTask";
import { locationManager } from "./LocationManager";
import { notificationManager } from "./NotificationManager";

export interface AlarmManager {
  createAlarm(
    destination: Destination,
    settings: AlarmSettings,
  ): Promise<CreateAlarmResult>;
  cancelAlarm(alarmId: string): Promise<void>;
  getActiveAlarms(): Promise<Alarm[]>;
  triggerAlarm(alarm: Alarm): Promise<void>;
  updateAlarmSettings(
    alarmId: string,
    settings: Partial<AlarmSettings>,
  ): Promise<void>;
  hasGeofenceAtLocation(coordinate: Coordinate, radius?: number): boolean;
}

// Storage key for AsyncStorage
const STORAGE_KEY = "hopoff_active_alarms";

// Distance threshold in meters to consider coordinates as "same location"
const DUPLICATE_LOCATION_THRESHOLD = 50;

// Result type for createAlarm to handle duplicates gracefully
export interface CreateAlarmResult {
  alarm: Alarm;
  isExisting: boolean;
  message?: string;
}

export class AlarmManagerImpl implements AlarmManager {
  private activeAlarms: Map<string, Alarm> = new Map();
  private initialized = false;

  /**
   * Ensure alarms and nested destinations use serializable ISO strings
   * for timestamps instead of Date objects.
   */
  private normalizeAlarm(alarm: Alarm | null): Alarm | null {
    if (!alarm) return null;

    const toIsoString = (value: string | Date) =>
      typeof value === "string" ? value : new Date(value).toISOString();

    return {
      ...alarm,
      createdAt: toIsoString(alarm.createdAt),
      destination: {
        ...alarm.destination,
        createdAt: toIsoString(alarm.destination.createdAt),
      },
    };
  }

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the alarm manager by loading persisted state
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const alarmsData = await AsyncStorage.getItem(STORAGE_KEY);
      if (alarmsData) {
        const parsedAlarms: Alarm[] = JSON.parse(alarmsData);
        for (const alarm of parsedAlarms) {
          const normalizedAlarm = this.normalizeAlarm(alarm);
          if (normalizedAlarm) {
            this.activeAlarms.set(normalizedAlarm.id, normalizedAlarm);
          }
        }

        // Re-register geofence event handlers for all alarms with geofences
        this.setupGeofenceEventHandlers();

        console.log(`Restored ${this.activeAlarms.size} alarms from storage`);

        // Ensure background location task is running for restored alarms
        if (this.activeAlarms.size > 0) {
          BackgroundLocationManager.start().catch((e) =>
            console.warn("Failed to start background task on restore:", e),
          );
        }
      }
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize AlarmManager:", error);
      // Clear corrupted data
      await this.clearPersistedState();
      this.initialized = true;
    }
  }

  /**
   * Setup geofence event handlers for all active alarms
   */
  private setupGeofenceEventHandlers(): void {
    // Set up a single event handler that dynamically looks up alarms
    // This ensures newly created alarms are found even after handler is registered
    locationManager.setGeofenceEventHandler((event) => {
      // Look up alarms at trigger time, not registration time
      const alarm = Array.from(this.activeAlarms.values()).find(
        (a) => a.geofenceId === event.geofenceId,
      );
      if (alarm) {
        console.log(
          `Geofence event matched alarm: ${alarm.id} (${alarm.destination.name})`,
        );
        this.handleAlarmTrigger(alarm);
      } else {
        console.warn(`No alarm found for geofence: ${event.geofenceId}`);
      }
    });

    const alarmsWithGeofences = Array.from(this.activeAlarms.values()).filter(
      (alarm) => alarm.geofenceId,
    );
    if (alarmsWithGeofences.length > 0) {
      console.log(
        `Restored geofence event handlers for ${alarmsWithGeofences.length} alarms`,
      );
    }
  }

  /**
   * Check if there's already a geofence at or near the specified location
   */
  hasGeofenceAtLocation(coordinate: Coordinate, radius?: number): boolean {
    const threshold = radius || DUPLICATE_LOCATION_THRESHOLD;

    for (const alarm of this.activeAlarms.values()) {
      const distance = calculateDistance(
        coordinate,
        alarm.destination.coordinate,
      );
      if (distance <= threshold) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the alarm at a specific location (if any)
   */
  getAlarmAtLocation(coordinate: Coordinate, radius?: number): Alarm | null {
    const threshold = radius || DUPLICATE_LOCATION_THRESHOLD;

    for (const alarm of this.activeAlarms.values()) {
      const distance = calculateDistance(
        coordinate,
        alarm.destination.coordinate,
      );
      if (distance <= threshold) {
        return alarm;
      }
    }
    return null;
  }

  /**
   * Create a new alarm with the specified destination and settings
   * Returns the existing alarm if one already exists near this location
   */
  async createAlarm(
    destination: Destination,
    settings: AlarmSettings,
  ): Promise<CreateAlarmResult> {
    const result = await handleAsyncOperation(async () => {
      await this.initialize();

      // Check for duplicate geofence location - return existing alarm gracefully
      const existingAlarm = this.getAlarmAtLocation(destination.coordinate);
      if (existingAlarm) {
        return {
          alarm: existingAlarm,
          isExisting: true,
          message: `An alarm already exists near this location: "${existingAlarm.destination.name}"`,
        };
      }

      // Validate settings
      this.validateAlarmSettings(settings);

      // Create new alarm
      const alarm: Alarm = {
        id: `alarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        destination,
        settings,
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      // Store in memory and persist
      this.activeAlarms.set(alarm.id, alarm);
      await this.persistAlarms();

      // Set up location monitoring (geofencing or fallback)
      await this.setupLocationMonitoring(alarm);

      // Start background location task (Android foreground service)
      // This ensures monitoring continues when the app is backgrounded
      await BackgroundLocationManager.start();

      return {
        alarm,
        isExisting: false,
      };
    }, "AlarmManager.createAlarm");

    if (!result.success) {
      throw new Error(result.error.message);
    }

    return result.data;
  }

  /**
   * Cancel an existing alarm by ID
   */
  async cancelAlarm(alarmId: string): Promise<void> {
    const result = await handleAsyncOperation(async () => {
      await this.initialize();

      const alarm = this.activeAlarms.get(alarmId);
      if (!alarm) {
        console.log(`Alarm ${alarmId} already cancelled or doesn't exist`);
        return;
      }

      // Clean up location monitoring for this specific alarm
      await this.cleanupAlarmMonitoring(alarm);

      // Remove alarm from map
      this.activeAlarms.delete(alarmId);
      await this.persistAlarms();

      // Update geofence event handlers
      this.setupGeofenceEventHandlers();

      // Stop background task if no alarms remain
      if (this.activeAlarms.size === 0) {
        await BackgroundLocationManager.stop();
      }
    }, "AlarmManager.cancelAlarm");

    if (!result.success) {
      throw new Error(result.error.message);
    }
  }

  /**
   * Cancel all active alarms
   */
  async cancelAllAlarms(): Promise<void> {
    await this.initialize();

    const alarmIds = Array.from(this.activeAlarms.keys());
    for (const alarmId of alarmIds) {
      await this.cancelAlarm(alarmId);
    }

    // Ensure background task is stopped
    await BackgroundLocationManager.stop();
  }

  /**
   * Get all active alarms (waits for initialization)
   */
  async getActiveAlarms(): Promise<Alarm[]> {
    await this.initialize();
    return Array.from(this.activeAlarms.values()).map(
      (alarm) => this.normalizeAlarm(alarm)!,
    );
  }

  /**
   * Get a specific alarm by ID
   */
  getAlarm(alarmId: string): Alarm | null {
    const alarm = this.activeAlarms.get(alarmId);
    return alarm ? this.normalizeAlarm(alarm) : null;
  }

  /**
   * Trigger an alarm (called when geofence is entered)
   */
  async triggerAlarm(alarm: Alarm): Promise<void> {
    await this.initialize();

    const activeAlarm = this.activeAlarms.get(alarm.id);
    if (!activeAlarm) {
      throw new Error("Cannot trigger alarm: no matching active alarm found");
    }

    try {
      // Show alarm notification with sound and haptic feedback
      await notificationManager.showAlarmNotification(alarm);

      console.log(
        `Alarm notification triggered for: ${alarm.destination.name}`,
      );
    } catch (error) {
      console.error("Error showing alarm notification:", error);
      // Continue to clear alarm even if notification fails
    }

    // Clean up this specific alarm's monitoring
    await this.cleanupAlarmMonitoring(activeAlarm);

    // Remove this alarm
    this.activeAlarms.delete(alarm.id);
    await this.persistAlarms();

    // Update geofence event handlers
    this.setupGeofenceEventHandlers();

    // Stop background task if no alarms remain
    if (this.activeAlarms.size === 0) {
      await BackgroundLocationManager.stop();
    }
  }

  /**
   * Update settings for an existing alarm
   */
  async updateAlarmSettings(
    alarmId: string,
    settings: Partial<AlarmSettings>,
  ): Promise<void> {
    await this.initialize();

    const alarm = this.activeAlarms.get(alarmId);
    if (!alarm) {
      throw new Error(`No active alarm found with ID: ${alarmId}`);
    }

    // Validate new settings
    const updatedSettings = { ...alarm.settings, ...settings };
    this.validateAlarmSettings(updatedSettings);

    // Update alarm settings
    alarm.settings = updatedSettings;
    this.activeAlarms.set(alarmId, alarm);
    await this.persistAlarms();
  }

  /**
   * Validate alarm settings
   */
  private validateAlarmSettings(settings: AlarmSettings): void {
    if (settings.triggerRadius < 50 || settings.triggerRadius > 2000) {
      throw new Error("Trigger radius must be between 50 and 2000 meters");
    }

    // Note: soundId and volume fields are kept for backward compatibility but are not used.
    // Notification sounds are controlled by system notification channel settings.
  }

  /**
   * Persist all alarms to AsyncStorage
   */
  private async persistAlarms(): Promise<void> {
    try {
      const alarms = Array.from(this.activeAlarms.values()).map((alarm) =>
        this.normalizeAlarm(alarm),
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
    } catch (error) {
      console.error("Failed to persist alarms:", error);
      throw new Error("Failed to save alarm state");
    }
  }

  /**
   * Clear all persisted state (for error recovery)
   */
  private async clearPersistedState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      this.activeAlarms.clear();
    } catch (error) {
      console.error("Failed to clear persisted state:", error);
    }
  }

  /**
   * Set up location monitoring for an alarm (geofencing as supplementary to background task)
   */
  private async setupLocationMonitoring(alarm: Alarm): Promise<void> {
    try {
      // Try to set up geofencing as a supplementary trigger.
      // The primary monitoring is done by BackgroundLocationTask, but geofencing
      // provides an additional OS-level trigger that can fire even if the
      // foreground service is killed.
      try {
        const geofenceId = await locationManager.setupGeofence(
          alarm.destination.coordinate,
          alarm.settings.triggerRadius,
        );

        const storedAlarm = this.activeAlarms.get(alarm.id);
        if (storedAlarm) {
          storedAlarm.geofenceId = geofenceId;
          this.activeAlarms.set(alarm.id, storedAlarm);
          await this.persistAlarms();
        }

        console.log(`Geofencing setup successful for alarm: ${alarm.id}`);
      } catch (geofenceError) {
        // Geofencing is optional — BackgroundLocationTask is the primary monitor
        console.warn(
          "Geofencing setup failed (background task will still monitor):",
          geofenceError,
        );
      }
    } catch (error) {
      console.error("Failed to set up location monitoring:", error);
      throw new Error("Unable to set up location monitoring for alarm");
    }
  }

  /**
   * Clean up location monitoring for a specific alarm
   */
  private async cleanupAlarmMonitoring(alarm: Alarm): Promise<void> {
    try {
      // Clean up geofencing if active
      if (alarm.geofenceId) {
        try {
          await locationManager.removeGeofence(alarm.geofenceId);
        } catch (error) {
          console.warn("Error removing geofence:", error);
        }
      }
    } catch (error) {
      console.error("Error during alarm monitoring cleanup:", error);
    }
  }

  /**
   * Handle alarm trigger from either geofencing or fallback polling
   */
  private async handleAlarmTrigger(alarm: Alarm): Promise<void> {
    try {
      console.log(`Alarm triggered: ${alarm.destination.name}`);

      // Trigger the alarm through the normal flow
      await this.triggerAlarm(alarm);
    } catch (error) {
      console.error("Error handling alarm trigger:", error);
      const errorInfo = ErrorHandler.processError(error);
      ErrorHandler.logError(errorInfo, "AlarmManager.handleAlarmTrigger");
    }
  }

  /**
   * Get monitoring status for all alarms
   */
  getMonitoringStatus(): {
    activeAlarmCount: number;
    alarmsWithGeofencing: number;
    alarms: {
      id: string;
      destinationName: string;
      usingGeofencing: boolean;
    }[];
  } {
    const alarms = Array.from(this.activeAlarms.values()).map((alarm) => ({
      id: alarm.id,
      destinationName: alarm.destination.name,
      usingGeofencing: alarm.geofenceId !== undefined,
    }));

    return {
      activeAlarmCount: this.activeAlarms.size,
      alarmsWithGeofencing: alarms.filter((a) => a.usingGeofencing).length,
      alarms,
    };
  }

  /**
   * Reset the alarm manager (for testing purposes)
   */
  async reset(): Promise<void> {
    // Clean up all alarms
    for (const alarm of this.activeAlarms.values()) {
      await this.cleanupAlarmMonitoring(alarm);
    }

    this.activeAlarms.clear();
    this.initialized = false;
    locationManager.removeGeofenceEventHandler();
    await this.clearPersistedState();

    // Stop background location task
    await BackgroundLocationManager.stop();
  }
}

// Export singleton instance
export const alarmManager = new AlarmManagerImpl();

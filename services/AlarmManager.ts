// Alarm management service for HopOff app
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alarm, AlarmSettings, Coordinate, Destination } from "../types";
import { ErrorHandler, handleAsyncOperation } from "../utils/ErrorHandler";
import { connectivityManager } from "./ConnectivityManager";
import { fallbackLocationService } from "./FallbackLocationService";
import { locationManager } from "./LocationManager";
import { notificationManager } from "./NotificationManager";

export interface AlarmManager {
  createAlarm(
    destination: Destination,
    settings: AlarmSettings,
  ): Promise<Alarm>;
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

export class AlarmManagerImpl implements AlarmManager {
  private activeAlarms: Map<string, Alarm> = new Map();
  private fallbackPollingIds: Map<string, string> = new Map();
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

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(from: Coordinate, to: Coordinate): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (from.latitude * Math.PI) / 180;
    const φ2 = (to.latitude * Math.PI) / 180;
    const Δφ = ((to.latitude - from.latitude) * Math.PI) / 180;
    const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
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
    const alarmsWithGeofences = Array.from(this.activeAlarms.values()).filter(
      (alarm) => alarm.geofenceId,
    );

    if (alarmsWithGeofences.length > 0) {
      locationManager.setGeofenceEventHandler((event) => {
        // Find the alarm that matches this geofence
        const alarm = alarmsWithGeofences.find(
          (a) => a.geofenceId === event.geofenceId,
        );
        if (alarm) {
          this.handleAlarmTrigger(alarm);
        }
      });
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
      const distance = this.calculateDistance(
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
      const distance = this.calculateDistance(
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
   */
  async createAlarm(
    destination: Destination,
    settings: AlarmSettings,
  ): Promise<Alarm> {
    const result = await handleAsyncOperation(async () => {
      await this.initialize();

      // Check for duplicate geofence location
      const existingAlarm = this.getAlarmAtLocation(destination.coordinate);
      if (existingAlarm) {
        throw new Error(
          `An alarm already exists near this location: "${existingAlarm.destination.name}". ` +
            `Please cancel it first or choose a different location.`,
        );
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

      return alarm;
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
      this.fallbackPollingIds.clear();
    } catch (error) {
      console.error("Failed to clear persisted state:", error);
    }
  }

  /**
   * Set up location monitoring for an alarm (geofencing or fallback)
   */
  private async setupLocationMonitoring(alarm: Alarm): Promise<void> {
    try {
      // Check if geofencing is available
      const canUseGeofencing = await connectivityManager.canUseGeofencing();

      if (canUseGeofencing) {
        // Try to set up geofencing first
        try {
          const geofenceId = await locationManager.setupGeofence(
            alarm.destination.coordinate,
            alarm.settings.triggerRadius,
          );

          // Update alarm with geofence ID
          const storedAlarm = this.activeAlarms.get(alarm.id);
          if (storedAlarm) {
            storedAlarm.geofenceId = geofenceId;
            this.activeAlarms.set(alarm.id, storedAlarm);
            await this.persistAlarms();
          }

          console.log(`Geofencing setup successful for alarm: ${alarm.id}`);
          return;
        } catch (geofenceError) {
          console.warn(
            "Geofencing setup failed, falling back to location polling:",
            geofenceError,
          );
        }
      }

      // Fall back to location polling
      console.log("Using fallback location polling for alarm:", alarm.id);
      const pollingId = await fallbackLocationService.startLocationPolling(
        alarm,
        (triggeredAlarm) => this.handleAlarmTrigger(triggeredAlarm),
      );
      this.fallbackPollingIds.set(alarm.id, pollingId);
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

      // Clean up fallback polling if active
      const pollingId = this.fallbackPollingIds.get(alarm.id);
      if (pollingId) {
        try {
          await fallbackLocationService.stopLocationPolling(pollingId);
          this.fallbackPollingIds.delete(alarm.id);
        } catch (error) {
          console.warn("Error stopping fallback polling:", error);
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
    alarmsWithFallback: number;
    alarms: {
      id: string;
      destinationName: string;
      usingGeofencing: boolean;
      usingFallback: boolean;
    }[];
  } {
    const alarms = Array.from(this.activeAlarms.values()).map((alarm) => ({
      id: alarm.id,
      destinationName: alarm.destination.name,
      usingGeofencing: alarm.geofenceId !== undefined,
      usingFallback: this.fallbackPollingIds.has(alarm.id),
    }));

    return {
      activeAlarmCount: this.activeAlarms.size,
      alarmsWithGeofencing: alarms.filter((a) => a.usingGeofencing).length,
      alarmsWithFallback: alarms.filter((a) => a.usingFallback).length,
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
    this.fallbackPollingIds.clear();
    this.initialized = false;
    locationManager.removeGeofenceEventHandler();
    await this.clearPersistedState();
  }
}

// Export singleton instance
export const alarmManager = new AlarmManagerImpl();

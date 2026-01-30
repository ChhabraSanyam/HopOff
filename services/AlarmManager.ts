// Alarm management service for HopOff app
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alarm, AlarmSettings, Destination } from "../types";
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
  getActiveAlarm(): Alarm | null;
  triggerAlarm(alarm: Alarm): Promise<void>;
  updateAlarmSettings(
    alarmId: string,
    settings: Partial<AlarmSettings>,
  ): Promise<void>;
}

// Storage key for AsyncStorage
const STORAGE_KEY = "hopoff_active_alarm";

export class AlarmManagerImpl implements AlarmManager {
  private activeAlarm: Alarm | null = null;
  private initialized = false;
  private fallbackPollingId: string | null = null;

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
      const activeAlarmData = await AsyncStorage.getItem(STORAGE_KEY);
      if (activeAlarmData) {
        const parsedAlarm = JSON.parse(activeAlarmData);
        this.activeAlarm = this.normalizeAlarm(parsedAlarm);
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
   * Create a new alarm with the specified destination and settings
   */
  async createAlarm(
    destination: Destination,
    settings: AlarmSettings,
  ): Promise<Alarm> {
    const result = await handleAsyncOperation(async () => {
      await this.initialize();

      // Cancel any existing alarm first
      if (this.activeAlarm) {
        await this.cancelAlarm(this.activeAlarm.id);
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
      this.activeAlarm = alarm;
      await this.persistActiveAlarm();

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

      // If there's no active alarm or it doesn't match, treat as already cancelled
      if (!this.activeAlarm || this.activeAlarm.id !== alarmId) {
        console.log(`Alarm ${alarmId} already cancelled or doesn't exist`);
        return;
      }

      // Clean up location monitoring
      await this.cleanupLocationMonitoring();

      // Clear active alarm
      this.activeAlarm = null;
      await this.clearActiveAlarmStorage();
    }, "AlarmManager.cancelAlarm");

    if (!result.success) {
      throw new Error(result.error.message);
    }
  }

  /**
   * Get the currently active alarm
   */
  getActiveAlarm(): Alarm | null {
    this.activeAlarm = this.normalizeAlarm(this.activeAlarm);
    return this.activeAlarm;
  }

  /**
   * Trigger an alarm (called when geofence is entered)
   */
  async triggerAlarm(alarm: Alarm): Promise<void> {
    await this.initialize();

    if (!this.activeAlarm || this.activeAlarm.id !== alarm.id) {
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

    // Clear active alarm after triggering notification
    this.activeAlarm = null;
    await this.clearActiveAlarmStorage();

    // Clean up location monitoring
    await this.cleanupLocationMonitoring();
  }

  /**
   * Update settings for an existing alarm
   */
  async updateAlarmSettings(
    alarmId: string,
    settings: Partial<AlarmSettings>,
  ): Promise<void> {
    await this.initialize();

    if (!this.activeAlarm || this.activeAlarm.id !== alarmId) {
      throw new Error(`No active alarm found with ID: ${alarmId}`);
    }

    // Validate new settings
    const updatedSettings = { ...this.activeAlarm.settings, ...settings };
    this.validateAlarmSettings(updatedSettings);

    // Update alarm settings
    this.activeAlarm.settings = updatedSettings;
    await this.persistActiveAlarm();
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
   * Persist the active alarm to AsyncStorage
   */
  private async persistActiveAlarm(): Promise<void> {
    const serializedAlarm = this.normalizeAlarm(this.activeAlarm);

    // Keep in-memory state consistent
    this.activeAlarm = serializedAlarm;

    if (!serializedAlarm) {
      await this.clearActiveAlarmStorage();
      return;
    }

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(serializedAlarm));
    } catch (error) {
      console.error("Failed to persist active alarm:", error);
      throw new Error("Failed to save alarm state");
    }
  }

  /**
   * Clear active alarm from AsyncStorage
   */
  private async clearActiveAlarmStorage(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear active alarm storage:", error);
    }
  }

  /**
   * Clear all persisted state (for error recovery)
   */
  private async clearPersistedState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
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
          if (this.activeAlarm && this.activeAlarm.id === alarm.id) {
            this.activeAlarm.geofenceId = geofenceId;
            await this.persistActiveAlarm();
          }

          // Set up geofence event handler
          locationManager.setGeofenceEventHandler((event) => {
            if (event.geofenceId === geofenceId) {
              this.handleAlarmTrigger(alarm);
            }
          });

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
      this.fallbackPollingId =
        await fallbackLocationService.startLocationPolling(
          alarm,
          (triggeredAlarm) => this.handleAlarmTrigger(triggeredAlarm),
        );
    } catch (error) {
      console.error("Failed to set up location monitoring:", error);
      throw new Error("Unable to set up location monitoring for alarm");
    }
  }

  /**
   * Clean up location monitoring (geofencing and fallback)
   */
  private async cleanupLocationMonitoring(): Promise<void> {
    try {
      // Clean up geofencing if active
      if (this.activeAlarm?.geofenceId) {
        try {
          await locationManager.removeGeofence(this.activeAlarm.geofenceId);
          locationManager.removeGeofenceEventHandler();
        } catch (error) {
          console.warn("Error removing geofence:", error);
        }
      }

      // Clean up fallback polling if active
      if (this.fallbackPollingId) {
        try {
          await fallbackLocationService.stopLocationPolling(
            this.fallbackPollingId,
          );
          this.fallbackPollingId = null;
        } catch (error) {
          console.warn("Error stopping fallback polling:", error);
        }
      }
    } catch (error) {
      console.error("Error during location monitoring cleanup:", error);
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
   * Get monitoring status for the active alarm
   */
  getMonitoringStatus(): {
    hasActiveAlarm: boolean;
    usingGeofencing: boolean;
    usingFallback: boolean;
    geofenceId?: string;
    fallbackPollingId?: string;
  } {
    return {
      hasActiveAlarm: this.activeAlarm !== null,
      usingGeofencing: this.activeAlarm?.geofenceId !== undefined,
      usingFallback: this.fallbackPollingId !== null,
      geofenceId: this.activeAlarm?.geofenceId,
      fallbackPollingId: this.fallbackPollingId || undefined,
    };
  }

  /**
   * Reset the alarm manager (for testing purposes)
   */
  async reset(): Promise<void> {
    await this.cleanupLocationMonitoring();
    this.activeAlarm = null;
    this.initialized = false;
    this.fallbackPollingId = null;
    await this.clearPersistedState();
  }
}

// Export singleton instance
export const alarmManager = new AlarmManagerImpl();

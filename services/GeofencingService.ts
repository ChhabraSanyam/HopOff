/**
 * Geofencing Service
 *
 * Simple geofencing service using Expo Location.
 * Provides a clean interface for setting up and managing geofences.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Coordinate } from "../types";

// Task name for geofencing background task
const GEOFENCING_TASK = "hopoff-geofencing-task";

// Storage key for persisting geofence IDs
const GEOFENCE_STORAGE_KEY = "hopoff_active_geofences";

export interface GeofenceEvent {
  geofenceId: string;
  coordinate: Coordinate;
  radius: number;
  eventType: "enter" | "exit";
  timestamp: string;
}

export type GeofenceEventHandler = (event: GeofenceEvent) => void;

export interface GeofenceSetupResult {
  geofenceId: string;
  success: boolean;
}

export enum GeofenceError {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  LOCATION_UNAVAILABLE = "LOCATION_UNAVAILABLE",
  GEOFENCING_UNAVAILABLE = "GEOFENCING_UNAVAILABLE",
  INVALID_COORDINATES = "INVALID_COORDINATES",
  INVALID_RADIUS = "INVALID_RADIUS",
  GEOFENCE_LIMIT_EXCEEDED = "GEOFENCE_LIMIT_EXCEEDED",
  GEOFENCE_NOT_FOUND = "GEOFENCE_NOT_FOUND",
}

export class GeofenceServiceError extends Error {
  constructor(
    public code: GeofenceError,
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "GeofenceServiceError";
  }
}

// Internal event handler reference for the task (must be module-level)
let _geofenceEventHandler: GeofenceEventHandler | null = null;
let _debugMode = typeof __DEV__ !== "undefined" ? __DEV__ : false;

/**
 * CRITICAL: TaskManager.defineTask MUST be called at the module level,
 * not inside a class or method. This ensures the task is defined when
 * the JavaScript bundle loads, before any geofencing events can occur.
 */
TaskManager.defineTask(GEOFENCING_TASK, async ({ data, error }) => {
  if (error) {
    console.error("Geofencing task error:", error);
    return;
  }

  if (data) {
    const { eventType, region } = data as {
      eventType: Location.GeofencingEventType;
      region: Location.LocationRegion;
    };

    if (eventType === Location.GeofencingEventType.Enter && region.identifier) {
      const event: GeofenceEvent = {
        geofenceId: region.identifier,
        coordinate: {
          latitude: region.latitude,
          longitude: region.longitude,
        },
        radius: region.radius,
        eventType: "enter",
        timestamp: new Date().toISOString(),
      };

      if (_debugMode) {
        console.log(`Geofence entered: ${region.identifier}`);
      }

      // Call the event handler
      if (_geofenceEventHandler) {
        _geofenceEventHandler(event);
      }

      // Auto-remove the geofence after triggering (one-time alarm)
      geofencingService.removeGeofence(region.identifier).catch((err) => {
        console.error("Failed to auto-remove geofence:", err);
      });
    }
  }
});

class GeofencingService {
  private activeGeofences: Map<string, Location.LocationRegion> = new Map();
  private debugMode = typeof __DEV__ !== "undefined" ? __DEV__ : false;
  private initialized = false;

  constructor() {
    // Sync the module-level debug mode
    _debugMode = this.debugMode;
  }

  /**
   * Initialize the service by restoring persisted geofence state
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Restore persisted geofence IDs
      const storedData = await AsyncStorage.getItem(GEOFENCE_STORAGE_KEY);
      if (storedData) {
        const regions: Location.LocationRegion[] = JSON.parse(storedData);
        for (const region of regions) {
          if (region.identifier) {
            this.activeGeofences.set(region.identifier, region);
          }
        }
        if (this.debugMode && this.activeGeofences.size > 0) {
          console.log(
            `Restored ${this.activeGeofences.size} geofences from storage`,
          );
        }
      }
      this.initialized = true;
    } catch (error) {
      console.error("Failed to restore geofence state:", error);
      // Clear corrupted data
      await this.clearPersistedGeofences();
      this.initialized = true;
    }
  }

  /**
   * Persist active geofences to AsyncStorage
   */
  private async persistGeofences(): Promise<void> {
    try {
      const regions = Array.from(this.activeGeofences.values());
      await AsyncStorage.setItem(GEOFENCE_STORAGE_KEY, JSON.stringify(regions));
    } catch (error) {
      console.error("Failed to persist geofences:", error);
    }
  }

  /**
   * Clear persisted geofence data
   */
  private async clearPersistedGeofences(): Promise<void> {
    try {
      await AsyncStorage.removeItem(GEOFENCE_STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear persisted geofences:", error);
    }
  }

  /**
   * Request location permissions for geofencing
   */
  async requestPermissions(): Promise<boolean> {
    try {
      // Check foreground permissions
      const { status: foregroundStatus } =
        await Location.getForegroundPermissionsAsync();

      if (foregroundStatus !== "granted") {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          throw new GeofenceServiceError(
            GeofenceError.PERMISSION_DENIED,
            "Location permission is required for geofencing.",
          );
        }
      }

      // Request background permissions for geofencing
      const { status: backgroundStatus } =
        await Location.getBackgroundPermissionsAsync();

      if (backgroundStatus !== "granted") {
        const { status } = await Location.requestBackgroundPermissionsAsync();
        if (status !== "granted") {
          console.warn(
            "Background location permission not granted. Geofencing may not work reliably when app is in background.",
          );
        }
      }

      return true;
    } catch (error) {
      if (error instanceof GeofenceServiceError) {
        throw error;
      }
      throw new GeofenceServiceError(
        GeofenceError.PERMISSION_DENIED,
        "Failed to request location permissions",
        error as Error,
      );
    }
  }

  /**
   * Check if geofencing is available on this device
   */
  async isAvailable(): Promise<boolean> {
    try {
      const hasServices = await Location.hasServicesEnabledAsync();
      const { status } = await Location.getBackgroundPermissionsAsync();
      return hasServices && status === "granted";
    } catch (error) {
      if (this.debugMode) {
        console.warn("Error checking geofencing availability:", error);
      }
      return false;
    }
  }

  /**
   * Setup a geofence at the specified location
   */
  async setupGeofence(
    destination: Coordinate,
    radius: number,
    customId?: string,
  ): Promise<GeofenceSetupResult> {
    try {
      // Ensure service is initialized
      await this.initialize();

      // Validate coordinates
      if (!this.isValidCoordinate(destination)) {
        throw new GeofenceServiceError(
          GeofenceError.INVALID_COORDINATES,
          "Invalid destination coordinates",
        );
      }

      // Validate radius (50m to 2000m)
      if (radius < 50 || radius > 2000) {
        throw new GeofenceServiceError(
          GeofenceError.INVALID_RADIUS,
          "Geofence radius must be between 50 and 2000 meters",
        );
      }

      // Request permissions
      await this.requestPermissions();

      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        throw new GeofenceServiceError(
          GeofenceError.LOCATION_UNAVAILABLE,
          "Location services are disabled. Please enable them in device settings.",
        );
      }

      // Check background permission
      const { status: bgStatus } =
        await Location.getBackgroundPermissionsAsync();
      if (bgStatus !== "granted") {
        throw new GeofenceServiceError(
          GeofenceError.PERMISSION_DENIED,
          'Background location permission is required. Please enable "Allow all the time" in settings.',
        );
      }

      // Check geofence limit
      if (this.activeGeofences.size >= 20) {
        throw new GeofenceServiceError(
          GeofenceError.GEOFENCE_LIMIT_EXCEEDED,
          "Maximum of 20 geofences allowed. Please remove some existing geofences.",
        );
      }

      // Generate unique ID
      const geofenceId =
        customId ||
        `geofence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create the region
      const region: Location.LocationRegion = {
        identifier: geofenceId,
        latitude: destination.latitude,
        longitude: destination.longitude,
        radius: radius,
        notifyOnEnter: true,
        notifyOnExit: false,
      };

      // Start geofencing with all active regions
      const allRegions = [...this.activeGeofences.values(), region];
      await Location.startGeofencingAsync(GEOFENCING_TASK, allRegions);

      // Track the geofence
      this.activeGeofences.set(geofenceId, region);

      // Persist the updated geofences
      await this.persistGeofences();

      if (this.debugMode) {
        console.log(
          `Geofence setup: ${geofenceId} at (${destination.latitude}, ${destination.longitude}) with radius ${radius}m`,
        );
      }

      return {
        geofenceId,
        success: true,
      };
    } catch (error) {
      if (error instanceof GeofenceServiceError) {
        throw error;
      }
      throw new GeofenceServiceError(
        GeofenceError.GEOFENCING_UNAVAILABLE,
        "Failed to setup geofence",
        error as Error,
      );
    }
  }

  /**
   * Remove a specific geofence
   */
  async removeGeofence(geofenceId: string): Promise<boolean> {
    try {
      // Ensure service is initialized (restores persisted state)
      await this.initialize();

      // Check if geofence exists in our tracking
      const hadGeofence = this.activeGeofences.has(geofenceId);

      // Remove from tracking regardless
      this.activeGeofences.delete(geofenceId);

      // Persist the updated state
      await this.persistGeofences();

      // Check if the task is registered before trying to modify it
      const isTaskRegistered =
        await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK);

      if (!isTaskRegistered) {
        // Task not registered, nothing to stop - geofence is already cleaned from our state
        if (this.debugMode) {
          console.log(
            `Geofence ${geofenceId} removed from state (task not active)`,
          );
        }
        return hadGeofence;
      }

      // Restart geofencing with remaining regions or stop if none left
      if (this.activeGeofences.size > 0) {
        const remainingRegions = Array.from(this.activeGeofences.values());
        await Location.startGeofencingAsync(GEOFENCING_TASK, remainingRegions);
      } else {
        try {
          await Location.stopGeofencingAsync(GEOFENCING_TASK);
        } catch (stopError) {
          // Task might already be stopped or not exist - this is okay
          if (this.debugMode) {
            console.warn("Error stopping geofencing:", stopError);
          }
        }
      }

      if (this.debugMode) {
        console.log(`Geofence removed: ${geofenceId}`);
      }

      return hadGeofence;
    } catch (error) {
      if (this.debugMode) {
        console.error(`Failed to remove geofence ${geofenceId}:`, error);
      }
      // Still return true if we at least removed it from our internal tracking
      return !this.activeGeofences.has(geofenceId);
    }
  }

  /**
   * Remove all geofences
   */
  async removeAllGeofences(): Promise<void> {
    try {
      // Ensure service is initialized
      await this.initialize();

      // Clear our tracking first
      this.activeGeofences.clear();
      await this.clearPersistedGeofences();

      // Check if task is registered before trying to stop
      const isTaskRegistered =
        await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK);

      if (isTaskRegistered) {
        try {
          await Location.stopGeofencingAsync(GEOFENCING_TASK);
        } catch (stopError) {
          // Task might already be stopped - this is okay
          if (this.debugMode) {
            console.warn("Error stopping geofencing:", stopError);
          }
        }
      }

      if (this.debugMode) {
        console.log("All geofences removed");
      }
    } catch (error) {
      if (this.debugMode) {
        console.error("Failed to remove all geofences:", error);
      }
      throw error;
    }
  }

  /**
   * Set the event handler for geofence events
   */
  setEventHandler(handler: GeofenceEventHandler): void {
    // Set both the instance property and module-level handler for the task
    _geofenceEventHandler = handler;
  }

  /**
   * Remove the event handler
   */
  removeEventHandler(): void {
    _geofenceEventHandler = null;
  }

  /**
   * Get all active geofence IDs
   */
  getActiveGeofenceIds(): string[] {
    return Array.from(this.activeGeofences.keys());
  }

  /**
   * Get active geofence count
   */
  getActiveGeofenceCount(): number {
    return this.activeGeofences.size;
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.removeAllGeofences();
      _geofenceEventHandler = null;

      if (this.debugMode) {
        console.log("Geofencing service cleaned up");
      }
    } catch (error) {
      if (this.debugMode) {
        console.error("Error during cleanup:", error);
      }
    }
  }

  /**
   * Enable or disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    _debugMode = enabled;
  }

  /**
   * Validate coordinate values
   */
  private isValidCoordinate(coordinate: Coordinate): boolean {
    return (
      typeof coordinate.latitude === "number" &&
      typeof coordinate.longitude === "number" &&
      coordinate.latitude >= -90 &&
      coordinate.latitude <= 90 &&
      coordinate.longitude >= -180 &&
      coordinate.longitude <= 180 &&
      !isNaN(coordinate.latitude) &&
      !isNaN(coordinate.longitude)
    );
  }
}

// Export singleton instance
export const geofencingService = new GeofencingService();

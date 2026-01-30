/**
 * Geofencing Service
 *
 * Simple geofencing service using Expo Location.
 * Provides a clean interface for setting up and managing geofences.
 */

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Coordinate } from "../types";

// Task name for geofencing background task
const GEOFENCING_TASK = "hopoff-geofencing-task";

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

class GeofencingService {
  private activeGeofences: Map<string, Location.LocationRegion> = new Map();
  private eventHandler: GeofenceEventHandler | null = null;
  private isTaskRegistered = false;
  private debugMode = typeof __DEV__ !== "undefined" ? __DEV__ : false;

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

      // Register the task if not already done
      if (!this.isTaskRegistered) {
        await this.registerTask();
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
      if (!this.activeGeofences.has(geofenceId)) {
        if (this.debugMode) {
          console.warn(`Geofence not found: ${geofenceId}`);
        }
        return false;
      }

      // Remove from tracking
      this.activeGeofences.delete(geofenceId);

      // Restart geofencing with remaining regions or stop if none left
      if (this.activeGeofences.size > 0) {
        const remainingRegions = Array.from(this.activeGeofences.values());
        await Location.startGeofencingAsync(GEOFENCING_TASK, remainingRegions);
      } else {
        await Location.stopGeofencingAsync(GEOFENCING_TASK);
      }

      if (this.debugMode) {
        console.log(`Geofence removed: ${geofenceId}`);
      }

      return true;
    } catch (error) {
      if (this.debugMode) {
        console.error(`Failed to remove geofence ${geofenceId}:`, error);
      }
      return false;
    }
  }

  /**
   * Remove all geofences
   */
  async removeAllGeofences(): Promise<void> {
    try {
      if (this.activeGeofences.size > 0) {
        await Location.stopGeofencingAsync(GEOFENCING_TASK);
        this.activeGeofences.clear();

        if (this.debugMode) {
          console.log("All geofences removed");
        }
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
    this.eventHandler = handler;
  }

  /**
   * Remove the event handler
   */
  removeEventHandler(): void {
    this.eventHandler = null;
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
      this.eventHandler = null;

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
  }

  /**
   * Register the background task for geofencing
   */
  private async registerTask(): Promise<void> {
    try {
      const isRegistered =
        await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK);
      if (isRegistered) {
        this.isTaskRegistered = true;
        return;
      }

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

          this.handleGeofenceEvent(eventType, region);
        }
      });

      this.isTaskRegistered = true;

      if (this.debugMode) {
        console.log("Geofencing task registered");
      }
    } catch (error) {
      throw new GeofenceServiceError(
        GeofenceError.GEOFENCING_UNAVAILABLE,
        "Failed to register geofencing task",
        error as Error,
      );
    }
  }

  /**
   * Handle geofence events from the background task
   */
  private handleGeofenceEvent(
    eventType: Location.GeofencingEventType,
    region: Location.LocationRegion,
  ): void {
    try {
      if (
        eventType === Location.GeofencingEventType.Enter &&
        region.identifier
      ) {
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

        if (this.debugMode) {
          console.log(`Geofence entered: ${region.identifier}`);
        }

        // Call the event handler
        if (this.eventHandler) {
          this.eventHandler(event);
        }

        // Auto-remove the geofence after triggering (one-time alarm)
        this.removeGeofence(region.identifier).catch((err) => {
          console.error("Failed to auto-remove geofence:", err);
        });
      }
    } catch (error) {
      console.error("Error handling geofence event:", error);
    }
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

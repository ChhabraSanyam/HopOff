/**
 * Location Manager Service
 *
 * Provides location services for the HopOff app including:
 * - Current location retrieval
 * - Distance calculations
 * - Geofence management (via GeofencingService)
 */

import * as Location from "expo-location";
import { Coordinate } from "../types";
import {
  GeofenceEvent,
  GeofenceEventHandler,
  geofencingService,
} from "./GeofencingService";

export interface LocationManager {
  setupGeofence(destination: Coordinate, radius: number): Promise<string>;
  removeGeofence(geofenceId: string): Promise<void>;
  getCurrentLocation(): Promise<Coordinate>;
  startForegroundLocationUpdates(): void;
  stopForegroundLocationUpdates(): void;
  requestLocationPermissions(): Promise<boolean>;
  getLocationPermissionStatus(): Promise<Location.PermissionStatus>;
  setGeofenceEventHandler(handler: GeofenceEventHandler): void;
  removeGeofenceEventHandler(): void;
  getActiveGeofences(): string[];
  isGeofencingAvailable(): Promise<boolean>;
  cleanup(): Promise<void>;
}

export enum LocationError {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  LOCATION_UNAVAILABLE = "LOCATION_UNAVAILABLE",
  TIMEOUT = "TIMEOUT",
  ACCURACY_TOO_LOW = "ACCURACY_TOO_LOW",
  GEOFENCING_UNAVAILABLE = "GEOFENCING_UNAVAILABLE",
  INVALID_COORDINATES = "INVALID_COORDINATES",
  GEOFENCE_LIMIT_EXCEEDED = "GEOFENCE_LIMIT_EXCEEDED",
  GEOFENCE_NOT_FOUND = "GEOFENCE_NOT_FOUND",
}

// Re-export geofence event types for convenience
export { GeofenceEvent, GeofenceEventHandler };

export class LocationManagerError extends Error {
  constructor(
    public code: LocationError,
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "LocationManagerError";
  }
}

export class LocationManagerImpl implements LocationManager {
  private locationSubscription: Location.LocationSubscription | null = null;
  private isTrackingLocation = false;

  /**
   * Request location permissions
   */
  async requestLocationPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } =
        await Location.getForegroundPermissionsAsync();

      if (existingStatus === "granted") {
        return true;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        throw new LocationManagerError(
          LocationError.PERMISSION_DENIED,
          "Location permission is required. Please enable location access in settings.",
        );
      }

      // Request background permissions for geofencing
      const { status: backgroundStatus } =
        await Location.requestBackgroundPermissionsAsync();

      if (backgroundStatus !== "granted") {
        console.warn(
          "Background location permission not granted. Geofencing may not work reliably.",
        );
      }

      return true;
    } catch (error) {
      if (error instanceof LocationManagerError) {
        throw error;
      }
      throw new LocationManagerError(
        LocationError.PERMISSION_DENIED,
        "Failed to request location permissions",
        error as Error,
      );
    }
  }

  /**
   * Get current location permission status
   */
  async getLocationPermissionStatus(): Promise<Location.PermissionStatus> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status;
    } catch (error) {
      throw new LocationManagerError(
        LocationError.PERMISSION_DENIED,
        "Failed to check location permission status",
        error as Error,
      );
    }
  }

  /**
   * Get current location
   */
  async getCurrentLocation(): Promise<Coordinate> {
    try {
      const hasPermission = await this.requestLocationPermissions();
      if (!hasPermission) {
        throw new LocationManagerError(
          LocationError.PERMISSION_DENIED,
          "Location permission is required to get current location",
        );
      }

      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        throw new LocationManagerError(
          LocationError.LOCATION_UNAVAILABLE,
          "Location services are disabled. Please enable them in settings.",
        );
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 0,
      });

      if (location.coords.accuracy && location.coords.accuracy > 100) {
        console.warn(`Location accuracy is low: ${location.coords.accuracy}m`);
      }

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      if (error instanceof LocationManagerError) {
        throw error;
      }

      if (error && typeof error === "object" && "code" in error) {
        const locationError = error as { code: string; message?: string };
        switch (locationError.code) {
          case "E_LOCATION_SERVICES_DISABLED":
            throw new LocationManagerError(
              LocationError.LOCATION_UNAVAILABLE,
              "Location services are disabled. Please enable them in settings.",
            );
          case "E_LOCATION_TIMEOUT":
            throw new LocationManagerError(
              LocationError.TIMEOUT,
              "Location request timed out. Please try again.",
            );
        }
      }

      throw new LocationManagerError(
        LocationError.LOCATION_UNAVAILABLE,
        "Failed to get current location",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Start foreground location updates
   */
  startForegroundLocationUpdates(): void {
    if (this.isTrackingLocation) {
      console.warn("Location updates already started");
      return;
    }

    this.isTrackingLocation = true;
    console.log("Starting foreground location updates");
  }

  /**
   * Stop foreground location updates
   */
  stopForegroundLocationUpdates(): void {
    if (!this.isTrackingLocation) {
      return;
    }

    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    this.isTrackingLocation = false;
    console.log("Stopped foreground location updates");
  }

  /**
   * Setup a geofence at the destination
   */
  async setupGeofence(
    destination: Coordinate,
    radius: number,
  ): Promise<string> {
    try {
      const result = await geofencingService.setupGeofence(destination, radius);
      return result.geofenceId;
    } catch (error) {
      if (error instanceof LocationManagerError) {
        throw error;
      }
      throw new LocationManagerError(
        LocationError.GEOFENCING_UNAVAILABLE,
        "Failed to setup geofence",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Remove a geofence
   */
  async removeGeofence(geofenceId: string): Promise<void> {
    try {
      const success = await geofencingService.removeGeofence(geofenceId);
      if (!success) {
        // Geofence might have already been removed or never existed
        // This is not a critical error, just log it
        console.warn(
          `Geofence with ID ${geofenceId} was not found`,
        );
      }
    } catch (error) {
      // Log the error but don't throw - the geofence state has been cleaned up
      console.error(`Failed to remove geofence ${geofenceId}:`, error);
    }
  }

  /**
   * Set geofence event handler
   */
  setGeofenceEventHandler(handler: GeofenceEventHandler): void {
    geofencingService.setEventHandler(handler);
  }

  /**
   * Remove geofence event handler
   */
  removeGeofenceEventHandler(): void {
    geofencingService.removeEventHandler();
  }

  /**
   * Get all active geofence IDs
   */
  getActiveGeofences(): string[] {
    return geofencingService.getActiveGeofenceIds();
  }

  /**
   * Check if geofencing is available
   */
  async isGeofencingAvailable(): Promise<boolean> {
    return geofencingService.isAvailable();
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    try {
      await geofencingService.cleanup();
      this.stopForegroundLocationUpdates();
    } catch (error) {
      console.error("Error during cleanup:", error);
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
export const locationManager = new LocationManagerImpl();

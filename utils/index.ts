// Utility functions for HopOff app
import {
  AlarmSettings,
  Coordinate,
  Destination,
  UserSettings,
  VALIDATION_CONSTANTS,
  ValidationResult,
} from "../types";

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param from Starting coordinate
 * @param to Ending coordinate
 * @returns Distance in meters
 */
export function calculateDistance(from: Coordinate, to: Coordinate): number {
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

/**
 * Generate a unique ID
 * @returns Unique string ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Format distance for display
 * @param distance Distance in meters
 * @returns Formatted distance string
 */
export function formatDistance(distance: number): string {
  if (distance < 1000) {
    return `${Math.round(distance)}m`;
  } else {
    return `${(distance / 1000).toFixed(1)}km`;
  }
}

// VALIDATION FUNCTIONS

/**
 * Validate coordinate values
 * @param coordinate Coordinate to validate
 * @returns ValidationResult with detailed error information
 */
export function validateCoordinate(coordinate: Coordinate): ValidationResult {
  const errors: string[] = [];

  if (typeof coordinate.latitude !== "number" || isNaN(coordinate.latitude)) {
    errors.push("Latitude must be a valid number");
  } else if (
    coordinate.latitude < VALIDATION_CONSTANTS.MIN_LATITUDE ||
    coordinate.latitude > VALIDATION_CONSTANTS.MAX_LATITUDE
  ) {
    errors.push(
      `Latitude must be between ${VALIDATION_CONSTANTS.MIN_LATITUDE} and ${VALIDATION_CONSTANTS.MAX_LATITUDE}`,
    );
  }

  if (typeof coordinate.longitude !== "number" || isNaN(coordinate.longitude)) {
    errors.push("Longitude must be a valid number");
  } else if (
    coordinate.longitude < VALIDATION_CONSTANTS.MIN_LONGITUDE ||
    coordinate.longitude > VALIDATION_CONSTANTS.MAX_LONGITUDE
  ) {
    errors.push(
      `Longitude must be between ${VALIDATION_CONSTANTS.MIN_LONGITUDE} and ${VALIDATION_CONSTANTS.MAX_LONGITUDE}`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Legacy function for backward compatibility
 * @param coordinate Coordinate to validate
 * @returns True if valid
 */
export function isValidCoordinate(coordinate: Coordinate): boolean {
  return validateCoordinate(coordinate).isValid;
}

/**
 * Validate destination data
 * @param destination Destination to validate
 * @returns ValidationResult with detailed error information
 */
export function validateDestination(
  destination: Partial<Destination>,
): ValidationResult {
  const errors: string[] = [];

  // Validate required fields
  if (!destination.name || typeof destination.name !== "string") {
    errors.push("Destination name is required and must be a string");
  } else if (destination.name.trim().length === 0) {
    errors.push("Destination name cannot be empty");
  } else if (
    destination.name.length > VALIDATION_CONSTANTS.MAX_DESTINATION_NAME_LENGTH
  ) {
    errors.push(
      `Destination name cannot exceed ${VALIDATION_CONSTANTS.MAX_DESTINATION_NAME_LENGTH} characters`,
    );
  }

  if (!destination.coordinate) {
    errors.push("Destination coordinate is required");
  } else {
    const coordinateValidation = validateCoordinate(destination.coordinate);
    if (!coordinateValidation.isValid) {
      errors.push(...coordinateValidation.errors);
    }
  }

  // Validate optional fields
  if (
    destination.address &&
    destination.address.length > VALIDATION_CONSTANTS.MAX_ADDRESS_LENGTH
  ) {
    errors.push(
      `Address cannot exceed ${VALIDATION_CONSTANTS.MAX_ADDRESS_LENGTH} characters`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate alarm settings
 * @param settings AlarmSettings to validate
 * @returns ValidationResult with detailed error information
 */
export function validateAlarmSettings(
  settings: Partial<AlarmSettings>,
): ValidationResult {
  const errors: string[] = [];

  // Validate trigger radius
  if (settings.triggerRadius !== undefined) {
    if (
      typeof settings.triggerRadius !== "number" ||
      isNaN(settings.triggerRadius)
    ) {
      errors.push("Trigger radius must be a valid number");
    } else if (
      settings.triggerRadius < VALIDATION_CONSTANTS.MIN_TRIGGER_RADIUS ||
      settings.triggerRadius > VALIDATION_CONSTANTS.MAX_TRIGGER_RADIUS
    ) {
      errors.push(
        `Trigger radius must be between ${VALIDATION_CONSTANTS.MIN_TRIGGER_RADIUS} and ${VALIDATION_CONSTANTS.MAX_TRIGGER_RADIUS} meters`,
      );
    }
  }

  // Sound ID and volume are controlled by system notification settings, no validation needed

  // Validate boolean fields
  if (
    settings.vibrationEnabled !== undefined &&
    typeof settings.vibrationEnabled !== "boolean"
  ) {
    errors.push("Vibration enabled must be a boolean value");
  }

  if (
    settings.persistentNotification !== undefined &&
    typeof settings.persistentNotification !== "boolean"
  ) {
    errors.push("Persistent notification must be a boolean value");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate user settings
 * @param settings UserSettings to validate
 * @returns ValidationResult with detailed error information
 */
export function validateUserSettings(
  settings: Partial<UserSettings>,
): ValidationResult {
  const errors: string[] = [];

  // Validate default trigger radius
  if (settings.defaultTriggerRadius !== undefined) {
    if (
      typeof settings.defaultTriggerRadius !== "number" ||
      isNaN(settings.defaultTriggerRadius)
    ) {
      errors.push("Default trigger radius must be a valid number");
    } else if (
      !VALIDATION_CONSTANTS.VALID_TRIGGER_RADII.includes(
        settings.defaultTriggerRadius as any,
      )
    ) {
      errors.push(
        `Default trigger radius must be one of: ${VALIDATION_CONSTANTS.VALID_TRIGGER_RADII.join(
          ", ",
        )}`,
      );
    }
  }

  // Sound and volume are controlled by system notification settings, no validation needed

  // Validate boolean fields
  if (
    settings.vibrationEnabled !== undefined &&
    typeof settings.vibrationEnabled !== "boolean"
  ) {
    errors.push("Vibration enabled must be a boolean value");
  }

  if (
    settings.batteryOptimizationEnabled !== undefined &&
    typeof settings.batteryOptimizationEnabled !== "boolean"
  ) {
    errors.push("Battery optimization enabled must be a boolean value");
  }

  // Validate battery optimization level
  if (settings.batteryOptimizationLevel !== undefined) {
    const validLevels = ["auto", "conservative", "aggressive", "disabled"];
    if (!validLevels.includes(settings.batteryOptimizationLevel)) {
      errors.push(
        `Battery optimization level must be one of: ${validLevels.join(", ")}`,
      );
    }
  }

  // Validate battery thresholds
  if (settings.lowBatteryThreshold !== undefined) {
    if (
      typeof settings.lowBatteryThreshold !== "number" ||
      isNaN(settings.lowBatteryThreshold)
    ) {
      errors.push("Low battery threshold must be a valid number");
    } else if (
      settings.lowBatteryThreshold < 0.1 ||
      settings.lowBatteryThreshold > 0.8
    ) {
      errors.push(
        "Low battery threshold must be between 0.1 (10%) and 0.8 (80%)",
      );
    }
  }

  if (settings.criticalBatteryThreshold !== undefined) {
    if (
      typeof settings.criticalBatteryThreshold !== "number" ||
      isNaN(settings.criticalBatteryThreshold)
    ) {
      errors.push("Critical battery threshold must be a valid number");
    } else if (
      settings.criticalBatteryThreshold < 0.05 ||
      settings.criticalBatteryThreshold > 0.3
    ) {
      errors.push(
        "Critical battery threshold must be between 0.05 (5%) and 0.3 (30%)",
      );
    }
  }

  // Validate threshold relationship
  if (
    settings.lowBatteryThreshold !== undefined &&
    settings.criticalBatteryThreshold !== undefined &&
    settings.criticalBatteryThreshold >= settings.lowBatteryThreshold
  ) {
    errors.push(
      "Critical battery threshold must be lower than low battery threshold",
    );
  }

  // Validate adaptive location accuracy
  if (
    settings.adaptiveLocationAccuracy !== undefined &&
    typeof settings.adaptiveLocationAccuracy !== "boolean"
  ) {
    errors.push("Adaptive location accuracy must be a boolean value");
  }

  // Validate background processing optimization
  if (
    settings.backgroundProcessingOptimization !== undefined &&
    typeof settings.backgroundProcessingOptimization !== "boolean"
  ) {
    errors.push("Background processing optimization must be a boolean value");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// COORDINATE OPERATIONS

/**
 * Calculate the bearing (direction) from one coordinate to another
 * @param from Starting coordinate
 * @param to Ending coordinate
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(from: Coordinate, to: Coordinate): number {
  const φ1 = (from.latitude * Math.PI) / 180;
  const φ2 = (to.latitude * Math.PI) / 180;
  const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

/**
 * Calculate a destination coordinate given a starting point, bearing, and distance
 * @param from Starting coordinate
 * @param bearing Bearing in degrees
 * @param distance Distance in meters
 * @returns Destination coordinate
 */
export function calculateDestinationCoordinate(
  from: Coordinate,
  bearing: number,
  distance: number,
): Coordinate {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (from.latitude * Math.PI) / 180;
  const λ1 = (from.longitude * Math.PI) / 180;
  const θ = (bearing * Math.PI) / 180;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(distance / R) +
      Math.cos(φ1) * Math.sin(distance / R) * Math.cos(θ),
  );

  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(distance / R) * Math.cos(φ1),
      Math.cos(distance / R) - Math.sin(φ1) * Math.sin(φ2),
    );

  return {
    latitude: (φ2 * 180) / Math.PI,
    longitude: (((λ2 * 180) / Math.PI + 540) % 360) - 180, // normalize to [-180, 180]
  };
}

/**
 * Check if a coordinate is within a circular area
 * @param point Point to check
 * @param center Center of the circular area
 * @param radius Radius in meters
 * @returns True if point is within the area
 */
export function isWithinRadius(
  point: Coordinate,
  center: Coordinate,
  radius: number,
): boolean {
  const distance = calculateDistance(point, center);
  return distance <= radius;
}

/**
 * Calculate the midpoint between two coordinates
 * @param coord1 First coordinate
 * @param coord2 Second coordinate
 * @returns Midpoint coordinate
 */
export function calculateMidpoint(
  coord1: Coordinate,
  coord2: Coordinate,
): Coordinate {
  const φ1 = (coord1.latitude * Math.PI) / 180;
  const φ2 = (coord2.latitude * Math.PI) / 180;
  const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
  const λ1 = (coord1.longitude * Math.PI) / 180;

  const Bx = Math.cos(φ2) * Math.cos(Δλ);
  const By = Math.cos(φ2) * Math.sin(Δλ);

  const φ3 = Math.atan2(
    Math.sin(φ1) + Math.sin(φ2),
    Math.sqrt((Math.cos(φ1) + Bx) * (Math.cos(φ1) + Bx) + By * By),
  );
  const λ3 = λ1 + Math.atan2(By, Math.cos(φ1) + Bx);

  return {
    latitude: (φ3 * 180) / Math.PI,
    longitude: (((λ3 * 180) / Math.PI + 540) % 360) - 180,
  };
}

/**
 * Normalize coordinate values to ensure they're within valid ranges
 * @param coordinate Coordinate to normalize
 * @returns Normalized coordinate
 */
export function normalizeCoordinate(coordinate: Coordinate): Coordinate {
  let { latitude, longitude } = coordinate;

  // Normalize latitude to [-90, 90]
  latitude = Math.max(
    VALIDATION_CONSTANTS.MIN_LATITUDE,
    Math.min(VALIDATION_CONSTANTS.MAX_LATITUDE, latitude),
  );

  // Normalize longitude to [-180, 180]
  longitude = ((longitude + 540) % 360) - 180;

  return { latitude, longitude };
}
// DATA CREATION AND SANITIZATION

/**
 * Create default alarm settings
 * @returns Default AlarmSettings object
 */
export function createDefaultAlarmSettings(): AlarmSettings {
  return {
    triggerRadius: 200,
    vibrationEnabled: true,
    persistentNotification: true,
  };
}

/**
 * Create default user settings
 * @returns Default UserSettings object
 */
export function createDefaultUserSettings(): UserSettings {
  return {
    defaultTriggerRadius: 200,
    vibrationEnabled: true,
    batteryOptimizationEnabled: true,
    batteryOptimizationLevel: "auto",
    lowBatteryThreshold: 0.3,
    criticalBatteryThreshold: 0.15,
    adaptiveLocationAccuracy: true,
    backgroundProcessingOptimization: true,
  };
}

/**
 * Sanitize destination name by trimming and limiting length
 * @param name Raw destination name
 * @returns Sanitized destination name
 */
export function sanitizeDestinationName(name: string): string {
  if (typeof name !== "string") return "";

  const trimmed = name.trim();
  return trimmed.length > VALIDATION_CONSTANTS.MAX_DESTINATION_NAME_LENGTH
    ? trimmed
        .substring(0, VALIDATION_CONSTANTS.MAX_DESTINATION_NAME_LENGTH)
        .trim()
    : trimmed;
}

/**
 * Sanitize address by trimming and limiting length
 * @param address Raw address string
 * @returns Sanitized address string
 */
export function sanitizeAddress(address: string): string {
  if (typeof address !== "string") return "";

  const trimmed = address.trim();
  return trimmed.length > VALIDATION_CONSTANTS.MAX_ADDRESS_LENGTH
    ? trimmed.substring(0, VALIDATION_CONSTANTS.MAX_ADDRESS_LENGTH).trim()
    : trimmed;
}

/**
 * Clamp a number between min and max values
 * @param value Value to clamp
 * @param min Minimum value
 * @param max Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Get the nearest valid trigger radius from available options
 * @param radius Desired radius
 * @returns Nearest valid trigger radius
 */
export function getNearestValidTriggerRadius(radius: number): number {
  const validRadii = VALIDATION_CONSTANTS.VALID_TRIGGER_RADII;
  return validRadii.reduce((nearest, current) =>
    Math.abs(current - radius) < Math.abs(nearest - radius) ? current : nearest,
  );
}

// FORMATTING UTILITIES

/**
 * Format bearing for display
 * @param bearing Bearing in degrees
 * @returns Formatted bearing string with cardinal direction
 */
export function formatBearing(bearing: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(bearing / 45) % 8;
  return `${Math.round(bearing)}° ${directions[index]}`;
}

/**
 * Format coordinate for display
 * @param coordinate Coordinate to format
 * @param precision Number of decimal places (default: 6)
 * @returns Formatted coordinate string
 */
export function formatCoordinate(
  coordinate: Coordinate,
  precision: number = 6,
): string {
  return `${coordinate.latitude.toFixed(
    precision,
  )}, ${coordinate.longitude.toFixed(precision)}`;
}

/**
 * Format time duration in a human-readable format
 * @param milliseconds Duration in milliseconds
 * @returns Formatted duration string
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

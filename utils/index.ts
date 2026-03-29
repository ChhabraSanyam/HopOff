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
 * Calculate distance between two coordinates using Haversine formula.
 * Validates coordinates before calculating.
 * @param from Starting coordinate
 * @param to Ending coordinate
 * @returns Distance in meters
 * @throws Error if coordinates are invalid
 */
export function calculateDistance(from: Coordinate, to: Coordinate): number {
  if (!isValidCoordinate(from) || !isValidCoordinate(to)) {
    throw new Error("Invalid coordinates provided for distance calculation");
  }

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
 * Generate a unique ID with an optional prefix
 * @param prefix Optional prefix string (e.g. "alarm", "dest", "search")
 * @returns Unique string ID
 */
export function generateId(prefix?: string): string {
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  return prefix ? `${prefix}_${id}` : id;
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

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// COORDINATE OPERATIONS

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

// DATA CREATION AND SANITIZATION

/**
 * Create default user settings
 * @returns Default UserSettings object
 */
export function createDefaultUserSettings(): UserSettings {
  return {
    defaultTriggerRadius: 500,
    vibrationEnabled: true,
    persistentNotificationEnabled: true,
    batteryOptimizationEnabled: true,
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

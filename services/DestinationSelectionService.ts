// Service for handling destination selection logic and validation
import { Coordinate, Destination, ValidationResult } from "../types";
import {
  formatCoordinate,
  generateId,
  sanitizeAddress,
  sanitizeDestinationName,
  validateCoordinate,
  validateDestination,
  calculateDistance,
} from "../utils";

export interface DestinationSelectionOptions {
  name?: string;
  address?: string;
}

export interface BoundaryCheckOptions {
  minLatitude?: number;
  maxLatitude?: number;
  minLongitude?: number;
  maxLongitude?: number;
  allowedRegions?: {
    name: string;
    bounds: {
      northeast: Coordinate;
      southwest: Coordinate;
    };
  }[];
}

export class DestinationSelectionService {
  private static instance: DestinationSelectionService;

  public static getInstance(): DestinationSelectionService {
    if (!DestinationSelectionService.instance) {
      DestinationSelectionService.instance = new DestinationSelectionService();
    }
    return DestinationSelectionService.instance;
  }

  /**
   * Create a destination from a coordinate with validation
   * @param coordinate The coordinate to create destination from
   * @param options Additional options for the destination
   * @returns Promise resolving to the created destination or validation errors
   */
  public async createDestinationFromCoordinate(
    coordinate: Coordinate,
    options: DestinationSelectionOptions = {},
  ): Promise<{ destination?: Destination; errors?: string[] }> {
    // Validate coordinate first
    const coordinateValidation =
      this.validateCoordinateForSelection(coordinate);
    if (!coordinateValidation.isValid) {
      return { errors: coordinateValidation.errors };
    }

    // Create destination object
    const destination: Partial<Destination> = {
      name: options.name || "Selected Location",
      coordinate,
      address: options.address || formatCoordinate(coordinate),
    };

    // Validate the complete destination
    const destinationValidation = validateDestination(destination);
    if (!destinationValidation.isValid) {
      return { errors: destinationValidation.errors };
    }

    // Create final destination with ID and timestamp
    const finalDestination: Destination = {
      id: generateId(),
      name: sanitizeDestinationName(destination.name!),
      coordinate: destination.coordinate!,
      address: destination.address
        ? sanitizeAddress(destination.address)
        : undefined,
      createdAt: new Date().toISOString(),
    };

    return { destination: finalDestination };
  }

  /**
   * Validate a coordinate for destination selection
   * @param coordinate Coordinate to validate
   * @param boundaryOptions Optional boundary checking options
   * @returns Validation result
   */
  public validateCoordinateForSelection(
    coordinate: Coordinate,
    boundaryOptions?: BoundaryCheckOptions,
  ): ValidationResult {
    // Basic coordinate validation
    const basicValidation = validateCoordinate(coordinate);
    if (!basicValidation.isValid) {
      return basicValidation;
    }

    const errors: string[] = [];

    // Additional boundary checks if specified
    if (boundaryOptions) {
      if (
        boundaryOptions.minLatitude !== undefined &&
        coordinate.latitude < boundaryOptions.minLatitude
      ) {
        errors.push(`Latitude must be at least ${boundaryOptions.minLatitude}`);
      }
      if (
        boundaryOptions.maxLatitude !== undefined &&
        coordinate.latitude > boundaryOptions.maxLatitude
      ) {
        errors.push(`Latitude must be at most ${boundaryOptions.maxLatitude}`);
      }
      if (
        boundaryOptions.minLongitude !== undefined &&
        coordinate.longitude < boundaryOptions.minLongitude
      ) {
        errors.push(
          `Longitude must be at least ${boundaryOptions.minLongitude}`,
        );
      }
      if (
        boundaryOptions.maxLongitude !== undefined &&
        coordinate.longitude > boundaryOptions.maxLongitude
      ) {
        errors.push(
          `Longitude must be at most ${boundaryOptions.maxLongitude}`,
        );
      }

      // Check allowed regions if specified
      if (
        boundaryOptions.allowedRegions &&
        boundaryOptions.allowedRegions.length > 0
      ) {
        const isInAllowedRegion = boundaryOptions.allowedRegions.some(
          (region) =>
            this.isCoordinateInBounds(
              coordinate,
              region.bounds.southwest,
              region.bounds.northeast,
            ),
        );

        if (!isInAllowedRegion) {
          const regionNames = boundaryOptions.allowedRegions
            .map((r) => r.name)
            .join(", ");
          errors.push(
            `Location must be within allowed regions: ${regionNames}`,
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: [...basicValidation.errors, ...errors],
    };
  }

  /**
   * Check if a coordinate is within specified bounds
   * @param coordinate Coordinate to check
   * @param southwest Southwest corner of bounds
   * @param northeast Northeast corner of bounds
   * @returns True if coordinate is within bounds
   */
  public isCoordinateInBounds(
    coordinate: Coordinate,
    southwest: Coordinate,
    northeast: Coordinate,
  ): boolean {
    return (
      coordinate.latitude >= southwest.latitude &&
      coordinate.latitude <= northeast.latitude &&
      coordinate.longitude >= southwest.longitude &&
      coordinate.longitude <= northeast.longitude
    );
  }

  /**
   * Validate multiple coordinates for batch selection
   * @param coordinates Array of coordinates to validate
   * @param boundaryOptions Optional boundary checking options
   * @returns Array of validation results
   */
  public validateMultipleCoordinates(
    coordinates: Coordinate[],
    boundaryOptions?: BoundaryCheckOptions,
  ): ValidationResult[] {
    return coordinates.map((coord) =>
      this.validateCoordinateForSelection(coord, boundaryOptions),
    );
  }

  /**
   * Check if a destination is suitable for alarm creation
   * @param destination Destination to check
   * @param currentLocation Current user location for distance validation
   * @returns Validation result with suitability information
   */
  public validateDestinationForAlarm(
    destination: Destination,
    currentLocation?: Coordinate,
  ): ValidationResult {
    const errors: string[] = [];

    // Basic destination validation
    const basicValidation = validateDestination(destination);
    if (!basicValidation.isValid) {
      return basicValidation;
    }

    // Check if destination is too close to current location
    if (currentLocation) {
      const distance = calculateDistance(
        currentLocation,
        destination.coordinate,
      );

      if (distance < 50) {
        // Less than 50 meters
        errors.push(
          "Destination is too close to your current location (minimum 50m)",
        );
      }

      if (distance > 100000) {
        // More than 100km
        errors.push(
          "Destination is too far from your current location (maximum 100km)",
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors: [...basicValidation.errors, ...errors],
    };
  }

  /**
   * Create boundary options for specific regions
   * @param regionName Name of the region
   * @returns Boundary options for the region
   */
  public createRegionBoundaryOptions(
    regionName: string,
  ): BoundaryCheckOptions | null {
    const regions: { [key: string]: BoundaryCheckOptions } = {
      delhi: {
        allowedRegions: [
          {
            name: "Delhi NCR",
            bounds: {
              northeast: { latitude: 28.88, longitude: 77.35 },
              southwest: { latitude: 28.4, longitude: 76.84 },
            },
          },
        ],
      },
      mumbai: {
        allowedRegions: [
          {
            name: "Mumbai Metropolitan Region",
            bounds: {
              northeast: { latitude: 19.27, longitude: 73.02 },
              southwest: { latitude: 18.89, longitude: 72.77 },
            },
          },
        ],
      },
      bangalore: {
        allowedRegions: [
          {
            name: "Bangalore Urban",
            bounds: {
              northeast: { latitude: 13.14, longitude: 77.78 },
              southwest: { latitude: 12.83, longitude: 77.46 },
            },
          },
        ],
      },
    };

    return regions[regionName.toLowerCase()] || null;
  }

  /**
   * Sanitize and prepare destination for storage
   * @param destination Raw destination data
   * @returns Sanitized destination ready for storage
   */
  public sanitizeDestination(
    destination: Partial<Destination>,
  ): Partial<Destination> {
    return {
      ...destination,
      name: destination.name
        ? sanitizeDestinationName(destination.name)
        : undefined,
      address: destination.address
        ? sanitizeAddress(destination.address)
        : undefined,
    };
  }
}

// Export singleton instance
export const destinationSelectionService =
  DestinationSelectionService.getInstance();

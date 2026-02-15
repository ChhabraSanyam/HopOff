// OpenStreetMap Nominatim API service for free geocoding and address search
import Constants from "expo-constants";
import { AddressSearchResult, Coordinate, NominatimResult } from "../types";

export interface NominatimService {
  searchAddress(query: string, limit?: number): Promise<AddressSearchResult[]>;
  reverseGeocode(coordinate: Coordinate): Promise<AddressSearchResult | null>;
  isServiceAvailable(): Promise<boolean>;
  clearCache(): void;
}

export enum NominatimError {
  NETWORK_ERROR = "NETWORK_ERROR",
  INVALID_RESPONSE = "INVALID_RESPONSE",
  NO_RESULTS = "NO_RESULTS",
  RATE_LIMITED = "RATE_LIMITED",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  INVALID_QUERY = "INVALID_QUERY",
}

export class NominatimServiceError extends Error {
  constructor(
    public code: NominatimError,
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "NominatimServiceError";
  }
}

export class NominatimServiceImpl implements NominatimService {
  private readonly baseUrl = "https://nominatim.openstreetmap.org";
  private readonly userAgent = `HopOff/${Constants.expoConfig?.version || "1.0.0"} (mailto:sanyam@sanyamchhabra.in)`;
  private readonly requestTimeout = 10000; // 10 seconds
  private lastRequestTime = 0;
  private readonly minRequestInterval = 1500; // 1.5 seconds between requests (conservative rate limit)

  // Simple in-memory cache
  private searchCache = new Map<
    string,
    { results: AddressSearchResult[]; timestamp: number }
  >();
  private reverseGeocodeCache = new Map<
    string,
    { result: AddressSearchResult | null; timestamp: number }
  >();
  private readonly cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Search for addresses using Nominatim geocoding API
   */
  async searchAddress(
    query: string,
    limit: number = 5,
  ): Promise<AddressSearchResult[]> {
    try {
      // Validate query
      if (!query || query.trim().length < 2) {
        throw new NominatimServiceError(
          NominatimError.INVALID_QUERY,
          "Search query must be at least 2 characters long",
        );
      }

      const trimmedQuery = query.trim();

      // Check cache first
      const cacheKey = `${trimmedQuery}_${limit}`;
      const cached = this.searchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.results;
      }

      // Respect rate limiting
      await this.respectRateLimit();

      const searchParams = new URLSearchParams({
        q: trimmedQuery,
        format: "json",
        limit: Math.min(limit, 10).toString(), // Cap at 10 results
        addressdetails: "1",
        extratags: "1",
        namedetails: "1",
        "accept-language": "en", // Prefer English results
      });

      const url = `${this.baseUrl}/search?${searchParams.toString()}`;

      const response = await this.makeRequest(url);

      if (!response.ok) {
        if (response.status === 429 || response.status === 509) {
          throw new NominatimServiceError(
            NominatimError.RATE_LIMITED,
            "Too many requests. Please wait a moment and try again.",
          );
        }
        throw new NominatimServiceError(
          NominatimError.SERVICE_UNAVAILABLE,
          `Nominatim service returned status ${response.status}`,
        );
      }

      const data: NominatimResult[] = await response.json();

      if (!Array.isArray(data)) {
        throw new NominatimServiceError(
          NominatimError.INVALID_RESPONSE,
          "Invalid response format from Nominatim service",
        );
      }

      if (data.length === 0) {
        throw new NominatimServiceError(
          NominatimError.NO_RESULTS,
          `No results found for "${trimmedQuery}"`,
        );
      }

      // Convert Nominatim results to our format
      const results = data.map((item, index) =>
        this.convertNominatimResult(item, index),
      );

      // Sort by importance (higher is better)
      results.sort((a, b) => b.importance - a.importance);

      // Cache the results
      this.searchCache.set(cacheKey, { results, timestamp: Date.now() });

      return results;
    } catch (error) {
      if (error instanceof NominatimServiceError) {
        throw error;
      }

      // Handle network errors
      if (
        error instanceof TypeError &&
        (error.message.includes("fetch") ||
          error.message.includes("Network request failed"))
      ) {
        throw new NominatimServiceError(
          NominatimError.NETWORK_ERROR,
          "Network error. Please check your internet connection.",
          error,
        );
      }

      throw new NominatimServiceError(
        NominatimError.SERVICE_UNAVAILABLE,
        "Failed to search address",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Reverse geocode a coordinate to get address information
   */
  async reverseGeocode(
    coordinate: Coordinate,
  ): Promise<AddressSearchResult | null> {
    try {
      // Validate coordinate
      if (!this.isValidCoordinate(coordinate)) {
        throw new NominatimServiceError(
          NominatimError.INVALID_QUERY,
          "Invalid coordinate provided for reverse geocoding",
        );
      }

      // Check cache first - round to 4 decimal places for cache key (~11m precision)
      const cacheKey = `${coordinate.latitude.toFixed(4)}_${coordinate.longitude.toFixed(4)}`;
      const cached = this.reverseGeocodeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.result;
      }

      // Respect rate limiting
      await this.respectRateLimit();

      const searchParams = new URLSearchParams({
        lat: coordinate.latitude.toString(),
        lon: coordinate.longitude.toString(),
        format: "json",
        addressdetails: "1",
        extratags: "1",
        namedetails: "1",
        zoom: "18", // High zoom for detailed address
        "accept-language": "en",
      });

      const url = `${this.baseUrl}/reverse?${searchParams.toString()}`;

      const response = await this.makeRequest(url);

      if (!response.ok) {
        if (response.status === 429 || response.status === 509) {
          throw new NominatimServiceError(
            NominatimError.RATE_LIMITED,
            "Too many requests. Please wait a moment and try again.",
          );
        }
        throw new NominatimServiceError(
          NominatimError.SERVICE_UNAVAILABLE,
          `Nominatim service returned status ${response.status}`,
        );
      }

      const data: NominatimResult = await response.json();

      if (!data || !data.lat || !data.lon) {
        // Cache the null result as well to avoid repeated requests for same location
        this.reverseGeocodeCache.set(cacheKey, {
          result: null,
          timestamp: Date.now(),
        });
        return null; // No result found for this coordinate
      }

      const result = this.convertNominatimResult(data, 0);

      // Cache the result
      this.reverseGeocodeCache.set(cacheKey, { result, timestamp: Date.now() });

      return result;
    } catch (error) {
      if (error instanceof NominatimServiceError) {
        throw error;
      }

      // Handle network errors
      if (
        error instanceof TypeError &&
        (error.message.includes("fetch") ||
          error.message.includes("Network request failed"))
      ) {
        throw new NominatimServiceError(
          NominatimError.NETWORK_ERROR,
          "Network error. Please check your internet connection.",
          error,
        );
      }

      throw new NominatimServiceError(
        NominatimError.SERVICE_UNAVAILABLE,
        "Failed to reverse geocode coordinate",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Check if Nominatim service is available
   */
  async isServiceAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${this.baseUrl}/status`, {
        method: "GET",
        headers: {
          "User-Agent": this.userAgent,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn("Nominatim service availability check failed:", error);
      return false;
    }
  }

  /**
   * Make HTTP request with proper headers and timeout
   */
  private async makeRequest(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Respect Nominatim rate limiting (max 1 request per 1.5 seconds for conservative approach)
   */
  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Clear the cache (useful for testing or if rate limit is hit)
   */
  clearCache(): void {
    this.searchCache.clear();
    this.reverseGeocodeCache.clear();
  }

  /**
   * Convert Nominatim result to our AddressSearchResult format
   */
  private convertNominatimResult(
    result: NominatimResult,
    index: number,
  ): AddressSearchResult {
    const coordinate: Coordinate = {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
    };

    // Parse bounding box
    const boundingBox = {
      south: parseFloat(result.boundingbox[0]),
      north: parseFloat(result.boundingbox[1]),
      west: parseFloat(result.boundingbox[2]),
      east: parseFloat(result.boundingbox[3]),
    };

    // Generate a readable name from display_name
    const displayName = this.extractReadableName(result.display_name);

    return {
      id: `nominatim_${result.place_id}_${index}`,
      displayName,
      address: result.display_name,
      coordinate,
      importance: result.importance || 0,
      type: result.type || "unknown",
      boundingBox,
    };
  }

  /**
   * Extract a readable name from Nominatim's display_name
   */
  private extractReadableName(displayName: string): string {
    // Nominatim display_name format: "Name, Street, City, State, Country"
    // We want to extract the most relevant part (usually the first 1-2 components)
    const parts = displayName.split(",").map((part) => part.trim());

    if (parts.length === 1) {
      return parts[0];
    }

    // For most cases, take the first two parts (e.g., "Central Park, New York")
    if (parts.length >= 2) {
      return `${parts[0]}, ${parts[1]}`;
    }

    return parts[0];
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
export const nominatimService = new NominatimServiceImpl();

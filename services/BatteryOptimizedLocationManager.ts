// Battery-optimized location manager that adapts behavior based on battery level
import * as Location from 'expo-location';
import { Coordinate } from '../types';
import { batteryManager, LocationOptimizationSettings } from './BatteryManager';
import { LocationError, LocationManager, LocationManagerError, LocationManagerImpl } from './LocationManager';

export interface BatteryOptimizedLocationManager extends LocationManager {
  startAdaptiveLocationUpdates(callback: (location: Coordinate) => void): void;
  stopAdaptiveLocationUpdates(): void;
  updateOptimizationSettings(batteryLevel: number): void;
  getOptimizationStatus(): LocationOptimizationStatus;
  setUserOptimizationPreferences(preferences: UserOptimizationPreferences): void;
}

export interface LocationOptimizationStatus {
  isOptimizing: boolean;
  currentSettings: LocationOptimizationSettings;
  batteryLevel: number | null;
  updateInterval: number;
  accuracy: Location.Accuracy;
  lastOptimizationUpdate: Date | null;
}

export interface UserOptimizationPreferences {
  enableBatteryOptimization: boolean;
  optimizationLevel: 'auto' | 'conservative' | 'aggressive' | 'disabled';
  lowBatteryThreshold: number; // 0-1
  criticalBatteryThreshold: number; // 0-1
  adaptiveAccuracy: boolean;
  backgroundProcessingOptimization: boolean;
}

export class BatteryOptimizedLocationManagerImpl extends LocationManagerImpl implements BatteryOptimizedLocationManager {
  private adaptiveLocationSubscription: Location.LocationSubscription | null = null;
  private isAdaptiveTracking = false;
  private currentOptimizationSettings: LocationOptimizationSettings;
  private userPreferences: UserOptimizationPreferences;
  private lastOptimizationUpdate: Date | null = null;
  private adaptiveCallback: ((location: Coordinate) => void) | null = null;
  private updateTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    
    // Default optimization settings
    this.currentOptimizationSettings = {
      updateInterval: 10000, // 10 seconds
      accuracy: 'high',
      useGeofencingOnly: false,
      reducedPollingFrequency: false,
      backgroundProcessingEnabled: true,
    };

    // Default user preferences
    this.userPreferences = {
      enableBatteryOptimization: true,
      optimizationLevel: 'auto',
      lowBatteryThreshold: 0.30,
      criticalBatteryThreshold: 0.15,
      adaptiveAccuracy: true,
      backgroundProcessingOptimization: true,
    };
  }

  /**
   * Start adaptive location updates that adjust based on battery level
   */
  startAdaptiveLocationUpdates(callback: (location: Coordinate) => void): void {
    if (this.isAdaptiveTracking) {
      console.warn('Adaptive location updates already started');
      return;
    }

    this.adaptiveCallback = callback;
    this.isAdaptiveTracking = true;

    // Update optimization settings based on current battery level
    this.updateOptimizationBasedOnBattery();

    // Start location updates with current settings
    this.startLocationUpdatesWithSettings();

    console.log('Adaptive location updates started');
  }

  /**
   * Stop adaptive location updates
   */
  stopAdaptiveLocationUpdates(): void {
    if (!this.isAdaptiveTracking) {
      return;
    }

    if (this.adaptiveLocationSubscription) {
      this.adaptiveLocationSubscription.remove();
      this.adaptiveLocationSubscription = null;
    }

    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    this.isAdaptiveTracking = false;
    this.adaptiveCallback = null;

    console.log('Adaptive location updates stopped');
  }

  /**
   * Update optimization settings based on battery level
   */
  updateOptimizationSettings(batteryLevel: number): void {
    if (!this.userPreferences.enableBatteryOptimization) {
      return;
    }

    const newSettings = batteryManager.getOptimizedLocationSettings(batteryLevel);
    
    // Apply user preferences
    if (this.userPreferences.optimizationLevel === 'disabled') {
      // Use default high-performance settings
      this.currentOptimizationSettings = {
        updateInterval: 10000,
        accuracy: 'high',
        useGeofencingOnly: false,
        reducedPollingFrequency: false,
        backgroundProcessingEnabled: true,
      };
    } else if (this.userPreferences.optimizationLevel === 'conservative') {
      // Less aggressive optimization
      this.currentOptimizationSettings = {
        ...newSettings,
        updateInterval: Math.max(newSettings.updateInterval, 15000), // At least 15 seconds
        accuracy: newSettings.accuracy === 'low' ? 'balanced' : newSettings.accuracy,
      };
    } else if (this.userPreferences.optimizationLevel === 'aggressive') {
      // More aggressive optimization
      this.currentOptimizationSettings = {
        ...newSettings,
        updateInterval: Math.min(newSettings.updateInterval * 1.5, 120000), // Up to 2 minutes
        useGeofencingOnly: batteryLevel <= this.userPreferences.lowBatteryThreshold,
      };
    } else {
      // Auto mode - use battery manager recommendations
      this.currentOptimizationSettings = newSettings;
    }

    this.lastOptimizationUpdate = new Date();

    // Restart location updates with new settings if currently tracking
    if (this.isAdaptiveTracking) {
      this.restartLocationUpdatesWithNewSettings();
    }

    console.log(`Location optimization updated for battery level ${(batteryLevel * 100).toFixed(1)}%:`, this.currentOptimizationSettings);
  }

  /**
   * Get current optimization status
   */
  getOptimizationStatus(): LocationOptimizationStatus {
    return {
      isOptimizing: this.isOptimizationActive(),
      currentSettings: { ...this.currentOptimizationSettings },
      batteryLevel: batteryManager.getLastStatus()?.level ?? null,
      updateInterval: this.currentOptimizationSettings.updateInterval,
      accuracy: this.getLocationAccuracy(),
      lastOptimizationUpdate: this.lastOptimizationUpdate,
    };
  }

  /**
   * Set user optimization preferences
   */
  setUserOptimizationPreferences(preferences: UserOptimizationPreferences): void {
    this.userPreferences = { ...preferences };
    
    // Update current settings based on new preferences
    const batteryLevel = batteryManager.getLastStatus()?.level;
    if (batteryLevel !== null && batteryLevel !== undefined) {
      this.updateOptimizationSettings(batteryLevel);
    }
  }

  /**
   * Override getCurrentLocation to use adaptive accuracy
   */
  async getCurrentLocation(): Promise<Coordinate> {
    try {
      const hasPermission = await this.requestLocationPermissions();
      if (!hasPermission) {
        throw new LocationManagerError(
          LocationError.PERMISSION_DENIED,
          'Location permission is required to get current location'
        );
      }

      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        throw new LocationManagerError(
          LocationError.LOCATION_UNAVAILABLE,
          'Location services are disabled. Please enable location services in your device settings.'
        );
      }

      // Use adaptive accuracy based on battery optimization
      const accuracy = this.getLocationAccuracy();
      const timeout = this.getLocationTimeout();

      const location = await Location.getCurrentPositionAsync({
        accuracy,
        timeInterval: timeout,
        distanceInterval: 0,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch {
      // Handle errors same as parent class
      return super.getCurrentLocation();
    }
  }

  /**
   * Start location updates with current optimization settings
   */
  private async startLocationUpdatesWithSettings(): Promise<void> {
    try {
      const hasPermission = await this.requestLocationPermissions();
      if (!hasPermission) {
        throw new LocationManagerError(
          LocationError.PERMISSION_DENIED,
          'Location permission is required for location updates'
        );
      }

      // Use timer-based updates for better battery control
      this.updateTimer = setInterval(async () => {
        try {
          const location = await this.getCurrentLocation();
          if (this.adaptiveCallback) {
            this.adaptiveCallback(location);
          }
        } catch (error) {
          console.warn('Error getting location during adaptive updates:', error);
        }
      }, this.currentOptimizationSettings.updateInterval) as unknown as NodeJS.Timeout;

    } catch (error) {
      console.error('Failed to start adaptive location updates:', error);
      throw error;
    }
  }

  /**
   * Restart location updates with new settings
   */
  private restartLocationUpdatesWithNewSettings(): void {
    // Stop current updates
    if (this.adaptiveLocationSubscription) {
      this.adaptiveLocationSubscription.remove();
      this.adaptiveLocationSubscription = null;
    }

    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    // Start with new settings
    this.startLocationUpdatesWithSettings();
  }

  /**
   * Update optimization based on current battery level
   */
  private async updateOptimizationBasedOnBattery(): Promise<void> {
    try {
      const batteryLevel = await batteryManager.getBatteryLevel();
      this.updateOptimizationSettings(batteryLevel);
    } catch (error) {
      console.warn('Failed to get battery level for optimization:', error);
    }
  }

  /**
   * Check if optimization is currently active
   */
  private isOptimizationActive(): boolean {
    if (!this.userPreferences.enableBatteryOptimization) {
      return false;
    }

    const batteryLevel = batteryManager.getLastStatus()?.level;
    if (batteryLevel === null || batteryLevel === undefined) {
      return false;
    }

    return batteryLevel <= this.userPreferences.lowBatteryThreshold;
  }

  /**
   * Get appropriate location accuracy based on optimization settings
   */
  private getLocationAccuracy(): Location.Accuracy {
    if (!this.userPreferences.adaptiveAccuracy || !this.isOptimizationActive()) {
      return Location.Accuracy.Balanced;
    }

    switch (this.currentOptimizationSettings.accuracy) {
      case 'high':
        return Location.Accuracy.High;
      case 'balanced':
        return Location.Accuracy.Balanced;
      case 'low':
        return Location.Accuracy.Low;
      default:
        return Location.Accuracy.Balanced;
    }
  }

  /**
   * Get appropriate location timeout based on optimization settings
   */
  private getLocationTimeout(): number {
    if (!this.isOptimizationActive()) {
      return 10000; // 10 seconds default
    }

    // Longer timeout for battery optimization
    return Math.min(this.currentOptimizationSettings.updateInterval * 0.8, 30000);
  }

  /**
   * Get user preferences
   */
  getUserOptimizationPreferences(): UserOptimizationPreferences {
    return { ...this.userPreferences };
  }

  /**
   * Get battery optimization statistics
   */
  getBatteryOptimizationStats(): {
    isOptimizing: boolean;
    batteryLevel: number | null;
    optimizationLevel: string;
    updateInterval: number;
    accuracy: string;
    totalOptimizations: number;
    lastUpdate: Date | null;
  } {
    const batteryStats = batteryManager.getBatteryOptimizationStats();
    
    return {
      isOptimizing: this.isOptimizationActive(),
      batteryLevel: batteryStats.currentLevel,
      optimizationLevel: this.userPreferences.optimizationLevel,
      updateInterval: this.currentOptimizationSettings.updateInterval,
      accuracy: this.currentOptimizationSettings.accuracy,
      totalOptimizations: 0, // Could be tracked if needed
      lastUpdate: this.lastOptimizationUpdate,
    };
  }

  /**
   * Override cleanup to include adaptive tracking cleanup
   */
  async cleanup(): Promise<void> {
    this.stopAdaptiveLocationUpdates();
    await super.cleanup();
  }
}

// Export singleton instance
export const batteryOptimizedLocationManager = new BatteryOptimizedLocationManagerImpl();
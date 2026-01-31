// Storage management service for HopOff app
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Destination, UserSettings, VALIDATION_CONSTANTS } from '../types';
import { databaseManager } from './DatabaseManager';
import { nominatimService } from './NominatimService';

export interface StorageManager {
  saveDestination(destination: Destination): Promise<string>;
  getSavedDestinations(): Promise<Destination[]>;
  deleteDestination(id: string): Promise<void>;
  saveSettings(settings: UserSettings): Promise<void>;
  getSettings(): Promise<UserSettings>;
  enrichDestinationWithAddress(destination: Destination): Promise<Destination>;
}

const SETTINGS_KEY = 'user_settings';

const defaultSettings: UserSettings = {
  defaultTriggerRadius: 200,
  vibrationEnabled: true,
  persistentNotificationEnabled: true,
  batteryOptimizationEnabled: true,
  batteryOptimizationLevel: 'auto',
  lowBatteryThreshold: 0.2,
  criticalBatteryThreshold: 0.1,
  adaptiveLocationAccuracy: true,
  backgroundProcessingOptimization: true,
};

export class StorageManagerImpl implements StorageManager {
  async saveDestination(destination: Destination): Promise<string> {
    try {
      await databaseManager.initializeDatabase();
      return await databaseManager.saveDestination(destination);
    } catch (error) {
      throw new Error(`Failed to save destination: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSavedDestinations(): Promise<Destination[]> {
    try {
      await databaseManager.initializeDatabase();
      return await databaseManager.getSavedDestinations();
    } catch (error) {
      throw new Error(`Failed to get saved destinations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteDestination(id: string): Promise<void> {
    try {
      await databaseManager.initializeDatabase();
      await databaseManager.deleteDestination(id);
    } catch (error) {
      throw new Error(`Failed to delete destination: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    try {
      const validatedSettings = this.validateSettings(settings);
      const settingsJson = JSON.stringify(validatedSettings);
      await AsyncStorage.setItem(SETTINGS_KEY, settingsJson);
    } catch (error) {
      throw new Error(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSettings(): Promise<UserSettings> {
    try {
      const settingsJson = await AsyncStorage.getItem(SETTINGS_KEY);
      if (!settingsJson) {
        // Return default settings if none exist
        return { ...defaultSettings };
      }
      
      const settings = JSON.parse(settingsJson) as UserSettings;
      // Validate and merge with defaults to handle missing properties
      return this.validateSettings({ ...defaultSettings, ...settings });
    } catch (error) {
      console.warn('Failed to load settings, using defaults:', error);
      return { ...defaultSettings };
    }
  }

  private validateSettings(settings: UserSettings): UserSettings {
    const validated: UserSettings = { ...settings };

    // Validate trigger radius
    if (!VALIDATION_CONSTANTS.VALID_TRIGGER_RADII.includes(validated.defaultTriggerRadius as any)) {
      validated.defaultTriggerRadius = defaultSettings.defaultTriggerRadius;
    }

    // Volume and sound are controlled by system notification settings, no validation needed

    // Ensure boolean values - handle string 'false' and number 0 correctly
    if (typeof validated.vibrationEnabled === 'string') {
      validated.vibrationEnabled = validated.vibrationEnabled === 'true';
    } else if (typeof validated.vibrationEnabled === 'number') {
      validated.vibrationEnabled = validated.vibrationEnabled !== 0;
    } else {
      validated.vibrationEnabled = Boolean(validated.vibrationEnabled);
    }

    if (typeof validated.batteryOptimizationEnabled === 'string') {
      validated.batteryOptimizationEnabled = validated.batteryOptimizationEnabled === 'true';
    } else if (typeof validated.batteryOptimizationEnabled === 'number') {
      validated.batteryOptimizationEnabled = validated.batteryOptimizationEnabled !== 0;
    } else {
      validated.batteryOptimizationEnabled = Boolean(validated.batteryOptimizationEnabled);
    }

    return validated;
  }

  /**
   * Enrich destination with address information using reverse geocoding
   */
  async enrichDestinationWithAddress(destination: Destination): Promise<Destination> {
    try {
      // If destination already has an address, return as-is
      if (destination.address && destination.address.trim().length > 0) {
        return destination;
      }

      // Try to get address using reverse geocoding
      const addressResult = await nominatimService.reverseGeocode(destination.coordinate);
      
      if (addressResult) {
        return {
          ...destination,
          address: addressResult.address,
          // Update name if it's generic (like "Selected Location")
          name: destination.name === 'Selected Location' || destination.name.startsWith('Location at') 
            ? addressResult.displayName 
            : destination.name,
        };
      }

      return destination;
    } catch (error) {
      console.warn('Failed to enrich destination with address:', error);
      // Return original destination if reverse geocoding fails
      return destination;
    }
  }
}

// Export singleton instance
export const storageManager = new StorageManagerImpl();
// Battery optimization service for HopOff app
import * as Battery from 'expo-battery';
import { Platform } from 'react-native';

export interface BatteryManager {
  getBatteryLevel(): Promise<number>;
  getBatteryState(): Promise<BatteryState>;
  startBatteryMonitoring(callback: BatteryCallback): void;
  stopBatteryMonitoring(): void;
  shouldOptimizeForBattery(batteryLevel: number, batteryState: BatteryState): boolean;
  getOptimizedLocationSettings(batteryLevel: number): LocationOptimizationSettings;
  getBatteryOptimizationRecommendations(batteryLevel: number, batteryState: BatteryState): BatteryRecommendation[];
  isLowPowerModeEnabled(): Promise<boolean>;
}

export enum BatteryState {
  UNKNOWN = 'unknown',
  UNPLUGGED = 'unplugged',
  CHARGING = 'charging',
  FULL = 'full',
}

export interface BatteryStatus {
  level: number; // 0-1 (0% to 100%)
  state: BatteryState;
  isLowPowerMode: boolean;
  timestamp: string;
}

export interface LocationOptimizationSettings {
  updateInterval: number; // milliseconds
  accuracy: 'high' | 'balanced' | 'low';
  useGeofencingOnly: boolean;
  reducedPollingFrequency: boolean;
  backgroundProcessingEnabled: boolean;
}

export interface BatteryRecommendation {
  type: 'warning' | 'suggestion' | 'info';
  title: string;
  message: string;
  action?: {
    label: string;
    callback: () => void;
  };
}

export type BatteryCallback = (status: BatteryStatus) => void;

export class BatteryManagerImpl implements BatteryManager {
  private isMonitoring = false;
  private callback: BatteryCallback | null = null;
  private batterySubscription: Battery.Subscription | null = null;
  private lastStatus: BatteryStatus | null = null;

  // Battery level thresholds for optimization
  private readonly CRITICAL_BATTERY_LEVEL = 0.15; // 15%
  private readonly LOW_BATTERY_LEVEL = 0.30; // 30%
  private readonly MODERATE_BATTERY_LEVEL = 0.50; // 50%

  /**
   * Get current battery level (0-1)
   */
  async getBatteryLevel(): Promise<number> {
    try {
      const batteryLevel = await Battery.getBatteryLevelAsync();
      return Math.max(0, Math.min(1, batteryLevel)); // Ensure 0-1 range
    } catch (error) {
      console.warn('Failed to get battery level:', error);
      return 1; // Assume full battery if unable to determine
    }
  }

  /**
   * Get current battery state
   */
  async getBatteryState(): Promise<BatteryState> {
    try {
      const batteryState = await Battery.getBatteryStateAsync();
      
      switch (batteryState) {
        case Battery.BatteryState.CHARGING:
          return BatteryState.CHARGING;
        case Battery.BatteryState.FULL:
          return BatteryState.FULL;
        case Battery.BatteryState.UNPLUGGED:
          return BatteryState.UNPLUGGED;
        default:
          return BatteryState.UNKNOWN;
      }
    } catch (error) {
      console.warn('Failed to get battery state:', error);
      return BatteryState.UNKNOWN;
    }
  }

  /**
   * Check if low power mode is enabled (iOS only)
   */
  async isLowPowerModeEnabled(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        return await Battery.isLowPowerModeEnabledAsync();
      }
      return false; // Android doesn't have a direct equivalent
    } catch (error) {
      console.warn('Failed to check low power mode:', error);
      return false;
    }
  }

  /**
   * Start monitoring battery changes
   */
  startBatteryMonitoring(callback: BatteryCallback): void {
    if (this.isMonitoring) {
      console.warn('Battery monitoring already started');
      return;
    }

    this.callback = callback;
    this.isMonitoring = true;

    // Set up battery level monitoring
    this.batterySubscription = Battery.addBatteryLevelListener(async ({ batteryLevel }) => {
      await this.updateBatteryStatus();
    });

    // Also monitor battery state changes
    Battery.addBatteryStateListener(async ({ batteryState }) => {
      await this.updateBatteryStatus();
    });

    // Initial status check
    this.updateBatteryStatus();

    console.log('Battery monitoring started');
  }

  /**
   * Stop monitoring battery changes
   */
  stopBatteryMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    if (this.batterySubscription) {
      this.batterySubscription.remove();
      this.batterySubscription = null;
    }

    this.isMonitoring = false;
    this.callback = null;

    console.log('Battery monitoring stopped');
  }

  /**
   * Determine if battery optimization should be enabled
   */
  shouldOptimizeForBattery(batteryLevel: number, batteryState: BatteryState): boolean {
    // Always optimize if battery is critical
    if (batteryLevel <= this.CRITICAL_BATTERY_LEVEL) {
      return true;
    }

    // Optimize if battery is low and not charging
    if (batteryLevel <= this.LOW_BATTERY_LEVEL && batteryState !== BatteryState.CHARGING) {
      return true;
    }

    // Don't optimize if charging or battery is good
    return false;
  }

  /**
   * Get optimized location settings based on battery level
   */
  getOptimizedLocationSettings(batteryLevel: number): LocationOptimizationSettings {
    if (batteryLevel <= this.CRITICAL_BATTERY_LEVEL) {
      // Critical battery: Maximum optimization
      return {
        updateInterval: 60000, // 1 minute
        accuracy: 'low',
        useGeofencingOnly: true,
        reducedPollingFrequency: true,
        backgroundProcessingEnabled: false,
      };
    } else if (batteryLevel <= this.LOW_BATTERY_LEVEL) {
      // Low battery: Moderate optimization
      return {
        updateInterval: 30000, // 30 seconds
        accuracy: 'balanced',
        useGeofencingOnly: true,
        reducedPollingFrequency: true,
        backgroundProcessingEnabled: true,
      };
    } else if (batteryLevel <= this.MODERATE_BATTERY_LEVEL) {
      // Moderate battery: Light optimization
      return {
        updateInterval: 15000, // 15 seconds
        accuracy: 'balanced',
        useGeofencingOnly: false,
        reducedPollingFrequency: false,
        backgroundProcessingEnabled: true,
      };
    } else {
      // Good battery: No optimization
      return {
        updateInterval: 10000, // 10 seconds
        accuracy: 'high',
        useGeofencingOnly: false,
        reducedPollingFrequency: false,
        backgroundProcessingEnabled: true,
      };
    }
  }

  /**
   * Get battery optimization recommendations for the user
   */
  getBatteryOptimizationRecommendations(
    batteryLevel: number,
    batteryState: BatteryState
  ): BatteryRecommendation[] {
    const recommendations: BatteryRecommendation[] = [];

    if (batteryLevel <= this.CRITICAL_BATTERY_LEVEL) {
      recommendations.push({
        type: 'warning',
        title: 'Critical Battery Level',
        message: 'Your battery is critically low. HopOff has automatically enabled maximum battery optimization to preserve power.',
      });

      if (batteryState !== BatteryState.CHARGING) {
        recommendations.push({
          type: 'suggestion',
          title: 'Charge Your Device',
          message: 'Consider charging your device to ensure reliable alarm functionality.',
        });
      }
    } else if (batteryLevel <= this.LOW_BATTERY_LEVEL) {
      recommendations.push({
        type: 'warning',
        title: 'Low Battery Level',
        message: 'Your battery is low. HopOff has enabled battery optimization to extend battery life.',
      });

      if (batteryState !== BatteryState.CHARGING) {
        recommendations.push({
          type: 'suggestion',
          title: 'Enable Battery Optimization',
          message: 'Consider enabling battery optimization in settings to extend battery life during your journey.',
          action: {
            label: 'Open Settings',
            callback: () => {
              // This would navigate to settings screen
              console.log('Navigate to settings');
            },
          },
        });
      }
    } else if (batteryLevel <= this.MODERATE_BATTERY_LEVEL) {
      recommendations.push({
        type: 'info',
        title: 'Moderate Battery Level',
        message: 'Your battery level is moderate. HopOff is using balanced settings for optimal performance.',
      });
    }

    // iOS Low Power Mode recommendation
    if (Platform.OS === 'ios' && batteryLevel <= this.LOW_BATTERY_LEVEL) {
      recommendations.push({
        type: 'suggestion',
        title: 'Low Power Mode',
        message: 'Consider enabling Low Power Mode in iOS Settings to extend battery life. HopOff will adapt automatically.',
      });
    }

    // Android Battery Optimization recommendation
    if (Platform.OS === 'android' && batteryLevel <= this.LOW_BATTERY_LEVEL) {
      recommendations.push({
        type: 'suggestion',
        title: 'Battery Optimization',
        message: 'For best results, add HopOff to your battery optimization whitelist in Android Settings.',
      });
    }

    return recommendations;
  }

  /**
   * Get the last known battery status
   */
  getLastStatus(): BatteryStatus | null {
    return this.lastStatus;
  }

  /**
   * Update battery status and notify callback
   */
  private async updateBatteryStatus(): Promise<void> {
    try {
      const level = await this.getBatteryLevel();
      const state = await this.getBatteryState();
      const isLowPowerMode = await this.isLowPowerModeEnabled();

      const currentStatus: BatteryStatus = {
        level,
        state,
        isLowPowerMode,
        timestamp: new Date().toISOString(),
      };

      // Only notify if status changed significantly
      if (!this.lastStatus || 
          Math.abs(this.lastStatus.level - currentStatus.level) >= 0.05 || // 5% change
          this.lastStatus.state !== currentStatus.state ||
          this.lastStatus.isLowPowerMode !== currentStatus.isLowPowerMode) {
        
        this.lastStatus = currentStatus;
        
        if (this.callback) {
          this.callback(currentStatus);
        }
      }
    } catch (error) {
      console.error('Error updating battery status:', error);
    }
  }

  /**
   * Get battery optimization statistics for debugging
   */
  getBatteryOptimizationStats(): {
    currentLevel: number | null;
    currentState: BatteryState | null;
    isOptimizing: boolean;
    optimizationLevel: 'none' | 'light' | 'moderate' | 'maximum';
    lastUpdate: Date | null;
  } {
    const level = this.lastStatus?.level ?? null;
    const state = this.lastStatus?.state ?? null;
    
    let optimizationLevel: 'none' | 'light' | 'moderate' | 'maximum' = 'none';
    let isOptimizing = false;

    if (level !== null && state !== null) {
      isOptimizing = this.shouldOptimizeForBattery(level, state);
      
      if (level <= this.CRITICAL_BATTERY_LEVEL) {
        optimizationLevel = 'maximum';
      } else if (level <= this.LOW_BATTERY_LEVEL) {
        optimizationLevel = 'moderate';
      } else if (level <= this.MODERATE_BATTERY_LEVEL) {
        optimizationLevel = 'light';
      }
    }

    return {
      currentLevel: level,
      currentState: state,
      isOptimizing,
      optimizationLevel,
      lastUpdate: this.lastStatus?.timestamp ? new Date(this.lastStatus.timestamp) : null,
    };
  }
}

// Export singleton instance
export const batteryManager = new BatteryManagerImpl();
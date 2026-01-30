// Connectivity management service for HopOff app

export interface ConnectivityManager {
  isOnline(): Promise<boolean>;
  getConnectionType(): Promise<ConnectionType>;
  startMonitoring(callback: ConnectivityCallback): void;
  stopMonitoring(): void;
  isLocationServicesAvailable(): Promise<boolean>;
  canUseGeofencing(): Promise<boolean>;
}

export enum ConnectionType {
  NONE = 'none',
  WIFI = 'wifi',
  CELLULAR = 'cellular',
  UNKNOWN = 'unknown',
}

export interface ConnectivityStatus {
  isOnline: boolean;
  connectionType: ConnectionType;
  timestamp: string;
}

export type ConnectivityCallback = (status: ConnectivityStatus) => void;

export class ConnectivityManagerImpl implements ConnectivityManager {
  private isMonitoring = false;
  private callback: ConnectivityCallback | null = null;
  private lastStatus: ConnectivityStatus | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Check if device is online by attempting to reach a reliable endpoint
   */
  async isOnline(): Promise<boolean> {
    try {
      // Use a simple fetch with timeout to check connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache',
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      // Network error or timeout - consider offline
      return false;
    }
  }

  /**
   * Get current connection type
   * Note: This is a simplified implementation. In production, you'd use @react-native-community/netinfo
   */
  async getConnectionType(): Promise<ConnectionType> {
    try {
      const isOnline = await this.isOnline();
      if (!isOnline) {
        return ConnectionType.NONE;
      }

      // For now, we'll return UNKNOWN when online since we don't have NetInfo
      // In production, this would detect wifi vs cellular
      return ConnectionType.UNKNOWN;
    } catch {
      return ConnectionType.NONE;
    }
  }

  /**
   * Start monitoring connectivity changes
   */
  startMonitoring(callback: ConnectivityCallback): void {
    if (this.isMonitoring) {
      console.warn('Connectivity monitoring already started');
      return;
    }

    this.callback = callback;
    this.isMonitoring = true;

    // Check connectivity every 30 seconds
    this.checkInterval = setInterval(async () => {
      await this.checkAndNotify();
    }, 30000) as unknown as NodeJS.Timeout;

    // Initial check
    this.checkAndNotify();
  }

  /**
   * Stop monitoring connectivity changes
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isMonitoring = false;
    this.callback = null;
  }

  /**
   * Check if location services are available and enabled
   */
  async isLocationServicesAvailable(): Promise<boolean> {
    try {
      // Import Location here to avoid circular dependencies
      const Location = await import('expo-location');
      return await Location.hasServicesEnabledAsync();
    } catch (error) {
      console.error('Error checking location services:', error);
      return false;
    }
  }

  /**
   * Check if geofencing can be used (requires location services + permissions)
   */
  async canUseGeofencing(): Promise<boolean> {
    try {
      const Location = await import('expo-location');
      
      // Check if location services are enabled
      const hasServices = await Location.hasServicesEnabledAsync();
      if (!hasServices) {
        return false;
      }

      // Check background location permission
      const { status } = await Location.getBackgroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking geofencing availability:', error);
      return false;
    }
  }

  /**
   * Check connectivity and notify callback if status changed
   */
  private async checkAndNotify(): Promise<void> {
    try {
      const isOnline = await this.isOnline();
      const connectionType = await this.getConnectionType();
      
      const currentStatus: ConnectivityStatus = {
        isOnline,
        connectionType,
        timestamp: new Date().toISOString(),
      };

      // Only notify if status changed
      if (!this.lastStatus || 
          this.lastStatus.isOnline !== currentStatus.isOnline ||
          this.lastStatus.connectionType !== currentStatus.connectionType) {
        
        this.lastStatus = currentStatus;
        
        if (this.callback) {
          this.callback(currentStatus);
        }
      }
    } catch (error) {
      console.error('Error checking connectivity:', error);
    }
  }

  /**
   * Get the last known connectivity status
   */
  getLastStatus(): ConnectivityStatus | null {
    return this.lastStatus;
  }
}

// Export singleton instance
export const connectivityManager = new ConnectivityManagerImpl();
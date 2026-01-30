// Fallback location service for when geofencing is unavailable
import { Alarm } from '../types';
import { ErrorHandler } from '../utils/ErrorHandler';
import { locationManager } from './LocationManager';

export interface FallbackLocationService {
  startLocationPolling(alarm: Alarm, onTrigger: (alarm: Alarm) => void): Promise<string>;
  stopLocationPolling(pollingId: string): Promise<void>;
  isPolling(pollingId: string): boolean;
  getActivePollingIds(): string[];
  cleanup(): Promise<void>;
}

interface PollingSession {
  id: string;
  alarm: Alarm;
  onTrigger: (alarm: Alarm) => void;
  intervalId: NodeJS.Timeout;
  isActive: boolean;
  startTime: Date;
  lastCheck: Date;
  checkCount: number;
}

export class FallbackLocationServiceImpl implements FallbackLocationService {
  private pollingSessions: Map<string, PollingSession> = new Map();
  private basePollingInterval = 30000; // 30 seconds default
  private batteryOptimizedInterval = 60000; // 1 minute when battery optimized
  private highAccuracyInterval = 15000; // 15 seconds for high accuracy mode

  /**
   * Start location polling as fallback when geofencing is unavailable
   */
  async startLocationPolling(
    alarm: Alarm, 
    onTrigger: (alarm: Alarm) => void
  ): Promise<string> {
    try {
      // Generate unique polling ID
      const pollingId = `polling_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Determine polling interval based on settings and battery level
      const pollingInterval = await this.determinePollingInterval(alarm);

      // Create polling session
      const session: PollingSession = {
        id: pollingId,
        alarm,
        onTrigger,
        intervalId: setInterval(() => this.checkLocation(pollingId), pollingInterval) as unknown as NodeJS.Timeout,
        isActive: true,
        startTime: new Date(),
        lastCheck: new Date(),
        checkCount: 0,
      };

      this.pollingSessions.set(pollingId, session);

      console.log(`Started fallback location polling: ${pollingId} (interval: ${pollingInterval}ms)`);
      
      // Perform initial check
      await this.checkLocation(pollingId);

      return pollingId;
    } catch (error) {
      const errorInfo = ErrorHandler.processError(error);
      ErrorHandler.logError(errorInfo, 'FallbackLocationService.startLocationPolling');
      throw error;
    }
  }

  /**
   * Stop location polling
   */
  async stopLocationPolling(pollingId: string): Promise<void> {
    const session = this.pollingSessions.get(pollingId);
    if (!session) {
      console.warn(`Polling session not found: ${pollingId}`);
      return;
    }

    // Clear the interval
    clearInterval(session.intervalId);
    
    // Mark as inactive
    session.isActive = false;
    
    // Remove from active sessions
    this.pollingSessions.delete(pollingId);

    console.log(`Stopped fallback location polling: ${pollingId}`);
  }

  /**
   * Check if a polling session is active
   */
  isPolling(pollingId: string): boolean {
    const session = this.pollingSessions.get(pollingId);
    return session ? session.isActive : false;
  }

  /**
   * Get all active polling session IDs
   */
  getActivePollingIds(): string[] {
    return Array.from(this.pollingSessions.keys()).filter(id => 
      this.pollingSessions.get(id)?.isActive
    );
  }

  /**
   * Cleanup all polling sessions
   */
  async cleanup(): Promise<void> {
    const activeIds = this.getActivePollingIds();
    
    for (const id of activeIds) {
      await this.stopLocationPolling(id);
    }

    this.pollingSessions.clear();
    console.log('Fallback location service cleaned up');
  }

  /**
   * Check current location against alarm destination
   */
  private async checkLocation(pollingId: string): Promise<void> {
    const session = this.pollingSessions.get(pollingId);
    if (!session || !session.isActive) {
      return;
    }

    try {
      session.checkCount++;
      session.lastCheck = new Date();

      // Get current location
      const currentLocation = await locationManager.getCurrentLocation();
      
      // Calculate distance to destination
      const distance = locationManager.calculateDistance(
        currentLocation,
        session.alarm.destination.coordinate
      );

      console.log(`Polling check ${session.checkCount}: ${distance}m to ${session.alarm.destination.name}`);

      // Check if we're within trigger radius
      if (distance <= session.alarm.settings.triggerRadius) {
        console.log(`Fallback location trigger: ${session.alarm.destination.name} (${distance}m)`);
        
        // Stop polling before triggering
        await this.stopLocationPolling(pollingId);
        
        // Trigger the alarm
        session.onTrigger(session.alarm);
      }

      // Adaptive polling: reduce frequency if we're far from destination
      await this.adaptPollingFrequency(session, distance);

    } catch (error) {
      console.error(`Error in location polling check (${pollingId}):`, error);
      
      // Don't stop polling on individual errors, but log them
      const errorInfo = ErrorHandler.processError(error);
      ErrorHandler.logError(errorInfo, `FallbackLocationService.checkLocation.${pollingId}`);
      
      // If we've had too many consecutive errors, stop polling
      if (session.checkCount > 10 && this.shouldStopOnError(error)) {
        console.error(`Stopping polling due to persistent errors: ${pollingId}`);
        await this.stopLocationPolling(pollingId);
      }
    }
  }

  /**
   * Determine appropriate polling interval based on alarm settings and device state
   */
  private async determinePollingInterval(alarm: Alarm): Promise<number> {
    try {
      // Check battery level (simplified - in production you'd use expo-battery)
      const isBatteryOptimized = alarm.settings.persistentNotification === false;
      
      // Base interval on trigger radius - smaller radius needs more frequent checks
      let interval = this.basePollingInterval;
      
      if (alarm.settings.triggerRadius <= 100) {
        interval = this.highAccuracyInterval; // More frequent for small radius
      } else if (isBatteryOptimized) {
        interval = this.batteryOptimizedInterval; // Less frequent for battery saving
      }

      return interval;
    } catch (error) {
      console.warn('Error determining polling interval, using default:', error);
      return this.basePollingInterval;
    }
  }

  /**
   * Adapt polling frequency based on distance to destination
   */
  private async adaptPollingFrequency(session: PollingSession, distance: number): Promise<void> {
    try {
      let newInterval = this.basePollingInterval;

      // If we're very close (within 2x trigger radius), poll more frequently
      if (distance <= session.alarm.settings.triggerRadius * 2) {
        newInterval = this.highAccuracyInterval;
      }
      // If we're far away (more than 10x trigger radius), poll less frequently
      else if (distance > session.alarm.settings.triggerRadius * 10) {
        newInterval = this.batteryOptimizedInterval;
      }

      // Only update if interval changed significantly (more than 5 seconds difference)
      const currentInterval = this.getCurrentInterval(session.intervalId);
      if (Math.abs(newInterval - currentInterval) > 5000) {
        // Clear current interval
        clearInterval(session.intervalId);
        
        // Set new interval
        session.intervalId = setInterval(() => this.checkLocation(session.id), newInterval) as unknown as NodeJS.Timeout;
        
        console.log(`Adapted polling frequency for ${session.id}: ${newInterval}ms (distance: ${distance}m)`);
      }
    } catch (error) {
      console.warn('Error adapting polling frequency:', error);
    }
  }

  /**
   * Get current interval duration (simplified implementation)
   */
  private getCurrentInterval(intervalId: NodeJS.Timeout): number {
    // This is a simplified implementation
    // In practice, you'd need to track the interval duration separately
    return this.basePollingInterval;
  }

  /**
   * Determine if polling should stop due to persistent errors
   */
  private shouldStopOnError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Stop on permission errors (won't recover automatically)
      if (message.includes('permission') || message.includes('unauthorized')) {
        return true;
      }
      
      // Stop on location services disabled
      if (message.includes('location services') && message.includes('disabled')) {
        return true;
      }
    }
    
    // Continue polling for other errors (network, timeout, etc.)
    return false;
  }

  /**
   * Get statistics for a polling session
   */
  getPollingStats(pollingId: string): {
    checkCount: number;
    duration: number;
    lastCheck: Date;
    isActive: boolean;
  } | null {
    const session = this.pollingSessions.get(pollingId);
    if (!session) {
      return null;
    }

    const now = Date.now();
    const startTime = session.startTime.getTime();
    const duration = Math.max(0, now - startTime); // Ensure non-negative duration

    return {
      checkCount: session.checkCount,
      duration,
      lastCheck: session.lastCheck,
      isActive: session.isActive,
    };
  }

  /**
   * Get all polling statistics
   */
  getAllPollingStats(): Record<string, ReturnType<typeof this.getPollingStats>> {
    const stats: Record<string, ReturnType<typeof this.getPollingStats>> = {};
    
    for (const [id] of this.pollingSessions) {
      stats[id] = this.getPollingStats(id);
    }
    
    return stats;
  }
}

// Export singleton instance
export const fallbackLocationService = new FallbackLocationServiceImpl();
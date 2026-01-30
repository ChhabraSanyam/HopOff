// Comprehensive error handling utilities for HopOff app

// Define LocationError enum locally to avoid circular dependencies in tests
export enum LocationError {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  LOCATION_UNAVAILABLE = 'LOCATION_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  ACCURACY_TOO_LOW = 'ACCURACY_TOO_LOW',
  GEOFENCING_UNAVAILABLE = 'GEOFENCING_UNAVAILABLE',
  INVALID_COORDINATES = 'INVALID_COORDINATES',
  GEOFENCE_LIMIT_EXCEEDED = 'GEOFENCE_LIMIT_EXCEEDED',
  GEOFENCE_NOT_FOUND = 'GEOFENCE_NOT_FOUND',
}

// Define LocationManagerError interface locally
interface LocationManagerError extends Error {
  code: LocationError;
  originalError?: Error;
}

export enum ErrorType {
  // Location errors
  LOCATION_PERMISSION_DENIED = 'LOCATION_PERMISSION_DENIED',
  LOCATION_SERVICES_DISABLED = 'LOCATION_SERVICES_DISABLED',
  LOCATION_UNAVAILABLE = 'LOCATION_UNAVAILABLE',
  LOCATION_TIMEOUT = 'LOCATION_TIMEOUT',
  LOCATION_ACCURACY_LOW = 'LOCATION_ACCURACY_LOW',
  
  // Geofencing errors
  GEOFENCING_UNAVAILABLE = 'GEOFENCING_UNAVAILABLE',
  GEOFENCING_PERMISSION_DENIED = 'GEOFENCING_PERMISSION_DENIED',
  GEOFENCE_LIMIT_EXCEEDED = 'GEOFENCE_LIMIT_EXCEEDED',
  GEOFENCE_SETUP_FAILED = 'GEOFENCE_SETUP_FAILED',
  
  // Network errors
  NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  
  // Storage errors
  STORAGE_UNAVAILABLE = 'STORAGE_UNAVAILABLE',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  
  // Notification errors
  NOTIFICATION_PERMISSION_DENIED = 'NOTIFICATION_PERMISSION_DENIED',
  NOTIFICATION_FAILED = 'NOTIFICATION_FAILED',
  
  // General errors
  INVALID_INPUT = 'INVALID_INPUT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ErrorInfo {
  type: ErrorType;
  message: string;
  userMessage: string;
  recoveryActions: RecoveryAction[];
  severity: ErrorSeverity;
  canRetry: boolean;
  originalError?: Error;
}

export enum ErrorSeverity {
  LOW = 'low',        // Warning, app can continue
  MEDIUM = 'medium',  // Feature degraded but app usable
  HIGH = 'high',      // Core functionality affected
  CRITICAL = 'critical', // App unusable
}

export interface RecoveryAction {
  id: string;
  label: string;
  description: string;
  action: 'retry' | 'settings' | 'permission' | 'manual' | 'fallback';
  priority: number; // Lower number = higher priority
}

export class ErrorHandler {
  /**
   * Process any error and return structured error information
   */
  static processError(error: unknown): ErrorInfo {
    // Handle LocationManagerError specifically
    if (error && typeof error === 'object' && 'code' in error && error.constructor.name === 'LocationManagerError') {
      return this.processLocationError(error as LocationManagerError);
    }

    // Handle generic Error objects
    if (error instanceof Error) {
      return this.processGenericError(error);
    }

    // Handle string errors
    if (typeof error === 'string') {
      return {
        type: ErrorType.UNKNOWN_ERROR,
        message: error,
        userMessage: 'An unexpected error occurred. Please try again.',
        recoveryActions: [this.getRetryAction()],
        severity: ErrorSeverity.MEDIUM,
        canRetry: true,
      };
    }

    // Handle unknown error types
    return {
      type: ErrorType.UNKNOWN_ERROR,
      message: 'Unknown error occurred',
      userMessage: 'An unexpected error occurred. Please restart the app.',
      recoveryActions: [this.getRetryAction()],
      severity: ErrorSeverity.HIGH,
      canRetry: false,
      originalError: error instanceof Error ? error : undefined,
    };
  }

  /**
   * Process LocationManagerError with specific handling
   */
  private static processLocationError(error: LocationManagerError): ErrorInfo {
    switch (error.code) {
      case LocationError.PERMISSION_DENIED:
        return {
          type: ErrorType.LOCATION_PERMISSION_DENIED,
          message: error.message,
          userMessage: 'Location permission is required to set destination alarms.',
          recoveryActions: [
            this.getPermissionAction('location'),
            this.getSettingsAction('location'),
          ],
          severity: ErrorSeverity.HIGH,
          canRetry: true,
          originalError: error,
        };

      case LocationError.LOCATION_UNAVAILABLE:
        return {
          type: ErrorType.LOCATION_SERVICES_DISABLED,
          message: error.message,
          userMessage: 'Location services are disabled. Please enable them to use HopOff.',
          recoveryActions: [
            this.getSettingsAction('location'),
            this.getRetryAction(),
          ],
          severity: ErrorSeverity.HIGH,
          canRetry: true,
          originalError: error,
        };

      case LocationError.TIMEOUT:
        return {
          type: ErrorType.LOCATION_TIMEOUT,
          message: error.message,
          userMessage: 'Unable to get your location. Please try again or move to an area with better GPS signal.',
          recoveryActions: [
            this.getRetryAction(),
            this.getManualAction('Move to an area with better GPS signal'),
          ],
          severity: ErrorSeverity.MEDIUM,
          canRetry: true,
          originalError: error,
        };

      case LocationError.ACCURACY_TOO_LOW:
        return {
          type: ErrorType.LOCATION_ACCURACY_LOW,
          message: error.message,
          userMessage: 'GPS accuracy is low. Alarms may not trigger reliably.',
          recoveryActions: [
            this.getManualAction('Move to an area with better GPS signal'),
            this.getFallbackAction('Use larger trigger radius'),
          ],
          severity: ErrorSeverity.LOW,
          canRetry: true,
          originalError: error,
        };

      case LocationError.GEOFENCING_UNAVAILABLE:
        return {
          type: ErrorType.GEOFENCING_UNAVAILABLE,
          message: error.message,
          userMessage: 'Background location monitoring is not available. The app will use battery-intensive location polling.',
          recoveryActions: [
            this.getPermissionAction('background-location'),
            this.getFallbackAction('Use location polling mode'),
          ],
          severity: ErrorSeverity.MEDIUM,
          canRetry: true,
          originalError: error,
        };

      case LocationError.GEOFENCE_LIMIT_EXCEEDED:
        return {
          type: ErrorType.GEOFENCE_LIMIT_EXCEEDED,
          message: error.message,
          userMessage: 'Too many active location monitors. Please cancel existing alarms first.',
          recoveryActions: [
            this.getManualAction('Cancel existing alarms'),
            this.getRetryAction(),
          ],
          severity: ErrorSeverity.MEDIUM,
          canRetry: true,
          originalError: error,
        };

      default:
        return {
          type: ErrorType.UNKNOWN_ERROR,
          message: error.message,
          userMessage: 'A location error occurred. Please try again.',
          recoveryActions: [this.getRetryAction()],
          severity: ErrorSeverity.MEDIUM,
          canRetry: true,
          originalError: error,
        };
    }
  }

  /**
   * Process generic Error objects
   */
  private static processGenericError(error: Error): ErrorInfo {
    // Check for common error patterns
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      return {
        type: ErrorType.NETWORK_UNAVAILABLE,
        message: error.message,
        userMessage: 'Network connection is unavailable. Some features may not work.',
        recoveryActions: [
          this.getManualAction('Check your internet connection'),
          this.getRetryAction(),
        ],
        severity: ErrorSeverity.MEDIUM,
        canRetry: true,
        originalError: error,
      };
    }

    if (message.includes('permission') || message.includes('unauthorized')) {
      return {
        type: ErrorType.LOCATION_PERMISSION_DENIED,
        message: error.message,
        userMessage: 'Permission denied. Please grant the required permissions.',
        recoveryActions: [
          this.getPermissionAction('general'),
          this.getSettingsAction('permissions'),
        ],
        severity: ErrorSeverity.HIGH,
        canRetry: true,
        originalError: error,
      };
    }

    if (message.includes('storage') || message.includes('quota')) {
      return {
        type: ErrorType.STORAGE_UNAVAILABLE,
        message: error.message,
        userMessage: 'Storage is unavailable or full. Please free up space.',
        recoveryActions: [
          this.getManualAction('Free up device storage'),
          this.getRetryAction(),
        ],
        severity: ErrorSeverity.MEDIUM,
        canRetry: true,
        originalError: error,
      };
    }

    // Default generic error
    return {
      type: ErrorType.UNKNOWN_ERROR,
      message: error.message,
      userMessage: 'An unexpected error occurred. Please try again.',
      recoveryActions: [this.getRetryAction()],
      severity: ErrorSeverity.MEDIUM,
      canRetry: true,
      originalError: error,
    };
  }

  /**
   * Get retry recovery action
   */
  private static getRetryAction(): RecoveryAction {
    return {
      id: 'retry',
      label: 'Try Again',
      description: 'Retry the operation',
      action: 'retry',
      priority: 1,
    };
  }

  /**
   * Get permission recovery action
   */
  private static getPermissionAction(type: string): RecoveryAction {
    return {
      id: `permission-${type}`,
      label: 'Grant Permission',
      description: `Grant ${type} permission to continue`,
      action: 'permission',
      priority: 1,
    };
  }

  /**
   * Get settings recovery action
   */
  private static getSettingsAction(type: string): RecoveryAction {
    return {
      id: `settings-${type}`,
      label: 'Open Settings',
      description: `Open device settings to enable ${type}`,
      action: 'settings',
      priority: 2,
    };
  }

  /**
   * Get manual recovery action
   */
  private static getManualAction(description: string): RecoveryAction {
    return {
      id: `manual-${Date.now()}`,
      label: 'Manual Fix',
      description,
      action: 'manual',
      priority: 3,
    };
  }

  /**
   * Get fallback recovery action
   */
  private static getFallbackAction(description: string): RecoveryAction {
    return {
      id: `fallback-${Date.now()}`,
      label: 'Use Alternative',
      description,
      action: 'fallback',
      priority: 2,
    };
  }

  /**
   * Check if an error is recoverable
   */
  static isRecoverable(errorInfo: ErrorInfo): boolean {
    return errorInfo.canRetry && errorInfo.severity !== ErrorSeverity.CRITICAL;
  }

  /**
   * Get user-friendly error message with recovery suggestions
   */
  static getDisplayMessage(errorInfo: ErrorInfo): string {
    let message = errorInfo.userMessage;

    if (errorInfo.recoveryActions.length > 0) {
      const primaryAction = errorInfo.recoveryActions
        .sort((a, b) => a.priority - b.priority)[0];
      
      message += `\n\nSuggestion: ${primaryAction.description}`;
    }

    return message;
  }

  /**
   * Log error for debugging (in development) or crash reporting (in production)
   */
  static logError(errorInfo: ErrorInfo, context?: string): void {
    const logData = {
      type: errorInfo.type,
      message: errorInfo.message,
      severity: errorInfo.severity,
      context,
      timestamp: new Date().toISOString(),
      originalError: errorInfo.originalError?.stack,
    };

    if (__DEV__) {
      console.error('HopOff Error:', logData);
    } else {
      // In production, you would send this to a crash reporting service
      // like Sentry, Crashlytics, or Bugsnag
      console.error('Production Error:', logData);
    }
  }
}

/**
 * Utility function to handle async operations with error processing
 */
export async function handleAsyncOperation<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<{ success: true; data: T } | { success: false; error: ErrorInfo }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const errorInfo = ErrorHandler.processError(error);
    ErrorHandler.logError(errorInfo, context);
    return { success: false, error: errorInfo };
  }
}
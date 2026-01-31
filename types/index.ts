// Core data types for HopOff app

export interface Coordinate {
  latitude: number;
  longitude: number;
}

// Validation result types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Constants for validation
export const VALIDATION_CONSTANTS = {
  MIN_LATITUDE: -90,
  MAX_LATITUDE: 90,
  MIN_LONGITUDE: -180,
  MAX_LONGITUDE: 180,
  MIN_TRIGGER_RADIUS: 50, // meters
  MAX_TRIGGER_RADIUS: 2000, // meters
  VALID_TRIGGER_RADII: [100, 200, 500] as const, // predefined options
  MAX_DESTINATION_NAME_LENGTH: 100,
  MAX_ADDRESS_LENGTH: 200,
} as const;

export interface Destination {
  id: string;
  name: string;
  coordinate: Coordinate;
  address?: string;
  createdAt: string;
}

export interface AlarmSettings {
  triggerRadius: number; // meters (100, 200, 500)
  vibrationEnabled: boolean;
  persistentNotification: boolean;
}

export interface Alarm {
  id: string;
  destination: Destination;
  settings: AlarmSettings;
  geofenceId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface UserSettings {
  defaultTriggerRadius: number;
  vibrationEnabled: boolean;
  batteryOptimizationEnabled: boolean;
  batteryOptimizationLevel: "auto" | "conservative" | "aggressive" | "disabled";
  lowBatteryThreshold: number; // 0-1 (percentage when to start optimizing)
  criticalBatteryThreshold: number; // 0-1 (percentage for maximum optimization)
  adaptiveLocationAccuracy: boolean; // Reduce accuracy when battery is low
  backgroundProcessingOptimization: boolean; // Reduce background processing
}

// Redux state types
export interface AppState {
  alarm: AlarmState;
  location: LocationState;
  destinations: DestinationState;
  settings: UserSettings;
  ui: UIState;
  connectivity: ConnectivityState;
  battery: BatteryState;
}

export interface BatteryState {
  level: number | null; // 0-1 (0% to 100%)
  state: "unknown" | "unplugged" | "charging" | "full";
  isLowPowerMode: boolean;
  isOptimizing: boolean;
  optimizationLevel: "none" | "light" | "moderate" | "maximum";
  lastUpdated: string | null;
  isMonitoring: boolean;
  error: string | null;
  recommendations: BatteryRecommendation[];
}

export interface BatteryRecommendation {
  type: "warning" | "suggestion" | "info";
  title: string;
  message: string;
  action?: {
    label: string;
    callback: () => void;
  };
}

export interface ConnectivityState {
  isOnline: boolean;
  connectionType: "none" | "wifi" | "cellular" | "unknown";
  lastChecked: string | null;
  isMonitoring: boolean;
  canUseGeofencing: boolean;
  locationServicesAvailable: boolean;
  error: string | null;
}

export interface AlarmState {
  activeAlarms: Alarm[];
  isLoading: boolean;
  error: string | null;
}

export interface LocationState {
  currentLocation: Coordinate | null;
  locationPermission: "granted" | "denied" | "undetermined";
  isTracking: boolean;
  lastUpdated: string | null;
  accuracy: number | null;
  error: string | null;
}

export interface DestinationState {
  saved: Destination[];
  recent: Destination[];
  searchHistory: SearchHistoryItem[];
  isLoading: boolean;
  error: string | null;
}

// Address search types for Nominatim integration
export interface SearchHistoryItem {
  id: string;
  query: string;
  result: NominatimResult;
  timestamp: string;
}

export interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  boundingbox: [string, string, string, string];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
  icon?: string;
}

export interface AddressSearchResult {
  id: string;
  displayName: string;
  address: string;
  coordinate: Coordinate;
  importance: number;
  type: string;
  boundingBox: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface UIState {
  selectedDestination: Destination | null;
  mapRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null;
  isMapReady: boolean;
  showDestinationModal: boolean;
  showSettingsModal: boolean;
  activeScreen: "map" | "alarm" | "settings" | "destinations";
}

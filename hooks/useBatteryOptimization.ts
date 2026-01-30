// Hook for battery optimization functionality
import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  initializeBatteryMonitoring, 
  stopBatteryMonitoring,
  updateBatteryOptimization,
  addBatteryRecommendation,
  removeBatteryRecommendation,
  clearBatteryRecommendations,
} from '../store/slices/batterySlice';
import { updateSettings } from '../store/slices/settingsSlice';
import { batteryOptimizedLocationManager } from '../services/BatteryOptimizedLocationManager';
import { BatteryRecommendation } from '../types';

export interface UseBatteryOptimizationReturn {
  // Battery status
  batteryLevel: number | null;
  batteryState: 'unknown' | 'unplugged' | 'charging' | 'full';
  isLowPowerMode: boolean;
  isOptimizing: boolean;
  optimizationLevel: 'none' | 'light' | 'moderate' | 'maximum';
  lastUpdated: string | null;
  isMonitoring: boolean;
  error: string | null;
  recommendations: BatteryRecommendation[];

  // Settings
  batteryOptimizationEnabled: boolean;
  batteryOptimizationLevel: 'auto' | 'conservative' | 'aggressive' | 'disabled';
  lowBatteryThreshold: number;
  criticalBatteryThreshold: number;
  adaptiveLocationAccuracy: boolean;
  backgroundProcessingOptimization: boolean;

  // Actions
  startMonitoring: () => void;
  stopMonitoring: () => void;
  updateOptimization: () => void;
  setBatteryOptimizationEnabled: (enabled: boolean) => void;
  setBatteryOptimizationLevel: (level: 'auto' | 'conservative' | 'aggressive' | 'disabled') => void;
  setLowBatteryThreshold: (threshold: number) => void;
  setCriticalBatteryThreshold: (threshold: number) => void;
  setAdaptiveLocationAccuracy: (enabled: boolean) => void;
  setBackgroundProcessingOptimization: (enabled: boolean) => void;
  addRecommendation: (recommendation: BatteryRecommendation) => void;
  removeRecommendation: (title: string, type: string) => void;
  clearRecommendations: () => void;

  // Utility functions
  shouldOptimizeForBattery: () => boolean;
  getBatteryOptimizationStats: () => any;
  getLocationOptimizationStatus: () => any;
}

export const useBatteryOptimization = (): UseBatteryOptimizationReturn => {
  const dispatch = useAppDispatch();
  
  // Battery state
  const {
    level: batteryLevel,
    state: batteryState,
    isLowPowerMode,
    isOptimizing,
    optimizationLevel,
    lastUpdated,
    isMonitoring,
    error,
    recommendations,
  } = useAppSelector((state) => state.battery);

  // Settings state
  const {
    batteryOptimizationEnabled,
    batteryOptimizationLevel,
    lowBatteryThreshold,
    criticalBatteryThreshold,
    adaptiveLocationAccuracy,
    backgroundProcessingOptimization,
  } = useAppSelector((state) => state.settings);

  // Initialize battery monitoring on mount
  useEffect(() => {
    if (batteryOptimizationEnabled && !isMonitoring) {
      dispatch(initializeBatteryMonitoring());
    }

    return () => {
      if (isMonitoring) {
        dispatch(stopBatteryMonitoring());
      }
    };
  }, [dispatch, batteryOptimizationEnabled, isMonitoring]);

  // Update location manager preferences when settings change
  useEffect(() => {
    batteryOptimizedLocationManager.setUserOptimizationPreferences({
      enableBatteryOptimization: batteryOptimizationEnabled,
      optimizationLevel: batteryOptimizationLevel,
      lowBatteryThreshold,
      criticalBatteryThreshold,
      adaptiveAccuracy: adaptiveLocationAccuracy,
      backgroundProcessingOptimization,
    });
  }, [
    batteryOptimizationEnabled,
    batteryOptimizationLevel,
    lowBatteryThreshold,
    criticalBatteryThreshold,
    adaptiveLocationAccuracy,
    backgroundProcessingOptimization,
  ]);

  // Update optimization when battery level changes
  useEffect(() => {
    if (batteryLevel !== null && batteryOptimizationEnabled) {
      batteryOptimizedLocationManager.updateOptimizationSettings(batteryLevel);
      dispatch(updateBatteryOptimization());
    }
  }, [dispatch, batteryLevel, batteryOptimizationEnabled]);

  // Actions
  const startMonitoring = useCallback(() => {
    dispatch(initializeBatteryMonitoring());
  }, [dispatch]);

  const stopMonitoring = useCallback(() => {
    dispatch(stopBatteryMonitoring());
  }, [dispatch]);

  const updateOptimization = useCallback(() => {
    dispatch(updateBatteryOptimization());
  }, [dispatch]);

  const setBatteryOptimizationEnabled = useCallback((enabled: boolean) => {
    dispatch(updateSettings({ batteryOptimizationEnabled: enabled }));
    
    if (enabled && !isMonitoring) {
      dispatch(initializeBatteryMonitoring());
    } else if (!enabled && isMonitoring) {
      dispatch(stopBatteryMonitoring());
    }
  }, [dispatch, isMonitoring]);

  const setBatteryOptimizationLevel = useCallback((level: 'auto' | 'conservative' | 'aggressive' | 'disabled') => {
    dispatch(updateSettings({ batteryOptimizationLevel: level }));
  }, [dispatch]);

  const setLowBatteryThreshold = useCallback((threshold: number) => {
    const clampedThreshold = Math.max(0.1, Math.min(0.8, threshold)); // 10% to 80%
    dispatch(updateSettings({ lowBatteryThreshold: clampedThreshold }));
  }, [dispatch]);

  const setCriticalBatteryThreshold = useCallback((threshold: number) => {
    const clampedThreshold = Math.max(0.05, Math.min(0.3, threshold)); // 5% to 30%
    dispatch(updateSettings({ criticalBatteryThreshold: clampedThreshold }));
  }, [dispatch]);

  const setAdaptiveLocationAccuracy = useCallback((enabled: boolean) => {
    dispatch(updateSettings({ adaptiveLocationAccuracy: enabled }));
  }, [dispatch]);

  const setBackgroundProcessingOptimization = useCallback((enabled: boolean) => {
    dispatch(updateSettings({ backgroundProcessingOptimization: enabled }));
  }, [dispatch]);

  const addRecommendation = useCallback((recommendation: BatteryRecommendation) => {
    dispatch(addBatteryRecommendation(recommendation));
  }, [dispatch]);

  const removeRecommendation = useCallback((title: string, type: string) => {
    dispatch(removeBatteryRecommendation({ title, type }));
  }, [dispatch]);

  const clearRecommendations = useCallback(() => {
    dispatch(clearBatteryRecommendations());
  }, [dispatch]);

  // Utility functions
  const shouldOptimizeForBattery = useCallback((): boolean => {
    if (!batteryOptimizationEnabled || batteryLevel === null) {
      return false;
    }

    return batteryLevel <= lowBatteryThreshold;
  }, [batteryOptimizationEnabled, batteryLevel, lowBatteryThreshold]);

  const getBatteryOptimizationStats = useCallback(() => {
    return batteryOptimizedLocationManager.getBatteryOptimizationStats();
  }, []);

  const getLocationOptimizationStatus = useCallback(() => {
    return batteryOptimizedLocationManager.getOptimizationStatus();
  }, []);

  return {
    // Battery status
    batteryLevel,
    batteryState,
    isLowPowerMode,
    isOptimizing,
    optimizationLevel,
    lastUpdated,
    isMonitoring,
    error,
    recommendations,

    // Settings
    batteryOptimizationEnabled,
    batteryOptimizationLevel,
    lowBatteryThreshold,
    criticalBatteryThreshold,
    adaptiveLocationAccuracy,
    backgroundProcessingOptimization,

    // Actions
    startMonitoring,
    stopMonitoring,
    updateOptimization,
    setBatteryOptimizationEnabled,
    setBatteryOptimizationLevel,
    setLowBatteryThreshold,
    setCriticalBatteryThreshold,
    setAdaptiveLocationAccuracy,
    setBackgroundProcessingOptimization,
    addRecommendation,
    removeRecommendation,
    clearRecommendations,

    // Utility functions
    shouldOptimizeForBattery,
    getBatteryOptimizationStats,
    getLocationOptimizationStatus,
  };
};
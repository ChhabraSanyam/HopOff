// Battery state slice for Redux store
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { batteryManager } from '../../services/BatteryManager';
import { BatteryRecommendation, BatteryState } from '../../types';

const initialState: BatteryState = {
  level: null,
  state: 'unknown',
  isLowPowerMode: false,
  isOptimizing: false,
  optimizationLevel: 'none',
  lastUpdated: null,
  isMonitoring: false,
  error: null,
  recommendations: [],
};

// Async thunks for battery operations
export const initializeBatteryMonitoring = createAsyncThunk(
  'battery/initializeMonitoring',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      // Get initial battery status
      const level = await batteryManager.getBatteryLevel();
      const state = await batteryManager.getBatteryState();
      const isLowPowerMode = await batteryManager.isLowPowerModeEnabled();

      const initialStatus = {
        level,
        state,
        isLowPowerMode,
        timestamp: new Date().toISOString(),
      };

      // Start monitoring
      batteryManager.startBatteryMonitoring((status) => {
        dispatch(updateBatteryStatus(status));
      });

      return initialStatus;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to initialize battery monitoring');
    }
  }
);

export const stopBatteryMonitoring = createAsyncThunk(
  'battery/stopMonitoring',
  async () => {
    batteryManager.stopBatteryMonitoring();
  }
);

export const updateBatteryOptimization = createAsyncThunk(
  'battery/updateOptimization',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as { battery: BatteryState };
    const { level, state: batteryState } = state.battery;

    if (level === null) {
      return rejectWithValue('Battery level not available');
    }

    const shouldOptimize = batteryManager.shouldOptimizeForBattery(level, batteryState as any);
    const optimizationSettings = batteryManager.getOptimizedLocationSettings(level);
    const recommendations = batteryManager.getBatteryOptimizationRecommendations(level, batteryState as any);

    return {
      shouldOptimize,
      optimizationSettings,
      recommendations,
    };
  }
);

const batterySlice = createSlice({
  name: 'battery',
  initialState,
  reducers: {
    updateBatteryStatus: (state, action: PayloadAction<{
      level: number;
      state: 'unknown' | 'unplugged' | 'charging' | 'full';
      isLowPowerMode: boolean;
      timestamp: string;
    }>) => {
      const { level, state: batteryState, isLowPowerMode, timestamp } = action.payload;
      
      state.level = level;
      state.state = batteryState;
      state.isLowPowerMode = isLowPowerMode;
      state.lastUpdated = timestamp;
      state.error = null;

      // Update optimization status
      const shouldOptimize = batteryManager.shouldOptimizeForBattery(level, batteryState as any);
      state.isOptimizing = shouldOptimize;

      // Update optimization level
      if (level <= 0.15) { // 15%
        state.optimizationLevel = 'maximum';
      } else if (level <= 0.30) { // 30%
        state.optimizationLevel = 'moderate';
      } else if (level <= 0.50) { // 50%
        state.optimizationLevel = 'light';
      } else {
        state.optimizationLevel = 'none';
      }

      // Update recommendations
      state.recommendations = batteryManager.getBatteryOptimizationRecommendations(level, batteryState as any);
    },

    setBatteryOptimization: (state, action: PayloadAction<{
      isOptimizing: boolean;
      optimizationLevel: 'none' | 'light' | 'moderate' | 'maximum';
    }>) => {
      state.isOptimizing = action.payload.isOptimizing;
      state.optimizationLevel = action.payload.optimizationLevel;
    },

    addBatteryRecommendation: (state, action: PayloadAction<BatteryRecommendation>) => {
      // Avoid duplicate recommendations
      const exists = state.recommendations.some(
        rec => rec.title === action.payload.title && rec.type === action.payload.type
      );
      
      if (!exists) {
        state.recommendations.push(action.payload);
      }
    },

    removeBatteryRecommendation: (state, action: PayloadAction<{ title: string; type: string }>) => {
      state.recommendations = state.recommendations.filter(
        rec => !(rec.title === action.payload.title && rec.type === action.payload.type)
      );
    },

    clearBatteryRecommendations: (state) => {
      state.recommendations = [];
    },

    setBatteryError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    clearBatteryError: (state) => {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    builder
      // Initialize battery monitoring
      .addCase(initializeBatteryMonitoring.pending, (state) => {
        state.error = null;
      })
      .addCase(initializeBatteryMonitoring.fulfilled, (state, action) => {
        const { level, state: batteryState, isLowPowerMode, timestamp } = action.payload;
        
        state.level = level;
        state.state = batteryState;
        state.isLowPowerMode = isLowPowerMode;
        state.lastUpdated = timestamp;
        state.isMonitoring = true;
        state.error = null;

        // Set initial optimization status
        const shouldOptimize = batteryManager.shouldOptimizeForBattery(level, batteryState as any);
        state.isOptimizing = shouldOptimize;

        // Set initial optimization level
        if (level <= 0.15) {
          state.optimizationLevel = 'maximum';
        } else if (level <= 0.30) {
          state.optimizationLevel = 'moderate';
        } else if (level <= 0.50) {
          state.optimizationLevel = 'light';
        } else {
          state.optimizationLevel = 'none';
        }

        // Set initial recommendations
        state.recommendations = batteryManager.getBatteryOptimizationRecommendations(level, batteryState as any);
      })
      .addCase(initializeBatteryMonitoring.rejected, (state, action) => {
        state.error = action.payload as string;
        state.isMonitoring = false;
      })

      // Stop battery monitoring
      .addCase(stopBatteryMonitoring.fulfilled, (state) => {
        state.isMonitoring = false;
      })

      // Update battery optimization
      .addCase(updateBatteryOptimization.fulfilled, (state, action) => {
        const { shouldOptimize, recommendations } = action.payload;
        state.isOptimizing = shouldOptimize;
        state.recommendations = recommendations;
      })
      .addCase(updateBatteryOptimization.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  updateBatteryStatus,
  setBatteryOptimization,
  addBatteryRecommendation,
  removeBatteryRecommendation,
  clearBatteryRecommendations,
  setBatteryError,
  clearBatteryError,
} = batterySlice.actions;

export default batterySlice.reducer;
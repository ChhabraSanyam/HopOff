// Settings state slice for Redux store
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { storageManager } from '../../services/StorageManager';
import { UserSettings } from '../../types';
import { validateUserSettings } from '../../utils';

const initialState: UserSettings & { isLoading: boolean; error: string | null } = {
  defaultTriggerRadius: 200, // 200m default
  vibrationEnabled: true,
  batteryOptimizationEnabled: true,
  batteryOptimizationLevel: 'auto',
  lowBatteryThreshold: 0.30, // 30%
  criticalBatteryThreshold: 0.15, // 15%
  adaptiveLocationAccuracy: true,
  backgroundProcessingOptimization: true,
  isLoading: false,
  error: null,
};

// Async thunks for settings persistence
export const loadSettings = createAsyncThunk(
  'settings/loadSettings',
  async (_, { rejectWithValue }) => {
    try {
      const settings = await storageManager.getSettings();
      return settings;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to load settings');
    }
  }
);

export const saveSettings = createAsyncThunk(
  'settings/saveSettings',
  async (settings: Partial<UserSettings>, { rejectWithValue, getState }) => {
    try {
      // Get current state and merge with new settings (exclude loading/error state)
      const state = getState() as { settings: UserSettings & { isLoading: boolean; error: string | null } };
      const currentSettings: UserSettings = {
        defaultTriggerRadius: state.settings.defaultTriggerRadius,
        vibrationEnabled: state.settings.vibrationEnabled,
        batteryOptimizationEnabled: state.settings.batteryOptimizationEnabled,
        batteryOptimizationLevel: state.settings.batteryOptimizationLevel,
        lowBatteryThreshold: state.settings.lowBatteryThreshold,
        criticalBatteryThreshold: state.settings.criticalBatteryThreshold,
        adaptiveLocationAccuracy: state.settings.adaptiveLocationAccuracy,
        backgroundProcessingOptimization: state.settings.backgroundProcessingOptimization,
      };
      const updatedSettings = { ...currentSettings, ...settings };
      
      // Validate settings before saving
      const validation = validateUserSettings(updatedSettings);
      if (!validation.isValid) {
        return rejectWithValue(`Invalid settings: ${validation.errors.join(', ')}`);
      }
      
      await storageManager.saveSettings(updatedSettings);
      return updatedSettings;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to save settings');
    }
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateSettings: (state, action: PayloadAction<Partial<UserSettings>>) => {
      // Update local state immediately for responsive UI
      Object.assign(state, action.payload);
      state.error = null;
    },
    resetSettings: (state) => {
      state.defaultTriggerRadius = 200;
      state.vibrationEnabled = true;
      state.batteryOptimizationEnabled = true;
      state.batteryOptimizationLevel = 'auto';
      state.lowBatteryThreshold = 0.30;
      state.criticalBatteryThreshold = 0.15;
      state.adaptiveLocationAccuracy = true;
      state.backgroundProcessingOptimization = true;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Load settings
      .addCase(loadSettings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadSettings.fulfilled, (state, action) => {
        state.isLoading = false;
        Object.assign(state, action.payload);
        state.error = null;
      })
      .addCase(loadSettings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Save settings
      .addCase(saveSettings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(saveSettings.fulfilled, (state, action) => {
        state.isLoading = false;
        Object.assign(state, action.payload);
        state.error = null;
      })
      .addCase(saveSettings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { updateSettings, resetSettings, clearError } = settingsSlice.actions;
export default settingsSlice.reducer;
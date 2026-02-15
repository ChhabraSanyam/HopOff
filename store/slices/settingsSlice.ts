// Settings state slice for Redux store
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { storageManager } from "../../services/StorageManager";
import { UserSettings } from "../../types";
import { validateUserSettings } from "../../utils";

const initialState: UserSettings & {
  isLoading: boolean;
  error: string | null;
} = {
  defaultTriggerRadius: 500, // 500m default
  vibrationEnabled: true,
  persistentNotificationEnabled: true,
  batteryOptimizationEnabled: true,
  isLoading: false,
  error: null,
};

// Async thunks for settings persistence
export const loadSettings = createAsyncThunk(
  "settings/loadSettings",
  async (_, { rejectWithValue }) => {
    try {
      const settings = await storageManager.getSettings();
      return settings;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to load settings",
      );
    }
  },
);

export const saveSettings = createAsyncThunk(
  "settings/saveSettings",
  async (settings: Partial<UserSettings>, { rejectWithValue, getState }) => {
    try {
      // Get current state and merge with new settings (exclude loading/error state)
      const state = getState() as {
        settings: UserSettings & { isLoading: boolean; error: string | null };
      };
      const currentSettings: UserSettings = {
        defaultTriggerRadius: state.settings.defaultTriggerRadius,
        vibrationEnabled: state.settings.vibrationEnabled,
        persistentNotificationEnabled:
          state.settings.persistentNotificationEnabled,
        batteryOptimizationEnabled: state.settings.batteryOptimizationEnabled,
      };
      const updatedSettings = { ...currentSettings, ...settings };

      // Validate settings before saving
      const validation = validateUserSettings(updatedSettings);
      if (!validation.isValid) {
        return rejectWithValue(
          `Invalid settings: ${validation.errors.join(", ")}`,
        );
      }

      await storageManager.saveSettings(updatedSettings);
      return updatedSettings;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to save settings",
      );
    }
  },
);

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    updateSettings: (state, action: PayloadAction<Partial<UserSettings>>) => {
      // Update local state immediately for responsive UI
      Object.assign(state, action.payload);
      state.error = null;
    },
    resetSettings: (state) => {
      state.defaultTriggerRadius = 500;
      state.vibrationEnabled = true;
      state.persistentNotificationEnabled = true;
      state.batteryOptimizationEnabled = true;
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

export const { updateSettings, resetSettings, clearError } =
  settingsSlice.actions;
export default settingsSlice.reducer;

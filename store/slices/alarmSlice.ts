// Alarm state slice for Redux store
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { alarmManager } from "../../services/AlarmManager";
import { Alarm, AlarmSettings, AlarmState, Destination } from "../../types";

const toIsoString = (value: string | Date) =>
  typeof value === "string" ? value : new Date(value).toISOString();

const sanitizeAlarm = (alarm: Alarm | null): Alarm | null => {
  if (!alarm) return null;

  return {
    ...alarm,
    createdAt: toIsoString(alarm.createdAt),
    destination: {
      ...alarm.destination,
      createdAt: toIsoString(alarm.destination.createdAt),
    },
  };
};

const initialState: AlarmState = {
  activeAlarm: null,
  isLoading: false,
  error: null,
};

// Async thunks for alarm lifecycle management
export const createAlarm = createAsyncThunk(
  "alarm/create",
  async ({
    destination,
    settings,
  }: {
    destination: Destination;
    settings: AlarmSettings;
  }) => {
    const alarm = await alarmManager.createAlarm(destination, settings);
    return alarm;
  },
);

export const cancelAlarm = createAsyncThunk(
  "alarm/cancel",
  async (alarmId: string) => {
    await alarmManager.cancelAlarm(alarmId);
    return alarmId;
  },
);

export const triggerAlarm = createAsyncThunk(
  "alarm/trigger",
  async (alarm: Alarm) => {
    await alarmManager.triggerAlarm(alarm);
    return alarm;
  },
);

export const updateAlarmSettings = createAsyncThunk(
  "alarm/updateSettings",
  async ({
    alarmId,
    settings,
  }: {
    alarmId: string;
    settings: Partial<AlarmSettings>;
  }) => {
    await alarmManager.updateAlarmSettings(alarmId, settings);
    const updatedAlarm = alarmManager.getActiveAlarm();
    return updatedAlarm;
  },
);

const alarmSlice = createSlice({
  name: "alarm",
  initialState,
  reducers: {
    // Synchronous actions
    setActiveAlarm: (state, action: PayloadAction<Alarm | null>) => {
      state.activeAlarm = sanitizeAlarm(action.payload);
    },
    setGeofenceId: (
      state,
      action: PayloadAction<{ alarmId: string; geofenceId: string }>,
    ) => {
      if (
        state.activeAlarm &&
        state.activeAlarm.id === action.payload.alarmId
      ) {
        state.activeAlarm.geofenceId = action.payload.geofenceId;
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    // Initialize state from AlarmManager (for app startup)
    initializeFromManager: (state) => {
      const activeAlarm = alarmManager.getActiveAlarm();
      state.activeAlarm = sanitizeAlarm(activeAlarm);
    },
  },
  extraReducers: (builder) => {
    // Handle async thunk actions
    builder
      // Create alarm
      .addCase(createAlarm.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createAlarm.fulfilled, (state, action) => {
        state.isLoading = false;
        state.activeAlarm = sanitizeAlarm(action.payload);
        state.error = null;
      })
      .addCase(createAlarm.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to create alarm";
      })
      // Cancel alarm
      .addCase(cancelAlarm.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(cancelAlarm.fulfilled, (state) => {
        state.isLoading = false;
        state.activeAlarm = null;
        state.error = null;
      })
      .addCase(cancelAlarm.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to cancel alarm";
      })
      // Trigger alarm
      .addCase(triggerAlarm.pending, (state) => {
        state.error = null;
      })
      .addCase(triggerAlarm.fulfilled, (state) => {
        state.activeAlarm = null;
        state.error = null;
      })
      .addCase(triggerAlarm.rejected, (state, action) => {
        state.error = action.error.message || "Failed to trigger alarm";
      })
      // Update alarm settings
      .addCase(updateAlarmSettings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateAlarmSettings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.activeAlarm = sanitizeAlarm(action.payload);
        state.error = null;
      })
      .addCase(updateAlarmSettings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to update alarm settings";
      });
  },
});

export const { setActiveAlarm, setGeofenceId, clearError, initializeFromManager } =
  alarmSlice.actions;

export default alarmSlice.reducer;

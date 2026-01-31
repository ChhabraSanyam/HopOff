// Alarm state slice for Redux store
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { alarmManager, CreateAlarmResult } from "../../services/AlarmManager";
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

const sanitizeAlarms = (alarms: Alarm[]): Alarm[] => {
  return alarms.map((alarm) => sanitizeAlarm(alarm)!);
};

const initialState: AlarmState = {
  activeAlarms: [],
  isLoading: false,
  error: null,
};

// Async thunks for alarm lifecycle management
export const createAlarm = createAsyncThunk<
  CreateAlarmResult,
  { destination: Destination; settings: AlarmSettings }
>("alarm/create", async ({ destination, settings }) => {
  const result = await alarmManager.createAlarm(destination, settings);
  return result;
});

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
    // Return updated alarms list
    return await alarmManager.getActiveAlarms();
  },
);

// Async thunk to initialize alarm state from persisted storage
export const initializeAlarmFromStorage = createAsyncThunk(
  "alarm/initializeFromStorage",
  async () => {
    const activeAlarms = await alarmManager.getActiveAlarms();
    return activeAlarms;
  },
);

// Async thunk to cancel all alarms
export const cancelAllAlarms = createAsyncThunk("alarm/cancelAll", async () => {
  await alarmManager.cancelAllAlarms();
});

const alarmSlice = createSlice({
  name: "alarm",
  initialState,
  reducers: {
    // Synchronous actions
    setActiveAlarms: (state, action: PayloadAction<Alarm[]>) => {
      state.activeAlarms = sanitizeAlarms(action.payload);
    },
    addAlarm: (state, action: PayloadAction<Alarm>) => {
      const sanitized = sanitizeAlarm(action.payload);
      if (sanitized) {
        state.activeAlarms.push(sanitized);
      }
    },
    removeAlarm: (state, action: PayloadAction<string>) => {
      state.activeAlarms = state.activeAlarms.filter(
        (alarm) => alarm.id !== action.payload,
      );
    },
    setGeofenceId: (
      state,
      action: PayloadAction<{ alarmId: string; geofenceId: string }>,
    ) => {
      const alarm = state.activeAlarms.find(
        (a) => a.id === action.payload.alarmId,
      );
      if (alarm) {
        alarm.geofenceId = action.payload.geofenceId;
      }
    },
    clearError: (state) => {
      state.error = null;
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
        const { alarm, isExisting } = action.payload;
        const sanitized = sanitizeAlarm(alarm);
        // Only add to state if it's a new alarm (not an existing duplicate)
        if (sanitized && !isExisting) {
          state.activeAlarms.push(sanitized);
        }
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
      .addCase(cancelAlarm.fulfilled, (state, action) => {
        state.isLoading = false;
        state.activeAlarms = state.activeAlarms.filter(
          (alarm) => alarm.id !== action.payload,
        );
        state.error = null;
      })
      .addCase(cancelAlarm.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to cancel alarm";
      })
      // Cancel all alarms
      .addCase(cancelAllAlarms.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(cancelAllAlarms.fulfilled, (state) => {
        state.isLoading = false;
        state.activeAlarms = [];
        state.error = null;
      })
      .addCase(cancelAllAlarms.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to cancel all alarms";
      })
      // Trigger alarm
      .addCase(triggerAlarm.pending, (state) => {
        state.error = null;
      })
      .addCase(triggerAlarm.fulfilled, (state, action) => {
        state.activeAlarms = state.activeAlarms.filter(
          (alarm) => alarm.id !== action.payload.id,
        );
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
        state.activeAlarms = sanitizeAlarms(action.payload);
        state.error = null;
      })
      .addCase(updateAlarmSettings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to update alarm settings";
      })
      // Initialize alarm from storage
      .addCase(initializeAlarmFromStorage.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(initializeAlarmFromStorage.fulfilled, (state, action) => {
        state.isLoading = false;
        state.activeAlarms = sanitizeAlarms(action.payload);
      })
      .addCase(initializeAlarmFromStorage.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to initialize alarm";
      });
  },
});

export const {
  setActiveAlarms,
  addAlarm,
  removeAlarm,
  setGeofenceId,
  clearError,
} = alarmSlice.actions;

export default alarmSlice.reducer;

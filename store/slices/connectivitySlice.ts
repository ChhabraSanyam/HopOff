// Connectivity state slice for Redux store
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ConnectionType, connectivityManager, ConnectivityStatus } from '../../services/ConnectivityManager';

export interface ConnectivityState {
  isOnline: boolean;
  connectionType: ConnectionType;
  lastChecked: Date | null;
  isMonitoring: boolean;
  canUseGeofencing: boolean;
  locationServicesAvailable: boolean;
  error: string | null;
}

const initialState: ConnectivityState = {
  isOnline: true, // Assume online initially
  connectionType: ConnectionType.UNKNOWN,
  lastChecked: null,
  isMonitoring: false,
  canUseGeofencing: false,
  locationServicesAvailable: false,
  error: null,
};

// Async thunks for connectivity operations
export const checkConnectivity = createAsyncThunk(
  'connectivity/check',
  async () => {
    const [isOnline, connectionType, canUseGeofencing, locationServicesAvailable] = await Promise.all([
      connectivityManager.isOnline(),
      connectivityManager.getConnectionType(),
      connectivityManager.canUseGeofencing(),
      connectivityManager.isLocationServicesAvailable(),
    ]);

    return {
      isOnline,
      connectionType,
      canUseGeofencing,
      locationServicesAvailable,
      timestamp: new Date().toISOString(),
    };
  }
);

export const startConnectivityMonitoring = createAsyncThunk(
  'connectivity/startMonitoring',
  async (_, { dispatch }) => {
    connectivityManager.startMonitoring((status: ConnectivityStatus) => {
      dispatch(updateConnectivityStatus({
        isOnline: status.isOnline,
        connectionType: status.connectionType,
        timestamp: status.timestamp,
      }));
    });
    
    return true;
  }
);

export const stopConnectivityMonitoring = createAsyncThunk(
  'connectivity/stopMonitoring',
  async () => {
    connectivityManager.stopMonitoring();
    return true;
  }
);

const connectivitySlice = createSlice({
  name: 'connectivity',
  initialState,
  reducers: {
    // Synchronous actions
    updateConnectivityStatus: (state, action: PayloadAction<{
      isOnline: boolean;
      connectionType: ConnectionType;
      timestamp: string;
    }>) => {
      state.isOnline = action.payload.isOnline;
      state.connectionType = action.payload.connectionType;
      state.lastChecked = new Date(action.payload.timestamp);
      state.error = null;
    },
    setGeofencingAvailability: (state, action: PayloadAction<boolean>) => {
      state.canUseGeofencing = action.payload;
    },
    setLocationServicesAvailability: (state, action: PayloadAction<boolean>) => {
      state.locationServicesAvailable = action.payload;
    },
    clearConnectivityError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Check connectivity
      .addCase(checkConnectivity.fulfilled, (state, action) => {
        state.isOnline = action.payload.isOnline;
        state.connectionType = action.payload.connectionType;
        state.canUseGeofencing = action.payload.canUseGeofencing;
        state.locationServicesAvailable = action.payload.locationServicesAvailable;
        state.lastChecked = new Date(action.payload.timestamp);
        state.error = null;
      })
      .addCase(checkConnectivity.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to check connectivity';
      })
      // Start monitoring
      .addCase(startConnectivityMonitoring.fulfilled, (state) => {
        state.isMonitoring = true;
        state.error = null;
      })
      .addCase(startConnectivityMonitoring.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to start connectivity monitoring';
      })
      // Stop monitoring
      .addCase(stopConnectivityMonitoring.fulfilled, (state) => {
        state.isMonitoring = false;
        state.error = null;
      })
      .addCase(stopConnectivityMonitoring.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to stop connectivity monitoring';
      });
  },
});

export const { 
  updateConnectivityStatus,
  setGeofencingAvailability,
  setLocationServicesAvailability,
  clearConnectivityError
} = connectivitySlice.actions;

export default connectivitySlice.reducer;
// Location state slice for Redux store
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Coordinate, LocationState } from '../../types';

// Import LocationManager service
import { locationManager } from '../../services/LocationManager';

const initialState: LocationState = {
  currentLocation: null,
  locationPermission: 'undetermined',
  isTracking: false,
  lastUpdated: null,
  accuracy: null,
  error: null,
};

// Async thunks for location operations
export const requestLocationPermission = createAsyncThunk(
  'location/requestPermission',
  async () => {
    const hasPermission = await locationManager.requestLocationPermissions();
    return hasPermission ? 'granted' : 'denied';
  }
);

export const getCurrentLocation = createAsyncThunk(
  'location/getCurrent',
  async () => {
    const location = await locationManager.getCurrentLocation();
    return { location, accuracy: 10, timestamp: new Date().toISOString() };
  }
);

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    // Synchronous actions
    setCurrentLocation: (state, action: PayloadAction<Coordinate | null>) => {
      state.currentLocation = action.payload;
      state.lastUpdated = new Date().toISOString();
    },
    setLocationPermission: (state, action: PayloadAction<'granted' | 'denied' | 'undetermined'>) => {
      state.locationPermission = action.payload;
    },
    setTracking: (state, action: PayloadAction<boolean>) => {
      state.isTracking = action.payload;
    },
    updateLocationWithAccuracy: (state, action: PayloadAction<{
      location: Coordinate;
      accuracy: number;
      timestamp: string;
    }>) => {
      state.currentLocation = action.payload.location;
      state.accuracy = action.payload.accuracy;
      state.lastUpdated = action.payload.timestamp;
    },
    clearLocationError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Request permission
      .addCase(requestLocationPermission.fulfilled, (state, action) => {
        state.locationPermission = action.payload;
        state.error = null;
      })
      .addCase(requestLocationPermission.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to request location permission';
      })
      // Get current location
      .addCase(getCurrentLocation.fulfilled, (state, action) => {
        state.currentLocation = action.payload.location;
        state.accuracy = action.payload.accuracy;
        state.lastUpdated = action.payload.timestamp;
        state.error = null;
      })
      .addCase(getCurrentLocation.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to get current location';
      });
  },
});

export const { 
  setCurrentLocation, 
  setLocationPermission, 
  setTracking,
  updateLocationWithAccuracy,
  clearLocationError 
} = locationSlice.actions;

export default locationSlice.reducer;
// UI state slice for Redux store
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Destination, UIState } from "../../types";

// Async thunk for requesting notification permission
export const requestNotificationPermission = createAsyncThunk(
  "ui/requestNotificationPermission",
  async () => {
    const Notifications = await import("expo-notifications");
    const { status } = await Notifications.requestPermissionsAsync();
    return status;
  },
);

const initialState: UIState = {
  selectedDestination: null,
  mapRegion: null,
  isMapReady: false,
  showDestinationModal: false,
  showSettingsModal: false,
  activeScreen: "map",
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setSelectedDestination: (
      state,
      action: PayloadAction<Destination | null>,
    ) => {
      state.selectedDestination = action.payload;
    },
    setMapRegion: (
      state,
      action: PayloadAction<{
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
      } | null>,
    ) => {
      state.mapRegion = action.payload;
    },
    setMapReady: (state, action: PayloadAction<boolean>) => {
      state.isMapReady = action.payload;
    },
    showDestinationModal: (state) => {
      state.showDestinationModal = true;
    },
    hideDestinationModal: (state) => {
      state.showDestinationModal = false;
    },
    showSettingsModal: (state) => {
      state.showSettingsModal = true;
    },
    hideSettingsModal: (state) => {
      state.showSettingsModal = false;
    },
    setActiveScreen: (
      state,
      action: PayloadAction<"map" | "alarm" | "settings" | "destinations">,
    ) => {
      state.activeScreen = action.payload;
    },
    resetUI: (state) => {
      state.selectedDestination = null;
      state.showDestinationModal = false;
      state.showSettingsModal = false;
    },
  },
});

export const {
  setSelectedDestination,
  setMapRegion,
  setMapReady,
  showDestinationModal,
  hideDestinationModal,
  showSettingsModal,
  hideSettingsModal,
  setActiveScreen,
  resetUI,
} = uiSlice.actions;

export default uiSlice.reducer;

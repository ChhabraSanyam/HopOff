// Redux store configuration for HopOff app
import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { apiSlice } from "./api/apiSlice";
import alarmSlice from "./slices/alarmSlice";
import batterySlice from "./slices/batterySlice";
import connectivitySlice from "./slices/connectivitySlice";
import destinationSlice from "./slices/destinationSlice";
import locationSlice from "./slices/locationSlice";
import settingsSlice from "./slices/settingsSlice";
import uiSlice from "./slices/uiSlice";

export const store = configureStore({
  reducer: {
    alarm: alarmSlice,
    location: locationSlice,
    destinations: destinationSlice,
    settings: settingsSlice,
    ui: uiSlice,
    connectivity: connectivitySlice,
    battery: batterySlice,
    api: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          "persist/PERSIST",
          "api/executeMutation/pending",
          "api/executeQuery/pending",
        ],
        ignoredPaths: ["api"],
      },
    }).concat(apiSlice.middleware),
});

// Enable listener behavior for the store
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import { ToastProvider } from "../contexts/ToastContext";
// Import GeofencingService early to ensure TaskManager.defineTask is called
// This MUST be imported before any geofencing operations can occur
import "../services/GeofencingService";
// Import BackgroundLocationTask early to register the background location task
// This MUST be imported at module level so the task is defined before any events fire
import "../services/BackgroundLocationTask";
import { store } from "../store";
import { useAppDispatch } from "../store/hooks";
import { initializeAlarmFromStorage } from "../store/slices/alarmSlice";
import { loadSettings } from "../store/slices/settingsSlice";

/**
 * Component that initializes the app state.
 * Separated to use hooks inside Provider.
 */
function AppInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const initializeApp = async () => {
      // Initialize alarm manager state from persisted data (async)
      await dispatch(initializeAlarmFromStorage());

      // Load user settings from storage
      dispatch(loadSettings());
    };

    initializeApp();
  }, [dispatch]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <StatusBar style="dark" backgroundColor="transparent" translucent />
        <ToastProvider>
          <AppInitializer>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="+not-found" />
            </Stack>
          </AppInitializer>
        </ToastProvider>
      </SafeAreaProvider>
    </Provider>
  );
}

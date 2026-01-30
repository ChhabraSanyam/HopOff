import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import { ToastProvider } from "../contexts/ToastContext";
import { store } from "../store";
import { initializeFromManager } from "../store/slices/alarmSlice";
import { loadSettings } from "../store/slices/settingsSlice";

export default function RootLayout() {
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = () => {
    // Initialize alarm manager state from persisted data
    store.dispatch(initializeFromManager());

    // Load user settings from storage
    store.dispatch(loadSettings());
  };

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <StatusBar style="dark" backgroundColor="transparent" translucent />
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="+not-found" />
          </Stack>
        </ToastProvider>
      </SafeAreaProvider>
    </Provider>
  );
}

// Settings screen for user preferences and app configuration
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import ConfirmModal from "../../components/ConfirmModal";
import { useAppDispatch, useUserSettings } from "../../store/hooks";
import {
  clearError,
  loadSettings,
  saveSettings,
  updateSettings,
} from "../../store/slices/settingsSlice";
import { UserSettings, VALIDATION_CONSTANTS } from "../../types";
import { validateUserSettings } from "../../utils";

const BRAND = "#b9221d";
const GRADIENT: [string, string, string] = [
  "rgba(195, 65, 55, 0.88)",
  "rgba(232, 100, 80, 0.50)",
  "rgba(195, 65, 55, 0.82)",
];

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

interface SettingsRowProps {
  label: string;
  children: React.ReactNode;
  description?: string;
}

const SettingsRow: React.FC<SettingsRowProps> = ({ label, children, description }) => (
  <View style={styles.row}>
    <View style={styles.rowContent}>
      <Text style={styles.rowLabel}>{label}</Text>
      {description && <Text style={styles.rowDescription}>{description}</Text>}
    </View>
    <View style={styles.rowControl}>{children}</View>
  </View>
);

const SettingsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const settings = useUserSettings() as UserSettings & {
    isLoading: boolean;
    error: string | null;
  };

  // Snapshot of the last persisted settings – used to detect unsaved changes
  const savedSnapshot = React.useRef<UserSettings | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Animation values for the footer slide-up
  const footerTranslateY = useRef(new Animated.Value(100)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  const [modalConfig, setModalConfig] = useState({
    visible: false, title: "", message: "", confirmLabel: "OK", cancelLabel: "Cancel", destructive: false, onConfirm: () => {},
  });
  const showModal = (title: string, message: string, confirmLabel = "OK", cancelLabel = "Cancel", onConfirm = hideModal, destructive = false) => {
    setModalConfig({ visible: true, title, message, confirmLabel, cancelLabel, onConfirm, destructive });
  };
  const hideModal = () => setModalConfig(m => ({ ...m, visible: false }));

  useEffect(() => {
    if (hasUnsavedChanges) {
      Animated.parallel([
        Animated.spring(footerTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 60,
          friction: 10,
        }),
        Animated.timing(footerOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(footerTranslateY, {
          toValue: 100,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(footerOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [hasUnsavedChanges]);

  // Re-derive hasUnsavedChanges whenever the live settings change
  useEffect(() => {
    if (savedSnapshot.current === null) return; // not yet loaded
    const snap = savedSnapshot.current;
    const changed =
      settings.defaultTriggerRadius !== snap.defaultTriggerRadius ||
      settings.vibrationEnabled !== snap.vibrationEnabled ||
      settings.persistentNotificationEnabled !== snap.persistentNotificationEnabled ||
      settings.batteryOptimizationEnabled !== snap.batteryOptimizationEnabled;
    setHasUnsavedChanges(changed);
  }, [
    settings.defaultTriggerRadius,
    settings.vibrationEnabled,
    settings.persistentNotificationEnabled,
    settings.batteryOptimizationEnabled,
  ]);

  useEffect(() => {
    dispatch(loadSettings()).then((action: any) => {
      if (action.meta.requestStatus === "fulfilled") {
        // Snapshot what was just loaded from storage
        const loaded = action.payload as UserSettings;
        savedSnapshot.current = {
          defaultTriggerRadius: loaded.defaultTriggerRadius,
          vibrationEnabled: loaded.vibrationEnabled,
          persistentNotificationEnabled: loaded.persistentNotificationEnabled,
          batteryOptimizationEnabled: loaded.batteryOptimizationEnabled,
        };
        setHasUnsavedChanges(false);
      }
    });
  }, [dispatch]);

  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  const handleSettingChange = (key: keyof UserSettings, value: any) => {
    dispatch(updateSettings({ [key]: value }));
  };

  const handleSaveSettings = async () => {
    const settingsToSave = {
      defaultTriggerRadius: settings.defaultTriggerRadius,
      vibrationEnabled: settings.vibrationEnabled,
      persistentNotificationEnabled: settings.persistentNotificationEnabled,
      batteryOptimizationEnabled: settings.batteryOptimizationEnabled,
    };
    const validation = validateUserSettings(settingsToSave);
    if (!validation.isValid) {
      showModal("Invalid Settings", validation.errors.join("\n"), "OK", "Close", hideModal);
      return;
    }
    try {
      await dispatch(saveSettings(settingsToSave)).unwrap();
      // Update snapshot so unsaved indicator clears
      savedSnapshot.current = { ...settingsToSave };
      setHasUnsavedChanges(false);
    } catch (error) {
      showModal("Error", `Failed to save settings: ${error}`, "OK", "Close", hideModal);
    }
  };

  const handleResetSettings = () => {
    showModal(
      "Reset Settings",
      "Are you sure you want to reset all settings to default values?",
      "Reset",
      "Cancel",
      () => {
        dispatch(
          updateSettings({
            defaultTriggerRadius: 500,
            vibrationEnabled: true,
            persistentNotificationEnabled: true,
            batteryOptimizationEnabled: true,
          }),
        );
        hideModal();
      },
      true
    );
  };

  const handleTriggerRadiusSelect = (radius: number) => {
    handleSettingChange("defaultTriggerRadius", radius);
  };

  const openNotificationSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      showModal(
        "Unable to Open Settings",
        "Please go to your device Settings > Apps > HopOff > Notifications to customize notification sounds.",
        "OK",
        "Cancel",
        hideModal
      );
    }
  };

  if (settings.isLoading) {
    return (
      <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }}>
        <SafeAreaView style={styles.loadingContainer} edges={["top", "left", "right"]}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={[
            styles.scrollContent, 
            hasUnsavedChanges && { paddingBottom: 160 }
          ]}
        >
          {settings.error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{settings.error}</Text>
              <TouchableOpacity onPress={() => dispatch(clearError())} style={styles.errorDismiss}>
                <Text style={styles.errorDismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}

          <SettingsSection title="Alarm Settings">
            <SettingsRow
              label="Trigger Distance"
              description="How close to your destination before the alarm triggers"
            >
              <View style={styles.radiusContainer}>
                {VALIDATION_CONSTANTS.VALID_TRIGGER_RADII.map((radius) => (
                  <TouchableOpacity
                    key={radius}
                    style={[
                      styles.radiusButton,
                      settings.defaultTriggerRadius === radius && styles.radiusButtonActive,
                    ]}
                    onPress={() => handleTriggerRadiusSelect(radius)}
                  >
                    <Text
                      style={[
                        styles.radiusButtonText,
                        settings.defaultTriggerRadius === radius && styles.radiusButtonTextActive,
                      ]}
                    >
                      {radius >= 1000 ? `${radius / 1000} km` : `${radius}m`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </SettingsRow>

            <SettingsRow label="Vibration" description="Enable haptic feedback when alarm triggers">
              <Switch
                value={settings.vibrationEnabled}
                onValueChange={(value) => handleSettingChange("vibrationEnabled", value)}
                trackColor={{ false: "rgba(255,255,255,0.2)", true: BRAND }}
                thumbColor="#fff"
              />
            </SettingsRow>

            <SettingsRow
              label="Persistent Notification"
              description="Show ongoing trip progress with distance updates"
            >
              <Switch
                value={settings.persistentNotificationEnabled}
                onValueChange={(value) =>
                  handleSettingChange("persistentNotificationEnabled", value)
                }
                trackColor={{ false: "rgba(255,255,255,0.2)", true: BRAND }}
                thumbColor="#fff"
              />
            </SettingsRow>
          </SettingsSection>

          <SettingsSection title="Notification Sound">
            <TouchableOpacity style={styles.notificationSettingsRow} onPress={openNotificationSettings}>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Customize Alarm Sound</Text>
                <Text style={styles.rowDescription}>
                  {Platform.OS === "android"
                    ? "Open system settings to choose a notification sound for destination alarms"
                    : "Open settings to manage notification preferences"}
                </Text>
              </View>
              <View style={styles.rowControl}>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
              </View>
            </TouchableOpacity>
            <View style={styles.soundInfoContainer}>
              <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.soundInfoText}>
                {Platform.OS === "android"
                  ? 'In notification settings, select "Destination Alarms" channel to change the sound'
                  : "Notification sounds are managed through iOS system settings"}
              </Text>
            </View>
          </SettingsSection>

          <SettingsSection title="Battery & Performance">
            <SettingsRow
              label="Smart Location Tracking"
              description="Reduce GPS usage when far from destination, increase precision when close. Saves battery during longer journeys."
            >
              <Switch
                value={settings.batteryOptimizationEnabled}
                onValueChange={(value) => handleSettingChange("batteryOptimizationEnabled", value)}
                trackColor={{ false: "rgba(255,255,255,0.2)", true: BRAND }}
                thumbColor="#fff"
              />
            </SettingsRow>
          </SettingsSection>
        </ScrollView>

        <Animated.View
          style={[
            styles.footer,
            { 
              bottom: 0,
              paddingBottom: 68 + insets.bottom + 20 
            },
            {
              opacity: footerOpacity,
              transform: [{ translateY: footerTranslateY }],
            },
          ]}
          pointerEvents={hasUnsavedChanges ? "auto" : "none"}
        >
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.button, styles.resetButton]} onPress={handleResetSettings}>
              <Text style={styles.resetButtonText}>Reset to Defaults</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSaveSettings}>
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>

      <ConfirmModal
        visible={modalConfig.visible}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmLabel={modalConfig.confirmLabel}
        cancelLabel={modalConfig.cancelLabel}
        destructive={modalConfig.destructive}
        onConfirm={modalConfig.onConfirm}
        onCancel={hideModal}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  errorContainer: {
    backgroundColor: "rgba(255,100,100,0.15)",
    borderColor: "rgba(255,100,100,0.35)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    margin: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorText: {
    color: "rgba(255,210,210,0.9)",
    fontSize: 14,
    flex: 1,
  },
  errorDismiss: {
    marginLeft: 12,
  },
  errorDismissText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    backgroundColor: "rgba(112, 33, 33, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(132, 42, 42, 0.74)",
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
    padding: 16,
    paddingBottom: 8,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#fff",
  },
  rowDescription: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    marginTop: 3,
    lineHeight: 18,
  },
  rowControl: {
    marginLeft: 16,
  },
  radiusContainer: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  radiusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  radiusButtonActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  radiusButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
  },
  radiusButtonTextActive: {
    color: "#fff",
  },
  notificationSettingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  soundInfoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.1)",
    gap: 8,
  },
  soundInfoText: {
    flex: 1,
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 18,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(130, 26, 25, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  unsavedIndicator: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderColor: "rgba(255,255,255,0.3)",
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 0,
    alignItems: "center",
  },
  unsavedText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
  },
  resetButton: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  resetButtonText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontWeight: "500",
  },
  saveButton: {
    backgroundColor: BRAND,
  },
  saveButtonDisabled: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  saveButtonTextDisabled: {
    color: "rgba(255,255,255,0.4)",
  },
});

export default SettingsScreen;

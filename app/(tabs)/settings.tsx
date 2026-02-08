// Settings screen for user preferences and app configuration
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppDispatch, useUserSettings } from "../../store/hooks";
import {
  clearError,
  loadSettings,
  saveSettings,
  updateSettings,
} from "../../store/slices/settingsSlice";
import { UserSettings, VALIDATION_CONSTANTS } from "../../types";
import { validateUserSettings } from "../../utils";

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  children,
}) => (
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

const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  children,
  description,
}) => (
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
  const settings = useUserSettings() as UserSettings & {
    isLoading: boolean;
    error: string | null;
  };
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    // Load settings when component mounts
    dispatch(loadSettings());
  }, [dispatch]);

  useEffect(() => {
    // Clear error when component unmounts
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  const handleSettingChange = (key: keyof UserSettings, value: any) => {
    dispatch(updateSettings({ [key]: value }));
    setHasUnsavedChanges(true);
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
      Alert.alert("Invalid Settings", validation.errors.join("\n"));
      return;
    }

    try {
      await dispatch(saveSettings(settingsToSave)).unwrap();
      setHasUnsavedChanges(false);
      Alert.alert("Success", "Settings saved successfully");
    } catch (error) {
      Alert.alert("Error", `Failed to save settings: ${error}`);
    }
  };

  const handleResetSettings = () => {
    Alert.alert(
      "Reset Settings",
      "Are you sure you want to reset all settings to default values?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            dispatch(
              updateSettings({
                defaultTriggerRadius: 200,
                vibrationEnabled: true,
                persistentNotificationEnabled: true,
                batteryOptimizationEnabled: true,
              }),
            );
            setHasUnsavedChanges(true);
          },
        },
      ],
    );
  };

  const handleTriggerRadiusSelect = (radius: number) => {
    handleSettingChange("defaultTriggerRadius", radius);
  };

  const openNotificationSettings = async () => {
    try {
      if (Platform.OS === "android") {
        // Open app's notification settings on Android
        // This allows users to customize notification sounds for each channel
        await Linking.openSettings();
      } else if (Platform.OS === "ios") {
        // iOS - open app settings
        await Linking.openSettings();
      }
    } catch {
      Alert.alert(
        "Unable to Open Settings",
        "Please go to your device Settings > Apps > HopOff > Notifications to customize notification sounds.",
        [{ text: "OK" }],
      );
    }
  };

  if (settings.isLoading) {
    return (
      <SafeAreaView
        style={styles.loadingContainer}
        edges={["top", "left", "right"]}
      >
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {settings.error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{settings.error}</Text>
            <TouchableOpacity
              onPress={() => dispatch(clearError())}
              style={styles.errorDismiss}
            >
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
                    settings.defaultTriggerRadius === radius &&
                      styles.radiusButtonActive,
                  ]}
                  onPress={() => handleTriggerRadiusSelect(radius)}
                >
                  <Text
                    style={[
                      styles.radiusButtonText,
                      settings.defaultTriggerRadius === radius &&
                        styles.radiusButtonTextActive,
                    ]}
                  >
                    {radius}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </SettingsRow>

          <SettingsRow
            label="Vibration"
            description="Enable haptic feedback when alarm triggers"
          >
            <Switch
              value={settings.vibrationEnabled}
              onValueChange={(value) =>
                handleSettingChange("vibrationEnabled", value)
              }
              trackColor={{ false: "#E5E5E7", true: "#007AFF" }}
              thumbColor="#FFFFFF"
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
              trackColor={{ false: "#E5E5E7", true: "#007AFF" }}
              thumbColor="#FFFFFF"
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Notification Sound">
          <TouchableOpacity
            style={styles.notificationSettingsRow}
            onPress={openNotificationSettings}
          >
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Customize Alarm Sound</Text>
              <Text style={styles.rowDescription}>
                {Platform.OS === "android"
                  ? "Open system settings to choose a notification sound for destination alarms"
                  : "Open settings to manage notification preferences"}
              </Text>
            </View>
            <View style={styles.rowControl}>
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </View>
          </TouchableOpacity>
          <View style={styles.soundInfoContainer}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color="#8E8E93"
            />
            <Text style={styles.soundInfoText}>
              {Platform.OS === "android"
                ? 'In notification settings, select "Destination Alarms" channel to change the sound'
                : "Notification sounds are managed through iOS system settings"}
            </Text>
          </View>
        </SettingsSection>

        <SettingsSection title="Battery & Performance">
          <SettingsRow
            label="Battery Optimization"
            description="Reduce location polling frequency when battery is low to extend battery life"
          >
            <Switch
              value={settings.batteryOptimizationEnabled}
              onValueChange={(value) =>
                handleSettingChange("batteryOptimizationEnabled", value)
              }
              trackColor={{ false: "#E5E5E7", true: "#007AFF" }}
              thumbColor="#FFFFFF"
            />
          </SettingsRow>
        </SettingsSection>
      </ScrollView>

      <View style={styles.footer}>
        {hasUnsavedChanges && (
          <View style={styles.unsavedIndicator}>
            <Text style={styles.unsavedText}>You have unsaved changes</Text>
          </View>
        )}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.resetButton]}
            onPress={handleResetSettings}
          >
            <Text style={styles.resetButtonText}>Reset to Defaults</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              styles.saveButton,
              !hasUnsavedChanges && styles.saveButtonDisabled,
            ]}
            onPress={handleSaveSettings}
            disabled={!hasUnsavedChanges}
          >
            <Text
              style={[
                styles.saveButtonText,
                !hasUnsavedChanges && styles.saveButtonTextDisabled,
              ]}
            >
              Save Settings
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  errorContainer: {
    backgroundColor: "#FFEBEE",
    borderColor: "#F44336",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    margin: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 14,
    flex: 1,
  },
  errorDismiss: {
    marginLeft: 12,
  },
  errorDismissText: {
    color: "#D32F2F",
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    backgroundColor: "#FFFFFF",
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    padding: 16,
    paddingBottom: 8,
    backgroundColor: "#F8F9FA",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5E7",
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
  rowDescription: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  rowControl: {
    marginLeft: 16,
  },
  radiusContainer: {
    flexDirection: "row",
    gap: 8,
  },
  radiusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#E5E5E7",
    borderWidth: 1,
    borderColor: "#E5E5E7",
  },
  radiusButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  radiusButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  radiusButtonTextActive: {
    color: "#FFFFFF",
  },
  notificationSettingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
  },
  soundInfoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F8F9FA",
    gap: 8,
  },
  soundInfoText: {
    flex: 1,
    fontSize: 13,
    color: "#8E8E93",
    lineHeight: 18,
  },
  footer: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5E7",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  unsavedIndicator: {
    backgroundColor: "#FFF3CD",
    borderColor: "#FFEAA7",
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  unsavedText: {
    color: "#856404",
    fontSize: 14,
    fontWeight: "500",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  resetButton: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E5E5E7",
  },
  resetButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "500",
  },
  saveButton: {
    backgroundColor: "#007AFF",
  },
  saveButtonDisabled: {
    backgroundColor: "#E5E5E7",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButtonTextDisabled: {
    color: "#999",
  },
});

export default SettingsScreen;

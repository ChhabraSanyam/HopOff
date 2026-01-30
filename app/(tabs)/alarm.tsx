// Alarm management screen for active alarm monitoring
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AlarmStatusCard from "../../components/AlarmStatusCard";
import { useAlarmMonitoring } from "../../hooks/useAlarmMonitoring";
import { notificationManager } from "../../services/NotificationManager";
import {
  useActiveAlarm,
  useAppDispatch,
  useCurrentLocation,
  useIsAlarmLoading,
} from "../../store/hooks";
import { cancelAlarm } from "../../store/slices/alarmSlice";
import { getCurrentLocation } from "../../store/slices/locationSlice";

export default function AlarmScreen() {
  const dispatch = useAppDispatch();
  const activeAlarm = useActiveAlarm();
  const currentLocation = useCurrentLocation();
  const isLoading = useIsAlarmLoading();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use custom hook for alarm monitoring
  const { distance, stopMonitoring } = useAlarmMonitoring({
    updateInterval: 10000, // 10 seconds
    enablePersistentNotification: true,
  });

  // Handle alarm cancellation
  const handleCancelAlarm = useCallback(() => {
    if (!activeAlarm) return;

    Alert.alert(
      "Cancel Alarm",
      `Are you sure you want to cancel the alarm for ${activeAlarm.destination.name}?`,
      [
        {
          text: "Keep Alarm",
          style: "cancel",
        },
        {
          text: "Cancel Alarm",
          style: "destructive",
          onPress: async () => {
            try {
              await dispatch(cancelAlarm(activeAlarm.id)).unwrap();

              // Clear notifications
              await notificationManager.clearNotifications();

              // Stop monitoring
              stopMonitoring();

              Alert.alert(
                "Alarm Cancelled",
                "Your destination alarm has been cancelled.",
              );
            } catch (error) {
              console.error("Error cancelling alarm:", error);
              Alert.alert("Error", "Failed to cancel alarm. Please try again.");
            }
          },
        },
      ],
    );
  }, [activeAlarm, dispatch, stopMonitoring]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await dispatch(getCurrentLocation()).unwrap();
    } catch (error) {
      console.error("Error refreshing location:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch]);

  // Format distance for display
  const formatDistance = (distanceInMeters: number): string => {
    if (distanceInMeters >= 1000) {
      return `${(distanceInMeters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(distanceInMeters)} m`;
  };

  // Format time estimate (rough calculation based on walking speed)
  const formatTimeEstimate = (distanceInMeters: number): string => {
    const walkingSpeedMps = 1.4; // Average walking speed: 1.4 m/s (5 km/h)
    const timeInSeconds = distanceInMeters / walkingSpeedMps;

    if (timeInSeconds < 60) {
      return `${Math.round(timeInSeconds)} sec`;
    } else if (timeInSeconds < 3600) {
      return `${Math.round(timeInSeconds / 60)} min`;
    } else {
      return `${Math.round(timeInSeconds / 3600)} hr`;
    }
  };

  if (!activeAlarm) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noAlarmContainer}>
          <Ionicons name="alarm-outline" size={64} color="#ccc" />
          <Text style={styles.noAlarmTitle}>No Active Alarm</Text>
          <Text style={styles.noAlarmText}>
            Set a destination alarm from the map screen to monitor your journey.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Active Alarm</Text>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelAlarm}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="close-circle" size={20} color="#fff" />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Alarm Status Card */}
        <AlarmStatusCard
          alarm={activeAlarm}
          distance={distance}
          currentLocation={currentLocation}
        />

        {/* Distance Information */}
        <View style={styles.distanceCard}>
          <View style={styles.distanceHeader}>
            <Ionicons name="location" size={24} color="#007AFF" />
            <Text style={styles.distanceTitle}>Distance to Destination</Text>
          </View>

          {distance !== null ? (
            <View style={styles.distanceInfo}>
              <Text style={styles.distanceValue}>
                {formatDistance(distance)}
              </Text>
              <Text style={styles.distanceSubtext}>
                Estimated walking time: {formatTimeEstimate(distance)}
              </Text>

              {/* Progress indicator */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            ((activeAlarm.settings.triggerRadius - distance) /
                              activeAlarm.settings.triggerRadius) *
                              100,
                          ),
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  Alarm will trigger at {activeAlarm.settings.triggerRadius}m
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.loadingText}>Calculating distance...</Text>
            </View>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>How it works</Text>
          <Text style={styles.instructionsText}>
            • Your location is being monitored in the background{"\n"}• The
            alarm will trigger when you&apos;re within{" "}
            {activeAlarm.settings.triggerRadius}m of your destination{"\n"}•
            You&apos;ll receive a notification with sound and vibration{"\n"}•
            Pull down to refresh your current location
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1c1c1e",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF3B30",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    justifyContent: "center",
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 4,
  },
  noAlarmContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  noAlarmTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1c1c1e",
    marginTop: 16,
    marginBottom: 8,
  },
  noAlarmText: {
    fontSize: 16,
    color: "#8e8e93",
    textAlign: "center",
    lineHeight: 22,
  },
  distanceCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  distanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  distanceTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1c1c1e",
    marginLeft: 8,
  },
  distanceInfo: {
    alignItems: "center",
  },
  distanceValue: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 4,
  },
  distanceSubtext: {
    fontSize: 14,
    color: "#8e8e93",
    marginBottom: 20,
  },
  progressContainer: {
    width: "100%",
    alignItems: "center",
  },
  progressBar: {
    width: "100%",
    height: 8,
    backgroundColor: "#e5e5ea",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#34C759",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: "#8e8e93",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 16,
    color: "#8e8e93",
  },
  instructionsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1c1c1e",
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    color: "#8e8e93",
    lineHeight: 20,
  },
});

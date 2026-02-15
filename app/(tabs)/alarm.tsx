// Alarm management screen for active alarm monitoring
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
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
import { notificationManager } from "../../services/NotificationManager";
import {
  useActiveAlarmCount,
  useActiveAlarms,
  useAppDispatch,
  useCurrentLocation,
  useHasActiveAlarms,
  useIsAlarmLoading,
} from "../../store/hooks";
import { cancelAlarm, cancelAllAlarms } from "../../store/slices/alarmSlice";
import { getCurrentLocation } from "../../store/slices/locationSlice";
import { Alarm } from "../../types";
import { calculateDistance } from "../../utils";

export default function AlarmScreen() {
  const dispatch = useAppDispatch();
  const activeAlarms = useActiveAlarms();
  const hasActiveAlarms = useHasActiveAlarms();
  const alarmCount = useActiveAlarmCount();
  const currentLocation = useCurrentLocation();
  const isLoading = useIsAlarmLoading();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch location once on mount for initial UI state.
  // After that, the BackgroundLocationTask pushes updates to Redux
  // on every location tick, keeping the UI in sync with notifications.
  useEffect(() => {
    dispatch(getCurrentLocation());
  }, [dispatch]);

  // Calculate distance for a specific alarm
  const calculateDistanceForAlarm = useCallback(
    (alarm: Alarm): number | null => {
      if (!currentLocation) return null;
      try {
        return calculateDistance(currentLocation, alarm.destination.coordinate);
      } catch {
        return null;
      }
    },
    [currentLocation],
  );

  // Handle alarm cancellation
  const handleCancelAlarm = useCallback(
    (alarm: Alarm) => {
      Alert.alert(
        "Cancel Alarm",
        `Are you sure you want to cancel the alarm for ${alarm.destination.name}?`,
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
                await dispatch(cancelAlarm(alarm.id)).unwrap();

                // Clear notifications if no more alarms
                if (alarmCount <= 1) {
                  await notificationManager.clearNotifications();
                }

                Alert.alert(
                  "Alarm Cancelled",
                  `Alarm for "${alarm.destination.name}" has been cancelled.`,
                );
              } catch (error) {
                console.error("Error cancelling alarm:", error);
                Alert.alert(
                  "Error",
                  "Failed to cancel alarm. Please try again.",
                );
              }
            },
          },
        ],
      );
    },
    [dispatch, alarmCount],
  );

  // Handle cancel all alarms
  const handleCancelAllAlarms = useCallback(() => {
    Alert.alert(
      "Cancel All Alarms",
      `Are you sure you want to cancel all ${alarmCount} active alarm${alarmCount > 1 ? "s" : ""}?`,
      [
        {
          text: "Keep Alarms",
          style: "cancel",
        },
        {
          text: "Cancel All",
          style: "destructive",
          onPress: async () => {
            try {
              await dispatch(cancelAllAlarms()).unwrap();
              await notificationManager.clearNotifications();

              Alert.alert(
                "All Alarms Cancelled",
                "All destination alarms have been cancelled.",
              );
            } catch (error) {
              console.error("Error cancelling all alarms:", error);
              Alert.alert(
                "Error",
                "Failed to cancel alarms. Please try again.",
              );
            }
          },
        },
      ],
    );
  }, [dispatch, alarmCount]);

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

  // Format time estimate (rough calculation based on metro/public transport speed)
  const formatTimeEstimate = (distanceInMeters: number): string => {
    const metroSpeedMps = 11; // Average metro speed: 40 km/h including stops
    const timeInSeconds = distanceInMeters / metroSpeedMps;

    if (timeInSeconds < 60) {
      return `${Math.round(timeInSeconds)} sec`;
    } else if (timeInSeconds < 3600) {
      return `${Math.round(timeInSeconds / 60)} min`;
    } else {
      return `${Math.round(timeInSeconds / 3600)} hr`;
    }
  };

  if (!hasActiveAlarms) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.noAlarmContainer}>
          <Ionicons name="alarm-outline" size={64} color="#ccc" />
          <Text style={styles.noAlarmTitle}>No Active Alarms</Text>
          <Text style={styles.noAlarmText}>
            Set a destination alarm from the map screen to monitor your journey.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Active Alarms</Text>
            <Text style={styles.headerSubtitle}>
              {alarmCount} alarm{alarmCount > 1 ? "s" : ""} active
            </Text>
          </View>
          {alarmCount > 1 && (
            <TouchableOpacity
              style={styles.cancelAllButton}
              onPress={handleCancelAllAlarms}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="close-circle" size={18} color="#fff" />
                  <Text style={styles.cancelAllButtonText}>Cancel All</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Alarm Cards */}
        {activeAlarms.map((alarm) => {
          const distance = calculateDistanceForAlarm(alarm);
          return (
            <View key={alarm.id} style={styles.alarmCardWrapper}>
              {/* Alarm Status Card */}
              <AlarmStatusCard
                alarm={alarm}
                distance={distance}
                currentLocation={currentLocation}
              />

              {/* Distance & Cancel for this alarm */}
              <View style={styles.alarmActions}>
                <View style={styles.distanceInfo}>
                  {distance !== null ? (
                    <>
                      <Text style={styles.distanceValue}>
                        {formatDistance(distance)}
                      </Text>
                      <Text style={styles.distanceSubtext}>
                        ~{formatTimeEstimate(distance)} by metro
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.distanceSubtext}>Calculating...</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => handleCancelAlarm(alarm)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="close-circle" size={18} color="#fff" />
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>How it works</Text>
          <Text style={styles.instructionsText}>
            • Your location is being monitored in the background{"\n"}• Each
            alarm will trigger when you&apos;re within its radius{"\n"}•
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
  headerSubtitle: {
    fontSize: 14,
    color: "#8e8e93",
    marginTop: 2,
  },
  cancelAllButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF3B30",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 100,
    justifyContent: "center",
  },
  cancelAllButtonText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 4,
    fontSize: 13,
  },
  alarmCardWrapper: {
    marginBottom: 16,
  },
  alarmActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  distanceInfo: {
    flex: 1,
  },
  distanceValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#007AFF",
  },
  distanceSubtext: {
    fontSize: 13,
    color: "#8e8e93",
    marginTop: 2,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF3B30",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 90,
    justifyContent: "center",
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 4,
    fontSize: 14,
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

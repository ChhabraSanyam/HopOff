// Alarm management screen for active alarm monitoring
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AlarmStatusCard from "../../components/AlarmStatusCard";
import ConfirmModal from "../../components/ConfirmModal";
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

const BRAND = "#e49e9cff";
const GRADIENT: [string, string, string] = [
  "rgba(238, 155, 141, 0.7)",
  "rgba(243, 166, 145, 0.4)",
  "rgba(241, 205, 199, 0.72)",
];

export default function AlarmScreen() {
  const dispatch = useAppDispatch();
  const activeAlarms = useActiveAlarms();
  const hasActiveAlarms = useHasActiveAlarms();
  const alarmCount = useActiveAlarmCount();
  const currentLocation = useCurrentLocation();
  const isLoading = useIsAlarmLoading();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal state for single alarm cancellation
  const [cancelTarget, setCancelTarget] = useState<Alarm | null>(null);
  // Modal state for cancel-all
  const [showCancelAll, setShowCancelAll] = useState(false);

  useEffect(() => {
    dispatch(getCurrentLocation());
  }, [dispatch]);

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

  const handleCancelAlarm = useCallback(
    (alarm: Alarm) => {
      setCancelTarget(alarm);
    },
    [],
  );

  const confirmCancelAlarm = useCallback(async () => {
    if (!cancelTarget) return;
    const alarm = cancelTarget;
    setCancelTarget(null);
    try {
      await dispatch(cancelAlarm(alarm.id)).unwrap();
      if (alarmCount <= 1) {
        await notificationManager.clearNotifications();
      }
    } catch (error) {
      console.error("Error cancelling alarm:", error);
    }
  }, [cancelTarget, dispatch, alarmCount]);

  const handleCancelAllAlarms = useCallback(() => {
    setShowCancelAll(true);
  }, []);

  const confirmCancelAllAlarms = useCallback(async () => {
    setShowCancelAll(false);
    try {
      await dispatch(cancelAllAlarms()).unwrap();
      await notificationManager.clearNotifications();
    } catch (error) {
      console.error("Error cancelling all alarms:", error);
    }
  }, [dispatch]);

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

  const formatDistance = (distanceInMeters: number): string => {
    if (distanceInMeters >= 1000) {
      return `${(distanceInMeters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(distanceInMeters)} m`;
  };

  const formatTimeEstimate = (distanceInMeters: number): string => {
    const metroSpeedMps = 11;
    const timeInSeconds = distanceInMeters / metroSpeedMps;
    if (timeInSeconds < 60) return `${Math.round(timeInSeconds)} sec`;
    if (timeInSeconds < 3600) return `${Math.round(timeInSeconds / 60)} min`;
    return `${Math.round(timeInSeconds / 3600)} hr`;
  };

  if (!hasActiveAlarms) {
    return (
      <LinearGradient
        colors={["rgba(130, 26, 25, 0.95)", "rgba(232, 47, 45, 0.55)", "rgba(130, 26, 25, 0.9)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
          <View style={styles.noAlarmContainer}>
            <Ionicons name="alarm-outline" size={72} color="rgba(255,255,255,0.4)" />
            <Text style={styles.noAlarmTitle}>No Active Alarms</Text>
            <Text style={styles.noAlarmText}>
              Set a destination alarm from the map screen to monitor your journey.
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["rgba(130, 26, 25, 0.95)", "rgba(232, 47, 45, 0.55)", "rgba(130, 26, 25, 0.9)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#fff"
              colors={[BRAND]}
            />
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
                <AlarmStatusCard
                  alarm={alarm}
                  distance={distance}
                  currentLocation={currentLocation}
                  onCancel={() => handleCancelAlarm(alarm)}
                />
              </View>
            );
          })}

          {/* Instructions */}
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>How it works</Text>
            <Text style={styles.instructionsText}>
              {"• Your location is being monitored in the background\n"}
              {"• Each alarm will trigger when you're within its radius\n"}
              {"• You'll receive a notification with sound and vibration\n"}
              {"• Pull down to refresh your current location"}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Themed cancel confirmation — single alarm */}
      <ConfirmModal
        visible={cancelTarget !== null}
        title="Cancel Alarm"
        message={cancelTarget ? `Cancel the alarm for "${cancelTarget.destination.name}"?` : ""}
        confirmLabel="Cancel Alarm"
        cancelLabel="Keep Alarm"
        destructive
        onConfirm={confirmCancelAlarm}
        onCancel={() => setCancelTarget(null)}
      />

      {/* Themed cancel confirmation — all alarms */}
      <ConfirmModal
        visible={showCancelAll}
        title="Cancel All Alarms"
        message={`Are you sure you want to cancel all ${alarmCount} active alarm${alarmCount > 1 ? "s" : ""}?`}
        confirmLabel="Cancel All"
        cancelLabel="Keep Alarms"
        destructive
        onConfirm={confirmCancelAllAlarms}
        onCancel={() => setShowCancelAll(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
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
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
  },
  cancelAllButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
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
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  distanceInfo: {
    flex: 1,
  },
  distanceValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  distanceSubtext: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BRAND,
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
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
  },
  noAlarmText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 22,
  },
  instructionsCard: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 22,
  },
});

// Alarm status card component for displaying active alarm information
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Alarm, Coordinate } from "../types";
import { haptics } from "../utils/Haptics";

interface AlarmStatusCardProps {
  alarm: Alarm;
  distance: number | null;
  currentLocation: Coordinate | null;
  onCancel: () => void;
}

const AlarmStatusCard: React.FC<AlarmStatusCardProps> = ({
  alarm,
  distance,
  currentLocation,
  onCancel,
}) => {
  // Format the creation time
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Format the date
  const formatDate = (date: Date): string => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return "Today";
    }

    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  };

  // Format the estimated time of arrival
  const getEtaText = (): string => {
    if (distance === null) return "Calculating...";
    const metroSpeedMps = 11;
    const timeInSeconds = distance / metroSpeedMps;
    if (timeInSeconds < 60) return `${Math.round(timeInSeconds)} sec`;

    const totalMinutes = Math.round(timeInSeconds / 60);
    if (totalMinutes < 60) return `${totalMinutes} min`;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  };

  // Get status color based on distance
  const getStatusColor = (): string => {
    if (!distance) return "#8E8E93";

    if (distance <= alarm.settings.triggerRadius) {
      return "#FF3B30"; // Red - very close
    } else if (distance <= alarm.settings.triggerRadius * 2) {
      return "#FF9500"; // Orange - approaching
    } else if (distance <= alarm.settings.triggerRadius * 5) {
      return "#FFCC00"; // Yellow - getting closer
    } else {
      return "#34C759"; // Green - far away
    }
  };

  // Get status text based on distance
  const getStatusText = (): string => {
    if (!distance) return "Calculating...";

    if (distance <= alarm.settings.triggerRadius) {
      return "Destination Reached!";
    } else if (distance <= alarm.settings.triggerRadius * 2) {
      return "Approaching Destination";
    } else if (distance <= alarm.settings.triggerRadius * 5) {
      return "Getting Closer";
    } else {
      return "En Route";
    }
  };

  return (
    <View style={styles.container}>
      {/* Status Header + cancel */}
      <View style={styles.topRow}>
        <View style={styles.statusHeader}>
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: getStatusColor() },
            ]}
          />
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.cancelCircle}
          onPress={() => {
            haptics.light();
            onCancel();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Cancel alarm"
          accessibilityHint="Closes the alarm status card"
        >
          <Ionicons name="close" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Destination Information */}
      <View style={styles.destinationSection}>
        <View style={styles.destinationHeader}>
          <Ionicons name="location" size={24} color="#007AFF" />
          <View style={styles.destinationInfo}>
            <Text style={styles.destinationName} numberOfLines={2}>
              {alarm.destination.name}
            </Text>
            {alarm.destination.address && (
              <Text style={styles.destinationAddress} numberOfLines={2}>
                {alarm.destination.address}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Alarm Details */}
      <View style={styles.detailsSection}>
        <View style={styles.detailRow}>
          <Ionicons name="time" size={16} color="#8E8E93" />
          <Text style={styles.detailText}>
            Created {formatDate(new Date(alarm.createdAt))} at{" "}
            {formatTime(new Date(alarm.createdAt))}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="radio-button-on" size={16} color="#8E8E93" />
          <Text style={styles.detailText}>
            Trigger radius: {alarm.settings.triggerRadius}m
          </Text>
        </View>

        {alarm.geofenceId && (
          <View style={styles.detailRow}>
            <Ionicons name="shield-checkmark" size={16} color="#34C759" />
            <Text style={styles.detailText}>Geofencing active</Text>
          </View>
        )}
      </View>

      {/* Distance and ETA Badges */}
      {distance !== null && (
        <View style={styles.badgesContainer}>
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceBadgeText}>
              {distance >= 1000
                ? `${(distance / 1000).toFixed(1)} km away`
                : `${Math.round(distance)} m away`}
            </Text>
          </View>
          <View style={[styles.distanceBadge, styles.etaBadge]}>
            <Ionicons
              name="time"
              size={14}
              color="#fff"
              style={styles.etaIcon}
            />
            <Text style={styles.distanceBadgeText}>~{getEtaText()}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
  },
  destinationSection: {
    marginBottom: 16,
  },
  destinationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  destinationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  destinationName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  destinationAddress: {
    fontSize: 14,
    color: "#8E8E93",
    lineHeight: 18,
  },
  coordinatesSection: {
    marginBottom: 12,
  },
  coordinatesLabel: {
    fontSize: 12,
    color: "#8E8E93",
    fontWeight: "500",
    marginBottom: 2,
  },
  coordinatesText: {
    fontSize: 14,
    color: "#1C1C1E",
    fontFamily: "monospace",
  },
  detailsSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#8E8E93",
    marginLeft: 8,
  },
  cancelCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  badgesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 8,
  },
  distanceBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  etaBadge: {
    backgroundColor: "#5856D6",
  },
  etaIcon: {
    marginRight: 4,
  },
  distanceBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});

export default AlarmStatusCard;

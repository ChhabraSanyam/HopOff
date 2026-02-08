// Saved destinations screen for managing favorite locations
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { createAlarm } from "../../store/slices/alarmSlice";
import {
  deleteDestination,
  loadSavedDestinations,
} from "../../store/slices/destinationSlice";
import { setSelectedDestination } from "../../store/slices/uiSlice";
import { AlarmSettings, AppState, Destination } from "../../types";

const SavedDestinationsScreen: React.FC = () => {
  const dispatch = useDispatch();
  const {
    saved: destinations,
    isLoading,
    error,
  } = useSelector((state: AppState) => state.destinations);
  const userSettings = useSelector((state: AppState) => state.settings);

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredDestinations, setFilteredDestinations] = useState<
    Destination[]
  >([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const loadDestinations = async () => {
      try {
        await dispatch(loadSavedDestinations() as any);
      } catch (error) {
        console.error("Failed to load destinations:", error);
      }
    };

    loadDestinations();
  }, [dispatch]);

  useEffect(() => {
    // Filter destinations based on search query
    if (searchQuery.trim() === "") {
      setFilteredDestinations(destinations);
    } else {
      const filtered = destinations.filter(
        (dest) =>
          dest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (dest.address &&
            dest.address.toLowerCase().includes(searchQuery.toLowerCase())),
      );
      setFilteredDestinations(filtered);
    }
  }, [destinations, searchQuery]);

  const loadDestinations = async () => {
    try {
      await dispatch(loadSavedDestinations() as any);
    } catch (error) {
      console.error("Failed to load destinations:", error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDestinations();
    setRefreshing(false);
  };

  const handleDeleteDestination = (destination: Destination) => {
    Alert.alert(
      "Delete Destination",
      `Are you sure you want to delete "${destination.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await dispatch(deleteDestination(destination.id) as any);
            } catch {
              Alert.alert("Error", "Failed to delete destination");
            }
          },
        },
      ],
    );
  };

  const handleSetAlarm = async (destination: Destination) => {
    try {
      // Set as selected destination
      dispatch(setSelectedDestination(destination));

      // Create alarm settings from user preferences
      const alarmSettings: AlarmSettings = {
        triggerRadius: userSettings.defaultTriggerRadius,
        vibrationEnabled: userSettings.vibrationEnabled,
        persistentNotification: true,
      };

      // Create the alarm
      const result = await dispatch(
        createAlarm({ destination, settings: alarmSettings }) as any,
      ).unwrap();

      // Check if this was an existing alarm at the same location
      if (result.isExisting) {
        Alert.alert(
          "Alarm Already Exists",
          result.message || `An alarm is already set for this location.`,
          [
            {
              text: "View Alarm",
              onPress: () => {
                router.push("/alarm");
              },
            },
            {
              text: "OK",
              style: "cancel",
            },
          ],
        );
        return;
      }

      // Navigate to alarm screen
      Alert.alert(
        "Alarm Created",
        `Alarm has been set for: ${destination.name}`,
        [
          {
            text: "View Alarm",
            onPress: () => {
              router.push("/alarm");
            },
          },
          {
            text: "OK",
            style: "cancel",
          },
        ],
      );
    } catch (error) {
      console.error("Error creating alarm:", error);
      Alert.alert(
        "Error",
        "Failed to create alarm. Please check your location services and try again.",
      );
    }
  };

  const renderDestinationItem = ({ item }: { item: Destination }) => (
    <TouchableOpacity
      style={styles.destinationItem}
      onPress={() => handleSetAlarm(item)}
      activeOpacity={0.7}
    >
      <View style={styles.destinationContent}>
        <View style={styles.destinationInfo}>
          <Text style={styles.destinationName}>{item.name}</Text>
          {item.address && (
            <Text style={styles.destinationAddress}>{item.address}</Text>
          )}
          <Text style={styles.destinationDate}>
            Added: {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.destinationActions}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={(e) => {
              e.stopPropagation();
              handleDeleteDestination(item);
            }}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No Saved Destinations</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery
          ? "No destinations match your search."
          : "Save destinations to your favourites for quick access when setting alarms."}
      </Text>
    </View>
  );

  if (isLoading && destinations.length === 0) {
    return (
      <SafeAreaView
        style={styles.loadingContainer}
        edges={["top", "left", "right"]}
      >
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading destinations...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved Destinations</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search favourites..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadDestinations}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filteredDestinations}
        keyExtractor={(item) => item.id}
        renderItem={renderDestinationItem}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={
          filteredDestinations.length === 0 ? styles.emptyContainer : undefined
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  destinationItem: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  destinationContent: {
    padding: 16,
    flexDirection: "column",
  },
  destinationInfo: {
    flex: 1,
    marginBottom: 12,
  },
  destinationName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  destinationAddress: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  destinationDate: {
    fontSize: 12,
    color: "#999",
  },
  destinationActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 8,
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  errorContainer: {
    backgroundColor: "#FFE6E6",
    margin: 16,
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorText: {
    color: "#D32F2F",
    flex: 1,
  },
  retryButton: {
    backgroundColor: "#D32F2F",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default SavedDestinationsScreen;

// Saved destinations screen for managing favorite locations
import { LinearGradient } from "expo-linear-gradient";
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

const BRAND = "#b9221d";
const GRADIENT: [string, string, string] = [
  "rgba(195, 65, 55, 0.88)",
  "rgba(232, 100, 80, 0.50)",
  "rgba(195, 65, 55, 0.82)",
];

const SavedDestinationsScreen: React.FC = () => {
  const dispatch = useDispatch();
  const {
    saved: destinations,
    isLoading,
    error,
  } = useSelector((state: AppState) => state.destinations);
  const userSettings = useSelector((state: AppState) => state.settings);

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredDestinations, setFilteredDestinations] = useState<Destination[]>([]);
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
    if (searchQuery.trim() === "") {
      setFilteredDestinations(destinations);
    } else {
      const filtered = destinations.filter(
        (dest) =>
          dest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (dest.address && dest.address.toLowerCase().includes(searchQuery.toLowerCase())),
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
      dispatch(setSelectedDestination(destination));
      const alarmSettings: AlarmSettings = {
        triggerRadius: userSettings.defaultTriggerRadius,
        vibrationEnabled: userSettings.vibrationEnabled,
        persistentNotification: true,
      };
      const result = await dispatch(
        createAlarm({ destination, settings: alarmSettings }) as any,
      ).unwrap();

      if (result.isExisting) {
        Alert.alert(
          "Alarm Already Exists",
          result.message || "An alarm is already set for this location.",
          [
            { text: "View Alarm", onPress: () => router.push("/alarm") },
            { text: "OK", style: "cancel" },
          ],
        );
        return;
      }

      Alert.alert(
        "Alarm Created",
        `Alarm has been set for: ${destination.name}`,
        [
          { text: "View Alarm", onPress: () => router.push("/alarm") },
          { text: "OK", style: "cancel" },
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
      <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }}>
        <SafeAreaView style={styles.loadingContainer} edges={["top", "left", "right"]}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading destinations...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Saved Destinations</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search favourites..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadDestinations}>
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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#fff"
              colors={[BRAND]}
            />
          }
          contentContainerStyle={
            filteredDestinations.length === 0 ? styles.emptyContainer : styles.listContent
          }
        />
      </SafeAreaView>
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
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.15)",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  listContent: {
    padding: 12,
    paddingBottom: 100,
  },
  destinationItem: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    marginHorizontal: 4,
    marginVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  destinationContent: {
    padding: 16,
  },
  destinationInfo: {
    flex: 1,
    marginBottom: 12,
  },
  destinationName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  destinationAddress: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 4,
  },
  destinationDate: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  destinationActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 4,
  },
  deleteButton: {
    backgroundColor: BRAND,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 22,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  errorContainer: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,100,100,0.4)",
    margin: 16,
    padding: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorText: {
    color: "rgba(255,200,200,0.9)",
    flex: 1,
  },
  retryButton: {
    backgroundColor: BRAND,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default SavedDestinationsScreen;

// Main map screen for destination selection and alarm management
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { LatLng } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import AddressSearchModal from "../../components/AddressSearchModal";
import AnimatedButton from "../../components/AnimatedButton";
import DestinationConfirmationModal from "../../components/DestinationConfirmationModal";
import FadeInView from "../../components/FadeInView";
import LoadingSpinner from "../../components/LoadingSpinner";
import MapComponent from "../../components/MapComponent";
import QuickDestinationSelector from "../../components/QuickDestinationSelector";
import SlideInView from "../../components/SlideInView";
import { destinationSelectionService } from "../../services/DestinationSelectionService";
import {
  useAppDispatch,
  useCurrentLocation,
  useLocationPermission,
  useMapRegion,
  useSelectedDestination,
  useUserSettings,
} from "../../store/hooks";
import { createAlarm } from "../../store/slices/alarmSlice";
import { addRecentDestination } from "../../store/slices/destinationSlice";
import {
  getCurrentLocation,
  requestLocationPermission,
} from "../../store/slices/locationSlice";
import { setSelectedDestination } from "../../store/slices/uiSlice";
import { AlarmSettings, Coordinate, Destination } from "../../types";

const MapScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentLocation = useCurrentLocation();
  const locationPermission = useLocationPermission();
  const selectedDestination = useSelectedDestination();
  const mapRegion = useMapRegion();
  const userSettings = useUserSettings();

  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingCoordinate, setPendingCoordinate] = useState<Coordinate | null>(
    null,
  );
  const [pendingName, setPendingName] = useState<string | undefined>(undefined);
  const [pendingAddress, setPendingAddress] = useState<string | undefined>(
    undefined,
  );
  const [showQuickSelector, setShowQuickSelector] = useState(false);
  const [showAddressSearch, setShowAddressSearch] = useState(false);
  const [shouldFitMarkers, setShouldFitMarkers] = useState(false);

  const initializeLocation = useCallback(async () => {
    try {
      setIsLoadingLocation(true);
      setLocationError(null);

      // Request location permission
      if (locationPermission === "undetermined") {
        await dispatch(requestLocationPermission()).unwrap();
      }

      // Get current location if permission is granted
      if (
        locationPermission === "granted" ||
        locationPermission === "undetermined"
      ) {
        await dispatch(getCurrentLocation()).unwrap();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to get location";
      setLocationError(errorMessage);
      console.error("Location initialization error:", error);
    } finally {
      setIsLoadingLocation(false);
    }
  }, [dispatch, locationPermission]);

  // Request location permission and get current location on mount
  useEffect(() => {
    initializeLocation();
  }, [initializeLocation]);

  const handleMapPress = async (coordinate: LatLng) => {
    const coord: Coordinate = {
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    };

    // Validate coordinate for selection
    const validation =
      destinationSelectionService.validateCoordinateForSelection(coord);
    if (!validation.isValid) {
      Alert.alert("Invalid Location", validation.errors.join("\n"), [
        { text: "OK" },
      ]);
      return;
    }

    // Additional validation for alarm suitability if current location is available
    if (currentLocation) {
      const alarmValidation =
        destinationSelectionService.validateDestinationForAlarm(
          {
            id: "temp",
            name: "temp",
            coordinate: coord,
            createdAt: new Date().toISOString(),
          },
          currentLocation,
        );

      if (!alarmValidation.isValid) {
        Alert.alert(
          "Location Not Suitable",
          alarmValidation.errors.join("\n"),
          [{ text: "OK" }],
        );
        return;
      }
    }

    // Set pending coordinate and show confirmation modal
    // (no name/address available when tapping map, so reverse geocoding will be performed)
    setPendingCoordinate(coord);
    setPendingName(undefined);
    setPendingAddress(undefined);
    setShowConfirmationModal(true);
  };

  const handleMapReady = () => {
    if (__DEV__) {
      console.log("Map is ready");
    }
  };

  const handleRetryLocation = () => {
    initializeLocation();
  };

  const handleClearSelection = () => {
    dispatch(setSelectedDestination(null));
  };

  const handleDestinationConfirm = async (destination: Destination) => {
    try {
      // Set as selected destination
      dispatch(setSelectedDestination(destination));

      // Add to recent destinations
      dispatch(addRecentDestination(destination));

      // Close modal
      setShowConfirmationModal(false);
      setPendingCoordinate(null);
      setPendingName(undefined);
      setPendingAddress(undefined);

      // Trigger map to fit both markers
      setShouldFitMarkers(true);
      // Reset after a brief delay to allow future manual zooms
      setTimeout(() => setShouldFitMarkers(false), 2000);

      // Create alarm settings from user preferences
      const alarmSettings: AlarmSettings = {
        triggerRadius: userSettings.defaultTriggerRadius,
        vibrationEnabled: userSettings.vibrationEnabled,
        persistentNotification: true,
      };

      // Create the alarm
      const result = await dispatch(
        createAlarm({ destination, settings: alarmSettings }),
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
      Alert.alert("Error", "Failed to create alarm. Please try again.", [
        { text: "OK" },
      ]);
    }
  };

  const handleDestinationCancel = () => {
    setShowConfirmationModal(false);
    setPendingCoordinate(null);
    setPendingName(undefined);
    setPendingAddress(undefined);
  };

  const handleQuickSelectDestination = async (destination: Destination) => {
    try {
      // Set as selected destination
      dispatch(setSelectedDestination(destination));

      // Add to recent destinations
      dispatch(addRecentDestination(destination));

      // Trigger map to fit both markers
      setShouldFitMarkers(true);
      // Reset after a brief delay to allow future manual zooms
      setTimeout(() => setShouldFitMarkers(false), 2000);

      // Create alarm settings from user preferences
      const alarmSettings: AlarmSettings = {
        triggerRadius: userSettings.defaultTriggerRadius,
        vibrationEnabled: userSettings.vibrationEnabled,
        persistentNotification: true,
      };

      // Create the alarm
      const result = await dispatch(
        createAlarm({ destination, settings: alarmSettings }),
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
      Alert.alert("Error", "Failed to create alarm. Please try again.", [
        { text: "OK" },
      ]);
    }
  };

  const handleAddressSearchSelect = async (destination: Destination) => {
    // Close the search modal
    setShowAddressSearch(false);

    // Set the destination info (including name and address from search) and show confirmation modal
    setPendingCoordinate(destination.coordinate);
    setPendingName(destination.name);
    setPendingAddress(destination.address);
    setShowConfirmationModal(true);
  };

  // Show permission request if needed
  if (locationPermission === "denied") {
    return (
      <SafeAreaView
        style={styles.permissionContainer}
        edges={["top", "left", "right"]}
      >
        <FadeInView>
          <Text style={styles.permissionTitle}>
            Location Permission Required
          </Text>
          <Text style={styles.permissionText}>
            HopOff needs location access to show your current position and set
            destination alarms.
          </Text>
          <AnimatedButton
            title="Grant Permission"
            onPress={initializeLocation}
            loading={isLoadingLocation}
            style={styles.permissionButton}
          />
        </FadeInView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <MapComponent
        currentLocation={currentLocation}
        selectedDestination={selectedDestination}
        mapRegion={mapRegion}
        onMapPress={handleMapPress}
        onMapReady={handleMapReady}
        shouldFitMarkers={shouldFitMarkers}
      />

      {/* Loading overlay */}
      {isLoadingLocation && (
        <FadeInView style={styles.loadingOverlay}>
          <LoadingSpinner text="Getting your location..." color="#FFFFFF" />
        </FadeInView>
      )}

      {/* Error overlay */}
      {locationError && (
        <SlideInView direction="down" style={styles.errorOverlay}>
          <Text style={styles.errorText}>{locationError}</Text>
          <AnimatedButton
            title="Retry"
            onPress={handleRetryLocation}
            variant="secondary"
            size="small"
          />
        </SlideInView>
      )}

      {/* Selected destination info */}
      {selectedDestination && (
        <SlideInView direction="up" style={styles.destinationInfo}>
          <Text style={styles.destinationTitle}>
            {selectedDestination.name}
          </Text>
          <Text style={styles.destinationAddress}>
            {selectedDestination.address}
          </Text>
          <AnimatedButton
            title="Clear Selection"
            onPress={handleClearSelection}
            variant="danger"
            size="small"
          />
        </SlideInView>
      )}

      {/* Instructions and Action Buttons */}
      {!selectedDestination && !isLoadingLocation && !locationError && (
        <FadeInView delay={500} style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            Tap on the map to select your destination
          </Text>
          <View style={styles.actionButtonsContainer}>
            <AnimatedButton
              title="Search Address"
              onPress={() => setShowAddressSearch(true)}
              size="small"
              style={styles.actionButton}
            />
            <AnimatedButton
              title="Quick Select"
              onPress={() => setShowQuickSelector(true)}
              size="small"
              style={styles.actionButton}
            />
          </View>
        </FadeInView>
      )}

      {/* Destination Confirmation Modal */}
      <DestinationConfirmationModal
        visible={showConfirmationModal}
        coordinate={pendingCoordinate}
        initialName={pendingName}
        initialAddress={pendingAddress}
        onConfirm={handleDestinationConfirm}
        onCancel={handleDestinationCancel}
      />

      {/* Quick Destination Selector */}
      <QuickDestinationSelector
        visible={showQuickSelector}
        onClose={() => setShowQuickSelector(false)}
        onSelectDestination={handleQuickSelectDestination}
      />

      {/* Address Search Modal */}
      <AddressSearchModal
        visible={showAddressSearch}
        onClose={() => setShowAddressSearch(false)}
        onSelectAddress={handleAddressSearchSelect}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
    color: "#333",
  },
  permissionText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
    color: "#666",
    lineHeight: 22,
  },
  permissionButton: {
    marginTop: 20,
  },
  loadingOverlay: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  loadingText: {
    color: "white",
    fontSize: 16,
  },
  errorOverlay: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: "rgba(220, 53, 69, 0.9)",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  errorText: {
    color: "white",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },

  destinationInfo: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  destinationTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  destinationAddress: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },

  instructionsContainer: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  instructionsText: {
    color: "white",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
  actionButtonsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
});

export default MapScreen;

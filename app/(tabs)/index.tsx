// Main map screen for destination selection and alarm management
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Image, StyleSheet, Text, TouchableOpacity } from "react-native";
import { LatLng } from "react-native-maps";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AddressSearchModal from "../../components/AddressSearchModal";
import AnimatedButton from "../../components/AnimatedButton";
import ConfirmModal from "../../components/ConfirmModal";
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
  const insets = useSafeAreaInsets();
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
  const [shouldCenterOnLocation, setShouldCenterOnLocation] = useState(false);

  // Themed info/confirm modal state
  const [infoModal, setInfoModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
    confirmLabel: "View Alarm",
    onConfirm: () => { },
  });

  const showInfoModal = (title: string, message: string, confirmLabel: string, onConfirm: () => void) => {
    setInfoModal({ visible: true, title, message, confirmLabel, onConfirm });
  };
  const hideInfoModal = () => setInfoModal((m) => ({ ...m, visible: false }));

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

  const handleLocatePress = () => {
    if (selectedDestination) {
      // Fit both current location and destination on screen
      setShouldFitMarkers(true);
      setTimeout(() => setShouldFitMarkers(false), 2000);
    } else {
      // No destination — just re-centre on current location
      setShouldCenterOnLocation(true);
      setTimeout(() => setShouldCenterOnLocation(false), 500);
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
        showInfoModal(
          "Alarm Already Exists",
          result.message || "An alarm is already set for this location.",
          "View Alarm",
          () => { hideInfoModal(); router.push("/alarm"); },
        );
        return;
      }

      showInfoModal(
        "Alarm Created",
        `Alarm has been set for: ${destination.name}`,
        "View Alarm",
        () => { hideInfoModal(); router.push("/alarm"); },
      );
    } catch (error) {
      console.error("Error creating alarm:", error);
      showInfoModal("Error", "Failed to create alarm. Please try again.", "OK", hideInfoModal);
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
        showInfoModal(
          "Alarm Already Exists",
          result.message || "An alarm is already set for this location.",
          "View Alarm",
          () => { hideInfoModal(); router.push("/alarm"); },
        );
        return;
      }

      showInfoModal(
        "Alarm Created",
        `Alarm has been set for: ${destination.name}`,
        "View Alarm",
        () => { hideInfoModal(); router.push("/alarm"); },
      );
    } catch (error) {
      console.error("Error creating alarm:", error);
      showInfoModal("Error", "Failed to create alarm. Please try again.", "OK", hideInfoModal);
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
      {/* ── Header bar (overlaid on map) ── */}
      <LinearGradient
        colors={["rgba(232, 47, 45, 0.48)", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.headerBar}
      >
        {/* Left: locate / fit markers */}
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleLocatePress}
          disabled={isLoadingLocation}
        >
          <Ionicons name="locate" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Centre: logo */}
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.headerLogo}
          resizeMode="contain"
        />

        {/* Right: search */}
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setShowAddressSearch(true)}
        >
          <Ionicons name="search" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      <MapComponent
        currentLocation={currentLocation}
        selectedDestination={selectedDestination}
        mapRegion={mapRegion}
        onMapPress={handleMapPress}
        onMapReady={handleMapReady}
        shouldFitMarkers={shouldFitMarkers}
        shouldCenterOnLocation={shouldCenterOnLocation}
        triggerRadius={userSettings.defaultTriggerRadius}
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
        <SlideInView
          direction="up"
          style={{ ...styles.destinationInfo, bottom: 60 + insets.bottom + 35 }}
        >
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

      {/* Themed alarm created / already exists modal */}
      <ConfirmModal
        visible={infoModal.visible}
        title={infoModal.title}
        message={infoModal.message}
        confirmLabel={infoModal.confirmLabel}
        cancelLabel="OK"
        onConfirm={infoModal.onConfirm}
        onCancel={hideInfoModal}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  /* ── Header ── */
  headerBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 160,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#b9221dff",
    justifyContent: "center",
    alignItems: "center",
  },
  headerLogo: {
    height: 100,
    width: 180,
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
    bottom: 20, // overridden inline with dynamic inset
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
    alignSelf: "center",
    backgroundColor: "rgba(251, 138, 138, 0.5)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
  },
  instructionsText: {
    color: "#982C2C",
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
    backgroundColor: "#982C2C",
  },
});

export default MapScreen;

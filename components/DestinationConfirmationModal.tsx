// Destination confirmation modal component
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch } from "react-redux";
import { nominatimService } from "../services/NominatimService";
import { saveDestination } from "../store/slices/destinationSlice";
import { Coordinate, Destination } from "../types";
import {
  formatCoordinate,
  generateId,
  sanitizeDestinationName,
  validateDestination,
} from "../utils";

interface DestinationConfirmationModalProps {
  visible: boolean;
  coordinate: Coordinate | null;
  onConfirm: (destination: Destination) => void;
  onCancel: () => void;
  initialName?: string;
  initialAddress?: string;
}

const DestinationConfirmationModal: React.FC<
  DestinationConfirmationModalProps
> = ({
  visible,
  coordinate,
  onConfirm,
  onCancel,
  initialName,
  initialAddress,
}) => {
  const dispatch = useDispatch();
  const [destinationName, setDestinationName] = useState("");
  const [address, setAddress] = useState("");
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [addToFavourites, setAddToFavourites] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const latestAddressRequestIdRef = useRef(0);

  const clearNameValidationErrors = () => {
    setValidationErrors((prev) =>
      prev.filter((error) => !error.toLowerCase().includes("name")),
    );
  };

  const handleDestinationNameChange = (value: string) => {
    setDestinationName(value);
    clearNameValidationErrors();
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible && coordinate) {
      // Use provided initial values or defaults
      setDestinationName(initialName || "Selected Location");
      setAddress(initialAddress || formatCoordinate(coordinate));
      setAddToFavourites(false);
      setValidationErrors([]);

      // Only load address from coordinate if not already provided
      if (!initialAddress) {
        const requestId = ++latestAddressRequestIdRef.current;
        loadAddressFromCoordinate(coordinate, requestId);
      } else {
        latestAddressRequestIdRef.current += 1;
        // Address already provided, no need to reverse geocode
        setIsLoadingAddress(false);
      }
    } else if (!visible) {
      latestAddressRequestIdRef.current += 1;
      // Reset state when modal closes
      setDestinationName("");
      setAddress("");
      setAddToFavourites(false);
      setValidationErrors([]);
      setIsLoadingAddress(false);
    }
  }, [visible, coordinate, initialName, initialAddress]);

  /**
   * Load address from coordinate using reverse geocoding
   */
  const loadAddressFromCoordinate = async (
    coord: Coordinate,
    requestId: number,
  ) => {
    if (requestId === latestAddressRequestIdRef.current) {
      setIsLoadingAddress(true);
    }

    try {
      const result = await nominatimService.reverseGeocode(coord);

      if (requestId !== latestAddressRequestIdRef.current) {
        return;
      }

      if (result) {
        // Update address with the geocoded result
        setAddress(result.address);
        setValidationErrors([]);

        // Use the location name as destination name if available
        if (result.displayName) {
          setDestinationName(result.displayName);
        }
      } else {
        // Fallback to coordinates if no address found
        setAddress(formatCoordinate(coord));
      }
    } catch (error) {
      if (requestId !== latestAddressRequestIdRef.current) {
        return;
      }

      console.warn("Failed to reverse geocode coordinate:", error);
      // Keep the coordinate format as fallback
      setAddress(formatCoordinate(coord));
    } finally {
      if (requestId === latestAddressRequestIdRef.current) {
        setIsLoadingAddress(false);
      }
    }
  };

  const validateInput = (): boolean => {
    if (!coordinate) {
      setValidationErrors(["Invalid coordinate"]);
      return false;
    }

    const destination: Partial<Destination> = {
      name: destinationName,
      coordinate,
      address,
    };

    const validation = validateDestination(destination);
    setValidationErrors(validation.errors);
    return validation.isValid;
  };

  const handleConfirm = async () => {
    if (!validateInput() || !coordinate) {
      return;
    }

    // If addToFavourites is checked, save and then set alarm
    if (addToFavourites) {
      await handleSaveAndConfirm();
    } else {
      // Just set alarm without saving
      const destination: Destination = {
        id: generateId("dest"),
        name: sanitizeDestinationName(destinationName),
        coordinate,
        address: address.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      onConfirm(destination);
    }
  };

  const handleSaveAndConfirm = async () => {
    if (!validateInput() || !coordinate) {
      return;
    }

    setIsSaving(true);
    try {
      const destinationData = {
        name: sanitizeDestinationName(destinationName),
        coordinate,
        address: address.trim() || undefined,
      };

      const result = await dispatch(saveDestination(destinationData) as any);

      if (result.type === "destinations/save/fulfilled") {
        const savedDestination = result.payload as Destination;

        onConfirm(savedDestination);
      } else {
        throw new Error(result.error?.message || "Failed to save destination");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to save destination. Please try again.");
      console.error("Failed to save destination:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setValidationErrors([]);
    onCancel();
  };

  if (!coordinate) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <LinearGradient
        colors={["rgba(130, 26, 25, 0.8)", "rgba(232, 47, 45, 0.48)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientContainer}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Confirm Destination</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel="Close"
              accessibilityHint="Closes the modal"
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {/* Destination Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Destination Name</Text>
              <TextInput
                style={styles.textInput}
                value={destinationName}
                onChangeText={handleDestinationNameChange}
                placeholder="Enter destination name"
                placeholderTextColor="rgba(255,255,255,0.6)"
                maxLength={100}
                autoCapitalize="words"
              />
            </View>

            {/* Address Display */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address</Text>
              {isLoadingAddress ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.loadingText}>Loading address...</Text>
                </View>
              ) : (
                <Text style={styles.addressText}>{address}</Text>
              )}
            </View>

            {/* Coordinate Display */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Coordinates</Text>
              <Text style={styles.coordinateText}>
                {formatCoordinate(coordinate, 6)}
              </Text>
            </View>

            {/* Add to Favourites Checkbox */}
            <View style={styles.favouriteContainer}>
              <TouchableOpacity
                style={styles.favouriteToggle}
                onPress={() => setAddToFavourites(!addToFavourites)}
              >
                <View
                  style={[
                    styles.checkbox,
                    addToFavourites && styles.checkboxChecked,
                  ]}
                >
                  {addToFavourites && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.favouriteLabel}>Add to Favourites</Text>
              </TouchableOpacity>
            </View>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <View style={styles.errorContainer}>
                {validationErrors.map((error, index) => (
                  <Text key={index} style={styles.errorText}>
                    • {error}
                  </Text>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                (validationErrors.length > 0 || isSaving) &&
                  styles.disabledButton,
              ]}
              onPress={handleConfirm}
              disabled={validationErrors.length > 0 || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.confirmButtonText}>Set Alarm</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.25)",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 16,
    color: "#fff",
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#fff",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  addressText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(255,255,255,0.15)",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  coordinateText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "monospace",
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 8,
    borderRadius: 4,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
  },
  favouriteContainer: {
    marginBottom: 16,
  },
  favouriteToggle: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#ddd",
    borderRadius: 4,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  checkmark: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  favouriteLabel: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
  },
  errorContainer: {
    backgroundColor: "#ffebee",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ffcdd2",
    marginBottom: 16,
  },
  errorText: {
    color: "#c62828",
    fontSize: 14,
    marginBottom: 4,
  },
  buttonContainer: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.25)",
    justifyContent: "space-between",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  confirmButton: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: "#b9221d",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
});

export default DestinationConfirmationModal;

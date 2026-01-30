// Destination confirmation modal component
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch } from "react-redux";
import { nominatimService } from "../services/NominatimService";
import { saveDestination } from "../store/slices/destinationSlice";
import { Coordinate, Destination } from "../types";
import {
  formatCoordinate,
  sanitizeDestinationName,
  validateDestination,
} from "../utils";

interface DestinationConfirmationModalProps {
  visible: boolean;
  coordinate: Coordinate | null;
  onConfirm: (destination: Destination) => void;
  onCancel: () => void;
}

const DestinationConfirmationModal: React.FC<
  DestinationConfirmationModalProps
> = ({ visible, coordinate, onConfirm, onCancel }) => {
  const dispatch = useDispatch();
  const [destinationName, setDestinationName] = useState("");
  const [address, setAddress] = useState("");
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [addToFavourites, setAddToFavourites] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible && coordinate) {
      setDestinationName("Selected Location");
      setAddress(formatCoordinate(coordinate));
      setAddToFavourites(false);
      setValidationErrors([]);
      // Load address from coordinate using reverse geocoding
      loadAddressFromCoordinate(coordinate);
    } else if (!visible) {
      // Reset state when modal closes
      setDestinationName("");
      setAddress("");
      setAddToFavourites(false);
      setValidationErrors([]);
      setIsLoadingAddress(false);
    }
  }, [visible, coordinate]);

  /**
   * Load address from coordinate using reverse geocoding
   */
  const loadAddressFromCoordinate = async (coord: Coordinate) => {
    setIsLoadingAddress(true);
    try {
      const result = await nominatimService.reverseGeocode(coord);

      if (result) {
        // Update address with the geocoded result
        setAddress(result.address);

        // Use the location name as destination name if available
        if (result.displayName) {
          setDestinationName(result.displayName);
        }
      } else {
        // Fallback to coordinates if no address found
        setAddress(formatCoordinate(coord));
      }
    } catch (error) {
      console.warn("Failed to reverse geocode coordinate:", error);
      // Keep the coordinate format as fallback
      setAddress(formatCoordinate(coord));
    } finally {
      setIsLoadingAddress(false);
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
        id: `dest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
        console.log("Destination saved as favorite:", savedDestination.id);

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
      transparent={true}
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Confirm Destination</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleCancel}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Destination Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Destination Name</Text>
              <TextInput
                style={styles.textInput}
                value={destinationName}
                onChangeText={setDestinationName}
                placeholder="Enter destination name"
                maxLength={100}
                autoCapitalize="words"
              />
            </View>

            {/* Address Display */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address</Text>
              {isLoadingAddress ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#007AFF" />
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
          </View>

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
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 16,
    color: "#666",
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
    color: "#333",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  addressText: {
    fontSize: 14,
    color: "#666",
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  coordinateText: {
    fontSize: 12,
    color: "#888",
    fontFamily: "monospace",
    backgroundColor: "#f9f9f9",
    padding: 8,
    borderRadius: 4,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#666",
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
    color: "#333",
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
    borderTopColor: "#e0e0e0",
    justifyContent: "space-between",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  confirmButton: {
    flex: 1,
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
});

export default DestinationConfirmationModal;

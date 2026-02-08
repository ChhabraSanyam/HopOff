// Quick destination selector for favourites and recent destinations
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { loadSavedDestinations } from "../store/slices/destinationSlice";
import { AppState, Destination } from "../types";

interface QuickDestinationSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelectDestination: (destination: Destination) => void;
}

const QuickDestinationSelector: React.FC<QuickDestinationSelectorProps> = ({
  visible,
  onClose,
  onSelectDestination,
}) => {
  const dispatch = useDispatch();
  const { saved: destinations, recent } = useSelector(
    (state: AppState) => state.destinations,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredDestinations, setFilteredDestinations] = useState<
    Destination[]
  >([]);

  useEffect(() => {
    if (visible) {
      dispatch(loadSavedDestinations() as any);
    }
  }, [visible, dispatch]);

  useEffect(() => {
    // Combine saved and recent destinations, prioritizing favorites
    const allDestinations = [
      ...destinations,
      ...recent.filter(
        (recentDest) =>
          !destinations.some((savedDest) => savedDest.id === recentDest.id),
      ),
    ];

    // Filter based on search query
    if (searchQuery.trim() === "") {
      setFilteredDestinations(allDestinations);
    } else {
      const filtered = allDestinations.filter(
        (dest) =>
          dest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (dest.address &&
            dest.address.toLowerCase().includes(searchQuery.toLowerCase())),
      );
      setFilteredDestinations(filtered);
    }
  }, [destinations, recent, searchQuery]);

  const handleSelectDestination = (destination: Destination) => {
    onSelectDestination(destination);
    onClose();
    setSearchQuery("");
  };

  const renderDestinationItem = ({ item }: { item: Destination }) => (
    <TouchableOpacity
      style={styles.destinationItem}
      onPress={() => handleSelectDestination(item)}
    >
      <View style={styles.destinationInfo}>
        <Text style={styles.destinationName}>{item.name}</Text>
        {item.address && (
          <Text style={styles.destinationAddress} numberOfLines={1}>
            {item.address}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>
        {searchQuery
          ? "No destinations match your search."
          : "No saved destinations yet. Add destinations to favourites for quick access."}
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Quick Select</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search destinations..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        <FlatList
          data={filteredDestinations}
          keyExtractor={(item) => item.id}
          renderItem={renderDestinationItem}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={
            filteredDestinations.length === 0
              ? styles.emptyContainer
              : undefined
          }
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
  },
  searchContainer: {
    backgroundColor: "#fff",
    padding: 16,
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
    padding: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  destinationInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  destinationName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  favoriteIcon: {
    fontSize: 16,
    color: "#FFD700",
    marginLeft: 8,
  },
  destinationAddress: {
    fontSize: 14,
    color: "#666",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
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
});

export default QuickDestinationSelector;

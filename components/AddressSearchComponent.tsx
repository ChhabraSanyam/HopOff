// Address search component with OpenStreetMap Nominatim integration
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  NominatimError,
  nominatimService,
  NominatimServiceError,
} from "../services/NominatimService";
import { AddressSearchResult, SearchHistoryItem } from "../types";

interface AddressSearchComponentProps {
  onSelectResult: (result: AddressSearchResult) => void;
  onClose: () => void;
  placeholder?: string;
  searchHistory?: SearchHistoryItem[];
  onAddToHistory?: (query: string, result: AddressSearchResult) => void;
  showHistory?: boolean;
}

interface SearchState {
  query: string;
  results: AddressSearchResult[];
  isLoading: boolean;
  error: string | null;
  showResults: boolean;
}

const AddressSearchComponent: React.FC<AddressSearchComponentProps> = ({
  onSelectResult,
  onClose,
  placeholder = "Search for an address...",
  searchHistory = [],
  onAddToHistory,
  showHistory = true,
}) => {
  const [searchState, setSearchState] = useState<SearchState>({
    query: "",
    results: [],
    isLoading: false,
    error: null,
    showResults: false,
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search function
  const performSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchState((prev) => ({
        ...prev,
        results: [],
        showResults: false,
        error: null,
      }));
      return;
    }

    setSearchState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      showResults: true,
    }));

    try {
      const results = await nominatimService.searchAddress(query.trim(), 8);

      setSearchState((prev) => ({
        ...prev,
        results,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      let errorMessage = "Search failed. Please try again.";

      if (error instanceof NominatimServiceError) {
        switch (error.code) {
          case NominatimError.NO_RESULTS:
            errorMessage = `No results found for "${query.trim()}"`;
            break;
          case NominatimError.NETWORK_ERROR:
            errorMessage = "Network error. Please check your connection.";
            break;
          case NominatimError.RATE_LIMITED:
            errorMessage = "Too many searches. Please wait a moment.";
            break;
          case NominatimError.SERVICE_UNAVAILABLE:
            errorMessage = "Search service temporarily unavailable.";
            break;
          default:
            errorMessage = error.message;
        }
      }

      setSearchState((prev) => ({
        ...prev,
        results: [],
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, []);

  // Handle search input changes with debouncing
  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchState((prev) => ({ ...prev, query: text }));

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer for debounced search
      debounceTimerRef.current = setTimeout(() => {
        performSearch(text);
      }, 500); // 500ms debounce
    },
    [performSearch],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleSelectResult = (result: AddressSearchResult) => {
    // Add to search history if callback provided
    if (onAddToHistory && searchState.query.trim()) {
      onAddToHistory(searchState.query.trim(), result);
    }

    // Clear search state
    setSearchState({
      query: "",
      results: [],
      isLoading: false,
      error: null,
      showResults: false,
    });

    // Call parent callback
    onSelectResult(result);
  };

  const handleSelectHistoryItem = (historyItem: SearchHistoryItem) => {
    // Convert history item to AddressSearchResult format
    const result: AddressSearchResult = {
      id: `history_${historyItem.id}`,
      displayName: historyItem.result.display_name.split(",")[0].trim(),
      address: historyItem.result.display_name,
      coordinate: {
        latitude: parseFloat(historyItem.result.lat),
        longitude: parseFloat(historyItem.result.lon),
      },
      importance: historyItem.result.importance || 0,
      type: historyItem.result.type || "unknown",
      boundingBox: {
        south: parseFloat(historyItem.result.boundingbox[0]),
        north: parseFloat(historyItem.result.boundingbox[1]),
        west: parseFloat(historyItem.result.boundingbox[2]),
        east: parseFloat(historyItem.result.boundingbox[3]),
      },
    };

    handleSelectResult(result);
  };

  const handleClearSearch = () => {
    setSearchState({
      query: "",
      results: [],
      isLoading: false,
      error: null,
      showResults: false,
    });
  };

  const renderSearchResult = ({ item }: { item: AddressSearchResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleSelectResult(item)}
      activeOpacity={0.7}
    >
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {item.displayName}
        </Text>
        <Text style={styles.resultAddress} numberOfLines={2}>
          {item.address}
        </Text>
        <Text style={styles.resultType}>{item.type}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderHistoryItem = ({ item }: { item: SearchHistoryItem }) => (
    <TouchableOpacity
      style={styles.historyItem}
      onPress={() => handleSelectHistoryItem(item)}
      activeOpacity={0.7}
    >
      <View style={styles.historyContent}>
        <Text style={styles.historyQuery} numberOfLines={1}>
          {item.query}
        </Text>
        <Text style={styles.historyAddress} numberOfLines={1}>
          {item.result.display_name}
        </Text>
      </View>
      <Text style={styles.historyTime}>
        {new Date(item.timestamp).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  const showHistorySection =
    showHistory &&
    searchHistory.length > 0 &&
    !searchState.showResults &&
    !searchState.query;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Search Address</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchState.query}
          onChangeText={handleSearchChange}
          placeholder={placeholder}
          placeholderTextColor="#999"
          autoFocus
          returnKeyType="search"
          onSubmitEditing={() => performSearch(searchState.query)}
        />
        {searchState.query.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearSearch}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Loading Indicator */}
      {searchState.isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {/* Error Message */}
      {searchState.error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{searchState.error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => performSearch(searchState.query)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Results */}
      {searchState.showResults && searchState.results.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.sectionTitle}>Search Results</Text>
          <FlatList
            data={searchState.results}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            style={styles.resultsList}
          />
        </View>
      )}

      {/* Search History */}
      {showHistorySection && (
        <View style={styles.historyContainer}>
          <Text style={styles.sectionTitle}>Recent Searches</Text>
          <FlatList
            data={searchHistory.slice(0, 5)} // Show only last 5 searches
            renderItem={renderHistoryItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            style={styles.historyList}
          />
        </View>
      )}

      {/* Empty State */}
      {!searchState.isLoading &&
        !searchState.error &&
        !showHistorySection &&
        searchState.results.length === 0 &&
        searchState.query.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Start typing to search for addresses
            </Text>
          </View>
        )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: "#666",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  clearButtonText: {
    fontSize: 16,
    color: "#999",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#666",
  },
  errorContainer: {
    padding: 16,
    backgroundColor: "#fff5f5",
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fed7d7",
  },
  errorText: {
    fontSize: 14,
    color: "#e53e3e",
    marginBottom: 8,
  },
  retryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#e53e3e",
    borderRadius: 4,
  },
  retryButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  resultAddress: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
    lineHeight: 18,
  },
  resultType: {
    fontSize: 12,
    color: "#999",
    textTransform: "capitalize",
  },
  historyContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  historyList: {
    flex: 1,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  historyContent: {
    flex: 1,
  },
  historyQuery: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  historyAddress: {
    fontSize: 12,
    color: "#666",
  },
  historyTime: {
    fontSize: 11,
    color: "#999",
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
  },
});

export default AddressSearchComponent;

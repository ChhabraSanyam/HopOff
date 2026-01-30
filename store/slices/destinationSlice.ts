// Destination state slice for Redux store
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { searchHistoryService } from "../../services/SearchHistoryService";
import { storageManager } from "../../services/StorageManager";
import {
  AddressSearchResult,
  Destination,
  DestinationState,
  SearchHistoryItem,
} from "../../types";

const initialState: DestinationState = {
  saved: [],
  recent: [],
  searchHistory: [],
  isLoading: false,
  error: null,
};

// Async thunks for destination operations
export const loadSavedDestinations = createAsyncThunk(
  "destinations/loadSaved",
  async () => {
    return await storageManager.getSavedDestinations();
  },
);

export const saveDestination = createAsyncThunk(
  "destinations/save",
  async (destination: Omit<Destination, "id" | "createdAt">) => {
    const savedDestination: Destination = {
      ...destination,
      id: `dest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    await storageManager.saveDestination(savedDestination);
    return savedDestination;
  },
);

export const deleteDestination = createAsyncThunk(
  "destinations/delete",
  async (destinationId: string) => {
    await storageManager.deleteDestination(destinationId);
    return destinationId;
  },
);

export const updateDestination = createAsyncThunk(
  "destinations/update",
  async ({ id, updates }: { id: string; updates: Partial<Destination> }) => {
    // Get current destination from storage to merge updates
    const destinations = await storageManager.getSavedDestinations();
    const currentDestination = destinations.find((dest) => dest.id === id);

    if (!currentDestination) {
      throw new Error("Destination not found");
    }

    const updatedDestination: Destination = {
      ...currentDestination,
      ...updates,
    };

    await storageManager.saveDestination(updatedDestination);
    return updatedDestination;
  },
);

export const searchDestinations = createAsyncThunk(
  "destinations/search",
  async (query: string) => {
    const destinations = await storageManager.getSavedDestinations();
    const lowercaseQuery = query.toLowerCase();

    return destinations.filter(
      (dest) =>
        dest.name.toLowerCase().includes(lowercaseQuery) ||
        (dest.address && dest.address.toLowerCase().includes(lowercaseQuery)),
    );
  },
);

// Search history async thunks
export const loadSearchHistory = createAsyncThunk(
  "destinations/loadSearchHistory",
  async () => {
    return await searchHistoryService.getSearchHistory();
  },
);

export const addToSearchHistory = createAsyncThunk(
  "destinations/addToSearchHistory",
  async ({ query, result }: { query: string; result: AddressSearchResult }) => {
    await searchHistoryService.addSearchToHistory(query, result);
    return await searchHistoryService.getSearchHistory();
  },
);

export const clearSearchHistory = createAsyncThunk(
  "destinations/clearSearchHistory",
  async () => {
    await searchHistoryService.clearSearchHistory();
    return [];
  },
);

export const removeFromSearchHistory = createAsyncThunk(
  "destinations/removeFromSearchHistory",
  async (id: string) => {
    await searchHistoryService.removeSearchFromHistory(id);
    return await searchHistoryService.getSearchHistory();
  },
);

const destinationSlice = createSlice({
  name: "destinations",
  initialState,
  reducers: {
    // Synchronous actions
    setSavedDestinations: (state, action: PayloadAction<Destination[]>) => {
      state.saved = action.payload;
    },
    addSavedDestination: (state, action: PayloadAction<Destination>) => {
      // Check if destination already exists
      const existingIndex = state.saved.findIndex(
        (dest) => dest.id === action.payload.id,
      );
      if (existingIndex >= 0) {
        state.saved[existingIndex] = action.payload;
      } else {
        state.saved.push(action.payload);
      }
    },
    removeSavedDestination: (state, action: PayloadAction<string>) => {
      state.saved = state.saved.filter((dest) => dest.id !== action.payload);
    },
    updateDestinationLocal: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<Destination> }>,
    ) => {
      const index = state.saved.findIndex(
        (dest) => dest.id === action.payload.id,
      );
      if (index >= 0) {
        state.saved[index] = {
          ...state.saved[index],
          ...action.payload.updates,
        };
      }
    },
    setRecentDestinations: (state, action: PayloadAction<Destination[]>) => {
      state.recent = action.payload;
    },
    addRecentDestination: (state, action: PayloadAction<Destination>) => {
      // Remove if already exists to avoid duplicates
      state.recent = state.recent.filter(
        (dest) => dest.id !== action.payload.id,
      );
      // Add to beginning and keep only last 10
      state.recent.unshift(action.payload);
      state.recent = state.recent.slice(0, 10);
    },
    clearRecentDestinations: (state) => {
      state.recent = [];
    },
    setSearchHistory: (state, action: PayloadAction<SearchHistoryItem[]>) => {
      state.searchHistory = action.payload;
    },
    addToSearchHistoryLocal: (
      state,
      action: PayloadAction<SearchHistoryItem>,
    ) => {
      // Remove if already exists to avoid duplicates
      state.searchHistory = state.searchHistory.filter(
        (item) => item.id !== action.payload.id,
      );
      // Add to beginning and keep only last 20
      state.searchHistory.unshift(action.payload);
      state.searchHistory = state.searchHistory.slice(0, 20);
    },
    clearDestinationError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Load saved destinations
      .addCase(loadSavedDestinations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadSavedDestinations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.saved = action.payload;
        state.error = null;
      })
      .addCase(loadSavedDestinations.rejected, (state, action) => {
        state.isLoading = false;
        state.error =
          action.error.message || "Failed to load saved destinations";
      })
      // Save destination
      .addCase(saveDestination.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(saveDestination.fulfilled, (state, action) => {
        state.isLoading = false;
        state.saved.push(action.payload);
        state.error = null;
      })
      .addCase(saveDestination.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to save destination";
      })
      // Delete destination
      .addCase(deleteDestination.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteDestination.fulfilled, (state, action) => {
        state.isLoading = false;
        state.saved = state.saved.filter((dest) => dest.id !== action.payload);
        state.error = null;
      })
      .addCase(deleteDestination.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to delete destination";
      })
      // Update destination
      .addCase(updateDestination.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateDestination.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.saved.findIndex(
          (dest) => dest.id === action.payload.id,
        );
        if (index >= 0) {
          state.saved[index] = action.payload;
        }
        state.error = null;
      })
      .addCase(updateDestination.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to update destination";
      })
      // Search destinations
      .addCase(searchDestinations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchDestinations.fulfilled, (state, action) => {
        state.isLoading = false;
        // Store search results in a separate field or handle in UI
        state.error = null;
      })
      .addCase(searchDestinations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to search destinations";
      })
      // Load search history
      .addCase(loadSearchHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadSearchHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.searchHistory = action.payload;
        state.error = null;
      })
      .addCase(loadSearchHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to load search history";
      })
      // Add to search history
      .addCase(addToSearchHistory.fulfilled, (state, action) => {
        state.searchHistory = action.payload;
      })
      // Clear search history
      .addCase(clearSearchHistory.fulfilled, (state, action) => {
        state.searchHistory = action.payload;
      })
      // Remove from search history
      .addCase(removeFromSearchHistory.fulfilled, (state, action) => {
        state.searchHistory = action.payload;
      });
  },
});

export const {
  setSavedDestinations,
  addSavedDestination,
  removeSavedDestination,
  updateDestinationLocal,
  setRecentDestinations,
  addRecentDestination,
  clearRecentDestinations,
  setSearchHistory,
  addToSearchHistoryLocal,
  clearDestinationError,
} = destinationSlice.actions;

export default destinationSlice.reducer;

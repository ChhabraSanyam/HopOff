// Search history service for managing address search history
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AddressSearchResult, NominatimResult, SearchHistoryItem } from '../types';

export interface SearchHistoryService {
  addSearchToHistory(query: string, result: AddressSearchResult): Promise<void>;
  getSearchHistory(): Promise<SearchHistoryItem[]>;
  clearSearchHistory(): Promise<void>;
  removeSearchFromHistory(id: string): Promise<void>;
}

const SEARCH_HISTORY_KEY = 'address_search_history';
const MAX_HISTORY_ITEMS = 20; // Keep only the most recent 20 searches

export class SearchHistoryServiceImpl implements SearchHistoryService {
  /**
   * Add a search result to history
   */
  async addSearchToHistory(query: string, result: AddressSearchResult): Promise<void> {
    try {
      const currentHistory = await this.getSearchHistory();
      
      // Check if this exact query already exists
      const existingIndex = currentHistory.findIndex(
        item => item.query.toLowerCase() === query.toLowerCase()
      );
      
      // Create new history item
      const newItem: SearchHistoryItem = {
        id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        query: query.trim(),
        result: this.convertToNominatimResult(result),
        timestamp: new Date().toISOString(),
      };
      
      let updatedHistory: SearchHistoryItem[];
      
      if (existingIndex >= 0) {
        // Update existing item (move to top)
        updatedHistory = [newItem, ...currentHistory.filter((_, index) => index !== existingIndex)];
      } else {
        // Add new item to the beginning
        updatedHistory = [newItem, ...currentHistory];
      }
      
      // Keep only the most recent items
      if (updatedHistory.length > MAX_HISTORY_ITEMS) {
        updatedHistory = updatedHistory.slice(0, MAX_HISTORY_ITEMS);
      }
      
      await this.saveSearchHistory(updatedHistory);
    } catch (error) {
      console.error('Failed to add search to history:', error);
      // Don't throw error - search history is not critical functionality
    }
  }

  /**
   * Get search history sorted by most recent first
   */
  async getSearchHistory(): Promise<SearchHistoryItem[]> {
    try {
      const historyJson = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      
      if (!historyJson) {
        return [];
      }
      
      const history = JSON.parse(historyJson) as SearchHistoryItem[];
      
      // Validate and normalize timestamps
      const validatedHistory = history
        .map(item => ({
          ...item,
          timestamp: typeof item.timestamp === 'string' ? item.timestamp : new Date(item.timestamp).toISOString(),
        }))
        .filter(item => this.isValidHistoryItem(item))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Most recent first
      
      return validatedHistory;
    } catch (error) {
      console.error('Failed to get search history:', error);
      return [];
    }
  }

  /**
   * Clear all search history
   */
  async clearSearchHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear search history:', error);
      throw new Error('Failed to clear search history');
    }
  }

  /**
   * Remove a specific search from history
   */
  async removeSearchFromHistory(id: string): Promise<void> {
    try {
      const currentHistory = await this.getSearchHistory();
      const updatedHistory = currentHistory.filter(item => item.id !== id);
      await this.saveSearchHistory(updatedHistory);
    } catch (error) {
      console.error('Failed to remove search from history:', error);
      // Don't throw error - search history is not critical functionality
    }
  }

  /**
   * Save search history to secure storage
   */
  private async saveSearchHistory(history: SearchHistoryItem[]): Promise<void> {
    try {
      const historyJson = JSON.stringify(history);
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, historyJson);
    } catch (error) {
      console.error('Failed to save search history:', error);
      throw new Error('Failed to save search history');
    }
  }

  /**
   * Convert AddressSearchResult to NominatimResult format for storage
   */
  private convertToNominatimResult(result: AddressSearchResult): NominatimResult {
    return {
      place_id: parseInt(result.id.replace(/\D/g, '')) || 0, // Extract numbers from ID
      licence: 'OpenStreetMap',
      osm_type: 'node',
      osm_id: 0,
      boundingbox: [
        result.boundingBox.south.toString(),
        result.boundingBox.north.toString(),
        result.boundingBox.west.toString(),
        result.boundingBox.east.toString(),
      ],
      lat: result.coordinate.latitude.toString(),
      lon: result.coordinate.longitude.toString(),
      display_name: result.address,
      class: 'place',
      type: result.type,
      importance: result.importance,
    };
  }

  /**
   * Validate history item structure
   */
  private isValidHistoryItem(item: any): item is SearchHistoryItem {
    if (!item) {
      return false;
    }
    
    if (typeof item.id !== 'string' || typeof item.query !== 'string') {
      return false;
    }
    
    if (!item.result) {
      return false;
    }
    
    if (typeof item.result.lat !== 'string' || 
        typeof item.result.lon !== 'string' || 
        typeof item.result.display_name !== 'string') {
      return false;
    }
    
    if (typeof item.timestamp !== 'string' || isNaN(new Date(item.timestamp).getTime())) {
      return false;
    }
    
    return true;
  }
}

// Export singleton instance
export const searchHistoryService = new SearchHistoryServiceImpl();
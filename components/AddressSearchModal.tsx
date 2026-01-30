import React, { useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppDispatch, useSearchHistory } from '../store/hooks';
import { addToSearchHistory, loadSearchHistory } from '../store/slices/destinationSlice';
import { AddressSearchResult, Destination } from '../types';
import AddressSearchComponent from './AddressSearchComponent';

interface AddressSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAddress: (destination: Destination) => void;
}

const AddressSearchModal: React.FC<AddressSearchModalProps> = ({
  visible,
  onClose,
  onSelectAddress,
}) => {
  const dispatch = useAppDispatch();
  const searchHistory = useSearchHistory();

  // Load search history when modal opens
  useEffect(() => {
    if (visible) {
      dispatch(loadSearchHistory());
    }
  }, [visible, dispatch]);

  const handleSelectResult = (result: AddressSearchResult) => {
    // Convert AddressSearchResult to Destination
    const destination: Destination = {
      id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: result.displayName,
      coordinate: result.coordinate,
      address: result.address,
      createdAt: new Date().toISOString(),
    };

    // Close modal first
    onClose();
    
    // Call parent callback
    onSelectAddress(destination);
  };

  const handleAddToHistory = async (query: string, result: AddressSearchResult) => {
    try {
      await dispatch(addToSearchHistory({ query, result })).unwrap();
    } catch (error) {
      console.error('Failed to add to search history:', error);
      // Don't show error to user - search history is not critical
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <AddressSearchComponent
            onSelectResult={handleSelectResult}
            onClose={onClose}
            placeholder="Search for an address or place..."
            searchHistory={searchHistory}
            onAddToHistory={handleAddToHistory}
            showHistory={true}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  content: {
    flex: 1,
  },
});

export default AddressSearchModal;
// Battery optimization settings component
import React from 'react';
import { View, Text, Switch, StyleSheet, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useBatteryOptimization } from '../hooks/useBatteryOptimization';

interface BatteryOptimizationSettingsProps {
  style?: any;
}

export const BatteryOptimizationSettings: React.FC<BatteryOptimizationSettingsProps> = ({ style }) => {
  const {
    batteryLevel,
    batteryState,
    isOptimizing,
    optimizationLevel,
    batteryOptimizationEnabled,
    batteryOptimizationLevel,
    lowBatteryThreshold,
    criticalBatteryThreshold,
    adaptiveLocationAccuracy,
    backgroundProcessingOptimization,
    setBatteryOptimizationEnabled,
    setBatteryOptimizationLevel,
    setLowBatteryThreshold,
    setCriticalBatteryThreshold,
    setAdaptiveLocationAccuracy,
    setBackgroundProcessingOptimization,
    recommendations,
  } = useBatteryOptimization();

  const handleOptimizationLevelChange = (level: 'auto' | 'conservative' | 'aggressive' | 'disabled') => {
    setBatteryOptimizationLevel(level);
    
    if (level === 'disabled') {
      Alert.alert(
        'Battery Optimization Disabled',
        'Disabling battery optimization may significantly reduce battery life during long journeys. Are you sure?',
        [
          { text: 'Cancel', onPress: () => setBatteryOptimizationLevel('auto') },
          { text: 'Disable', style: 'destructive' },
        ]
      );
    }
  };

  const formatBatteryLevel = (level: number | null): string => {
    if (level === null) return 'Unknown';
    return `${Math.round(level * 100)}%`;
  };

  const formatThreshold = (threshold: number): string => {
    return `${Math.round(threshold * 100)}%`;
  };

  const getOptimizationLevelDescription = (level: string): string => {
    switch (level) {
      case 'auto':
        return 'Automatically adjusts based on battery level';
      case 'conservative':
        return 'Light optimization to preserve battery';
      case 'aggressive':
        return 'Maximum optimization for extended battery life';
      case 'disabled':
        return 'No battery optimization (not recommended)';
      default:
        return '';
    }
  };

  const getOptimizationStatusColor = (level: string): string => {
    switch (level) {
      case 'none':
        return '#4CAF50'; // Green
      case 'light':
        return '#FF9800'; // Orange
      case 'moderate':
        return '#FF5722'; // Deep Orange
      case 'maximum':
        return '#F44336'; // Red
      default:
        return '#757575'; // Grey
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.sectionTitle}>Battery Optimization</Text>
      
      {/* Current Battery Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>Current Status</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Battery Level:</Text>
          <Text style={styles.statusValue}>{formatBatteryLevel(batteryLevel)}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Battery State:</Text>
          <Text style={styles.statusValue}>{batteryState}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Optimization:</Text>
          <Text style={[styles.statusValue, { color: getOptimizationStatusColor(optimizationLevel) }]}>
            {isOptimizing ? `Active (${optimizationLevel})` : 'Inactive'}
          </Text>
        </View>
      </View>

      {/* Enable/Disable Battery Optimization */}
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Enable Battery Optimization</Text>
          <Text style={styles.settingDescription}>
            Automatically adjust location accuracy and update frequency to preserve battery life
          </Text>
        </View>
        <Switch
          value={batteryOptimizationEnabled}
          onValueChange={setBatteryOptimizationEnabled}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={batteryOptimizationEnabled ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>

      {batteryOptimizationEnabled && (
        <>
          {/* Optimization Level */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Optimization Level</Text>
              <Text style={styles.settingDescription}>
                {getOptimizationLevelDescription(batteryOptimizationLevel)}
              </Text>
            </View>
          </View>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={batteryOptimizationLevel}
              onValueChange={handleOptimizationLevelChange}
              style={styles.picker}
            >
              <Picker.Item label="Auto (Recommended)" value="auto" />
              <Picker.Item label="Conservative" value="conservative" />
              <Picker.Item label="Aggressive" value="aggressive" />
              <Picker.Item label="Disabled" value="disabled" />
            </Picker>
          </View>

          {/* Low Battery Threshold */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Low Battery Threshold</Text>
              <Text style={styles.settingDescription}>
                Start optimizing when battery drops below {formatThreshold(lowBatteryThreshold)}
              </Text>
            </View>
          </View>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={lowBatteryThreshold}
              onValueChange={setLowBatteryThreshold}
              style={styles.picker}
            >
              <Picker.Item label="20%" value={0.20} />
              <Picker.Item label="30%" value={0.30} />
              <Picker.Item label="40%" value={0.40} />
              <Picker.Item label="50%" value={0.50} />
            </Picker>
          </View>

          {/* Critical Battery Threshold */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Critical Battery Threshold</Text>
              <Text style={styles.settingDescription}>
                Maximum optimization when battery drops below {formatThreshold(criticalBatteryThreshold)}
              </Text>
            </View>
          </View>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={criticalBatteryThreshold}
              onValueChange={setCriticalBatteryThreshold}
              style={styles.picker}
            >
              <Picker.Item label="10%" value={0.10} />
              <Picker.Item label="15%" value={0.15} />
              <Picker.Item label="20%" value={0.20} />
              <Picker.Item label="25%" value={0.25} />
            </Picker>
          </View>

          {/* Adaptive Location Accuracy */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Adaptive Location Accuracy</Text>
              <Text style={styles.settingDescription}>
                Reduce GPS accuracy when battery is low to save power
              </Text>
            </View>
            <Switch
              value={adaptiveLocationAccuracy}
              onValueChange={setAdaptiveLocationAccuracy}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={adaptiveLocationAccuracy ? '#f5dd4b' : '#f4f3f4'}
            />
          </View>

          {/* Background Processing Optimization */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Background Processing Optimization</Text>
              <Text style={styles.settingDescription}>
                Reduce background processing when battery is low
              </Text>
            </View>
            <Switch
              value={backgroundProcessingOptimization}
              onValueChange={setBackgroundProcessingOptimization}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={backgroundProcessingOptimization ? '#f5dd4b' : '#f4f3f4'}
            />
          </View>
        </>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <View style={styles.recommendationsContainer}>
          <Text style={styles.recommendationsTitle}>Recommendations</Text>
          {recommendations.map((rec, index) => (
            <View key={index} style={[styles.recommendationItem, { borderLeftColor: getRecommendationColor(rec.type) }]}>
              <Text style={styles.recommendationTitle}>{rec.title}</Text>
              <Text style={styles.recommendationMessage}>{rec.message}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const getRecommendationColor = (type: string): string => {
  switch (type) {
    case 'warning':
      return '#FF5722';
    case 'suggestion':
      return '#FF9800';
    case 'info':
      return '#2196F3';
    default:
      return '#757575';
  }
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  statusContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  pickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  picker: {
    height: 50,
  },
  recommendationsContainer: {
    marginTop: 16,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  recommendationItem: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    marginBottom: 8,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  recommendationMessage: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
});
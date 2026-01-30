// Battery status indicator component
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useBatteryOptimization } from '../hooks/useBatteryOptimization';

interface BatteryStatusIndicatorProps {
  style?: any;
  onPress?: () => void;
  showDetails?: boolean;
  compact?: boolean;
}

export const BatteryStatusIndicator: React.FC<BatteryStatusIndicatorProps> = ({ 
  style, 
  onPress, 
  showDetails = false,
  compact = false 
}) => {
  const {
    batteryLevel,
    batteryState,
    isOptimizing,
    optimizationLevel,
    batteryOptimizationEnabled,
  } = useBatteryOptimization();

  const formatBatteryLevel = (level: number | null): string => {
    if (level === null) return '?';
    return `${Math.round(level * 100)}%`;
  };

  const getBatteryColor = (level: number | null): string => {
    if (level === null) return '#757575';
    if (level <= 0.15) return '#F44336'; // Red
    if (level <= 0.30) return '#FF9800'; // Orange
    if (level <= 0.50) return '#FFC107'; // Amber
    return '#4CAF50'; // Green
  };

  const getBatteryIcon = (level: number | null, state: string): string => {
    if (state === 'charging') return '🔌';
    if (level === null) return '🔋';
    if (level <= 0.15) return '🪫';
    if (level <= 0.30) return '🔋';
    if (level <= 0.70) return '🔋';
    return '🔋';
  };

  const getOptimizationIcon = (isOptimizing: boolean, level: string): string => {
    if (!isOptimizing) return '';
    switch (level) {
      case 'light': return '⚡';
      case 'moderate': return '⚡⚡';
      case 'maximum': return '⚡⚡⚡';
      default: return '⚡';
    }
  };

  if (compact) {
    return (
      <TouchableOpacity 
        style={[styles.compactContainer, style]} 
        onPress={onPress}
        disabled={!onPress}
      >
        <Text style={styles.batteryIcon}>
          {getBatteryIcon(batteryLevel, batteryState)}
        </Text>
        <Text style={[styles.compactLevel, { color: getBatteryColor(batteryLevel) }]}>
          {formatBatteryLevel(batteryLevel)}
        </Text>
        {isOptimizing && (
          <Text style={styles.optimizationIcon}>
            {getOptimizationIcon(isOptimizing, optimizationLevel)}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={[styles.container, style]} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <View style={styles.batteryInfo}>
          <Text style={styles.batteryIcon}>
            {getBatteryIcon(batteryLevel, batteryState)}
          </Text>
          <Text style={[styles.batteryLevel, { color: getBatteryColor(batteryLevel) }]}>
            {formatBatteryLevel(batteryLevel)}
          </Text>
        </View>
        
        {isOptimizing && (
          <View style={styles.optimizationBadge}>
            <Text style={styles.optimizationIcon}>
              {getOptimizationIcon(isOptimizing, optimizationLevel)}
            </Text>
            <Text style={styles.optimizationText}>
              {optimizationLevel.toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {showDetails && (
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>State:</Text>
            <Text style={styles.detailValue}>{batteryState}</Text>
          </View>
          
          {batteryOptimizationEnabled && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Optimization:</Text>
              <Text style={styles.detailValue}>
                {isOptimizing ? `Active (${optimizationLevel})` : 'Inactive'}
              </Text>
            </View>
          )}
          
          {!batteryOptimizationEnabled && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Optimization:</Text>
              <Text style={[styles.detailValue, styles.disabledText]}>Disabled</Text>
            </View>
          )}
        </View>
      )}

      {/* Battery level indicator bar */}
      <View style={styles.batteryBar}>
        <View 
          style={[
            styles.batteryFill, 
            { 
              width: `${(batteryLevel || 0) * 100}%`,
              backgroundColor: getBatteryColor(batteryLevel)
            }
          ]} 
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  batteryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  batteryLevel: {
    fontSize: 18,
    fontWeight: '600',
  },
  compactLevel: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  optimizationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  optimizationIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  optimizationText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FF9800',
  },
  details: {
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  disabledText: {
    color: '#999',
    fontStyle: 'italic',
  },
  batteryBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  batteryFill: {
    height: '100%',
    borderRadius: 2,
  },
});
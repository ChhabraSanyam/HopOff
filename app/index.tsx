import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Index() {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const onboardingStatus = await AsyncStorage.getItem('hasCompletedOnboarding');
      setIsOnboardingComplete(onboardingStatus === 'true');
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setError('Failed to check onboarding status');
      // Default to showing onboarding if we can't determine the status
      setIsOnboardingComplete(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking onboarding status
  if (isLoading) {
    return (
      <SafeAreaView style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#F8F9FA'
      }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ 
          marginTop: 16, 
          fontSize: 16, 
          color: '#8E8E93',
          textAlign: 'center'
        }}>
          Loading HopOff...
        </Text>
      </SafeAreaView>
    );
  }

  // Show error state if needed
  if (error) {
    return (
      <SafeAreaView style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        paddingHorizontal: 32
      }}>
        <Text style={{ 
          fontSize: 18, 
          color: '#FF3B30',
          textAlign: 'center',
          marginBottom: 16
        }}>
          {error}
        </Text>
        <Text style={{ 
          fontSize: 14, 
          color: '#8E8E93',
          textAlign: 'center'
        }}>
          Continuing to onboarding...
        </Text>
      </SafeAreaView>
    );
  }

  // Redirect based on onboarding status
  if (isOnboardingComplete) {
    return <Redirect href="/(tabs)" />;
  } else {
    return <Redirect href="/(onboarding)" />;
  }
}

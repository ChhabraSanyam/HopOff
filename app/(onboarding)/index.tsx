import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useAppDispatch } from "../../store/hooks";
import { requestLocationPermission } from "../../store/slices/locationSlice";
import { requestNotificationPermission } from "../../store/slices/uiSlice";

const { width } = Dimensions.get("window");

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  action?: () => Promise<void>;
  actionText?: string;
}

const OnboardingScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const scrollViewRef = useRef<ScrollView>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const handleLocationPermission = async () => {
    try {
      setIsLoading(true);
      const status = await dispatch(requestLocationPermission()).unwrap();

      if (status === "granted") {
        setCompletedSteps((prev) => new Set([...prev, 1]));
      } else {
        Alert.alert(
          "Permission Error",
          "Failed to request location permission. Please enable it in your device settings.",
          [{ text: "OK" }],
        );
      }
    } catch {
      Alert.alert(
        "Permission Required",
        "Location permission is required for HopOff to work properly. Please enable it to continue.",
        [{ text: "OK" }],
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationPermission = async () => {
    try {
      setIsLoading(true);
      const status = await dispatch(requestNotificationPermission()).unwrap();

      if (status === "granted") {
        setCompletedSteps((prev) => new Set([...prev, 2]));
      } else {
        Alert.alert(
          "Permission Required",
          "Notifications help ensure you never miss your stop. Please enable them to continue.",
          [{ text: "OK" }],
        );
      }
    } catch {
      Alert.alert(
        "Permission Error",
        "Failed to request notification permission. Please enable it in your device settings.",
        [{ text: "OK" }],
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onboardingSteps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Welcome to HopOff!",
      description:
        "Never miss your stop again! HopOff monitors your location and alerts you when you're approaching your destination.",
      icon: "location",
      color: "#007AFF",
    },
    {
      id: "location",
      title: "Location Permission",
      description:
        "We need access to your location to monitor your journey and trigger alarms when you approach your destination. Your location data stays on your device.",
      icon: "navigate",
      color: "#34C759",
      action: handleLocationPermission,
      actionText: "Enable Location",
    },
    {
      id: "notifications",
      title: "Notification Permission",
      description:
        "Allow notifications so we can alert you when you're near your stop, even when the app is in the background.",
      icon: "notifications",
      color: "#FF9500",
      action: handleNotificationPermission,
      actionText: "Enable Notifications",
    },
    {
      id: "features",
      title: "Key Features",
      description:
        "• Set destination alarms with custom trigger distances\n• Save favorite destinations for quick access\n• Battery-optimized background monitoring\n• Works offline with GPS",
      icon: "checkmark-circle",
      color: "#30D158",
    },
    {
      id: "ready",
      title: "You're All Set!",
      description:
        "Start by selecting a destination on the map. HopOff will monitor your location and alert you when you're getting close.",
      icon: "rocket",
      color: "#FF6B6B",
    },
  ];

  const handleNext = () => {
    // Check if current step requires an action to be completed
    const currentStepData = onboardingSteps[currentStep];
    if (currentStepData.action && !completedSteps.has(currentStep)) {
      Alert.alert(
        "Permission Required",
        "Please complete this step before continuing.",
        [{ text: "OK" }],
      );
      return;
    }

    if (currentStep < onboardingSteps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      scrollViewRef.current?.scrollTo({
        x: nextStep * width,
        animated: true,
      });
    } else {
      handleFinish();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      scrollViewRef.current?.scrollTo({
        x: prevStep * width,
        animated: true,
      });
    }
  };

  const handleFinish = async () => {
    try {
      // Mark onboarding as completed
      await AsyncStorage.setItem("hasCompletedOnboarding", "true");
      router.replace("/(tabs)");
    } catch (error) {
      console.error("Error saving onboarding status:", error);
      // Still navigate even if we can't save the status
      router.replace("/(tabs)");
    }
  };

  const handleSkip = () => {
    Alert.alert(
      "Skip Onboarding",
      "Are you sure you want to skip the setup? You can configure permissions later in settings.",
      [
        { text: "Continue Setup", style: "cancel" },
        { text: "Skip", style: "destructive", onPress: handleFinish },
      ],
    );
  };

  const renderStep = (step: OnboardingStep, index: number) => (
    <View key={step.id} style={styles.stepContainer}>
      <View style={styles.stepContent}>
        <View style={[styles.iconContainer, { backgroundColor: step.color }]}>
          <Ionicons name={step.icon} size={48} color="#FFFFFF" />
        </View>

        <Text style={styles.stepTitle}>{step.title}</Text>
        <Text style={styles.stepDescription}>{step.description}</Text>

        {step.action && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: step.color }]}
            onPress={step.action}
            disabled={isLoading || completedSteps.has(index)}
          >
            {isLoading ? (
              <LoadingSpinner size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name={
                    completedSteps.has(index) ? "checkmark" : "arrow-forward"
                  }
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.actionButtonText}>
                  {completedSteps.has(index) ? "Completed" : step.actionText}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>

        <View style={styles.progressContainer}>
          {onboardingSteps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === currentStep && styles.progressDotActive,
                index < currentStep && styles.progressDotCompleted,
              ]}
            />
          ))}
        </View>

        <View style={styles.placeholder} />
      </View>

      {/* Steps */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={styles.scrollView}
      >
        {onboardingSteps.map(renderStep)}
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navigation}>
        <TouchableOpacity
          style={[
            styles.navButton,
            currentStep === 0 && styles.navButtonDisabled,
          ]}
          onPress={handlePrevious}
          disabled={currentStep === 0}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={currentStep === 0 ? "#C7C7CC" : "#007AFF"}
          />
          <Text
            style={[
              styles.navButtonText,
              currentStep === 0 && styles.navButtonTextDisabled,
            ]}
          >
            Previous
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.nextButton,
            onboardingSteps[currentStep].action &&
              !completedSteps.has(currentStep) &&
              styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={
            onboardingSteps[currentStep].action &&
            !completedSteps.has(currentStep)
          }
        >
          <Text
            style={[
              styles.nextButtonText,
              onboardingSteps[currentStep].action &&
                !completedSteps.has(currentStep) &&
                styles.nextButtonTextDisabled,
            ]}
          >
            {currentStep === onboardingSteps.length - 1
              ? "Get Started"
              : "Next"}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={24}
            color={
              onboardingSteps[currentStep].action &&
              !completedSteps.has(currentStep)
                ? "#C7C7CC"
                : "#FFFFFF"
            }
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  skipButton: {
    padding: 8,
  },
  skipButtonText: {
    fontSize: 16,
    color: "#8E8E93",
    fontWeight: "500",
  },
  progressContainer: {
    flexDirection: "row",
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E5E7",
  },
  progressDotActive: {
    backgroundColor: "#007AFF",
    width: 24,
  },
  progressDotCompleted: {
    backgroundColor: "#34C759",
  },
  placeholder: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  stepContainer: {
    width,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  stepContent: {
    alignItems: "center",
    maxWidth: 320,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1C1C1E",
    textAlign: "center",
    marginBottom: 16,
  },
  stepDescription: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E5E7",
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "500",
    marginLeft: 4,
  },
  navButtonTextDisabled: {
    color: "#C7C7CC",
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  nextButtonDisabled: {
    backgroundColor: "#C7C7CC",
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 4,
  },
  nextButtonTextDisabled: {
    color: "#F8F9FA",
  },
});

export default OnboardingScreen;

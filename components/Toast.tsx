import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity } from "react-native";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onHide: () => void;
  position?: "top" | "bottom";
}

const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type = "info",
  duration = 3000,
  onHide,
  position = "top",
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  }, [slideAnim, opacityAnim, onHide]);

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible, duration, hideToast, slideAnim, opacityAnim]);

  const getToastStyle = () => {
    switch (type) {
      case "success":
        return styles.success;
      case "error":
        return styles.error;
      case "warning":
        return styles.warning;
      case "info":
      default:
        return styles.info;
    }
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return "checkmark-circle";
      case "error":
        return "close-circle";
      case "warning":
        return "warning";
      case "info":
      default:
        return "information-circle";
    }
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: position === "top" ? [-100, 0] : [100, 0],
  });

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        position === "top" ? styles.topPosition : styles.bottomPosition,
        {
          transform: [{ translateY }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.toast, getToastStyle()]}
        onPress={hideToast}
        activeOpacity={0.9}
      >
        <Ionicons name={getIcon()} size={24} color="#FFFFFF" />
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  topPosition: {
    top: 60,
  },
  bottomPosition: {
    bottom: 100,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  success: {
    backgroundColor: "#34C759",
  },
  error: {
    backgroundColor: "#FF3B30",
  },
  warning: {
    backgroundColor: "#FF9500",
  },
  info: {
    backgroundColor: "#007AFF",
  },
  message: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 12,
    marginRight: 8,
  },
  closeButton: {
    padding: 4,
  },
});

export default Toast;

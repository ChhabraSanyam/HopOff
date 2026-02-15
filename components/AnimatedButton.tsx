import React, { useRef } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
  TextStyle,
  GestureResponderEvent,
} from "react-native";

interface AnimatedButtonProps {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
  size?: "small" | "medium" | "large";
}

const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  title,
  onPress,
  style,
  textStyle,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "medium",
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const getButtonStyle = () => {
    const baseStyle: ViewStyle[] = [styles.button, styles[size]];

    switch (variant) {
      case "primary":
        baseStyle.push(styles.primary);
        break;
      case "secondary":
        baseStyle.push(styles.secondary);
        break;
      case "danger":
        baseStyle.push(styles.danger);
        break;
    }

    if (disabled || loading) {
      baseStyle.push(styles.disabled);
    }

    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle: TextStyle[] = [
      styles.text,
      styles[`${size}Text` as keyof typeof styles] as TextStyle,
    ];

    switch (variant) {
      case "primary":
        baseStyle.push(styles.primaryText);
        break;
      case "secondary":
        baseStyle.push(styles.secondaryText);
        break;
      case "danger":
        baseStyle.push(styles.dangerText);
        break;
    }

    if (disabled || loading) {
      baseStyle.push(styles.disabledText);
    }

    return baseStyle;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          getButtonStyle(),
          style,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <Text style={[getTextStyle(), textStyle]}>
          {loading ? "Loading..." : title}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  small: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  medium: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  large: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  primary: {
    backgroundColor: "#007AFF",
  },
  secondary: {
    backgroundColor: "#F2F2F7",
    borderWidth: 1,
    borderColor: "#C7C7CC",
  },
  danger: {
    backgroundColor: "#FF3B30",
  },
  disabled: {
    backgroundColor: "#E5E5E7",
    borderColor: "#E5E5E7",
  },
  text: {
    fontWeight: "600",
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
  primaryText: {
    color: "#FFFFFF",
  },
  secondaryText: {
    color: "#007AFF",
  },
  dangerText: {
    color: "#FFFFFF",
  },
  disabledText: {
    color: "#8E8E93",
  },
});

export default AnimatedButton;

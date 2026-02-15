import React, { useRef, useEffect } from "react";
import { Animated, ViewStyle, Dimensions } from "react-native";

const { height: screenHeight } = Dimensions.get("window");

interface SlideInViewProps {
  children: React.ReactNode;
  direction?: "up" | "down" | "left" | "right";
  duration?: number;
  delay?: number;
  style?: ViewStyle;
  distance?: number;
}

const SlideInView: React.FC<SlideInViewProps> = ({
  children,
  direction = "up",
  duration = 300,
  delay = 0,
  style,
  distance,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;

  const getInitialOffset = () => {
    const defaultDistance = distance || screenHeight * 0.1;

    switch (direction) {
      case "up":
        return defaultDistance;
      case "down":
        return -defaultDistance;
      case "left":
        return defaultDistance;
      case "right":
        return -defaultDistance;
      default:
        return defaultDistance;
    }
  };

  const getTransform = () => {
    const offset = slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [getInitialOffset(), 0],
    });

    if (direction === "left" || direction === "right") {
      return [{ translateX: offset }];
    } else {
      return [{ translateY: offset }];
    }
  };

  useEffect(() => {
    slideAnim.setValue(0);

    const timer = setTimeout(() => {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [slideAnim, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: getTransform(),
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

export default SlideInView;

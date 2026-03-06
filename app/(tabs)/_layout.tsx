import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BRAND = "#b9221d";

/** Animated glow ring: one-shot burst on press, then static */
function GlowRing({ focused }: { focused: boolean }) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (focused) {
      // Burst out, then settle to a static glow — no loop
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.5, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1.0, duration: 200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.05, duration: 400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.42, duration: 400, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.8, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [focused]);

  return (
    <Animated.View
      style={[styles.glowRing, { opacity, transform: [{ scale }] }]}
    />
  );
}

/** Tab icon with animated glow halo */
function TabIcon({
  name,
  focused,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  focused: boolean;
}) {
  return (
    <View style={styles.section}>
      <GlowRing focused={focused} />
      <View style={[styles.iconCircle, focused && styles.iconCircleFocused]}>
        <Ionicons name={name} size={22} color={focused ? "#fff" : BRAND} />
      </View>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const extraPad = 8;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BRAND,
        tabBarInactiveTintColor: BRAND,
        tabBarStyle: {
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          paddingBottom: insets.bottom + extraPad,
          paddingTop: 8,
          height: 68 + insets.bottom + extraPad,
          position: "absolute",
        },
        tabBarBackground: () => <View style={styles.iconRow} />,
        headerShown: false,
        tabBarShowLabel: false,
        tabBarButton: ({ ref, ...props }) => (
          <Pressable
            {...props}
            onPress={(e) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              props.onPress?.(e);
            }}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Map",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "map" : "map-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="alarm"
        options={{
          title: "Alarm",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "alarm" : "alarm-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="destinations"
        options={{
          title: "Saved",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "bookmark" : "bookmark-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "settings" : "settings-outline"} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconRow: {
    position: "absolute",
    top: -3,
    bottom: 39,
    left: 20,
    right: 20,
    borderRadius: 29,
    backgroundColor: "rgba(120, 120, 120, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(180, 180, 180, 0.6)",
    overflow: "hidden",
  },
  section: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  glowRing: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 54,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 92,
    elevation: 20,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  iconCircleFocused: {
    backgroundColor: BRAND,
    shadowColor: BRAND,
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 6,
  },
});

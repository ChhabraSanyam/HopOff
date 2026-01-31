// Notification management service for HopOff app
import * as Notifications from "expo-notifications";
import { Platform, Vibration } from "react-native";
import { Alarm } from "../types";
// import { MetroLine, MetroStation } from "../metro/types/metro";

export interface AlarmDistanceInfo {
  alarm: Alarm;
  distance: number;
}

export interface NotificationManager {
  requestPermissions(): Promise<boolean>;
  showAlarmNotification(alarm: Alarm): Promise<void>;
  showPersistentNotification(alarm: Alarm, distance: number): Promise<void>;
  showMultipleAlarmsPersistentNotification(
    alarms: AlarmDistanceInfo[],
  ): Promise<void>;
  clearNotifications(): Promise<void>;
  triggerHapticFeedback(): Promise<void>;
  // // Metro-specific notifications
  // showIntermediateStopNotification(
  //   station: MetroStation,
  //   destination: MetroStation,
  //   message: string,
  // ): Promise<void>;
  // showTransferNotification(
  //   station: MetroStation,
  //   fromLine: MetroLine,
  //   toLine: MetroLine,
  //   message: string,
  // ): Promise<void>;
  // showMetroRouteNotification(
  //   route: any,
  //   currentDistance: number,
  // ): Promise<void>;
}

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationManagerImpl implements NotificationManager {
  private static readonly ALARM_NOTIFICATION_ID = "hop-off-alarm";
  private static readonly PERSISTENT_NOTIFICATION_ID = "hop-off-persistent";
  private static readonly INTERMEDIATE_NOTIFICATION_ID = "hop-off-intermediate";
  private static readonly TRANSFER_NOTIFICATION_ID = "hop-off-transfer";
  private static readonly METRO_ROUTE_NOTIFICATION_ID = "hop-off-metro-route";
  private static readonly ALARM_CHANNEL_ID = "hop-off-alarms";
  private static readonly PERSISTENT_CHANNEL_ID = "hop-off-persistent";
  private static readonly METRO_CHANNEL_ID = "hop-off-metro";

  private isInitialized = false;

  constructor() {
    this.initializeNotificationChannels();
  }

  private async initializeNotificationChannels(): Promise<void> {
    if (this.isInitialized) return;

    if (Platform.OS === "android") {
      // Create notification channels for Android
      await Notifications.setNotificationChannelAsync(
        NotificationManagerImpl.ALARM_CHANNEL_ID,
        {
          name: "Destination Alarms",
          description: "Notifications when you reach your destination",
          importance: Notifications.AndroidImportance.MAX,
          sound: "default",
          enableLights: true,
          lightColor: "#FF0000",
          enableVibrate: true,
          bypassDnd: true, // Bypass Do Not Disturb mode
        },
      );

      await Notifications.setNotificationChannelAsync(
        NotificationManagerImpl.PERSISTENT_CHANNEL_ID,
        {
          name: "Trip Progress",
          description: "Ongoing trip information and distance updates",
          importance: Notifications.AndroidImportance.LOW,
          sound: null,
          vibrationPattern: null,
          enableLights: false,
          enableVibrate: false,
        },
      );

      await Notifications.setNotificationChannelAsync(
        NotificationManagerImpl.METRO_CHANNEL_ID,
        {
          name: "Metro Alerts",
          description:
            "Metro-specific notifications for transfers and intermediate stops",
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: "default",
          vibrationPattern: [0, 200, 100, 200],
          enableLights: true,
          lightColor: "#0066CC",
          enableVibrate: true,
        },
      );
    }

    this.isInitialized = true;
  }

  async requestPermissions(): Promise<boolean> {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === "granted";
  }

  async showAlarmNotification(alarm: Alarm): Promise<void> {
    await this.initializeNotificationChannels();

    const notificationContent: Notifications.NotificationContentInput = {
      title: "HopOff! - Destination Reached",
      body: `You're approaching ${alarm.destination.name}. Time to get ready!`,
      data: {
        alarmId: alarm.id,
        destinationId: alarm.destination.id,
        type: "alarm",
      },
      sound: alarm.settings.vibrationEnabled ? "default" : false,
      categoryIdentifier: "alarm",
    };

    // Add Android-specific properties
    const androidContent = notificationContent as any;
    if (Platform.OS === "android") {
      androidContent.channelId = NotificationManagerImpl.ALARM_CHANNEL_ID;
      androidContent.priority = "max";
    }

    // Schedule the notification
    await Notifications.scheduleNotificationAsync({
      identifier: NotificationManagerImpl.ALARM_NOTIFICATION_ID,
      content: notificationContent,
      trigger: null, // Show immediately
    });

    // Trigger haptic feedback if enabled
    if (alarm.settings.vibrationEnabled) {
      await this.triggerHapticFeedback();
    }
  }

  async showPersistentNotification(
    alarm: Alarm,
    distance: number,
  ): Promise<void> {
    await this.initializeNotificationChannels();

    const distanceText =
      distance >= 1000
        ? `${(distance / 1000).toFixed(1)} km`
        : `${Math.round(distance)} m`;

    const notificationContent: Notifications.NotificationContentInput = {
      title: "HopOff! - Trip Active",
      body: `${distanceText} to ${alarm.destination.name}`,
      data: {
        alarmId: alarm.id,
        destinationId: alarm.destination.id,
        distance,
        type: "persistent",
      },
      sound: false, // No sound for persistent notifications
      sticky: true, // Keep notification visible
      categoryIdentifier: "persistent",
    };

    // Add Android-specific properties
    const androidContent = notificationContent as any;
    if (Platform.OS === "android") {
      androidContent.channelId = NotificationManagerImpl.PERSISTENT_CHANNEL_ID;
      androidContent.priority = "low";
    }

    await Notifications.scheduleNotificationAsync({
      identifier: NotificationManagerImpl.PERSISTENT_NOTIFICATION_ID,
      content: notificationContent,
      trigger: null,
    });
  }

  async showMultipleAlarmsPersistentNotification(
    alarms: AlarmDistanceInfo[],
  ): Promise<void> {
    await this.initializeNotificationChannels();

    if (alarms.length === 0) {
      // No alarms, clear persistent notification
      await Notifications.dismissNotificationAsync(
        NotificationManagerImpl.PERSISTENT_NOTIFICATION_ID,
      );
      return;
    }

    if (alarms.length === 1) {
      // Single alarm, use the original method
      await this.showPersistentNotification(
        alarms[0].alarm,
        alarms[0].distance,
      );
      return;
    }

    // Multiple alarms - show summary notification
    // Sort by distance (closest first)
    const sortedAlarms = [...alarms].sort((a, b) => a.distance - b.distance);
    const closest = sortedAlarms[0];

    const closestDistanceText =
      closest.distance >= 1000
        ? `${(closest.distance / 1000).toFixed(1)} km`
        : `${Math.round(closest.distance)} m`;

    // Create body with all alarm distances
    const alarmsList = sortedAlarms
      .map((info) => {
        const dist =
          info.distance >= 1000
            ? `${(info.distance / 1000).toFixed(1)} km`
            : `${Math.round(info.distance)} m`;
        return `• ${dist} to ${info.alarm.destination.name}`;
      })
      .join("\n");

    const notificationContent: Notifications.NotificationContentInput = {
      title: `HopOff! - ${alarms.length} Active Trips`,
      body: `Closest: ${closestDistanceText} to ${closest.alarm.destination.name}\n${alarmsList}`,
      data: {
        alarmCount: alarms.length,
        closestAlarmId: closest.alarm.id,
        type: "persistent-multiple",
      },
      sound: false,
      sticky: true,
      categoryIdentifier: "persistent",
    };

    // Add Android-specific properties
    const androidContent = notificationContent as any;
    if (Platform.OS === "android") {
      androidContent.channelId = NotificationManagerImpl.PERSISTENT_CHANNEL_ID;
      androidContent.priority = "low";
    }

    await Notifications.scheduleNotificationAsync({
      identifier: NotificationManagerImpl.PERSISTENT_NOTIFICATION_ID,
      content: notificationContent,
      trigger: null,
    });
  }

  async clearNotifications(): Promise<void> {
    // Cancel all scheduled notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Dismiss all presented notifications
    await Notifications.dismissAllNotificationsAsync();
  }

  async triggerHapticFeedback(): Promise<void> {
    try {
      // Use strong vibration pattern for alarm alert
      const PATTERN = [0, 300, 100, 200];

      if (Platform.OS === "android") {
        // Android: Use the vibration pattern
        Vibration.vibrate(PATTERN);
      } else {
        // iOS: Vibration.vibrate() ignores pattern, use repeated single vibrations
        // iOS vibration is fixed duration, so we repeat it
        Vibration.vibrate();
        setTimeout(() => Vibration.vibrate(), 200);
      }
    } catch (error) {
      console.warn("Haptic feedback not available:", error);
      // Don't throw error - haptic feedback is optional
    }
  }

  //   async showIntermediateStopNotification(
  //     station: MetroStation,
  //     destination: MetroStation,
  //     message: string,
  //   ): Promise<void> {
  //     await this.initializeNotificationChannels();

  //     const notificationContent: Notifications.NotificationContentInput = {
  //       title: "🚇 Metro Alert - Intermediate Stop",
  //       body: message,
  //       data: {
  //         stationId: station.id,
  //         destinationId: destination.id,
  //         type: "intermediate",
  //       },
  //       sound: "default",
  //       categoryIdentifier: "metro-intermediate",
  //     };

  //     // Add Android-specific properties
  //     const androidContent = notificationContent as any;
  //     if (Platform.OS === "android") {
  //       androidContent.channelId = NotificationManagerImpl.METRO_CHANNEL_ID;
  //       androidContent.priority = "default";
  //     }

  //     await Notifications.scheduleNotificationAsync({
  //       identifier: NotificationManagerImpl.INTERMEDIATE_NOTIFICATION_ID,
  //       content: notificationContent,
  //       trigger: null,
  //     });

  //     // Short vibration for intermediate stops
  //     Vibration.vibrate(100);
  //   }

  //   async showTransferNotification(
  //     station: MetroStation,
  //     fromLine: MetroLine,
  //     toLine: MetroLine,
  //     message: string,
  //   ): Promise<void> {
  //     await this.initializeNotificationChannels();

  //     const notificationContent: Notifications.NotificationContentInput = {
  //       title: "🔄 Metro Transfer Required",
  //       body: message,
  //       data: {
  //         stationId: station.id,
  //         fromLineId: fromLine.id,
  //         toLineId: toLine.id,
  //         type: "transfer",
  //       },
  //       sound: "default",
  //       categoryIdentifier: "metro-transfer",
  //     };

  //     // Add Android-specific properties
  //     const androidContent = notificationContent as any;
  //     if (Platform.OS === "android") {
  //       androidContent.channelId = NotificationManagerImpl.METRO_CHANNEL_ID;
  //       androidContent.priority = "default";
  //     }

  //     await Notifications.scheduleNotificationAsync({
  //       identifier: NotificationManagerImpl.TRANSFER_NOTIFICATION_ID,
  //       content: notificationContent,
  //       trigger: null,
  //     });

  //     // Medium vibration for transfers
  //     Vibration.vibrate(200);
  //   }

  //   async showMetroRouteNotification(
  //     route: any,
  //     currentDistance: number,
  //   ): Promise<void> {
  //     await this.initializeNotificationChannels();

  //     const distanceText =
  //       currentDistance >= 1000
  //         ? `${(currentDistance / 1000).toFixed(1)} km`
  //         : `${Math.round(currentDistance)} m`;

  //     const transferText =
  //       route.transfers.length > 0
  //         ? ` • ${route.transfers.length} transfer${route.transfers.length > 1 ? "s" : ""}`
  //         : "";

  //     const notificationContent: Notifications.NotificationContentInput = {
  //       title: "🚇 Metro Route Active",
  //       body: `${distanceText} to ${route.destination.name}${transferText}`,
  //       data: {
  //         routeId: route.id,
  //         distance: currentDistance,
  //         type: "metro-route",
  //       },
  //       sound: false,
  //       sticky: true,
  //       categoryIdentifier: "metro-route",
  //     };

  //     // Add Android-specific properties
  //     const androidContent = notificationContent as any;
  //     if (Platform.OS === "android") {
  //       androidContent.channelId = NotificationManagerImpl.PERSISTENT_CHANNEL_ID;
  //       androidContent.priority = "low";
  //     }

  //     await Notifications.scheduleNotificationAsync({
  //       identifier: NotificationManagerImpl.METRO_ROUTE_NOTIFICATION_ID,
  //       content: notificationContent,
  //       trigger: null,
  //     });
  //   }
}

// Export singleton instance
export const notificationManager = new NotificationManagerImpl();

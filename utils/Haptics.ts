import * as Haptics from "expo-haptics";

const noop = () => {};

export const haptics = {
  selection: () => {
    void Haptics.selectionAsync().catch(noop);
  },
  light: () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(noop);
  },
  medium: () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(noop);
  },
  heavy: () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(noop);
  },
  success: () => {
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(noop);
  },
  warning: () => {
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning,
    ).catch(noop);
  },
  error: () => {
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Error,
    ).catch(noop);
  },
};

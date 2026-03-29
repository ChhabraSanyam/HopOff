// Reusable themed confirmation modal matching the app's red gradient design
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      {/* Dim overlay */}
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Buttons */}
          <View style={styles.buttonRow}>
            {onCancel && (
              <>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onCancel}
                >
                  <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
                </TouchableOpacity>

                <View style={styles.buttonSeparator} />
              </>
            )}

            <TouchableOpacity
              style={[
                styles.confirmButton,
                destructive && styles.destructiveButton,
              ]}
              onPress={onConfirm}
            >
              <Text
                style={[
                  styles.confirmButtonText,
                  destructive && styles.destructiveButtonText,
                ]}
              >
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  card: {
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(132, 42, 42, 0.74)",
    backgroundColor: "rgba(112, 33, 33, 0.95)",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "rgba(255,255,255,0.78)",
    textAlign: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  buttonRow: {
    flexDirection: "row",
  },
  buttonSeparator: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#e9e9e9ff",
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 16,
    color: "#fafafaff",
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  destructiveButton: {},
  destructiveButtonText: {
    color: "#ff6b6b",
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
});

export default ConfirmModal;

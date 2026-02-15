import { Ionicons } from "@expo/vector-icons";
import React, { Component, ErrorInfo, ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console in development
    if (__DEV__) {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you would send this to a crash reporting service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Ionicons name="warning-outline" size={64} color="#FF6B6B" />
            <Text style={styles.title}>Oops! Something went wrong</Text>
            <Text style={styles.message}>
              We&apos;re sorry, but something unexpected happened. Please try
              again.
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={this.handleRetry}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>

            {__DEV__ && this.state.error && (
              <ScrollView style={styles.errorDetails}>
                <Text style={styles.errorTitle}>
                  Error Details (Development Only):
                </Text>
                <Text style={styles.errorText}>
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo && (
                  <Text style={styles.errorText}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    alignItems: "center",
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1c1c1e",
    marginTop: 20,
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#8e8e93",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  errorDetails: {
    maxHeight: 200,
    width: "100%",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 12,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#d32f2f",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: "#666",
    fontFamily: "monospace",
  },
});

export default ErrorBoundary;

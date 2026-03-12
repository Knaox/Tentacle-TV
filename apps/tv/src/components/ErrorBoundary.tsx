import React from "react";
import { View, Text } from "react-native";
import { Colors } from "../theme/colors";
import { Focusable } from "./focus/Focusable";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{
          flex: 1, justifyContent: "center", alignItems: "center",
          backgroundColor: Colors.bgDeep, padding: 40,
        }}>
          <Text style={{ color: Colors.textPrimary, fontSize: 24, fontWeight: "700", marginBottom: 12 }}>
            Something went wrong
          </Text>
          <Text style={{ color: Colors.textSecondary, fontSize: 15, textAlign: "center", marginBottom: 28 }}>
            {this.state.error?.message ?? "An unexpected error occurred."}
          </Text>
          <Focusable variant="button" onPress={this.handleRetry} hasTVPreferredFocus>
            <View style={{
              backgroundColor: Colors.accentPurple,
              paddingHorizontal: 28, paddingVertical: 12,
              borderRadius: 10,
            }}>
              <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: "600" }}>
                Retry
              </Text>
            </View>
          </Focusable>
        </View>
      );
    }
    return this.props.children;
  }
}

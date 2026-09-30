import React from "react";
import { View, Text } from "react-native";
import { Colors } from "../theme/colors";
import { Focusable } from "./focus/Focusable";
import { Button } from "../theme/buttons";
import type { RouteLike } from "../navigation/routeRailKey";
import { REDESIGN_ACTIVE } from "../redesignWiring/redesignGate";
import { ScreenErrorRedesign } from "../redesignWiring/overlays/ScreenErrorRedesign";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** La route de l'écran enveloppé (frontière par écran) ; absente à la
   *  racine de l'app, hors de toute navigation. */
  route?: RouteLike;
}

/**
 * La frontière d'erreur — autour de l'app et de chaque écran. Sur Apple TV,
 * ce qui remplace l'écran tombé est celui de la refonte
 * (`ScreenErrorRedesign`, textes traduits, navigation gardée) ; Android TV
 * garde l'ancien.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && REDESIGN_ACTIVE) {
      return <ScreenErrorRedesign error={this.state.error} route={this.props.route} onRetry={this.handleRetry} />;
    }
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
          <Focusable variant="button" focusRadius={Button.medium.borderRadius} onPress={this.handleRetry} hasTVPreferredFocus>
            <View style={{
              backgroundColor: Colors.accentPurple,
              paddingHorizontal: 28, paddingVertical: 12,
              ...Button.medium,
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

import React from "react";
import { Appearance, Text, TouchableOpacity, View } from "react-native";
import i18next from "i18next";

import { buildDarkPalette } from "@/theme/palette.dark";
import { buildLightPalette } from "@/theme/palette.light";
import type { ThemePalette } from "@/theme/palette.types";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Filet de sécurité racine — monté AU-DESSUS du ThemeProvider, donc sans
 * accès aux hooks de thème. Le scheme est lu impérativement via
 * `Appearance.getColorScheme()` au render (le mode utilisateur est déjà
 * répercuté au niveau OS par Appearance.setColorScheme) et la palette
 * construite par les builders partagés — aucun littéral couleur ici.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const palette: ThemePalette =
        Appearance.getColorScheme() === "light" ? buildLightPalette() : buildDarkPalette();

      return (
        <View
          style={{
            flex: 1,
            backgroundColor: palette.surface.s0,
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <Text
            style={{
              color: palette.text.primary,
              fontSize: 20,
              fontWeight: "600",
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            {i18next.t("errors:unexpectedError")}
          </Text>
          {__DEV__ && this.state.error && (
            <Text
              style={{
                color: palette.text.tertiary,
                fontSize: 14,
                marginBottom: 24,
                textAlign: "center",
              }}
            >
              {this.state.error.message}
            </Text>
          )}
          <TouchableOpacity
            style={{
              backgroundColor: palette.brand.violet,
              paddingHorizontal: 32,
              paddingVertical: 12,
              borderRadius: 8,
            }}
            onPress={this.handleRetry}
          >
            <Text style={{ color: palette.cta.brandFg, fontSize: 16, fontWeight: "600" }}>
              {i18next.t("common:retry")}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

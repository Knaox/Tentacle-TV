import React from "react";
import type { RouteLike } from "../navigation/routeRailKey";
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
 * La frontière d'erreur — autour de l'app et de chaque écran. Ce qui remplace
 * l'écran tombé est celui de la refonte (`ScreenErrorRedesign`, textes
 * traduits, navigation gardée).
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
    if (this.state.hasError) {
      return <ScreenErrorRedesign error={this.state.error} route={this.props.route} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

import { Component, type ErrorInfo, type ReactNode } from "react";
import { describeProblem, problemDetails } from "@tentacle-tv/shared";
import { PageProblem } from "./PageProblem";

/**
 * Le filet de toute l'application : une exception de rendu ne laisse plus un
 * écran vide. La pieuvre dit qu'une erreur inattendue est survenue, propose
 * de recharger, et garde le message replié sous « Détails » (avec « Copier »)
 * pour l'administrateur. Seul `vite:preloadError` avait un repli avant lui.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Tentacle] rendu interrompu", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const model = describeProblem({
      cause: "unknown",
      context: "page",
      availability: { canGoBack: false },
      details: problemDetails({ message: `${error.name}: ${error.message}` }),
    });
    return <PageProblem fullScreen model={model} onAction={() => window.location.reload()} />;
  }
}

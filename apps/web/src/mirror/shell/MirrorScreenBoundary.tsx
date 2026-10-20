import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { describeProblem, problemDetails, type ProblemActionKey } from "@tentacle-tv/shared";
import { PageProblem } from "../../components/problems/PageProblem";

interface BoundaryProps {
  children: ReactNode;
  onBack: () => void;
}

/**
 * Le filet d'UN écran du web étroit — `ScreenErrorBoundary` du mobile
 * (session erreurs-mobile) : un écran qui plante cède la place à « Cet écran
 * n'a pas pu s'afficher » (cause partagée `renderCrash` : Réessayer · Retour),
 * et la barre d'onglets, l'en-tête et le reste continuent. Le filet de toute
 * l'application (`AppErrorBoundary`) reste dessous.
 */
class ScreenBoundary extends Component<BoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Tentacle] écran interrompu", error, info.componentStack);
  }

  private onAction = (key: ProblemActionKey) => {
    if (key === "back") this.props.onBack();
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const model = describeProblem({
      cause: "renderCrash",
      context: "screen",
      details: problemDetails({ message: `${error.name}: ${error.message}` }),
    });
    return <PageProblem model={model} onAction={this.onAction} />;
  }
}

/** Une limite par écran : la clé (le chemin) la remet à zéro quand on change d'écran. */
export function MirrorScreenBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <ScreenBoundary key={pathname} onBack={() => navigate(-1)}>
      {children}
    </ScreenBoundary>
  );
}

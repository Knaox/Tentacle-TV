import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { ScreenErrorTv } from "./ScreenErrorTv";
import { recordScreenError } from "./screenErrorLog";
import { followLocation, type ErrorScreenState } from "./screenErrorReset";

interface BoundaryProps {
  /** Change à chaque navigation : c'est ce qui referme l'écran de reprise. */
  resetKey: string;
  children: ReactNode;
}

type BoundaryState = ErrorScreenState;

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/**
 * La frontière d'erreur des écrans du téléviseur.
 *
 * **Sans elle, la moindre exception éteignait tout.** React 19 démonte l'arbre
 * ENTIER quand une erreur de rendu ou d'effet ne rencontre aucune frontière — et
 * le client n'en avait aucune. Un module de page introuvable, une donnée
 * inattendue : fond noir, rail compris, et le routeur démonté avec le reste.
 * « Retour » changeait alors l'adresse sans que rien ne se redessine — mesuré au
 * simulateur, `#root` vide après le retour. Seul un redémarrage de
 * l'application en sortait.
 *
 * Posée SOUS le routeur, elle garde l'historique vivant : un retour change
 * `location.key`, la frontière se referme et l'écran précédent revient. Deux
 * exemplaires : l'un autour de l'application, l'autre autour du contenu de la
 * disposition, qui laisse le rail utilisable pendant qu'un écran de catalogue
 * est en échec.
 *
 * C'est une classe, et c'est la seule exception à la règle des composants
 * fonctionnels : React n'offre toujours aucun équivalent en fonction pour
 * `getDerivedStateFromError`.
 */
class Boundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null, errorKey: null };

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { error: asError(error) };
  }

  /** On ne referme que sur une navigation POSTÉRIEURE à l'erreur (cf. `followLocation`). */
  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
    return followLocation(state, props.resetKey);
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    recordScreenError(asError(error), info.componentStack);
  }

  private readonly retry = (): void => {
    this.setState({ error: null, errorKey: null });
  };

  render(): ReactNode {
    if (this.state.error) return <ScreenErrorTv error={this.state.error} onRetry={this.retry} />;
    return this.props.children;
  }
}

export function ScreenErrorBoundaryTv({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <Boundary resetKey={location.key}>{children}</Boundary>;
}

import React, { type ReactElement, type ReactNode } from "react";
import {
  describeProblem, problemDetails,
  type ProblemActionKey, type ProblemModel,
} from "@tentacle-tv/shared";
import { recordProblem } from "@/problems/problemJournalStore";
import { ProblemState } from "./ProblemState";

interface Props {
  children: ReactNode;
  /** L'écran (nom de la route) : il entre au journal, jamais ses paramètres. */
  screen?: string;
  /** Revenir à l'écran d'avant ; absent : seul « Réessayer » est offert. */
  onBack?: () => void;
}

interface State {
  model: ProblemModel | null;
}

/**
 * La limite d'erreur d'UN écran : un écran qui plante en se dessinant ne
 * devient jamais une page blanche ni un arrêt de l'app. Il cède la place au
 * message commun (« Cet écran n'a pas pu s'afficher », la pieuvre, Réessayer,
 * Retour) ; les autres écrans de la pile et la barre d'onglets continuent.
 * Le message brut et la pile restent hors de l'écran : seul le message,
 * repliable sous « Détails », et le code du support. Posée sur chaque écran
 * par `screenLayout` (`withScreenBoundary`).
 */
export class ScreenErrorBoundary extends React.Component<Props, State> {
  state: State = { model: null };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return {
      model: describeProblem({
        cause: "renderCrash",
        context: "screen",
        details: problemDetails({ message }),
      }),
    };
  }

  componentDidCatch(error: unknown): void {
    if (this.state.model) recordProblem(this.state.model, { screen: this.props.screen });
    if (__DEV__) console.error("[ScreenErrorBoundary]", this.props.screen, error);
  }

  private handleAction = (key: ProblemActionKey) => {
    if (key === "back" && this.props.onBack) {
      this.props.onBack();
      return;
    }
    this.setState({ model: null });
  };

  render() {
    const { model } = this.state;
    if (!model) return this.props.children;
    const shown = this.props.onBack ? model : describeProblem({
      cause: model.cause, context: model.context, details: model.details, availability: { canGoBack: false },
    });
    return <ProblemState model={shown} onAction={this.handleAction} />;
  }
}

interface LayoutArgs {
  route: { name: string; key: string };
  navigation: { canGoBack(): boolean; goBack(): void };
  children: ReactElement;
}

/**
 * Le `screenLayout` d'un navigateur (pile, onglets) : chaque écran dans sa
 * propre limite d'erreur. La clé de route la remet à zéro pour un nouvel écran.
 */
export function withScreenBoundary({ route, navigation, children }: LayoutArgs): ReactElement {
  return (
    <ScreenErrorBoundary
      key={route.key}
      screen={route.name}
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
    >
      {children}
    </ScreenErrorBoundary>
  );
}

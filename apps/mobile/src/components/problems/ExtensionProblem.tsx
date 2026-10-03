import { memo, useMemo } from "react";
import {
  describeProblem, problemDetails, problemFromError, type ProblemActionKey,
} from "@tentacle-tv/shared";
import { ProblemState } from "./ProblemState";

interface Props {
  /**
   * `crashed` : la page de l'extension a planté (pont, processus de rendu) ;
   * `missing` : l'extension n'est plus active ; `load` : son code n'a pas pu
   * être chargé (l'erreur dit pourquoi).
   */
  kind: "crashed" | "missing" | "load";
  error?: unknown;
  /** Le message brut du plantage, pour « Détails ». */
  detail?: string;
  onRetry?: () => void;
  /** Un écran empilé : « Retour » est offert, et passe par `onAction`. */
  canGoBack?: boolean;
  onAction?: (key: ProblemActionKey) => void;
}

/**
 * Une page d'extension qui ne s'affiche pas — le modèle commun, comme toute
 * page : « Cette extension ne s'affiche pas », pourquoi (plantage, désactivée,
 * serveur muet), Réessayer quand c'est possible, et le message brut replié.
 * Fini les « Plugin crashed » et les « Failed to load plugin » en dur.
 */
export const ExtensionProblem = memo(function ExtensionProblem({ kind, error, detail, onRetry, canGoBack = false, onAction }: Props) {
  const model = useMemo(() => {
    const availability = { canGoBack, canRetry: kind !== "missing" };
    if (kind === "load") return problemFromError(error, { target: "extension", context: "extension", availability });
    return describeProblem({
      cause: kind === "missing" ? "extensionMissing" : "unknown",
      context: "extension",
      availability,
      details: detail ? problemDetails({ message: detail }) : [],
    });
  }, [kind, error, detail, canGoBack]);
  return <ProblemState model={model} onAction={(key) => (key === "retry" ? onRetry?.() : onAction?.(key))} />;
});

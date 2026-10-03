import { memo, useMemo } from "react";
import {
  problemDetails, problemFromError, rawFromError,
  type FailureTarget, type ProblemActionKey, type ProblemAvailability, type ProblemModel,
} from "@tentacle-tv/shared";
import { CryingTentacle } from "../CryingTentacle";
import { ProblemPanel } from "./ProblemPanel";

/**
 * Le message d'une page qui n'a pas pu se charger, composé de son erreur :
 * la cause dite en mots (fiche retirée, serveur muet, session expirée…), les
 * gestes possibles ici, et les détails (statut, message) repliés.
 */
export function usePageProblemModel(
  error: unknown,
  options: { target?: FailureTarget; availability?: ProblemAvailability } = {},
): ProblemModel | null {
  const target = options.target ?? "relayed";
  const key = JSON.stringify(options.availability ?? {});
  return useMemo(() => {
    if (!error) return null;
    const raw = rawFromError(error, target);
    const model = problemFromError(error, { target, context: "page", availability: options.availability });
    return { ...model, details: problemDetails({ status: raw.status, message: raw.message }) };
  }, [error, target, key]); // eslint-disable-line react-hooks/exhaustive-deps
}

interface Props {
  model: ProblemModel;
  onAction: (key: ProblemActionKey) => void;
  busy?: ProblemActionKey | null;
  /** Plein écran (une page entière) ; sinon dans la page, sous son en-tête. */
  fullScreen?: boolean;
}

/**
 * Une page qui n'a pas pu s'afficher — comme l'écran d'erreur de l'Apple TV
 * et du mobile : la pieuvre qui pleure, puis le message (quoi, pourquoi, quoi
 * faire, détails), centré, à largeur de lecture. Jamais une page blanche, vide
 * ou qui charge pour toujours. Le geste principal prend le focus (clavier,
 * télécommande).
 */
export const PageProblem = memo(function PageProblem({ model, onAction, busy = null, fullScreen = false }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center gap-5 px-6 py-16 ${fullScreen ? "min-h-screen bg-surface-0" : "min-h-[60vh]"}`}>
      <div aria-hidden="true">
        <CryingTentacle size={96} />
      </div>
      <ProblemPanel model={model} tone="page" center onAction={onAction} busy={busy} showIcon={false} autoFocus />
    </div>
  );
});

/**
 * Une liste qui n'a pas pu se charger (Ma liste, favoris, recherche) : sa
 * cause, « Réessayer », et rien d'autre — c'est un onglet, il n'y a nulle
 * part où revenir. Avant, l'échec ressemblait à une liste vide.
 */
export function QueryProblem({ error, target, retrying, onRetry }: {
  error: unknown;
  target?: FailureTarget;
  retrying: boolean;
  onRetry: () => void;
}) {
  const model = usePageProblemModel(error, { target, availability: { canGoBack: false } });
  if (!model) return null;
  return <PageProblem model={model} busy={retrying ? "retry" : null} onAction={(key) => key === "retry" && onRetry()} />;
}
